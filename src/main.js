const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const http = require('http');
const path = require('path');
const fs = require('fs');
const hooks = require('./hooks');

const PORT = parseInt(process.env.CLAUDE_WAIT_GAME_PORT || '45872', 10);
const HOST = '127.0.0.1';

let win = null;
let tray = null;
let settings = {
  alwaysOnTop: true,
  popupOnWorking: true,
  hideOnDone: false,
  soundOnDone: true
};

const settingsPath = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try {
    settings = { ...settings, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) };
  } catch {
    // first run, defaults are fine
  }
}

function saveSettings() {
  try {
    fs.writeFileSync(settingsPath(), JSON.stringify(settings, null, 2));
  } catch {
    // non-fatal
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 440,
    height: 680,
    minWidth: 380,
    minHeight: 560,
    show: false,
    title: 'Claude Wait Game',
    backgroundColor: '#12121a',
    alwaysOnTop: settings.alwaysOnTop,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  win.once('ready-to-show', () => win.show());

  // Closing the window keeps the app alive in the tray so hooks can still wake it.
  win.on('close', (e) => {
    if (!app.isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });
}

function sendToRenderer(channel, payload) {
  if (win && !win.isDestroyed()) {
    win.webContents.send(channel, payload);
  }
}

function popUp() {
  if (!win || win.isDestroyed()) return;
  if (win.isMinimized()) win.restore();
  // showInactive keeps focus in the terminal so the user can keep typing,
  // but the game window becomes visible next to it.
  if (!win.isVisible()) win.showInactive();
  if (settings.alwaysOnTop) win.setAlwaysOnTop(true, 'floating');
}

// Boil a PreToolUse payload down to one short human-readable detail string.
function summarizeToolInput(input) {
  if (!input || typeof input !== 'object') return '';
  const detail =
    input.file_path ||
    input.notebook_path ||
    input.path ||
    input.command ||
    input.pattern ||
    input.query ||
    input.url ||
    input.description ||
    '';
  return String(detail).slice(0, 120);
}

function handleClaudeEvent(event, body) {
  switch (event) {
    case 'working':
      if (settings.popupOnWorking) popUp();
      sendToRenderer('claude-status', { status: 'working', ...body });
      break;
    case 'done':
      sendToRenderer('claude-status', { status: 'done', ...body });
      if (win && !win.isDestroyed()) win.flashFrame(true);
      if (settings.hideOnDone) {
        setTimeout(() => {
          if (win && !win.isDestroyed() && win.isVisible()) win.hide();
        }, 4000);
      }
      break;
    case 'notification':
      // Claude needs attention (permission prompt, idle reminder, ...)
      popUp();
      sendToRenderer('claude-status', { status: 'attention', ...body });
      if (win && !win.isDestroyed()) win.flashFrame(true);
      break;
    case 'activity':
      // Claude is about to run a tool — feed the live ticker.
      sendToRenderer('claude-status', {
        status: 'activity',
        tool: body.tool,
        detail: body.detail,
        sessionId: body.sessionId
      });
      break;
    default:
      return false;
  }
  return true;
}

// Tiny local HTTP server: Claude Code hooks POST here to drive the window.
function startHookServer() {
  const server = http.createServer((req, res) => {
    const match = /^\/event\/([a-z-]+)$/.exec(req.url || '');
    if (req.method !== 'POST' || !match) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const LIMIT = 1024 * 1024; // Write/Edit tool payloads can be large
    let raw = '';
    let truncated = false;
    req.on('data', (chunk) => {
      if (truncated) return; // keep draining so 'end' still fires
      raw += chunk;
      if (raw.length > LIMIT) {
        truncated = true;
        raw = '';
      }
    });
    req.on('end', () => {
      let body = {};
      try {
        body = raw ? JSON.parse(raw) : {};
      } catch {
        body = {};
      }
      const ok = handleClaudeEvent(match[1], {
        sessionId: body.session_id,
        message: body.message,
        cwd: body.cwd,
        tool: typeof body.tool_name === 'string' ? body.tool_name.slice(0, 60) : undefined,
        detail: summarizeToolInput(body.tool_input)
      });
      res.writeHead(ok ? 200 : 400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok }));
    });
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} is already in use — is another instance running?`);
    } else {
      console.error('Hook server error:', err.message);
    }
  });

  server.listen(PORT, HOST, () => {
    console.log(`claude-wait-game listening for hooks on http://${HOST}:${PORT}`);
  });
}

function createTray() {
  // 16x16 dot icon drawn as a data URL so we ship no binary assets.
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAaElEQVQ4y2NgGAWDHzAyMDD8x4EZ8ZnMhMSGKcAlxoTNRHRDcBnOhMtGdMOwOZURlwHINuAyGKcT0Q3AZzDBQCTkbSZChhKKHRZChjIS4VUmYqOSCZcgIS8y4kn3jMSmbEZ8mkfBIAcAdlkTKcSSKKcAAAAASUVORK5CYII='
  );
  tray = new Tray(icon);
  tray.setToolTip('Claude Wait Game');
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show', click: () => { if (win) { win.show(); win.focus(); } } },
      { type: 'separator' },
      {
        label: 'Quit',
        click: () => {
          app.isQuitting = true;
          app.quit();
        }
      }
    ])
  );
  tray.on('click', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      win.show();
      win.focus();
    }
  });

  app.whenReady().then(() => {
    loadSettings();
    createWindow();
    createTray();
    startHookServer();

    ipcMain.handle('get-settings', () => settings);
    ipcMain.handle('set-setting', (_e, key, value) => {
      if (!(key in settings)) return settings;
      settings[key] = value;
      if (key === 'alwaysOnTop' && win && !win.isDestroyed()) {
        win.setAlwaysOnTop(!!value, 'floating');
      }
      saveSettings();
      return settings;
    });
    // Hook management from the app's Settings screen — so people who install
    // from a release never need the repo or a terminal to connect to Claude Code.
    ipcMain.handle('hooks-status', () => hooks.status());
    ipcMain.handle('hooks-install', () => hooks.apply({ port: PORT }));
    ipcMain.handle('hooks-uninstall', () => hooks.apply({ port: PORT, uninstall: true }));

    ipcMain.on('stop-flash', () => {
      if (win && !win.isDestroyed()) win.flashFrame(false);
    });

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
      else if (win) win.show();
    });
  });

  app.on('before-quit', () => {
    app.isQuitting = true;
  });

  app.on('window-all-closed', () => {
    // Stay alive in the tray on all platforms; quit only from the tray menu.
  });
}
