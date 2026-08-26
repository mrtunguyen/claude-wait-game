// Snake — classic grid snake on a canvas.
(function () {
  const COLS = 20;
  const ROWS = 20;
  const CELL = 18;

  let canvas, ctx, loopId, keyHandler;
  let snake, dir, nextDir, food, score, speed, alive, started;
  let api;

  function reset() {
    snake = [
      { x: 9, y: 10 },
      { x: 8, y: 10 },
      { x: 7, y: 10 }
    ];
    dir = { x: 1, y: 0 };
    nextDir = dir;
    score = 0;
    speed = 140;
    alive = true;
    started = false;
    placeFood();
    api.setScore(score);
  }

  function placeFood() {
    do {
      food = {
        x: Math.floor(Math.random() * COLS),
        y: Math.floor(Math.random() * ROWS)
      };
    } while (snake.some((s) => s.x === food.x && s.y === food.y));
  }

  function tick() {
    if (!alive || !started) {
      draw();
      loopId = setTimeout(tick, speed);
      return;
    }
    dir = nextDir;
    const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

    const hitWall = head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS;
    const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
    if (hitWall || hitSelf) {
      alive = false;
      api.reportBest('snake', score);
      draw();
      loopId = setTimeout(tick, speed);
      return;
    }

    snake.unshift(head);
    if (head.x === food.x && head.y === food.y) {
      score += 10;
      api.setScore(score);
      speed = Math.max(60, speed - 3);
      placeFood();
    } else {
      snake.pop();
    }

    draw();
    loopId = setTimeout(tick, speed);
  }

  function draw() {
    ctx.fillStyle = '#1c1c28';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // food
    ctx.fillStyle = '#d97757';
    ctx.beginPath();
    ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL / 2 - 2, 0, Math.PI * 2);
    ctx.fill();

    // snake
    snake.forEach((seg, i) => {
      ctx.fillStyle = i === 0 ? '#a5f3b4' : '#4ade80';
      ctx.fillRect(seg.x * CELL + 1, seg.y * CELL + 1, CELL - 2, CELL - 2);
    });

    if (!started || !alive) {
      ctx.fillStyle = '#000000aa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#e8e8f0';
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      const mid = canvas.height / 2;
      if (!alive) {
        ctx.fillText('Game over — score ' + score, canvas.width / 2, mid - 10);
        ctx.font = '14px sans-serif';
        ctx.fillText('Press any arrow key to restart', canvas.width / 2, mid + 16);
      } else {
        ctx.fillText('Press an arrow key to start', canvas.width / 2, mid);
      }
    }
  }

  function onKey(e) {
    const map = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
      w: { x: 0, y: -1 },
      s: { x: 0, y: 1 },
      a: { x: -1, y: 0 },
      d: { x: 1, y: 0 }
    };
    const nd = map[e.key];
    if (!nd) return;
    e.preventDefault();
    if (!alive) {
      reset();
      started = true;
      return;
    }
    started = true;
    // no instant 180° turns
    if (nd.x === -dir.x && nd.y === -dir.y) return;
    nextDir = nd;
  }

  (window.WaitGames = window.WaitGames || []).push({
    id: 'snake',
    name: 'Snake',
    icon: '\u{1F40D}',
    desc: 'Arrows or WASD. Eat, grow, survive.',
    start(container, gameApi) {
      api = gameApi;
      canvas = document.createElement('canvas');
      canvas.width = COLS * CELL;
      canvas.height = ROWS * CELL;
      canvas.className = 'snake-canvas';
      ctx = canvas.getContext('2d');
      container.appendChild(canvas);

      const hint = document.createElement('div');
      hint.className = 'game-hint';
      hint.textContent = 'Arrow keys or WASD to steer';
      container.appendChild(hint);

      keyHandler = onKey;
      window.addEventListener('keydown', keyHandler);
      reset();
      tick();
    },
    stop() {
      clearTimeout(loopId);
      window.removeEventListener('keydown', keyHandler);
    }
  });
})();
