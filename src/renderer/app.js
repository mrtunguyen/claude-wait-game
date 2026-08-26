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

  let activeGame = null;
  let workingSince = null;
  let timerInterval = null;
  let settings = {};

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
    menu.classList.add('hidden');
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
      setStatus('working');
    } else if (payload.status === 'done') {
      setStatus('done');
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
