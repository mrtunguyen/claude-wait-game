// Memory Match — flip pairs of cards, fewest moves wins.
(function () {
  const EMOJI = ['\u{1F680}', '\u{1F40D}', '\u{1F916}', '\u{2615}', '\u{1F41B}', '\u{1F4BE}', '\u{1F511}', '\u{1F4E6}'];

  let container, api, first, lockUntil, matched, moves, timeouts;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startRound() {
    container.innerHTML = '';
    first = null;
    lockUntil = 0;
    matched = 0;
    moves = 0;
    api.setScore('Moves: 0');

    const deck = shuffle([...EMOJI, ...EMOJI]);
    const grid = document.createElement('div');
    grid.className = 'memory-grid';

    deck.forEach((emoji) => {
      const card = document.createElement('button');
      card.className = 'memory-card';
      card.textContent = emoji;
      card.addEventListener('click', () => flip(card, emoji));
      grid.appendChild(card);
    });

    container.appendChild(grid);

    const hint = document.createElement('div');
    hint.className = 'game-hint';
    hint.textContent = 'Find all 8 pairs in as few moves as you can';
    container.appendChild(hint);
  }

  function flip(card, emoji) {
    if (Date.now() < lockUntil) return;
    if (card.classList.contains('flipped') || card.classList.contains('matched')) return;

    card.classList.add('flipped');

    if (!first) {
      first = { card, emoji };
      return;
    }

    moves += 1;
    api.setScore('Moves: ' + moves);

    if (first.emoji === emoji) {
      card.classList.add('matched');
      first.card.classList.add('matched');
      first = null;
      matched += 1;
      if (matched === EMOJI.length) finish();
    } else {
      const a = first.card;
      first = null;
      lockUntil = Date.now() + 800;
      timeouts.push(
        setTimeout(() => {
          a.classList.remove('flipped');
          card.classList.remove('flipped');
        }, 800)
      );
    }
  }

  function finish() {
    // lower is better for memory: report as inverse-ish score for the "best" line
    api.reportBest('memory', moves, { lowerIsBetter: true });
    const msg = document.createElement('div');
    msg.className = 'overlay-msg';
    msg.textContent = `All pairs found in ${moves} moves!` + (moves <= 12 ? ' \u{1F3C6}' : '');
    container.appendChild(msg);

    const again = document.createElement('button');
    again.className = 'primary';
    again.textContent = 'Play again';
    again.addEventListener('click', startRound);
    container.appendChild(again);
  }

  (window.WaitGames = window.WaitGames || []).push({
    id: 'memory',
    name: 'Memory Match',
    icon: '\u{1F0CF}',
    desc: 'Flip cards, match all 8 pairs.',
    start(el, gameApi) {
      container = el;
      api = gameApi;
      timeouts = [];
      startRound();
    },
    stop() {
      (timeouts || []).forEach(clearTimeout);
    }
  });
})();
