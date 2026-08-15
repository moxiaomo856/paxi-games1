/**
 * 2048 — 移植自 paxi-toolbox（付费逻辑统一到 game-pay.js）
 * 死局 → GamePay.showGameOver → 复活 = 保留分数重开棋盘
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _g2048State = null;
let _g2048KeyDown = null;
let _g2048TouchStart = null;

function render2048() {
  return `
    <div class="card">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('g2048.score')}: <b id="g2048Score" style="color:var(--primary)">0</b></span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('g2048.best')}: <b id="g2048Best" style="color:var(--warning)">0</b></span>
        ${GamePay.roundsBadge('game-2048')}
      </div>
      <div style="position:relative;display:flex;justify-content:center;">
        <div id="g2048Board" style="width:320px;max-width:100%;height:auto;aspect-ratio:1;background:#bbada0;border-radius:8px;padding:10px;display:grid;grid-template-columns:repeat(4,1fr);gap:10px;position:relative;touch-action:none;"></div>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);border-radius:8px;z-index:10;">
          ${GamePay.overlayHTML('game-2048', 'g2048.title', 'g2048.controls')}
        </div>
      </div>
    </div>
  `;
}

function bind2048Events() {
  GamePay.bindStart('game-2048', start2048Game);
}

// keepScore=true 时为复活模式：保留分数重开棋盘
function start2048Game(keepScore) {
  if (!GamePay.consumeRound('game-2048')) return;

  const prev = keepScore && _g2048State ? _g2048State.score : 0;

  _g2048State = {
    grid: Array(4).fill(null).map(() => Array(4).fill(0)),
    score: prev,
    best: parseInt(localStorage.getItem('paxi_2048_best') || '0', 10),
    over: false,
    won: false,
  };

  _add2048Tile();
  _add2048Tile();
  _render2048Board();

  GamePay.registerRevive('game-2048', () => start2048Game(true));

  // 键盘
  if (_g2048KeyDown) window.removeEventListener('keydown', _g2048KeyDown);
  _g2048KeyDown = (e) => {
    if (!_g2048State || _g2048State.over) return;
    let moved = false;
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': moved = _move2048('left'); break;
      case 'ArrowRight': case 'd': case 'D': moved = _move2048('right'); break;
      case 'ArrowUp': case 'w': case 'W': moved = _move2048('up'); break;
      case 'ArrowDown': case 's': case 'S': moved = _move2048('down'); break;
    }
    if (moved) { e.preventDefault(); _after2048Move(); }
  };
  window.addEventListener('keydown', _g2048KeyDown);

  // 触摸
  const board = document.getElementById('g2048Board');
  if (board) {
    board.ontouchstart = (e) => {
      _g2048TouchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    };
    board.ontouchend = (e) => {
      if (!_g2048TouchStart || !_g2048State || _g2048State.over) return;
      const dx = e.changedTouches[0].clientX - _g2048TouchStart.x;
      const dy = e.changedTouches[0].clientY - _g2048TouchStart.y;
      const absX = Math.abs(dx), absY = Math.abs(dy);
      if (Math.max(absX, absY) < 20) return;
      let moved = false;
      if (absX > absY) moved = _move2048(dx > 0 ? 'right' : 'left');
      else moved = _move2048(dy > 0 ? 'down' : 'up');
      if (moved) _after2048Move();
      _g2048TouchStart = null;
    };
  }
}

function _add2048Tile() {
  const empty = [];
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++)
      if (_g2048State.grid[r][c] === 0) empty.push([r, c]);
  if (empty.length === 0) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  _g2048State.grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}

function _move2048(dir) {
  const g = _g2048State.grid;
  let moved = false;
  const rotate = (grid) => grid[0].map((_, i) => grid.map(row => row[i]).reverse());
  const unrotate = (grid) => grid[0].map((_, i) => grid.map(row => row[i])).reverse();

  let work = g.map(row => [...row]);
  for (let i = 0; i < { left: 0, up: 1, right: 2, down: 3 }[dir]; i++) work = rotate(work);

  for (let r = 0; r < 4; r++) {
    let row = work[r].filter(v => v !== 0);
    for (let i = 0; i < row.length - 1; i++) {
      if (row[i] === row[i + 1]) {
        row[i] *= 2;
        _g2048State.score += row[i];
        if (row[i] === 2048) _g2048State.won = true;
        row.splice(i + 1, 1);
      }
    }
    while (row.length < 4) row.push(0);
    if (JSON.stringify(row) !== JSON.stringify(work[r])) moved = true;
    work[r] = row;
  }
  for (let i = 0; i < (4 - { left: 0, up: 1, right: 2, down: 3 }[dir]) % 4; i++) work = unrotate(work);

  if (moved) _g2048State.grid = work;
  return moved;
}

function _after2048Move() {
  _add2048Tile();
  _render2048Board();
  if (_g2048State.score > _g2048State.best) {
    _g2048State.best = _g2048State.score;
    localStorage.setItem('paxi_2048_best', String(_g2048State.best));
  }
  if (_is2048Over()) {
    _g2048State.over = true;
    if (_g2048KeyDown) { window.removeEventListener('keydown', _g2048KeyDown); _g2048KeyDown = null; }
    GamePay.showGameOver('game-2048', `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${_g2048State.score}</b>`);
  }
}

function _is2048Over() {
  const g = _g2048State.grid;
  for (let r = 0; r < 4; r++)
    for (let c = 0; c < 4; c++) {
      if (g[r][c] === 0) return false;
      if (c < 3 && g[r][c] === g[r][c + 1]) return false;
      if (r < 3 && g[r][c] === g[r + 1][c]) return false;
    }
  return true;
}

function _render2048Board() {
  const board = document.getElementById('g2048Board');
  if (!board || !_g2048State) return;
  board.innerHTML = '';
  const colors = { 0: 'var(--bg)', 2: '#eee4da', 4: '#ede0c8', 8: '#f2b179', 16: '#f59563', 32: '#f67c5f', 64: '#f65e3b', 128: '#edcf72', 256: '#edcc61', 512: '#edc850', 1024: '#edc53f', 2048: '#edc22e' };
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      const v = _g2048State.grid[r][c];
      const cell = document.createElement('div');
      cell.style.cssText = `width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:6px;font-weight:800;transition:all 0.1s;border:2px solid rgba(0,0,0,0.25);box-shadow:inset 0 2px 4px rgba(255,255,255,0.3),inset 0 -2px 4px rgba(0,0,0,0.15);${v <= 4 ? 'color:#776e65;' : 'color:#fff;'}`;
      const bg = v === 0 ? '#cdc1b4' : (colors[v] || '#3c3a32');
      cell.style.background = bg;
      cell.style.fontSize = v >= 1024 ? '18px' : v >= 128 ? '20px' : '26px';
      cell.textContent = v || '';
      board.appendChild(cell);
    }
  }
  const scoreEl = document.getElementById('g2048Score');
  if (scoreEl) scoreEl.textContent = _g2048State.score;
  const bestEl = document.getElementById('g2048Best');
  if (bestEl) bestEl.textContent = _g2048State.best;
}

window.TOOL_REGISTRY['game-2048'] = {
  render: render2048,
  bind: bind2048Events,
  beforeUnmount: () => {
    if (_g2048KeyDown) { window.removeEventListener('keydown', _g2048KeyDown); _g2048KeyDown = null; }
    _g2048State = null;
  }
};
