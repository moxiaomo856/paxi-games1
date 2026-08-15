/**
 * ➡️ 箭头解谜（路径追踪版）- 修复遮罩遮挡 & 生成算法
 * 点击箭头 → 沿路径追踪，遇到箭头转向，直到飞出边界，整条链消除
 * 无法消除时扣一颗心
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _arrowState = null;
let _arrowHintTimer = null;
const ARROW_SIZE = 8;
const MAX_LEVEL = 268;
const ARROW_DIR = {
  '↑': { dx: 0, dy: -1, glyph: '⬆', color: '#243256' },
  '↓': { dx: 0, dy: 1, glyph: '⬇', color: '#562430' },
  '←': { dx: -1, dy: 0, glyph: '⬅', color: '#2b4536' },
  '→': { dx: 1, dy: 0, glyph: '➡', color: '#4d3a56' },
};
const ARROW_KEYS = ['↑', '↓', '←', '→'];

// ============================================================
// 生成关卡（确保每个箭头都可解）
// ============================================================
function _generateLevel(level) {
  const size = ARROW_SIZE;
  // 空格比例随关卡增加
  const emptyRatio = Math.min(0.5, 0.1 + level * 0.002);
  let attempts = 0;
  while (attempts++ < 50) {
    const grid = Array(size).fill(null).map(() => Array(size).fill(null));
    let placed = 0;
    // 先随机放置一部分箭头（满足相邻空格或边界）
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (Math.random() < emptyRatio) continue;
        const shuffled = ARROW_KEYS.slice().sort(() => Math.random() - 0.5);
        for (const dir of shuffled) {
          const d = ARROW_DIR[dir];
          const nr = r + d.dy, nc = c + d.dx;
          if (nr < 0 || nr >= size || nc < 0 || nc >= size || grid[nr][nc] === null) {
            grid[r][c] = dir;
            placed++;
            break;
          }
        }
      }
    }
    // 验证每个箭头是否能到达边界
    let allValid = true;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (grid[r][c] !== null) {
          const { canExit } = _findPath(grid, r, c);
          if (!canExit) { allValid = false; break; }
        }
      }
      if (!allValid) break;
    }
    if (allValid && placed >= 4) {
      return { grid, remaining: placed };
    }
  }
  // 兜底：边缘箭头指向外
  const fallback = Array(size).fill(null).map(() => Array(size).fill(null));
  for (let i = 0; i < size; i++) {
    fallback[0][i] = '↑';
    fallback[size-1][i] = '↓';
    fallback[i][0] = '←';
    fallback[i][size-1] = '→';
  }
  return { grid: fallback, remaining: size * 4 };
}

// 路径追踪
function _findPath(grid, startR, startC) {
  const path = [];
  const visited = new Set();
  let r = startR, c = startC;
  while (true) {
    const key = r + ',' + c;
    if (visited.has(key)) return { path: [], canExit: false };
    visited.add(key);
    const ch = grid[r][c];
    if (!ch) return { path: [], canExit: false };
    path.push({ r, c, dir: ch });
    const d = ARROW_DIR[ch];
    let nr = r + d.dy, nc = c + d.dx;
    // 如果下一步超出边界，可退出
    if (nr < 0 || nr >= ARROW_SIZE || nc < 0 || nc >= ARROW_SIZE) {
      return { path, canExit: true };
    }
    // 如果下一步是空格，则路径被阻断，不可退出（因为无法转向）
    if (grid[nr][nc] === null) {
      return { path, canExit: false };
    }
    // 否则继续
    r = nr; c = nc;
  }
}

// 渲染函数
function renderArrowPuzzle() {
  return `
    <div class="card">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">📚 ${t('arrow.level')}: <b id="arrowLevel" style="color:var(--primary)">1</b></span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">🏆 ${t('arrow.cleared')}: <b id="arrowScore" style="color:var(--warning)">0</b></span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">❤️ <b id="arrowHearts" style="color:var(--danger)">5</b></span>
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
      .arrow-cell{aspect-ratio:1;background:#2c3d4f;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#dbeafe;box-shadow:0 3px 0 #0f171f;transition:all 0.1s;cursor:pointer;touch-action:manipulation;}
      .arrow-cell:active{transform:scale(0.92);}
      .arrow-cell.empty{background:#1f2c38;box-shadow:inset 0 2px 6px rgba(0,0,0,0.4);color:transparent;pointer-events:none;}
      .arrow-cell.wrong{background:#a03a4a!important;animation:shake 0.2s;}
      .arrow-cell.hint-highlight{background:#4f7a4f!important;box-shadow:0 0 12px #7ddf7d;}
      .arrow-cell.path-highlight{background:#f5c542!important;box-shadow:0 0 16px #f5c542;}
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
    hintUsed: 0,
    hintLimit: 3,
  };
  _arrowState.grid = _generateLevel(_arrowState.level);

  GamePay.registerRevive('arrow-puzzle', () => {
    if (_arrowState) {
      _arrowState.hearts = 5;
      _arrowState.gameOver = false;
      _arrowState.levelCompleted = false;
      _arrowState.grid = _generateLevel(_arrowState.level);
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
  const remain = _arrowState.hintLimit - _arrowState.hintUsed;
  // 如果存在提示剩余显示元素，更新（可选）
}

function _giveHint() {
  const s = _arrowState;
  if (!s || s.gameOver || s.levelCompleted) return;
  if (s.hintUsed >= s.hintLimit) {
    document.getElementById('arrowStatus').textContent = '💡 本关提示次数已用完！';
    return;
  }
  const cells = [];
  const grid = s.grid.grid;
  for (let r = 0; r < ARROW_SIZE; r++) {
    for (let c = 0; c < ARROW_SIZE; c++) {
      if (grid[r][c] !== null) {
        const { canExit } = _findPath(grid, r, c);
        if (canExit) cells.push([r, c]);
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
  s.hintCells = shuffled.slice(0, 5);
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
  const grid = s.grid.grid;
  if (grid[r][c] === null) return;

  const { path, canExit } = _findPath(grid, r, c);
  if (!canExit || path.length === 0) {
    // 不可消除：扣心
    s.hearts--;
    document.getElementById('arrowHearts').textContent = s.hearts;
    cellEl.classList.add('wrong');
    setTimeout(() => cellEl.classList.remove('wrong'), 300);
    document.getElementById('arrowStatus').textContent = '❌ 路径被阻挡，-1 ❤️';
    if (s.hearts <= 0) {
      s.gameOver = true;
      GamePay.showGameOver('arrow-puzzle', `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`, { score: s.score });
    }
    return;
  }

  // 消除整条路径
  for (const p of path) {
    grid[p.r][p.c] = null;
    s.grid.remaining--;
    s.score++;
  }
  document.getElementById('arrowScore').textContent = s.score;
  document.getElementById('arrowStatus').textContent = `✔️ 消除 ${path.length} 个箭头`;
  s.hintCells = [];
  _renderBoard();

  // 检查过关
  if (s.grid.remaining <= 0) {
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
        s.grid = _generateLevel(s.level);
        s.hintCells = [];
        s.hintUsed = 0;
        _renderBoard();
        _updateUI();
        document.getElementById('arrowStatus').textContent = `第 ${s.level} 关，加油！`;
      }, 1200);
    }
  } else {
    // 检查是否还有可消除的箭头
    let hasValid = false;
    for (let rr = 0; rr < ARROW_SIZE; rr++) {
      for (let cc = 0; cc < ARROW_SIZE; cc++) {
        if (grid[rr][cc] !== null) {
          const { canExit } = _findPath(grid, rr, cc);
          if (canExit) { hasValid = true; break; }
        }
      }
      if (hasValid) break;
    }
    if (!hasValid) {
      document.getElementById('arrowStatus').textContent = '♻️ 没有可消除的箭头，自动重置本关';
      setTimeout(() => {
        s.grid = _generateLevel(s.level);
        s.hintCells = [];
        s.hintUsed = 0;
        _renderBoard();
        _updateUI();
        document.getElementById('arrowStatus').textContent = `第 ${s.level} 关已重置`;
      }, 800);
    }
  }
}

function _resetLevel() {
  const s = _arrowState;
  if (!s) return;
  s.grid = _generateLevel(s.level);
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
  board.innerHTML = '';
  const grid = s.grid.grid;
  for (let r = 0; r < ARROW_SIZE; r++) {
    for (let c = 0; c < ARROW_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'arrow-cell';
      const val = grid[r][c];
      if (val === null) {
        cell.classList.add('empty');
      } else {
        cell.textContent = ARROW_DIR[val].glyph;
        cell.style.background = ARROW_DIR[val].color;
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