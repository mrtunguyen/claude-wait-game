# Claude Wait Game 🎮

A little companion window for [Claude Code](https://claude.com/claude-code). When you send Claude a prompt and sit back to wait, a game window pops up so you can play **Snake**, answer **Trivia** questions, or do a round of **Memory Match** — and the moment Claude finishes, the window chimes and tells you your answer is ready.

```
┌────────────────────────────┐
│ ● Claude is working…   42s │
│ ✏️ Editing main.js         │
├────────────────────────────┤
│   🐍 Snake    🧠 Trivia    │
│   🃏 Memory Match          │
│   📊 Your waiting stats    │
└────────────────────────────┘
```

## How it works

Claude Code supports [hooks](https://code.claude.com/docs/en/hooks) — shell commands that run on session events. This app:

1. Runs a tiny HTTP server on `127.0.0.1:45872` (localhost only).
2. Installs four hooks into `~/.claude/settings.json`:
   - **UserPromptSubmit** → you sent a prompt → the game window pops up ("Claude is working…")
   - **PreToolUse** → Claude is about to use a tool → the **live activity ticker** updates ("✏️ Editing main.js", "💻 Running npm test…", "🔍 Searching for handleEvent…")
   - **Stop** → Claude finished → chime + "Claude is done!" banner with elapsed time and tool-call count
   - **Notification** → Claude needs your attention (e.g. a permission prompt) → window flashes
3. The hooks are `curl` one-liners with 1–2 s timeouts and `|| true`, so if the app isn't running they silently no-op and **never slow down or break your Claude session**.

Because it hooks Claude Code itself, it works whether you run `claude` in a plain terminal, in the desktop app's terminal, or in an IDE terminal.

## Setup

Requires Node.js 18+ and `curl` (preinstalled on macOS, Linux, and Windows 10+). The generated hook commands use POSIX shell syntax, so on Windows run Claude Code under WSL or Git Bash.

```bash
git clone https://github.com/mrtunguyen/claude-wait-game.git
cd claude-wait-game
npm install

# wire it into Claude Code (writes ~/.claude/settings.json, backs it up first)
npm run install-hooks

# launch the game window
npm start
```

Restart any running Claude Code sessions so they pick up the hooks, then send Claude a prompt — the window pops up on its own.

### Uninstall

```bash
npm run uninstall-hooks   # removes only its own hook entries, leaves the rest untouched
```

## The games

| Game | How to play |
|---|---|
| 🐍 **Snake** | Arrow keys or WASD. Eat food, grow, don't hit walls or yourself. Speeds up as you score. |
| 🧠 **Trivia** | 10 quick multiple-choice questions (mostly dev-flavored). Streaks earn bonus points. |
| 🃏 **Memory Match** | Flip cards to find all 8 emoji pairs in as few moves as possible. |

Best scores are saved locally per game.

## Live activity ticker

While Claude works, a ticker under the status bar shows what it's actually doing in real time — which file it's editing, what command it's running, what it's searching for. Tool inputs are summarized to a single short line (a file basename, a truncated command) and never leave your machine.

## Waiting stats

Open **📊 Your waiting stats** from the menu:

- Time waited today and all time, number of waits, longest and average wait
- Games played (with a per-game breakdown) and total tool calls watched
- A bar chart of time waited over the last 7 days (hover a bar for the exact value)

Each "Claude is done!" banner also shows how long that wait took and how many tool calls it involved. Stats live in local storage and daily history is kept for 60 days.

## Behavior & settings

Open **Settings** at the bottom of the game menu:

- **Pop up when Claude starts working** (default on) — the window appears *without stealing focus*, so you can keep typing in your terminal.
- **Keep window on top** (default on)
- **Hide window when Claude finishes** (default off)
- **Play a sound when Claude finishes** (default on)

Closing the window minimizes the app to the tray so hooks can still wake it; quit from the tray icon.

## Configuration

- **Port**: set `CLAUDE_WAIT_GAME_PORT` when launching the app, and install hooks with the same port: `node scripts/install-hooks.js --port 50000`.
- **Project-level hooks**: install into a specific project instead of globally with `node scripts/install-hooks.js --settings /path/to/project/.claude/settings.json`.

## Security notes

- The server binds to `127.0.0.1` only — nothing is exposed to the network.
- Hook payloads (session id, cwd) stay on your machine; the app makes no outbound requests.
- The installer backs up `~/.claude/settings.json` to `settings.json.bak` before modifying it, and only ever adds/removes entries tagged `claude-wait-game`.
