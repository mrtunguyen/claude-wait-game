// Waiting stats: persistent store (localStorage) + the stats screen renderer.
(function () {
  const KEY = 'stats:v1';
  const KEEP_DAYS = 60;

  function emptyStats() {
    return {
      totals: { waitMs: 0, waits: 0, longestMs: 0, tools: 0, games: 0 },
      days: {}, // 'YYYY-MM-DD' -> { waitMs, waits }
      gamesByType: {}
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return emptyStats();
      const s = JSON.parse(raw);
      return { ...emptyStats(), ...s, totals: { ...emptyStats().totals, ...s.totals } };
    } catch {
      return emptyStats();
    }
  }

  function save(stats) {
    // prune old days so the store never grows unbounded
    const cutoff = dayKey(new Date(Date.now() - KEEP_DAYS * 86400000));
    for (const day of Object.keys(stats.days)) {
      if (day < cutoff) delete stats.days[day];
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(stats));
    } catch {
      // storage unavailable — stats just don't persist
    }
  }

  function dayKey(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function fmtDuration(ms) {
    const s = Math.round(ms / 1000);
    if (s < 60) return s + 's';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    const h = Math.floor(m / 60);
    return `${h}h ${m % 60}m`;
  }

  // ---------- recording ----------
  function recordWait(ms) {
    if (!(ms > 0)) return;
    const stats = load();
    stats.totals.waitMs += ms;
    stats.totals.waits += 1;
    stats.totals.longestMs = Math.max(stats.totals.longestMs, ms);
    const day = dayKey(new Date());
    const d = stats.days[day] || { waitMs: 0, waits: 0 };
    d.waitMs += ms;
    d.waits += 1;
    stats.days[day] = d;
    save(stats);
  }

  function recordGame(id) {
    const stats = load();
    stats.totals.games += 1;
    stats.gamesByType[id] = (stats.gamesByType[id] || 0) + 1;
    save(stats);
  }

  function recordTools(count) {
    if (!(count > 0)) return;
    const stats = load();
    stats.totals.tools += count;
    save(stats);
  }

  // ---------- rendering ----------
  function tile(label, value, sub) {
    const el = document.createElement('div');
    el.className = 'stat-tile';
    const v = document.createElement('div');
    v.className = 'stat-value';
    v.textContent = value;
    const l = document.createElement('div');
    l.className = 'stat-label';
    l.textContent = label;
    el.appendChild(v);
    el.appendChild(l);
    if (sub) {
      const s = document.createElement('div');
      s.className = 'stat-sub';
      s.textContent = sub;
      el.appendChild(s);
    }
    return el;
  }

  function renderChart(stats) {
    const wrap = document.createElement('div');
    wrap.className = 'chart-block';

    const title = document.createElement('div');
    title.className = 'chart-title';
    title.textContent = 'Time waited — last 7 days';
    wrap.appendChild(title);

    // last 7 days, oldest first, today last
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date(Date.now() - i * 86400000);
      const key = dayKey(date);
      days.push({
        key,
        label: date.toLocaleDateString(undefined, { weekday: 'short' }),
        waitMs: (stats.days[key] || {}).waitMs || 0,
        isToday: i === 0
      });
    }

    const max = Math.max(...days.map((d) => d.waitMs));
    if (max === 0) {
      const empty = document.createElement('div');
      empty.className = 'chart-empty';
      empty.textContent = 'No waits recorded yet — send Claude a prompt!';
      wrap.appendChild(empty);
      return wrap;
    }

    const chart = document.createElement('div');
    chart.className = 'bar-chart';
    chart.setAttribute('role', 'img');
    chart.setAttribute(
      'aria-label',
      'Bar chart of time waited per day: ' +
        days.map((d) => `${d.label} ${fmtDuration(d.waitMs)}`).join(', ')
    );

    days.forEach((d) => {
      const col = document.createElement('div');
      col.className = 'bar-col';

      const barArea = document.createElement('div');
      barArea.className = 'bar-area';

      // direct-label only the max bar; every bar gets a hover tooltip
      if (d.waitMs === max) {
        const topLabel = document.createElement('div');
        topLabel.className = 'bar-value';
        topLabel.textContent = fmtDuration(d.waitMs);
        barArea.appendChild(topLabel);
      }

      const bar = document.createElement('div');
      bar.className = 'bar' + (d.isToday ? ' today' : '');
      bar.style.height = Math.max(2, Math.round((d.waitMs / max) * 100)) + '%';
      bar.title = `${d.label}: ${fmtDuration(d.waitMs)}`;
      bar.dataset.tip = `${d.label} · ${fmtDuration(d.waitMs)}`;
      barArea.appendChild(bar);

      const label = document.createElement('div');
      label.className = 'bar-label';
      label.textContent = d.label;

      col.appendChild(barArea);
      col.appendChild(label);
      chart.appendChild(col);
    });

    wrap.appendChild(chart);
    return wrap;
  }

  function render(container) {
    const stats = load();
    container.innerHTML = '';

    const today = stats.days[dayKey(new Date())] || { waitMs: 0, waits: 0 };
    const avg = stats.totals.waits > 0 ? stats.totals.waitMs / stats.totals.waits : 0;

    const grid = document.createElement('div');
    grid.className = 'stat-grid';
    grid.appendChild(tile('waited today', fmtDuration(today.waitMs), `${today.waits} wait${today.waits === 1 ? '' : 's'}`));
    grid.appendChild(tile('waited all time', fmtDuration(stats.totals.waitMs), `${stats.totals.waits} wait${stats.totals.waits === 1 ? '' : 's'}`));
    grid.appendChild(tile('longest wait', fmtDuration(stats.totals.longestMs)));
    grid.appendChild(tile('average wait', fmtDuration(avg)));
    grid.appendChild(tile('games played', String(stats.totals.games), gamesBreakdown(stats)));
    grid.appendChild(tile('tool calls watched', String(stats.totals.tools)));
    container.appendChild(grid);

    container.appendChild(renderChart(stats));
  }

  function gamesBreakdown(stats) {
    const entries = Object.entries(stats.gamesByType);
    if (entries.length === 0) return '';
    return entries
      .sort((a, b) => b[1] - a[1])
      .map(([id, n]) => `${id} ${n}`)
      .join(' · ');
  }

  window.WaitStats = { recordWait, recordGame, recordTools, render, fmtDuration };
})();
