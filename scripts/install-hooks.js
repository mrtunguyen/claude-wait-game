#!/usr/bin/env node
/**
 * Installs (or removes) the Claude Code hooks that drive the wait-game window.
 *
 * Adds four hooks to ~/.claude/settings.json:
 *   - UserPromptSubmit -> POST /event/working  (you sent a prompt, Claude starts working)
 *   - Stop             -> POST /event/done     (Claude finished responding)
 *   - Notification     -> POST /event/notification (Claude needs attention/permission)
 *   - PreToolUse       -> POST /event/activity (Claude is about to use a tool — drives the live ticker)
 *
 * The hooks are plain curl calls to the app's local server (127.0.0.1:45872 by
 * default) and fail silently when the app isn't running, so they never slow
 * down or break a Claude session.
 *
 * If you installed the app from a release, you don't need this script — use the
 * "Connect to Claude Code" button in the app's Settings instead.
 *
 * Usage:
 *   node scripts/install-hooks.js [--port 45872] [--settings /path/to/settings.json]
 *   node scripts/install-hooks.js --uninstall
 */
const hooks = require('../src/hooks');

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

const args = parseArgs(process.argv);
const result = hooks.apply({
  port: args.port,
  settingsPath: args.settings || hooks.defaultSettingsPath(),
  uninstall: args.uninstall
});

if (!result.ok) {
  console.error(result.error);
  process.exit(1);
}

if (result.backedUp) console.log(`Backed up existing settings to ${result.settingsPath}.bak`);

if (args.uninstall) {
  console.log(`Removed claude-wait-game hooks from ${result.settingsPath}`);
} else {
  console.log(`Installed claude-wait-game hooks into ${result.settingsPath} (port ${args.port})`);
  console.log('Restart any running Claude Code sessions to pick up the new hooks.');
  console.log('Then start the game window with: npm start');
}
