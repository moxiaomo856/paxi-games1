/**
 * ➡️ 箭头消除（硬核提示版）
 * 每关最多3次提示，每次提示扣1分，使用满3次额外扣1颗心
 * 点击箭头 → 相邻格子为空或边界 → 消除（得分+1）
 * 否则 → 扣一颗心
 * 清空棋盘过关
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _arrowState = null;
let _arrowHintTimer = null;
const SIZE = 8;
const MAX_LEVEL = 268;
const ARROWS = ['↑', '↓', '←', '→'];
const DIR_MAP = {
  '↑': { dx: 0, dy: -1 },
  '↓': { dx: 0, dy: 1 },
  '←': { dx: -1, dy: 0 },
  '→': { dx: 1, dy: 0 }
};

// 生成棋盘
function _generateGrid(level) {
  const emptyRatio = Math.min(0.5, 0.1 + level * 0.002);
  const grid = Array(SIZE).fill(null).map(() => Array(SIZE).fill(null));
  let placed = 0;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (Math.random() < emptyRatio) continue;
      const shuffled = ARROWS.slice().sort(() => Math.random() - 0.5);
      for (const dir of shuffled) {
        const d = DIR_MAP[dir];
        const nr = r + d.dy, nc = c + d.dx;
        if (nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || grid[nr][nc] === null) {
          grid[r][c] = dir;
          placed++;
          break;
        }
      }
    }
  }

  if (placed < 5) {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (grid[r][c] === null) {
          const candidates = ARROWS.filter(dir => {
            const d = DIR_MAP[dir];
            const nr = r + d.dy, nc = c + d.dx;
            return nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || grid[nr][nc] === null;
          });
          if (candidates.length > 0) {
            grid[r][c] = candidates[0];
            placed++;
          }
        }
        if (placed >= 8) break;
      }
      if (placed >= 8) break;
    }
  }

  return grid;
}

function _isRemovable(grid, r, c) {
  const ch = grid[r][c];
  if (!ch) return false;
  const d = DIR_MAP[ch];
  const nr = r + d.dy, nc = c + d.dx;
  return nr < 0 || nr >= SIZE || nc < 0 || nc >= SIZE || grid[nr][nc] === null;
}

function renderArrowPuzzle() {
  return `
    <div class="card">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">📚 ${t('arrow.level')}: <b id="arrowLevel" style="color:var(--primary)">1</b>/268</span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">🏆 ${t('arrow.cleared')}: <b id="arrowScore" style="color:var(--warning)">0</b></span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">❤️ <b id="arrowHearts" style="color:var(--danger)">5</b></span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">💡 <b id="arrowHintRemain" style="color:var(--primary)">3</b></span>
        ${GamePay.roundsBadge('arrow-puzzle')}
      </div>
      <div style="position:relative;display:flex;justify-content:center;">
        <div id="arrowBoard" style="display:grid;grid-template-columns:repeat(8,1fr);gap:6px;padding:10px;background:#18212b;border-radius:16px;width:100%;max-width:400px;touch-action:manipulation;"></div>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);border-radius:8px;z-index:10;">
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
      .arrow-cell{aspect-ratio:1;background:#2c3d4f;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#dbeafe;box-shadow:0 3px 0 #0f171f;transition:all 0.1s;cursor:pointer;touch-action:manipulation;}
      .arrow-cell:active{transform:scale(0.92);}
      .arrow-cell.empty{background:#1f2c38;box-shadow:inset 0 2px 6px rgba(0,0,0,0.4);color:transparent;pointer-events:none;}
      .arrow-cell.wrong{background:#a03a4a!important;animation:shake 0.2s;}
      .arrow-cell.hint-highlight{background:#4f7a4f!important;box-shadow:0 0 12px #7ddf7d;}
      @keyframes shake{0%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}100%{transform:translateX(0)}}
    </style>
  `;
}

function bindArrowEvents() {
  GamePay.bindStart('arrow-puzzle', () => startArrowGame());
}

function startArrowGame(keepScore) {
  if (!GamePay.consumeRound('arrow-puzzle')) return;

  const prevScore = keepScore && _arrowState ? _arrowState.score : 0;
  const prevLevel = keepScore && _arrowState ? _arrowState.level : 1;
  const prevHearts = keepScore && _arrowState ? _arrowState.hearts : 5;

  _arrowState = {
    level: prevLevel,
    score: prevScore,
    hearts: prevHearts,
    grid: null,
    gameOver: false,
    levelCompleted: false,
    hintCells: [],
    hintUsed: 0,      // 本关已使用提示次数
    hintLimit: 3,     // 每关最多3次
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
      _renderArrowBoard();
      _updateHintUI();
      document.getElementById('arrowStatus').textContent = `♻️ 已复活，第 ${_arrowState.level} 关`;
    }
  });

  _renderArrowBoard();
  document.getElementById('arrowLevel').textContent = _arrowState.level;
  document.getElementById('arrowScore').textContent = _arrowState.score;
  document.getElementById('arrowHearts').textContent = _arrowState.hearts;
  _updateHintUI();
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

function _updateHintUI() {
  const remain = _arrowState.hintLimit - _arrowState.hintUsed;
  document.getElementById('arrowHintRemain').textContent = Math.max(0, remain);
}

function _giveHint() {
  const s = _arrowState;
  if (!s || s.gameOver || s.levelCompleted) return;

  // 检查提示次数是否用完
  if (s.hintUsed >= s.hintLimit) {
    document.getElementById('arrowStatus').textContent = '💡 本关提示次数已用完！';
    return;
  }

  // 查找可消除的箭头
  const cells = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (s.grid[r][c] !== null && _isRemovable(s.grid, r, c)) {
        cells.push([r, c]);
      }
    }
  }
  if (cells.length === 0) {
    document.getElementById('arrowStatus').textContent = '💡 当前没有可消除的箭头';
    return;
  }

  // 消耗一次提示
  s.hintUsed++;
  // 扣1分（分数最低为0）
  if (s.score > 0) s.score--;
  document.getElementById('arrowScore').textContent = s.score;

  // 高亮提示
  const shuffled = cells.sort(() => Math.random() - 0.5);
  s.hintCells = shuffled.slice(0, 5);
  _renderArrowBoard();

  // 检查是否达到3次（触发额外扣心）
  if (s.hintUsed === s.hintLimit) {
    s.hearts--;
    document.getElementById('arrowHearts').textContent = s.hearts;
    document.getElementById('arrowStatus').textContent = `💔 提示次数用尽，扣一颗心！剩余 ${s.hearts} 颗`;
    if (s.hearts <= 0) {
      s.gameOver = true;
      document.getElementById('arrowStatus').textContent = '💔 生命耗尽';
      GamePay.showGameOver('arrow-puzzle', `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`, { score: s.score });
    }
  } else {
    document.getElementById('arrowStatus').textContent = `💡 已用 ${s.hintUsed}/${s.hintLimit} 次提示，扣1分`;
  }

  _updateHintUI();

  // 2.5秒后清除高亮
  if (_arrowHintTimer) clearTimeout(_arrowHintTimer);
  _arrowHintTimer = setTimeout(() => {
    if (s) { s.hintCells = []; _renderArrowBoard(); }
  }, 2500);
}

function _handleClick(r, c, cellEl) {
  const s = _arrowState;
  if (!s || !s.grid) return;
  if (s.grid[r][c] === null) return;

  if (!_isRemovable(s.grid, r, c)) {
    s.hearts--;
    document.getElementById('arrowHearts').textContent = s.hearts;
    cellEl.classList.add('wrong');
    setTimeout(() => cellEl.classList.remove('wrong'), 300);
    document.getElementById('arrowStatus').textContent = '❌ 这个箭头指向另一个箭头，-1 ❤️';
    if (s.hearts <= 0) {
      s.gameOver = true;
      document.getElementById('arrowStatus').textContent = '💔 生命耗尽';
      GamePay.showGameOver('arrow-puzzle', `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`, { score: s.score });
    }
    return;
  }

  // 消除箭头
  s.grid[r][c] = null;
  s.score++;
  document.getElementById('arrowScore').textContent = s.score;
  document.getElementById('arrowStatus').textContent = `✔️ 消除 1 个箭头`;
  s.hintCells = [];
  _renderArrowBoard();

  // 检查是否清空
  let remaining = 0;
  for (let rr = 0; rr < SIZE; rr++) {
    for (let cc = 0; cc < SIZE; cc++) {
      if (s.grid[rr][cc] !== null) remaining++;
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
        s.grid = _generateGrid(s.level);
        s.hintCells = [];
        s.hintUsed = 0;
        _renderArrowBoard();
        document.getElementById('arrowLevel').textContent = s.level;
        document.getElementById('arrowHearts').textContent = s.hearts;
        _updateHintUI();
        document.getElementById('arrowStatus').textContent = `第 ${s.level} 关，加油！`;
      }, 1200);
    }
  } else {
    // 检查是否还有可消除的箭头
    let hasRemovable = false;
    for (let rr = 0; rr < SIZE; rr++) {
      for (let cc = 0; cc < SIZE; cc++) {
        if (s.grid[rr][cc] !== null && _isRemovable(s.grid, rr, cc)) {
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
        _renderArrowBoard();
        _updateHintUI();
        document.getElementById('arrowStatus').textContent = `第 ${s.level} 关已重置`;
      }, 800);
    }
  }
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
  _renderArrowBoard();
  document.getElementById('arrowLevel').textContent = s.level;
  document.getElementById('arrowHearts').textContent = s.hearts;
  _updateHintUI();
  document.getElementById('arrowStatus').textContent = `🔄 已重置第 ${s.level} 关`;
}

function _renderArrowBoard() {
  const s = _arrowState;
  const board = document.getElementById('arrowBoard');
  if (!board || !s) return;
  board.innerHTML = '';
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'arrow-cell';
      const val = s.grid[r][c];
      if (val === null) {
        cell.classList.add('empty');
      } else {
        cell.textContent = val;
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (s.hintCells.some(([hr, hc]) => hr === r && hc === c)) {
          cell.classList.add('hint-highlight');
        }
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