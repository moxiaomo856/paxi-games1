/**
 * 俄罗斯方块 — 移植自 paxi-toolbox
 * 付费/复活由 common/game-pay.js 统一处理：
 *   死亡 → GamePay.showGameOver → 免费/付费复活 → startTetrisGame(true) 保留分数
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _tetrisCanvas = null;
let _tetrisCtx = null;
let _tetrisState = null;
let _tetrisAnimId = null;
let _tetrisKeyDown = null;

const TETRIS_W = 220;
const TETRIS_H = 440;
const TETRIS_CELL = 22;
const TETRIS_COLS = 10;
const TETRIS_ROWS = 20;

const TETROMINOES = {
  I: { shape: [[1,1,1,1]], color: '#00f0f0' },
  O: { shape: [[1,1],[1,1]], color: '#f0f000' },
  T: { shape: [[0,1,0],[1,1,1]], color: '#a000f0' },
  S: { shape: [[0,1,1],[1,1,0]], color: '#00f000' },
  Z: { shape: [[1,1,0],[0,1,1]], color: '#f00000' },
  L: { shape: [[1,0,0],[1,1,1]], color: '#f0a000' },
  J: { shape: [[0,0,1],[1,1,1]], color: '#0000f0' },
};
const TETRIS_KEYS = Object.keys(TETROMINOES);

function renderTetris() {
  return `
    <div class="card">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('tetris.score')}: <b id="tetrisScore" style="color:var(--primary)">0</b></span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('tetris.lines')}: <b id="tetrisLines" style="color:var(--success)">0</b></span>
        ${GamePay.roundsBadge('tetris')}
      </div>
      <div style="position:relative;display:flex;justify-content:center;">
        <canvas id="tetrisCanvas" width="${TETRIS_W}" height="${TETRIS_H}" style="background:#0a0a1a;border-radius:8px;touch-action:none;max-width:100%;height:auto;"></canvas>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);border-radius:8px;z-index:10;">
          ${GamePay.overlayHTML('tetris', 'tetris.title', 'tetris.controls')}
        </div>
      </div>
      <div style="display:flex;gap:12px;justify-content:center;align-items:center;margin-top:14px;flex-wrap:wrap;">
        <button type="button" id="tetrisBtnLeft" class="tetris-btn">◀</button>
        <button type="button" id="tetrisBtnRotate" class="tetris-btn">⟳</button>
        <button type="button" id="tetrisBtnRight" class="tetris-btn">▶</button>
        <button type="button" id="tetrisBtnDown" class="tetris-btn">▼</button>
        <button type="button" id="tetrisBtnDrop" class="tetris-btn">⤓</button>
      </div>
    </div>
    <style>
      .tetris-btn{
        width:48px;height:48px;border-radius:50%;
        background:rgba(255,255,255,0.15);
        border:1px solid rgba(255,255,255,0.3);
        color:var(--text);font-size:20px;font-weight:bold;
        cursor:pointer;display:flex;align-items:center;justify-content:center;
        touch-action:manipulation;user-select:none;-webkit-user-select:none;
        -webkit-tap-highlight-color:transparent;padding:0;line-height:1;
        transition:background .1s;
      }
      .tetris-btn:active{background:rgba(255,255,255,0.35);}
    </style>
  `;
}

function bindTetrisEvents() {
  GamePay.bindStart('tetris', startTetrisGame);
}

// keepScore=true 时为"复活"模式：保留分数与行数，重新开局
function startTetrisGame(keepScore) {
  if (!GamePay.consumeRound('tetris')) return;

  _tetrisCanvas = document.getElementById('tetrisCanvas');
  if (!_tetrisCanvas) return;
  _tetrisCtx = _tetrisCanvas.getContext('2d');

  const prev = keepScore && _tetrisState ? { score: _tetrisState.score, lines: _tetrisState.lines } : null;

  _tetrisState = {
    board: Array(TETRIS_ROWS).fill(null).map(() => Array(TETRIS_COLS).fill(null)),
    current: null,
    next: null,
    score: prev ? prev.score : 0,
    lines: prev ? prev.lines : 0,
    over: false,
    dropTime: 0,
    dropInterval: prev ? Math.max(200, 800 - prev.lines * 20) : 800,
    lastTime: 0,
  };
  document.getElementById('tetrisScore').textContent = _tetrisState.score;
  document.getElementById('tetrisLines').textContent = _tetrisState.lines;

  // 注册复活函数：保留分数重新挑战
  GamePay.registerRevive('tetris', () => startTetrisGame(true));

  _spawnTetrisPiece();
  _tetrisState.next = _randomTetrisPiece();

  // 键盘
  if (_tetrisKeyDown) window.removeEventListener('keydown', _tetrisKeyDown);
  _tetrisKeyDown = (e) => {
    if (!_tetrisState || _tetrisState.over) return;
    const p = _tetrisState.current;
    if (!p) return;
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': e.preventDefault(); _moveTetris(p, -1, 0); break;
      case 'ArrowRight': case 'd': case 'D': e.preventDefault(); _moveTetris(p, 1, 0); break;
      case 'ArrowDown': case 's': case 'S': e.preventDefault(); _moveTetris(p, 0, 1); break;
      case 'ArrowUp': case 'w': case 'W': e.preventDefault(); _rotateTetris(p); break;
      case ' ': e.preventDefault(); _hardDrop(); break;
    }
  };
  window.addEventListener('keydown', _tetrisKeyDown);

  // 触摸控制
  let touchStart = null;
  _tetrisCanvas.ontouchstart = (e) => {
    e.preventDefault();
    touchStart = { x: e.touches[0].clientX, y: e.touches[0].clientY, time: Date.now() };
  };
  _tetrisCanvas.ontouchend = (e) => {
    e.preventDefault();
    if (!touchStart || !_tetrisState || _tetrisState.over) return;
    const dx = e.changedTouches[0].clientX - touchStart.x;
    const dy = e.changedTouches[0].clientY - touchStart.y;
    const absX = Math.abs(dx), absY = Math.abs(dy);
    if (absX < 15 && absY < 15) {
      _rotateTetris(_tetrisState.current);
    } else if (absX > absY) {
      _moveTetris(_tetrisState.current, dx > 0 ? 1 : -1, 0);
    } else {
      if (dy > 30) _hardDrop();
      else _moveTetris(_tetrisState.current, 0, 1);
    }
    touchStart = null;
  };

  // 触屏按钮
  const bindTetrisBtn = (id, fn) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.onclick = (e) => {
      e.preventDefault();
      if (!_tetrisState || _tetrisState.over) return;
      const p = _tetrisState.current;
      if (!p) return;
      fn(p);
    };
  };
  bindTetrisBtn('tetrisBtnLeft', (p) => _moveTetris(p, -1, 0));
  bindTetrisBtn('tetrisBtnRight', (p) => _moveTetris(p, 1, 0));
  bindTetrisBtn('tetrisBtnRotate', (p) => _rotateTetris(p));
  bindTetrisBtn('tetrisBtnDown', (p) => _moveTetris(p, 0, 1));
  bindTetrisBtn('tetrisBtnDrop', () => _hardDrop());

  if (_tetrisAnimId) cancelAnimationFrame(_tetrisAnimId);
  _tetrisAnimId = requestAnimationFrame(_tetrisLoop);
}

function _randomTetrisPiece() {
  const key = TETRIS_KEYS[Math.floor(Math.random() * TETRIS_KEYS.length)];
  const tet = TETROMINOES[key];
  return {
    shape: tet.shape.map(row => [...row]),
    color: tet.color,
    x: Math.floor((TETRIS_COLS - tet.shape[0].length) / 2),
    y: 0,
  };
}

function _spawnTetrisPiece() {
  _tetrisState.current = _tetrisState.next || _randomTetrisPiece();
  _tetrisState.next = _randomTetrisPiece();
  if (_collidesTetris(_tetrisState.current, 0, 0)) {
    _tetrisState.over = true;
    if (_tetrisAnimId) cancelAnimationFrame(_tetrisAnimId);
    if (_tetrisKeyDown) { window.removeEventListener('keydown', _tetrisKeyDown); _tetrisKeyDown = null; }
    GamePay.showGameOver('tetris', `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${_tetrisState.score}</b>`);
  }
}

function _collidesTetris(piece, dx, dy, shape) {
  const s = shape || piece.shape;
  for (let r = 0; r < s.length; r++) {
    for (let c = 0; c < s[r].length; c++) {
      if (!s[r][c]) continue;
      const nx = piece.x + c + dx;
      const ny = piece.y + r + dy;
      if (nx < 0 || nx >= TETRIS_COLS || ny >= TETRIS_ROWS) return true;
      if (ny >= 0 && _tetrisState.board[ny][nx]) return true;
    }
  }
  return false;
}

function _moveTetris(piece, dx, dy) {
  if (!_collidesTetris(piece, dx, dy)) {
    piece.x += dx;
    piece.y += dy;
    return true;
  }
  if (dy > 0) _lockTetris();
  return false;
}

function _rotateTetris(piece) {
  const rotated = piece.shape[0].map((_, i) => piece.shape.map(row => row[i]).reverse());
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!_collidesTetris(piece, kick, 0, rotated)) {
      piece.shape = rotated;
      piece.x += kick;
      return;
    }
  }
}

function _hardDrop() {
  while (_moveTetris(_tetrisState.current, 0, 1)) {}
}

function _lockTetris() {
  const p = _tetrisState.current;
  for (let r = 0; r < p.shape.length; r++) {
    for (let c = 0; c < p.shape[r].length; c++) {
      if (p.shape[r][c] && p.y + r >= 0) {
        _tetrisState.board[p.y + r][p.x + c] = p.color;
      }
    }
  }
  _clearLines();
  _spawnTetrisPiece();
}

function _clearLines() {
  let cleared = 0;
  for (let r = TETRIS_ROWS - 1; r >= 0; r--) {
    if (_tetrisState.board[r].every(c => c !== null)) {
      _tetrisState.board.splice(r, 1);
      _tetrisState.board.unshift(Array(TETRIS_COLS).fill(null));
      cleared++;
      r++;
    }
  }
  if (cleared > 0) {
    const points = [0, 100, 300, 500, 800][cleared] || 0;
    _tetrisState.score += points;
    _tetrisState.lines += cleared;
    _tetrisState.dropInterval = Math.max(200, 800 - _tetrisState.lines * 20);
    document.getElementById('tetrisScore').textContent = _tetrisState.score;
    document.getElementById('tetrisLines').textContent = _tetrisState.lines;
  }
}

function _tetrisLoop(timestamp) {
  const s = _tetrisState;
  if (!s || s.over) return;

  if (!s.lastTime) s.lastTime = timestamp;
  const dt = timestamp - s.lastTime;
  s.lastTime = timestamp;
  s.dropTime += dt;

  if (s.dropTime >= s.dropInterval) {
    s.dropTime = 0;
    _moveTetris(s.current, 0, 1);
  }

  _drawTetris();
  _tetrisAnimId = requestAnimationFrame(_tetrisLoop);
}

function _drawTetris() {
  const ctx = _tetrisCtx;
  const s = _tetrisState;
  ctx.fillStyle = '#0a0a1a';
  ctx.fillRect(0, 0, TETRIS_W, TETRIS_H);

  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  for (let i = 0; i <= TETRIS_COLS; i++) {
    ctx.beginPath();
    ctx.moveTo(i * TETRIS_CELL, 0);
    ctx.lineTo(i * TETRIS_CELL, TETRIS_H);
    ctx.stroke();
  }
  for (let i = 0; i <= TETRIS_ROWS; i++) {
    ctx.beginPath();
    ctx.moveTo(0, i * TETRIS_CELL);
    ctx.lineTo(TETRIS_W, i * TETRIS_CELL);
    ctx.stroke();
  }

  for (let r = 0; r < TETRIS_ROWS; r++) {
    for (let c = 0; c < TETRIS_COLS; c++) {
      if (s.board[r][c]) _drawTetrisBlock(c, r, s.board[r][c]);
    }
  }

  if (s.current) {
    const p = s.current;
    for (let r = 0; r < p.shape.length; r++) {
      for (let c = 0; c < p.shape[r].length; c++) {
        if (p.shape[r][c]) _drawTetrisBlock(p.x + c, p.y + r, p.color);
      }
    }
  }
}

function _drawTetrisBlock(col, row, color) {
  const ctx = _tetrisCtx;
  const x = col * TETRIS_CELL;
  const y = row * TETRIS_CELL;
  ctx.fillStyle = color;
  ctx.fillRect(x + 1, y + 1, TETRIS_CELL - 2, TETRIS_CELL - 2);
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  ctx.fillRect(x + 1, y + 1, TETRIS_CELL - 2, 4);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fillRect(x + 1, y + TETRIS_CELL - 5, TETRIS_CELL - 2, 4);
}

window.TOOL_REGISTRY['tetris'] = {
  render: renderTetris,
  bind: bindTetrisEvents,
  beforeUnmount: () => {
    if (_tetrisAnimId) cancelAnimationFrame(_tetrisAnimId);
    if (_tetrisKeyDown) { window.removeEventListener('keydown', _tetrisKeyDown); _tetrisKeyDown = null; }
    _tetrisAnimId = null;
    _tetrisState = null;
    _tetrisCanvas = null;
    _tetrisCtx = null;
  }
};
