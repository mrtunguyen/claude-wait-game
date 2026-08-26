// Trivia — quick-fire multiple choice questions, mostly dev-flavored.
(function () {
  const QUESTIONS = [
    { q: 'What does "HTTP" stand for?', a: ['HyperText Transfer Protocol', 'High Transfer Text Protocol', 'HyperText Terminal Process', 'Host Transfer Text Protocol'], c: 0 },
    { q: 'Which language runs natively in web browsers?', a: ['Python', 'JavaScript', 'C++', 'Rust'], c: 1 },
    { q: 'What does "git clone" do?', a: ['Deletes a repository', 'Copies a repository locally', 'Merges two branches', 'Creates a new commit'], c: 1 },
    { q: 'Binary 1010 equals which decimal number?', a: ['8', '12', '10', '14'], c: 2 },
    { q: 'Which HTTP status code means "Not Found"?', a: ['500', '301', '403', '404'], c: 3 },
    { q: 'What does CSS stand for?', a: ['Cascading Style Sheets', 'Computer Style System', 'Creative Style Syntax', 'Coded Style Sheets'], c: 0 },
    { q: 'Which data structure works FIFO (first in, first out)?', a: ['Stack', 'Queue', 'Tree', 'Heap'], c: 1 },
    { q: 'What year was JavaScript created?', a: ['1989', '1995', '2001', '1999'], c: 1 },
    { q: 'Which company created the Linux kernel? (trick!)', a: ['Microsoft', 'IBM', 'No company — Linus Torvalds', 'Google'], c: 2 },
    { q: 'What does "API" stand for?', a: ['Application Programming Interface', 'Advanced Program Integration', 'Applied Protocol Interface', 'Automatic Programming Input'], c: 0 },
    { q: 'Which of these is NOT a JavaScript framework?', a: ['React', 'Vue', 'Django', 'Svelte'], c: 2 },
    { q: 'What is the time complexity of binary search?', a: ['O(n)', 'O(log n)', 'O(n log n)', 'O(1)'], c: 1 },
    { q: 'What does "sudo" let you do on Unix systems?', a: ['Search documents', 'Run commands as another user (usually root)', 'Shut down the OS', 'Sort directories'], c: 1 },
    { q: 'Which planet is closest to the Sun?', a: ['Venus', 'Earth', 'Mercury', 'Mars'], c: 2 },
    { q: 'How many bits are in one byte?', a: ['4', '8', '16', '32'], c: 1 },
    { q: 'Which symbol starts a comment in Python?', a: ['//', '#', '/*', '--'], c: 1 },
    { q: 'What does "RAM" stand for?', a: ['Rapid Access Module', 'Random Access Memory', 'Read And Modify', 'Runtime Allocated Memory'], c: 1 },
    { q: 'TCP and UDP are protocols of which layer?', a: ['Application', 'Transport', 'Network', 'Physical'], c: 1 },
    { q: 'Which command shows your current directory in a shell?', a: ['cd', 'ls', 'pwd', 'dir'], c: 2 },
    { q: 'The Great Wall is located in which country?', a: ['Japan', 'India', 'China', 'Mongolia'], c: 2 },
    { q: 'What is 2 to the power of 10?', a: ['512', '1024', '2048', '1000'], c: 1 },
    { q: 'Which one is a NoSQL database?', a: ['PostgreSQL', 'MySQL', 'MongoDB', 'SQLite'], c: 2 },
    { q: 'What does "DNS" resolve?', a: ['Ports to services', 'Domain names to IP addresses', 'Files to folders', 'Users to passwords'], c: 1 },
    { q: 'Who painted the Mona Lisa?', a: ['Michelangelo', 'Raphael', 'Leonardo da Vinci', 'Donatello'], c: 2 },
    { q: 'Which keyword declares a constant in JavaScript?', a: ['let', 'var', 'const', 'static'], c: 2 },
    { q: 'What is the chemical symbol for gold?', a: ['Go', 'Gd', 'Au', 'Ag'], c: 2 },
    { q: 'REST APIs commonly exchange data in which format?', a: ['XML only', 'JSON', 'CSV', 'YAML only'], c: 1 },
    { q: 'Which sorting algorithm has the best average case?', a: ['Bubble sort O(n²)', 'Quicksort O(n log n)', 'Selection sort O(n²)', 'Insertion sort O(n²)'], c: 1 },
    { q: 'What does the "404" in HTTP 404 refer to?', a: ['A room number at CERN (legend)', 'The error category and code', 'The year it was defined', 'Server rack position'], c: 1 },
    { q: 'Which ocean is the largest?', a: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], c: 3 }
  ];

  const ROUND = 10;
  let container, api, order, index, score, streak, timeouts;

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function startRound() {
    order = shuffle(QUESTIONS).slice(0, ROUND);
    index = 0;
    score = 0;
    streak = 0;
    api.setScore(score);
    renderQuestion();
  }

  function renderQuestion() {
    container.innerHTML = '';
    const wrap = document.createElement('div');
    wrap.className = 'trivia';

    const item = order[index];
    const answerOrder = shuffle(item.a.map((text, i) => ({ text, correct: i === item.c })));

    const progress = document.createElement('div');
    progress.className = 'progress';
    progress.innerHTML = `<span>Question ${index + 1} / ${ROUND}</span><span>Streak: ${streak}\u{1F525}</span>`;
    wrap.appendChild(progress);

    const qEl = document.createElement('div');
    qEl.className = 'question';
    qEl.textContent = item.q;
    wrap.appendChild(qEl);

    const answers = document.createElement('div');
    answers.className = 'answers';
    answerOrder.forEach((ans) => {
      const btn = document.createElement('button');
      btn.textContent = ans.text;
      btn.addEventListener('click', () => pick(btn, ans.correct, answers));
      answers.appendChild(btn);
    });
    wrap.appendChild(answers);

    container.appendChild(wrap);
  }

  function pick(btn, correct, answersEl) {
    [...answersEl.children].forEach((b) => (b.disabled = true));
    if (correct) {
      btn.classList.add('correct');
      streak += 1;
      score += 10 + Math.min(streak - 1, 5) * 2; // small streak bonus
    } else {
      btn.classList.add('wrong');
      streak = 0;
      // reveal the right one
      const rightText = order[index].a[order[index].c];
      [...answersEl.children].forEach((b) => {
        if (b.textContent === rightText) b.classList.add('correct');
      });
    }
    api.setScore(score);

    timeouts.push(
      setTimeout(() => {
        index += 1;
        if (index >= ROUND) finish();
        else renderQuestion();
      }, correct ? 700 : 1400)
    );
  }

  function finish() {
    api.reportBest('trivia', score);
    container.innerHTML = '';
    const msg = document.createElement('div');
    msg.className = 'overlay-msg';
    const pct = Math.round((score / (ROUND * 10)) * 100);
    msg.textContent = `Round over! Score: ${score}` + (pct >= 100 ? ' \u{1F3C6}' : pct >= 70 ? ' \u{1F389}' : '');
    container.appendChild(msg);

    const again = document.createElement('button');
    again.className = 'primary';
    again.textContent = 'Play again';
    again.addEventListener('click', startRound);
    container.appendChild(again);
  }

  (window.WaitGames = window.WaitGames || []).push({
    id: 'trivia',
    name: 'Trivia',
    icon: '\u{1F9E0}',
    desc: '10 quick questions. Build a streak.',
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
