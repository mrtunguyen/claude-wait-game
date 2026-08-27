#!/usr/bin/env node
/**
 * Dependency-free test suite. Run with: npm test
 *
 * Covers the parts that can break silently: hook install/uninstall against a
 * real settings file, the local hook server's event handling, and the stats store.
 */
const assert = require('assert');
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const Module = require('module');

const ROOT = path.join(__dirname, '..');
let passed = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    failures.push({ name, err });
    console.log(`  FAIL ${name}\n       ${err.message}`);
  }
}

function tmpFile(contents) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'cwg-')), 'settings.json');
  if (contents !== undefined) fs.writeFileSync(p, contents);
  return p;
}

(async () => {
  console.log('\nsyntax');
  const sources = [
    'src/main.js', 'src/preload.js', 'src/hooks.js',
    'src/renderer/app.js', 'src/renderer/stats.js',
    'src/renderer/games/snake.js', 'src/renderer/games/trivia.js', 'src/renderer/games/memory.js',
    'scripts/install-hooks.js', 'scripts/make-icon.js'
  ];
  for (const rel of sources) {
    await test(rel, () => {
      execFileSync(process.execPath, ['--check', path.join(ROOT, rel)], { stdio: 'pipe' });
    });
  }

  console.log('\nhooks');
  const hooks = require(path.join(ROOT, 'src/hooks.js'));

  await test('installs all four hooks', () => {
    const p = tmpFile('{}');
    const res = hooks.apply({ settingsPath: p, port: 45872 });
    assert.ok(res.ok, res.error);
    const st = hooks.status({ settingsPath: p });
    assert.strictEqual(st.installed, true);
    assert.strictEqual(st.port, 45872);
    assert.deepStrictEqual(st.hooks.sort(), ['Notification', 'PreToolUse', 'Stop', 'UserPromptSubmit']);
  });

  await test('preserves unrelated user hooks and settings', () => {
    const p = tmpFile(JSON.stringify({
      model: 'opus',
      hooks: { Stop: [{ hooks: [{ type: 'command', command: 'echo mine' }] }] }
    }));
    hooks.apply({ settingsPath: p });
    hooks.apply({ settingsPath: p, uninstall: true });
    const after = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.strictEqual(after.model, 'opus');
    assert.strictEqual(after.hooks.Stop.length, 1);
    assert.strictEqual(after.hooks.Stop[0].hooks[0].command, 'echo mine');
  });

  await test('install is idempotent', () => {
    const p = tmpFile('{}');
    hooks.apply({ settingsPath: p });
    hooks.apply({ settingsPath: p });
    hooks.apply({ settingsPath: p });
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const name of Object.keys(hooks.EVENTS)) {
      assert.strictEqual(s.hooks[name].length, 1, `${name} duplicated`);
    }
  });

  await test('uninstall leaves no trace in a clean file', () => {
    const p = tmpFile('{}');
    hooks.apply({ settingsPath: p });
    hooks.apply({ settingsPath: p, uninstall: true });
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    assert.ok(!('hooks' in s), 'hooks key should be gone');
    assert.strictEqual(hooks.status({ settingsPath: p }).installed, false);
  });

  await test('generates POSIX shell-form hooks on macOS/Linux', () => {
    const p = tmpFile('{}');
    hooks.apply({ settingsPath: p, platform: 'darwin' });
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    const h = s.hooks.UserPromptSubmit[0].hooks[0];
    assert.strictEqual(h.type, 'command');
    assert.ok(!('args' in h), 'POSIX hooks use shell form, not exec form');
    assert.match(h.command, /^curl /);
    assert.match(h.command, /event\/working/);
    assert.ok(h.command.includes('>/dev/null 2>&1 || true'), 'must silence output and never fail');
  });

  await test('generates shell-independent exec-form hooks on Windows', () => {
    const p = tmpFile('{}');
    hooks.apply({ settingsPath: p, platform: 'win32' });
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const [name, event] of Object.entries(hooks.EVENTS)) {
      const h = s.hooks[name][0].hooks[0];
      assert.strictEqual(h.command, 'cmd.exe', `${name} must not depend on the shell`);
      assert.ok(Array.isArray(h.args) && h.args[0] === '/c', `${name} must use exec form`);
      const line = h.args[1];
      assert.ok(line.includes(`/event/${event}`), `${name} posts to the wrong endpoint`);
      // POSIX-only syntax here would break under PowerShell
      assert.ok(!line.includes('/dev/null'), 'no POSIX device path');
      assert.ok(!line.includes('|| true'), 'no POSIX-only || true');
      assert.ok(line.includes('>NUL 2>&1'), 'response body must be discarded');
      assert.ok(line.includes('exit /b 0'), 'a closed app must not surface a hook error');
    }
  });

  await test('detects and removes Windows hooks it wrote', () => {
    const p = tmpFile('{}');
    hooks.apply({ settingsPath: p, port: 45872, platform: 'win32' });
    const st = hooks.status({ settingsPath: p });
    assert.strictEqual(st.installed, true, 'exec-form hooks must be recognized');
    assert.strictEqual(st.port, 45872, 'port must be read from exec-form args');
    hooks.apply({ settingsPath: p, uninstall: true, platform: 'win32' });
    assert.strictEqual(hooks.status({ settingsPath: p }).installed, false);
  });

  await test('reinstalling across platforms leaves exactly one hook each', () => {
    // e.g. hooks written by the CLI under WSL, then repaired from the Windows app
    const p = tmpFile('{}');
    hooks.apply({ settingsPath: p, platform: 'linux' });
    hooks.apply({ settingsPath: p, platform: 'win32' });
    const s = JSON.parse(fs.readFileSync(p, 'utf8'));
    for (const name of Object.keys(hooks.EVENTS)) {
      assert.strictEqual(s.hooks[name].length, 1, `${name} duplicated across platforms`);
      assert.strictEqual(s.hooks[name][0].hooks[0].command, 'cmd.exe');
    }
  });

  await test('reports a custom port', () => {
    const p = tmpFile('{}');
    hooks.apply({ settingsPath: p, port: 50123 });
    assert.strictEqual(hooks.status({ settingsPath: p }).port, 50123);
  });

  await test('refuses to clobber malformed JSON', () => {
    const p = tmpFile('{ this is not json');
    const res = hooks.apply({ settingsPath: p });
    assert.strictEqual(res.ok, false);
    assert.match(res.error, /Could not parse/);
    assert.strictEqual(fs.readFileSync(p, 'utf8'), '{ this is not json');
  });

  await test('creates the settings file when missing', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cwg-new-'));
    const p = path.join(dir, 'nested', 'settings.json');
    const res = hooks.apply({ settingsPath: p });
    assert.ok(res.ok, res.error);
    assert.strictEqual(hooks.status({ settingsPath: p }).installed, true);
  });

  console.log('\nhook server');
  // Load main.js against a stubbed electron so the HTTP server can be exercised.
  const sent = [];
  const fakeWin = {
    isDestroyed: () => false, isMinimized: () => false, isVisible: () => true,
    showInactive() {}, restore() {}, show() {}, hide() {}, focus() {},
    flashFrame() {}, setAlwaysOnTop() {}, loadFile() {},
    once(ev, cb) { if (ev === 'ready-to-show') cb(); }, on() {},
    webContents: { send: (ch, payload) => sent.push({ ch, payload }) }
  };
  const electronStub = {
    app: {
      requestSingleInstanceLock: () => true,
      whenReady: () => Promise.resolve(),
      on() {}, quit() {},
      getPath: () => fs.mkdtempSync(path.join(os.tmpdir(), 'cwg-userdata-'))
    },
    BrowserWindow: Object.assign(function () { return fakeWin; }, { getAllWindows: () => [fakeWin] }),
    Tray: function () { return { setToolTip() {}, setContextMenu() {}, on() {} }; },
    Menu: { buildFromTemplate: () => ({}) },
    ipcMain: { handle() {}, on() {} },
    nativeImage: { createFromDataURL: () => ({}) }
  };
  const origResolve = Module._resolveFilename;
  Module._resolveFilename = function (request, ...rest) {
    if (request === 'electron') return 'electron';
    return origResolve.call(this, request, ...rest);
  };
  require.cache['electron'] = { id: 'electron', filename: 'electron', loaded: true, exports: electronStub };

  const PORT = 45899;
  process.env.CLAUDE_WAIT_GAME_PORT = String(PORT);
  require(path.join(ROOT, 'src/main.js'));
  await new Promise((r) => setTimeout(r, 400));

  function post(urlPath, body) {
    return new Promise((resolve, reject) => {
      const req = http.request(
        { host: '127.0.0.1', port: PORT, path: urlPath, method: 'POST', headers: { 'Content-Type': 'application/json' } },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve({ status: res.statusCode, data }));
        }
      );
      req.on('error', reject);
      req.end(body);
    });
  }

  await test('accepts a working event and forwards the session id', async () => {
    sent.length = 0;
    const r = await post('/event/working', JSON.stringify({ session_id: 'abc', cwd: '/x' }));
    assert.strictEqual(r.status, 200);
    assert.strictEqual(sent[0].payload.status, 'working');
    assert.strictEqual(sent[0].payload.sessionId, 'abc');
  });

  await test('summarizes a tool call for the ticker', async () => {
    sent.length = 0;
    await post('/event/activity', JSON.stringify({
      tool_name: 'Edit', tool_input: { file_path: '/home/u/p/src/main.js', old_string: 'a', new_string: 'b' }
    }));
    assert.strictEqual(sent[0].payload.tool, 'Edit');
    assert.strictEqual(sent[0].payload.detail, '/home/u/p/src/main.js');
  });

  await test('summarizes a bash command', async () => {
    sent.length = 0;
    await post('/event/activity', JSON.stringify({
      tool_name: 'Bash', tool_input: { command: 'npm test -- --watch=false', description: 'Run tests' }
    }));
    assert.ok(sent[0].payload.detail.startsWith('npm test'));
  });

  await test('survives an oversized tool payload', async () => {
    sent.length = 0;
    const big = JSON.stringify({ tool_name: 'Write', tool_input: { file_path: '/x', content: 'z'.repeat(2 * 1024 * 1024) } });
    const r = await post('/event/activity', big);
    assert.strictEqual(r.status, 200);
    assert.strictEqual(sent[0].payload.status, 'activity');
  });

  await test('tolerates malformed JSON', async () => {
    const r = await post('/event/working', 'not-json{{{');
    assert.strictEqual(r.status, 200);
  });

  await test('rejects an unknown event', async () => {
    const r = await post('/event/bogus', '{}');
    assert.strictEqual(r.status, 400);
  });

  console.log('\nstats');
  await test('records waits, games and tools', () => {
    const store = {};
    global.localStorage = { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = v; } };
    global.window = {};
    delete require.cache[path.join(ROOT, 'src/renderer/stats.js')];
    require(path.join(ROOT, 'src/renderer/stats.js'));
    const S = global.window.WaitStats;
    S.recordWait(65000);
    S.recordWait(125000);
    S.recordWait(-5); // ignored
    S.recordGame('snake');
    S.recordGame('snake');
    S.recordGame('trivia');
    S.recordTools(23);
    const s = JSON.parse(store['stats:v1']);
    assert.strictEqual(s.totals.waits, 2);
    assert.strictEqual(s.totals.waitMs, 190000);
    assert.strictEqual(s.totals.longestMs, 125000);
    assert.strictEqual(s.totals.games, 3);
    assert.strictEqual(s.gamesByType.snake, 2);
    assert.strictEqual(s.totals.tools, 23);
    assert.strictEqual(S.fmtDuration(65000), '1m 5s');
    assert.strictEqual(S.fmtDuration(3723000), '1h 2m');
    assert.strictEqual(S.fmtDuration(42000), '42s');
  });

  console.log(`\n${passed} passed, ${failures.length} failed\n`);
  process.exit(failures.length ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
