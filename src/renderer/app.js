// App shell: status bar, game menu, game lifecycle, settings, done banner.
(function () {
  const games = window.WaitGames || [];

  const statusBar = document.getElementById('status-bar');
  const statusText = document.getElementById('status-text');
  const statusTimer = document.getElementById('status-timer');
  const menu = document.getElementById('menu');
  const gameList = document.getElementById('game-list');
  const gameView = document.getElementById('game-view');
  const gameTitle = document.getElementById('game-title');
  const gameScore = document.getElementById('game-score');
  const gameContainer = document.getElementById('game-container');
  const backBtn = document.getElementById('back-btn');
  const doneBanner = document.getElementById('done-banner');
  const doneDismiss = document.getElementById('done-dismiss');
  const doneSub = document.querySelector('.done-sub');
  const ticker = document.getElementById('ticker');
  const tickerIcon = document.getElementById('ticker-icon');
  const tickerText = document.getElementById('ticker-text');
  const statsBtn = document.getElementById('stats-btn');
  const statsView = document.getElementById('stats-view');
  const statsContent = document.getElementById('stats-content');
  const statsBackBtn = document.getElementById('stats-back-btn');

  let activeGame = null;
  let workingSince = null;
  let timerInterval = null;
  let settings = {};
  let toolsThisWait = 0;

  // ---------- best scores ----------
  function bestKey(id) {
    return 'best:' + id;
  }

  function getBest(id) {
    try {
      const raw = localStorage.getItem(bestKey(id));
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function reportBest(id, value, opts = {}) {
    try {
      const prev = getBest(id);
      const better =
        prev === null ||
        (opts.lowerIsBetter ? value < prev.value : value > prev.value);
      if (better) {
        localStorage.setItem(bestKey(id), JSON.stringify({ value, lowerIsBetter: !!opts.lowerIsBetter }));
        renderMenu();
      }
    } catch {
      // localStorage unavailable — best scores just don't persist
    }
  }

  // ---------- menu ----------
  function renderMenu() {
    gameList.innerHTML = '';
    games.forEach((game) => {
      const card = document.createElement('button');
      card.className = 'game-card';

      const icon = document.createElement('span');
      icon.className = 'icon';
      icon.textContent = game.icon;

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = game.name;

      const desc = document.createElement('div');
      desc.className = 'desc';
      desc.textContent = game.desc;

      card.appendChild(icon);
      card.appendChild(name);
      card.appendChild(desc);

      const best = getBest(game.id);
      if (best) {
        const bestEl = document.createElement('div');
        bestEl.className = 'best';
        bestEl.textContent = best.lowerIsBetter
          ? `Best: ${best.value} moves`
          : `Best: ${best.value}`;
        card.appendChild(bestEl);
      }

      card.addEventListener('click', () => openGame(game));
      gameList.appendChild(card);
    });
  }

  // ---------- game lifecycle ----------
  const gameApi = {
    setScore(value) {
      gameScore.textContent = typeof value === 'number' ? 'Score: ' + value : String(value);
    },
    reportBest
  };

  function openGame(game) {
    closeGame();
    activeGame = game;
    window.WaitStats.recordGame(game.id);
    menu.classList.add('hidden');
    statsView.classList.add('hidden');
    gameView.classList.remove('hidden');
    gameTitle.textContent = game.icon + ' ' + game.name;
    gameScore.textContent = '';
    gameContainer.innerHTML = '';
    game.start(gameContainer, gameApi);
  }

  function closeGame() {
    if (activeGame) {
      try {
        activeGame.stop();
      } catch {
        // a broken game shouldn't take down the shell
      }
      activeGame = null;
    }
    gameContainer.innerHTML = '';
    gameView.classList.add('hidden');
    menu.classList.remove('hidden');
  }

  backBtn.addEventListener('click', closeGame);

  // ---------- stats view ----------
  statsBtn.addEventListener('click', () => {
    menu.classList.add('hidden');
    gameView.classList.add('hidden');
    statsView.classList.remove('hidden');
    window.WaitStats.render(statsContent);
  });

  statsBackBtn.addEventListener('click', () => {
    statsView.classList.add('hidden');
    menu.classList.remove('hidden');
  });

  // ---------- activity ticker ----------
  const TOOL_DISPLAY = {
    Edit: ['✏️', 'Editing'],
    MultiEdit: ['✏️', 'Editing'],
    Write: ['✏️', 'Writing'],
    NotebookEdit: ['✏️', 'Editing notebook'],
    Read: ['\u{1F4D6}', 'Reading'],
    Bash: ['\u{1F4BB}', 'Running'],
    BashOutput: ['\u{1F4BB}', 'Checking output of'],
    KillShell: ['\u{1F4BB}', 'Stopping'],
    Grep: ['\u{1F50D}', 'Searching for'],
    Glob: ['\u{1F50D}', 'Finding files'],
    LS: ['\u{1F4C2}', 'Listing'],
    WebFetch: ['\u{1F310}', 'Fetching'],
    WebSearch: ['\u{1F310}', 'Searching the web for'],
    Task: ['\u{1F916}', 'Delegating:'],
    Agent: ['\u{1F916}', 'Delegating:'],
    TodoWrite: ['\u{1F4DD}', 'Planning'],
    Skill: ['\u{1F9E9}', 'Using skill']
  };

  function shortDetail(detail) {
    if (!detail) return '';
    let d = String(detail);
    // for file paths, the basename is what the user recognizes
    if (d.includes('/') && !d.includes(' ')) {
      const parts = d.split('/').filter(Boolean);
      if (parts.length > 0) d = parts[parts.length - 1];
    }
    return d.length > 60 ? d.slice(0, 57) + '…' : d;
  }

  function updateTicker(tool, detail) {
    const [icon, verb] = TOOL_DISPLAY[tool] || ['⚙️', 'Using'];
    tickerIcon.textContent = icon;
    const d = shortDetail(detail);
    tickerText.textContent = d ? `${verb} ${d}` : `${verb || 'Using'} ${tool || 'a tool'}`;
    ticker.classList.remove('hidden');
    // retrigger the slide-in animation
    ticker.classList.remove('tick');
    void ticker.offsetWidth;
    ticker.classList.add('tick');
  }

  function hideTicker() {
    ticker.classList.add('hidden');
  }

  // ---------- status / timer ----------
  function fmtElapsed(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return m > 0 ? `${m}m ${s % 60}s` : `${s}s`;
  }

  function setStatus(kind) {
    statusBar.className = 'status ' + kind;
    clearInterval(timerInterval);
    statusTimer.textContent = '';

    if (kind === 'working') {
      workingSince = Date.now();
      statusText.textContent = 'Claude is working…';
      timerInterval = setInterval(() => {
        statusTimer.textContent = fmtElapsed(Date.now() - workingSince);
      }, 1000);
    } else if (kind === 'done') {
      statusText.textContent =
        'Claude is done!' + (workingSince ? ` (took ${fmtElapsed(Date.now() - workingSince)})` : '');
      workingSince = null;
    } else if (kind === 'attention') {
      statusText.textContent = 'Claude needs your attention!';
    } else {
      statusText.textContent = 'Waiting for Claude…';
    }
  }

  // ---------- done banner + sound ----------
  function chime() {
    if (!settings.soundOnDone) return;
    try {
      const ctx = new AudioContext();
      [523.25, 659.25, 783.99].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(0.12, ctx.currentTime + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.35);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + i * 0.12);
        osc.stop(ctx.currentTime + i * 0.12 + 0.4);
      });
      setTimeout(() => ctx.close(), 1200);
    } catch {
      // no audio device — fine
    }
  }

  function showDoneBanner() {
    doneBanner.classList.remove('hidden');
  }

  doneDismiss.addEventListener('click', () => {
    doneBanner.classList.add('hidden');
    window.waitGame.stopFlash();
  });

  // ---------- Claude events from the main process ----------
  window.waitGame.onClaudeStatus((payload) => {
    if (payload.status === 'working') {
      doneBanner.classList.add('hidden');
      toolsThisWait = 0;
      setStatus('working');
      tickerIcon.textContent = '\u{1F680}';
      tickerText.textContent = 'Getting started…';
      ticker.classList.remove('hidden');
    } else if (payload.status === 'activity') {
      // the app may have been started mid-session; a tool call means Claude is working
      if (!workingSince) {
        doneBanner.classList.add('hidden');
        toolsThisWait = 0;
        setStatus('working');
      }
      toolsThisWait += 1;
      updateTicker(payload.tool, payload.detail);
    } else if (payload.status === 'done') {
      const elapsed = workingSince ? Date.now() - workingSince : 0;
      setStatus('done');
      hideTicker();
      if (elapsed > 0) {
        window.WaitStats.recordWait(elapsed);
        window.WaitStats.recordTools(toolsThisWait);
        doneSub.textContent =
          `Took ${window.WaitStats.fmtDuration(elapsed)}` +
          (toolsThisWait > 0 ? ` · ${toolsThisWait} tool call${toolsThisWait === 1 ? '' : 's'}` : '') +
          ' — your response is ready in the terminal.';
      } else {
        doneSub.textContent = 'Your response is ready in the terminal.';
      }
      toolsThisWait = 0;
      // live-refresh the stats screen if it's open
      if (!statsView.classList.contains('hidden')) {
        window.WaitStats.render(statsContent);
      }
      chime();
      showDoneBanner();
    } else if (payload.status === 'attention') {
      setStatus('attention');
      chime();
    }
  });

  // ---------- settings ----------
  const optIds = ['popupOnWorking', 'alwaysOnTop', 'hideOnDone', 'soundOnDone'];

  async function initSettings() {
    settings = await window.waitGame.getSettings();
    optIds.forEach((key) => {
      const box = document.getElementById('opt-' + key);
      if (!box) return;
      box.checked = !!settings[key];
      box.addEventListener('change', async () => {
        settings = await window.waitGame.setSetting(key, box.checked);
      });
    });
  }

  // ---------- boot ----------
  renderMenu();
  setStatus('idle');
  initSettings();
})();
