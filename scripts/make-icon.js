#!/usr/bin/env node
/**
 * Generates build/icon.png (512x512) with no image dependencies.
 * electron-builder derives the .ico / .icns / Linux icons from this file.
 *
 * Design: rounded-square dark panel, warm accent "wait" ring with a gap,
 * and a small snake-like pixel trail — the app in one glyph.
 */
const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

const SIZE = 512;

function crc32(buf) {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

// --- draw into an RGBA buffer ---
const px = Buffer.alloc(SIZE * SIZE * 4, 0);

function set(x, y, r, g, b, a) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return;
  const i = (y * SIZE + x) * 4;
  const srcA = a / 255;
  const dstA = px[i + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA === 0) return;
  px[i] = Math.round((r * srcA + px[i] * dstA * (1 - srcA)) / outA);
  px[i + 1] = Math.round((g * srcA + px[i + 1] * dstA * (1 - srcA)) / outA);
  px[i + 2] = Math.round((b * srcA + px[i + 2] * dstA * (1 - srcA)) / outA);
  px[i + 3] = Math.round(outA * 255);
}

// supersampled coverage helper: fn(x, y) -> true if inside
function fill(color, inside) {
  const [r, g, b] = color;
  const S = 3; // 3x3 supersample
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      let hits = 0;
      for (let sy = 0; sy < S; sy++) {
        for (let sx = 0; sx < S; sx++) {
          if (inside(x + (sx + 0.5) / S, y + (sy + 0.5) / S)) hits++;
        }
      }
      if (hits) set(x, y, r, g, b, Math.round((hits / (S * S)) * 255));
    }
  }
}

const C = SIZE / 2;

// 1. rounded-square background panel
const PAD = 26;
const RADIUS = 108;
fill([28, 28, 40], (x, y) => {
  const lo = PAD, hi = SIZE - PAD;
  if (x < lo || x > hi || y < lo || y > hi) return false;
  const cx = Math.min(Math.max(x, lo + RADIUS), hi - RADIUS);
  const cy = Math.min(Math.max(y, lo + RADIUS), hi - RADIUS);
  const dx = x - cx, dy = y - cy;
  return dx * dx + dy * dy <= RADIUS * RADIUS;
});

// 2. accent ring with a gap at the top-right (a "still working" spinner)
const R_OUT = 150, R_IN = 118;
fill([217, 119, 87], (x, y) => {
  const dx = x - C, dy = y - C;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d < R_IN || d > R_OUT) return false;
  // gap: angle from -20deg to 70deg (screen coords, y down)
  const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
  return !(ang > -75 && ang < 15);
});

// 3. snake trail: three rounded squares stepping toward a food dot
const CELL = 46;
function roundRect(cx, cy, half, rad, color) {
  fill(color, (x, y) => {
    const lo_x = cx - half, hi_x = cx + half, lo_y = cy - half, hi_y = cy + half;
    if (x < lo_x || x > hi_x || y < lo_y || y > hi_y) return false;
    const qx = Math.min(Math.max(x, lo_x + rad), hi_x - rad);
    const qy = Math.min(Math.max(y, lo_y + rad), hi_y - rad);
    const dx = x - qx, dy = y - qy;
    return dx * dx + dy * dy <= rad * rad;
  });
}

roundRect(C - CELL, C + CELL * 0.5, 21, 7, [74, 222, 128]);
roundRect(C, C + CELL * 0.5, 21, 7, [74, 222, 128]);
roundRect(C, C - CELL * 0.5, 21, 7, [165, 243, 180]);

// food dot
fill([217, 119, 87], (x, y) => {
  const dx = x - (C + CELL), dy = y - (C - CELL * 0.5);
  return dx * dx + dy * dy <= 18 * 18;
});

// --- encode PNG ---
const rows = [];
for (let y = 0; y < SIZE; y++) {
  rows.push(Buffer.from([0])); // filter: none
  rows.push(px.subarray(y * SIZE * 4, (y + 1) * SIZE * 4));
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8;  // bit depth
ihdr[9] = 6;  // RGBA
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', zlib.deflateSync(Buffer.concat(rows), { level: 9 })),
  chunk('IEND', Buffer.alloc(0))
]);

const out = path.join(__dirname, '..', 'build', 'icon.png');
fs.writeFileSync(out, png);
console.log(`wrote ${out} (${SIZE}x${SIZE}, ${png.length} bytes)`);
