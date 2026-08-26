#!/usr/bin/env node
/**
 * Installs (or removes) the Claude Code hooks that drive the wait-game window.
 *
 * Adds three hooks to ~/.claude/settings.json:
 *   - UserPromptSubmit -> POST /event/working  (you sent a prompt, Claude starts working)
 *   - Stop             -> POST /event/done     (Claude finished responding)
 *   - Notification     -> POST /event/notification (Claude needs attention/permission)
 *
 * The hooks are plain curl calls to the app's local server (127.0.0.1:45872 by
 * default) and fail silently when the app isn't running, so they never slow
 * down or break a Claude session.
 *
 * Usage:
 *   node scripts/install-hooks.js [--port 45872] [--settings /path/to/settings.json]
 *   node scripts/install-hooks.js --uninstall
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const MARKER = 'claude-wait-game';

function parseArgs(argv) {
  const args = { uninstall: false, port: 45872, settings: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--uninstall') args.uninstall = true;
    else if (a === '--port') args.port = parseInt(argv[++i], 10);
    else if (a === '--settings') args.settings = argv[++i];
    else if (a === '--help' || a === '-h') {
      console.log('Usage: node scripts/install-hooks.js [--port N] [--settings PATH] [--uninstall]');
      process.exit(0);
    } else {
      console.error('Unknown argument: ' + a);
      process.exit(1);
    }
  }
  if (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535) {
    console.error('Invalid --port value');
    process.exit(1);
  }
  return args;
}

function hookCommand(port, event) {
  // --data-binary @- forwards Claude's hook JSON (session_id, cwd, message, ...)
  // to the app. `|| true` + short timeouts: never block Claude if the app is closed.
  return (
    `curl -s -m 2 --connect-timeout 1 -X POST -H "Content-Type: application/json" ` +
    `--data-binary @- http://127.0.0.1:${port}/event/${event} >/dev/null 2>&1 || true` +
    ` # ${MARKER}`
  );
}

function isOurs(entry) {
  return (
    entry &&
    Array.isArray(entry.hooks) &&
    entry.hooks.some((h) => typeof h.command === 'string' && h.command.includes(MARKER))
  );
}

function main() {
  const args = parseArgs(process.argv);
  const settingsPath =
    args.settings || path.join(os.homedir(), '.claude', 'settings.json');

  let settings = {};
  if (fs.existsSync(settingsPath)) {
    const raw = fs.readFileSync(settingsPath, 'utf8').trim();
    if (raw) {
      try {
        settings = JSON.parse(raw);
      } catch (err) {
        console.error(`Could not parse ${settingsPath}: ${err.message}`);
        console.error('Fix the JSON manually and re-run.');
        process.exit(1);
      }
    }
    // keep a one-shot backup before we touch anything
    fs.copyFileSync(settingsPath, settingsPath + '.bak');
    console.log(`Backed up existing settings to ${settingsPath}.bak`);
  } else {
    fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
  }

  settings.hooks = settings.hooks || {};

  const events = {
    UserPromptSubmit: 'working',
    Stop: 'done',
    Notification: 'notification'
  };

  for (const [hookName, appEvent] of Object.entries(events)) {
    const list = Array.isArray(settings.hooks[hookName]) ? settings.hooks[hookName] : [];
    // always strip our previous entries first (idempotent install / clean uninstall)
    const kept = list.filter((entry) => !isOurs(entry));

    if (!args.uninstall) {
      kept.push({
        hooks: [{ type: 'command', command: hookCommand(args.port, appEvent) }]
      });
    }

    if (kept.length > 0) settings.hooks[hookName] = kept;
    else delete settings.hooks[hookName];
  }

  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');

  if (args.uninstall) {
    console.log(`Removed claude-wait-game hooks from ${settingsPath}`);
  } else {
    console.log(`Installed claude-wait-game hooks into ${settingsPath} (port ${args.port})`);
    console.log('Restart any running Claude Code sessions to pick up the new hooks.');
    console.log('Then start the game window with: npm start');
  }
}

main();
