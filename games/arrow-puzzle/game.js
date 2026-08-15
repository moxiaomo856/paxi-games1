/**
 * ➡️ 箭头消除（长折线箭头版）
 * 使用 ➜ 旋转实现四个方向，折线特征明显
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _arrowState = null;
let _arrowHintTimer = null;

const MAX_LEVEL = 268;
// ---- 长折线箭头：使用 ➜ ----
const ARROW_CHAR = '➜';
const DIR_LIST = [
  { id: 'up', dx: 0, dy: -1, rotate: 270 },
  { id: 'down', dx: 0, dy: 1, rotate: 90 },
  { id: 'left', dx: -1, dy: 0, rotate: 180 },
  { id: 'right', dx: 1, dy: 0, rotate: 0 }
];
const DIR_COLORS = {
  'up': '#ff6b6b',
  'down': '#4dabf7',
  'left': '#69db7c',
  'right': '#da77f2'
};
const DIR_COLORS_DIMMED = {
  'up': '#6b4a4a',
  'down': '#4a5a6b',
  'left': '#4a6b4a',
  'right': '#6b4a6b'
};

function _getRandomDir() {
  const idx = Math.floor(Math.random() * DIR_LIST.length);
  return DIR_LIST[idx];
}

function _getBoardSize(level) {
  if (level <= 10) return 4;
  if (level <= 50) return 5;
  if (level <= 100) return 6;
  if (level <= 150) return 7;
  if (level <= 200) return 8;
  if (level <= 250) return 8;
  return 9;
}

function _generateGrid(level) {
  const size = _getBoardSize(level);
  const emptyRatio = Math.min(0.5, 0.1 + level * 0.002);
  const grid = Array(size).fill(null).map(() => Array(size).fill(null));
  let placed = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (Math.random() < emptyRatio) continue;
      const shuffled = DIR_LIST.slice().sort(() => Math.random() - 0.5);
      for (const dir of shuffled) {
        const nr = r + dir.dy, nc = c + dir.dx;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size || grid[nr][nc] === null) {
          grid[r][c] = { dir: dir.id, rotate: dir.rotate };
          placed++;
          break;
        }
      }
    }
  }

  if (placed < Math.max(4, size)) {
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] === null) {
          const candidates = DIR_LIST.filter(dir => {
            const nr = r + dir.dy, nc = c + dir.dx;
            return nr < 0 || nr >= size || nc < 0 || nc >= size || grid[nr][nc] === null;
          });
          if (candidates.length > 0) {
            const chosen = candidates[Math.floor(Math.random() * candidates.length)];
            grid[r][c] = { dir: chosen.id, rotate: chosen.rotate };
            placed++;
          }
        }
        if (placed >= size * 2) break;
      }
      if (placed >= size * 2) break;
    }
  }
  return grid;
}

function _isRemovable(grid, r, c) {
  const cell = grid[r][c];
  if (!cell) return false;
  const dirInfo = DIR_LIST.find(d => d.id === cell.dir);
  if (!dirInfo) return false;
  const nr = r + dirInfo.dy, nc = c + dirInfo.dx;
  const size = grid.length;
  return nr < 0 || nr >= size || nc < 0 || nc >= size || grid[nr][nc] === null;
}

function renderArrowPuzzle() {
  return `
    <div class="card">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">📚 ${t('arrow.level')}: <b id="arrowLevel" style="color:var(--primary)">1</b>/268</span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">🏆 ${t('arrow.cleared')}: <b id="arrowScore" style="color:var(--warning)">0</b></span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">❤️ <b id="arrowHearts" style="color:var(--danger)">5</b></span>
        ${GamePay.roundsBadge('arrow-puzzle')}
      </div>
      <div style="position:relative;width:100%;max-width:400px;margin:0 auto;">
        <div id="arrowBoard" style="display:grid;gap:6px;padding:10px;background:#18212b;border-radius:16px;width:100%;aspect-ratio:1;touch-action:manipulation;"></div>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.85);border-radius:16px;z-index:10;padding:10px;box-sizing:border-box;overflow:hidden;">
          ${GamePay.overlayHTML('arrow-puzzle', 'game.arrow-puzzle', 'arrow.controls')}
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
        <button id="arrowHintBtn" class="btn sec" style="flex:1;">💡 ${t('arrow.hint')}</button>
        <button id="arrowRestartBtn" class="btn sec" style="flex:1;">🔄 ${t('arrow.restart')}</button>
      </div>
      <div id="arrowStatus" style="text-align:center;color:var(--text-muted);font-size:13px;margin-top:10px;min-height:20px;">${t('arrow.desc')}</div>
    </div>
    <style>
      .arrow-cell{aspect-ratio:1;background:#2c3d4f;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:clamp(30px, 7.5vw, 46px);font-weight:900;color:#dbeafe;box-shadow:0 3px 0 #0f171f, inset 0 -2px 4px rgba(0,0,0,0.3);transition:all 0.1s;cursor:pointer;touch-action:manipulation;text-shadow:0 2px 4px rgba(0,0,0,0.5);}
      .arrow-cell:active{transform:scale(0.92);}
      .arrow-cell.empty{background:#1f2c38;box-shadow:inset 0 2px 6px rgba(0,0,0,0.4);color:transparent;pointer-events:none;text-shadow:none;}
      .arrow-cell.wrong{background:#a03a4a!important;animation:shake 0.2s;}
      .arrow-cell.hint-highlight{box-shadow:0 0 16px #7ddf7d, 0 0 30px #7ddf7d;border:2px solid #7ddf7d;}
      .arrow-cell.flying{transition:transform 0.5s cubic-bezier(0.34, 1.1, 0.64, 1), opacity 0.5s;pointer-events:none;z-index:5;}
      @keyframes shake{0%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}100%{transform:translateX(0)}}
      #gpOverlay #gpOverlayTitle{font-size:20px!important;margin-bottom:8px!important;}
      #gpOverlay #gpOverlaySub{font-size:12px!important;margin-bottom:12px!important;line-height:1.5;max-width:100%;}
      #gpOverlay #gpStartBtn{min-width:160px!important;font-size:14px!important;padding:8px 16px!important;}
    </style>
  `;
}

function bindArrowEvents() {
  GamePay.bindStart('arrow-puzzle', () => startArrowGame());
}

function startArrowGame(keepScore) {
  if (!GamePay.consumeRound('arrow-puzzle')) return;

  const overlay = document.getElementById('gpOverlay');
  if (overlay) overlay.style.display = 'none';

  const prevScore = keepScore && _arrowState ? _arrowState.score : 0;
  const prevLevel = keepScore && _arrowState ? _arrowState.level : 1;
  const prevHearts = keepScore && _arrowState ? _arrowState.hearts : 5;

  _arrowState = {
    level: prevLevel,
    score: prevScore,
    hearts: prevHearts,
    grid: null,
    size: _getBoardSize(prevLevel),
    gameOver: false,
    levelCompleted: false,
    hintCells: [],
    hintUsed: 0,
    hintLimit: 3,
  };
  _arrowState.grid = _generateGrid(_arrowState.level);

  GamePay.registerRevive('arrow-puzzle', () => {
    if (_arrowState) {
      _arrowState.hearts = 5;
      _arrowState.gameOver = false;
      _arrowState.levelCompleted = false;
      _arrowState.grid = _generateGrid(_arrowState.level);
      _arrowState.hintCells = [];
      _arrowState.hintUsed = 0;
      _renderBoard();
      _updateUI();
      document.getElementById('arrowStatus').textContent = `♻️ 已复活，第 ${_arrowState.level} 关`;
    }
  });

  _renderBoard();
  _updateUI();
  document.getElementById('arrowStatus').textContent = `第 ${_arrowState.level} 关，点击可消除的箭头！`;

  document.getElementById('arrowHintBtn').onclick = () => _giveHint();
  document.getElementById('arrowRestartBtn').onclick = () => _resetLevel();

  const board = document.getElementById('arrowBoard');
  board.onclick = (e) => {
    const cell = e.target.closest('.arrow-cell');
    if (!cell || cell.classList.contains('empty')) return;
    if (_arrowState.gameOver || _arrowState.levelCompleted) return;
    const r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
    if (isNaN(r) || isNaN(c)) return;
    _handleClick(r, c, cell);
  };
}

function _updateUI() {
  document.getElementById('arrowLevel').textContent = _arrowState.level;
  document.getElementById('arrowScore').textContent = _arrowState.score;
  document.getElementById('arrowHearts').textContent = _arrowState.hearts;
}

function _giveHint() {
  const s = _arrowState;
  if (!s || s.gameOver || s.levelCompleted) return;
  if (s.hintUsed >= s.hintLimit) {
    document.getElementById('arrowStatus').textContent = '💡 本关提示次数已用完！';
    return;
  }
  const cells = [];
  const grid = s.grid;
  const size = s.size;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] !== null && _isRemovable(grid, r, c)) {
        cells.push([r, c]);
      }
    }
  }
  if (cells.length === 0) {
    document.getElementById('arrowStatus').textContent = '💡 当前没有可消除的箭头';
    return;
  }
  s.hintUsed++;
  if (s.score > 0) s.score--;
  document.getElementById('arrowScore').textContent = s.score;

  const shuffled = cells.sort(() => Math.random() - 0.5);
  s.hintCells = shuffled.slice(0, Math.min(5, shuffled.length));
  _renderBoard();

  if (s.hintUsed === s.hintLimit) {
    s.hearts--;
    document.getElementById('arrowHearts').textContent = s.hearts;
    document.getElementById('arrowStatus').textContent = `💔 提示次数用尽，扣一颗心！剩余 ${s.hearts} 颗`;
    if (s.hearts <= 0) {
      s.gameOver = true;
      GamePay.showGameOver('arrow-puzzle', `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`, { score: s.score });
    }
  } else {
    document.getElementById('arrowStatus').textContent = `💡 已用 ${s.hintUsed}/${s.hintLimit} 次提示，扣1分`;
  }

  if (_arrowHintTimer) clearTimeout(_arrowHintTimer);
  _arrowHintTimer = setTimeout(() => {
    if (s) { s.hintCells = []; _renderBoard(); }
  }, 2500);
}

function _handleClick(r, c, cellEl) {
  const s = _arrowState;
  if (!s || !s.grid) return;
  const grid = s.grid;
  if (grid[r][c] === null) return;

  if (!_isRemovable(grid, r, c)) {
    s.hearts--;
    document.getElementById('arrowHearts').textContent = s.hearts;
    cellEl.classList.add('wrong');
    setTimeout(() => cellEl.classList.remove('wrong'), 300);
    document.getElementById('arrowStatus').textContent = '❌ 这个箭头指向另一个箭头，-1 ❤️';
    if (s.hearts <= 0) {
      s.gameOver = true;
      GamePay.showGameOver('arrow-puzzle', `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`, { score: s.score });
    }
    return;
  }

  const cellData = grid[r][c];
  const dirInfo = DIR_LIST.find(d => d.id === cellData.dir);
  const d = { dx: dirInfo.dx, dy: dirInfo.dy };
  const size = s.size;
  const distance = size * 1.5;
  const tx = d.dx * distance;
  const ty = d.dy * distance;

  const clone = cellEl.cloneNode(true);
  clone.style.position = 'absolute';
  clone.style.left = cellEl.offsetLeft + 'px';
  clone.style.top = cellEl.offsetTop + 'px';
  clone.style.width = cellEl.offsetWidth + 'px';
  clone.style.height = cellEl.offsetHeight + 'px';
  clone.style.margin = '0';
  clone.style.zIndex = '10';
  clone.classList.add('flying');
  const board = document.getElementById('arrowBoard');
  board.appendChild(clone);

  cellEl.classList.add('empty');
  cellEl.textContent = '';
  cellEl.style.background = '';
  grid[r][c] = null;
  s.score++;
  document.getElementById('arrowScore').textContent = s.score;
  document.getElementById('arrowStatus').textContent = `✔️ 消除 1 个箭头`;

  requestAnimationFrame(() => {
    clone.style.transform = `translate(${tx}px, ${ty}px) rotate(${cellData.rotate}deg)`;
    clone.style.opacity = '0';
  });

  setTimeout(() => {
    if (clone.parentNode) clone.parentNode.removeChild(clone);
  }, 600);

  s.hintCells = [];

  setTimeout(() => {
    let remaining = 0;
    for (let rr = 0; rr < size; rr++) {
      for (let cc = 0; cc < size; cc++) {
        if (grid[rr][cc] !== null) remaining++;
      }
    }
    if (remaining === 0) {
      s.levelCompleted = true;
      if (s.level >= MAX_LEVEL) {
        document.getElementById('arrowStatus').textContent = '🏆🏆🏆 通关全部268关！';
        s.gameOver = true;
        GamePay.showGameOver('arrow-puzzle', `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`, { win: true, score: s.score });
      } else {
        document.getElementById('arrowStatus').textContent = `🎉 第 ${s.level} 关通过！进入下一关`;
        setTimeout(() => {
          s.level++;
          s.hearts = 5;
          s.gameOver = false;
          s.levelCompleted = false;
          s.size = _getBoardSize(s.level);
          s.grid = _generateGrid(s.level);
          s.hintCells = [];
          s.hintUsed = 0;
          _renderBoard();
          _updateUI();
          document.getElementById('arrowStatus').textContent = `第 ${s.level} 关，加油！`;
        }, 1200);
      }
    } else {
      let hasRemovable = false;
      for (let rr = 0; rr < size; rr++) {
        for (let cc = 0; cc < size; cc++) {
          if (grid[rr][cc] !== null && _isRemovable(grid, rr, cc)) {
            hasRemovable = true;
            break;
          }
        }
        if (hasRemovable) break;
      }
      if (!hasRemovable) {
        document.getElementById('arrowStatus').textContent = '♻️ 没有可消除的箭头，自动重置本关';
        setTimeout(() => {
          s.grid = _generateGrid(s.level);
          s.hintCells = [];
          s.hintUsed = 0;
          _renderBoard();
          _updateUI();
          document.getElementById('arrowStatus').textContent = `第 ${s.level} 关已重置`;
        }, 800);
      }
    }
  }, 350);
}

function _resetLevel() {
  const s = _arrowState;
  if (!s) return;
  s.grid = _generateGrid(s.level);
  s.hearts = 5;
  s.gameOver = false;
  s.levelCompleted = false;
  s.hintCells = [];
  s.hintUsed = 0;
  _renderBoard();
  _updateUI();
  document.getElementById('arrowStatus').textContent = `🔄 已重置第 ${s.level} 关`;
}

function _renderBoard() {
  const s = _arrowState;
  const board = document.getElementById('arrowBoard');
  if (!board || !s) return;
  const size = s.size;
  board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;

  board.innerHTML = '';
  const grid = s.grid;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const cell = document.createElement('div');
      cell.className = 'arrow-cell';
      const val = grid[r][c];
      if (val === null) {
        cell.classList.add('empty');
      } else {
        cell.textContent = ARROW_CHAR;
        cell.style.transform = `rotate(${val.rotate}deg)`;
        cell.dataset.r = r;
        cell.dataset.c = c;
        const removable = _isRemovable(grid, r, c);
        const color = removable ? DIR_COLORS[val.dir] : DIR_COLORS_DIMMED[val.dir];
        cell.style.color = color;
        cell.style.textShadow = removable ? `0 0 16px ${color}60, 0 2px 4px rgba(0,0,0,0.5)` : 'none';
        if (s.hintCells.some(([hr, hc]) => hr === r && hc === c)) {
          cell.classList.add('hint-highlight');
        }
        cell.dataset.rotate = val.rotate;
      }
      board.appendChild(cell);
    }
  }
}

window.TOOL_REGISTRY['arrow-puzzle'] = {
  render: renderArrowPuzzle,
  bind: bindArrowEvents,
  beforeUnmount: () => {
    if (_arrowHintTimer) clearTimeout(_arrowHintTimer);
    _arrowState = null;
  }
};