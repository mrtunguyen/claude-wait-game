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

## Download

Grab the latest installer from the [**Releases page**](https://github.com/mrtunguyen/claude-wait-game/releases/latest):

| Platform | File |
|---|---|
| macOS (Apple silicon) | `.dmg` with `arm64` in the name |
| macOS (Intel) | `.dmg` with `x64` in the name |
| Windows | `...Setup....exe` (installer) or the portable `.exe` |
| Linux | `.AppImage` (make it executable and run) or `.deb` (`sudo dpkg -i ...`) |

Open the app, then click **Connect to Claude Code** on the main screen — that writes the hooks for you, so there's no terminal setup. Restart any open Claude Code sessions afterwards and you're done.

### The OS blocks it on first launch

The releases aren't code-signed, so macOS and Windows both warn (and Windows sometimes
blocks outright). Nothing is wrong with the download — signing certificates cost money and
this project doesn't have one yet.

**Windows**

1. On *"Windows protected your PC"*: click the small **More info** link, then **Run anyway**.
2. No **Run anyway** button? The file is flagged as downloaded from the internet. Clear that
   flag and try again:
   ```powershell
   Unblock-File "$HOME\Downloads\Claude.Wait.Game.Setup.1.0.1.exe"
   ```
   (Or right-click the `.exe` → **Properties** → tick **Unblock** → **OK**.)
3. Still blocked? Your organization may enforce SmartScreen/WDAC/AppLocker, which you can't
   override. [Run from source](#run-from-source) instead — no unsigned executable involved.

Verify the download matches what the release workflow built:

```powershell
Get-FileHash "$HOME\Downloads\Claude.Wait.Game.Setup.1.0.1.exe" -Algorithm SHA256
```

Compare it against the digest GitHub shows for that asset on the release page.

**macOS**

Right-click the app → **Open** → **Open**. If it's still blocked:

```bash
xattr -cr "/Applications/Claude Wait Game.app"
```

## How it works

Claude Code supports [hooks](https://code.claude.com/docs/en/hooks) — shell commands that run on session events. This app:

1. Runs a tiny HTTP server on `127.0.0.1:45872` (localhost only).
2. Installs four hooks into `~/.claude/settings.json`:
   - **UserPromptSubmit** → you sent a prompt → the game window pops up ("Claude is working…")
   - **PreToolUse** → Claude is about to use a tool → the **live activity ticker** updates ("✏️ Editing main.js", "💻 Running npm test…", "🔍 Searching for handleEvent…")
   - **Stop** → Claude finished → chime + "Claude is done!" banner with elapsed time and tool-call count
   - **Notification** → Claude needs your attention (e.g. a permission prompt) → window flashes
3. The hooks are `curl` calls with 1–2 s timeouts that discard their output, so if the app isn't running they silently no-op and **never slow down or break your Claude session**.

On macOS and Linux these are shell one-liners. On Windows they're written in Claude Code's
*exec form* (`cmd.exe /c ...`), which bypasses the shell — Claude Code otherwise runs hooks
through Git Bash when it's installed and PowerShell when it isn't, and a POSIX one-liner is
not valid PowerShell. Either way the app installs the right form for your machine.

Because it hooks Claude Code itself, it works whether you run `claude` in a plain terminal, in the desktop app's terminal, or in an IDE terminal.

## Run from source

Requires Node.js 18+ and `curl` (preinstalled on macOS, Linux, and Windows 10+).

```bash
git clone https://github.com/mrtunguyen/claude-wait-game.git
cd claude-wait-game
npm install

# wire it into Claude Code (writes ~/.claude/settings.json, backs it up first)
npm run install-hooks

# launch the game window
npm start
```

Restart any running Claude Code sessions so they pick up the hooks, then send Claude a prompt — the window pops up on its own. (The in-app **Connect to Claude Code** button does the same thing as `npm run install-hooks`.)

### Uninstall the hooks

```bash
npm run uninstall-hooks   # removes only its own hook entries, leaves the rest untouched
```

Or click **Disconnect** in the app.

## Building and releasing

```bash
npm test          # dependency-free test suite (hooks, hook server, stats)
npm run dist      # build installers for the current platform into dist/
```

Releases are automated. Pushing a version tag builds macOS, Windows, and Linux
installers on GitHub Actions and publishes them to a GitHub Release:

```bash
git tag v1.0.1
git push origin v1.0.1
```

You can also trigger the **Release** workflow manually from the Actions tab and give it a
version number — it creates the tag for you. Tests must pass before anything is built, and
every push runs CI on all three platforms.

The app icon is generated (no binary asset checked in by hand): `npm run make-icon`.

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

### Running Claude Code inside WSL

If the app runs on Windows but you use `claude` inside WSL, the two don't share a home
directory *or* a loopback address, so the in-app button can't wire them together:

- Install the hooks from **inside WSL** (`npm run install-hooks`), so they land in WSL's
  `~/.claude/settings.json`.
- WSL2 can't reach the Windows host on `127.0.0.1` unless you're on Windows 11 with
  [mirrored networking](https://learn.microsoft.com/windows/wsl/networking#mirrored-mode-networking)
  (`networkingMode=mirrored` in `.wslconfig`). Without it, point the hooks at the Windows
  host IP instead — or just run the app inside WSL too.

## Security notes

- The server binds to `127.0.0.1` only — nothing is exposed to the network.
- Hook payloads (session id, cwd) stay on your machine; the app makes no outbound requests.
- The installer backs up `~/.claude/settings.json` to `settings.json.bak` before modifying it, and only ever adds/removes entries tagged `claude-wait-game`.
