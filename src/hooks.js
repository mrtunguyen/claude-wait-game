/**
 * Shared Claude Code hook management.
 *
 * Used by both the CLI (scripts/install-hooks.js) and the packaged app's
 * Settings screen, so people who install from a release never need the repo
 * or a terminal to wire the app into Claude Code.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const MARKER = 'claude-wait-game';

// Claude Code hook name -> the app's /event/<name> endpoint
const EVENTS = {
  UserPromptSubmit: 'working',
  Stop: 'done',
  Notification: 'notification',
  PreToolUse: 'activity'
};

function defaultSettingsPath() {
  return path.join(os.homedir(), '.claude', 'settings.json');
}

function hookCommand(port, event) {
  // --data-binary @- forwards Claude's hook JSON (session_id, tool_name, ...)
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

function readSettings(settingsPath) {
  if (!fs.existsSync(settingsPath)) return {};
  const raw = fs.readFileSync(settingsPath, 'utf8').trim();
  if (!raw) return {};
  return JSON.parse(raw); // caller handles a malformed file
}

/**
 * Are our hooks currently installed, and on which port?
 * Returns { installed, port, settingsPath, error }.
 */
function status({ settingsPath = defaultSettingsPath() } = {}) {
  try {
    const settings = readSettings(settingsPath);
    const hooks = settings.hooks || {};
    const ours = [];
    for (const name of Object.keys(EVENTS)) {
      const list = Array.isArray(hooks[name]) ? hooks[name] : [];
      if (list.some(isOurs)) ours.push(name);
    }
    let port = null;
    for (const list of Object.values(hooks)) {
      if (!Array.isArray(list)) continue;
      for (const entry of list) {
        if (!isOurs(entry)) continue;
        const cmd = entry.hooks.find((h) => h.command && h.command.includes(MARKER)).command;
        const m = /127\.0\.0\.1:(\d+)\//.exec(cmd);
        if (m) port = parseInt(m[1], 10);
      }
    }
    return {
      installed: ours.length === Object.keys(EVENTS).length,
      partial: ours.length > 0 && ours.length < Object.keys(EVENTS).length,
      hooks: ours,
      port,
      settingsPath
    };
  } catch (err) {
    return { installed: false, partial: false, hooks: [], port: null, settingsPath, error: err.message };
  }
}

/**
 * Install or remove our hook entries, leaving every other hook untouched.
 * Returns { ok, settingsPath, backedUp, error }.
 */
function apply({ port = 45872, settingsPath = defaultSettingsPath(), uninstall = false } = {}) {
  let settings;
  let backedUp = false;

  try {
    settings = readSettings(settingsPath);
  } catch (err) {
    return {
      ok: false,
      settingsPath,
      backedUp,
      error: `Could not parse ${settingsPath}: ${err.message}. Fix the JSON manually and retry.`
    };
  }

  try {
    if (fs.existsSync(settingsPath)) {
      fs.copyFileSync(settingsPath, settingsPath + '.bak');
      backedUp = true;
    } else {
      fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
    }

    settings.hooks = settings.hooks || {};

    for (const [hookName, appEvent] of Object.entries(EVENTS)) {
      const list = Array.isArray(settings.hooks[hookName]) ? settings.hooks[hookName] : [];
      // always strip our previous entries first (idempotent install / clean uninstall)
      const kept = list.filter((entry) => !isOurs(entry));

      if (!uninstall) {
        kept.push({ hooks: [{ type: 'command', command: hookCommand(port, appEvent) }] });
      }

      if (kept.length > 0) settings.hooks[hookName] = kept;
      else delete settings.hooks[hookName];
    }

    if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n');
    return { ok: true, settingsPath, backedUp };
  } catch (err) {
    return { ok: false, settingsPath, backedUp, error: err.message };
  }
}

module.exports = { MARKER, EVENTS, defaultSettingsPath, hookCommand, status, apply };
