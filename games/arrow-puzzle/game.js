/**
 * ➡️ 箭头消除（连锁转向）— 集成 GamePay + 首次引导教程
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _arrowState = null;
let _arrowHintTimer = null;

const ARROW_SIZE = 8;
const MAX_LEVEL = 268;
const DIRECTIONS = { '↑':[-1,0], '↓':[1,0], '←':[0,-1], '→':[0,1] };
const ARROWS = ['↑','↓','←','→'];

// ============================================================
// 教程专用棋盘（第 1 关固定，简单可解）
// ============================================================
function _getTutorialGrid() {
  const g = Array(ARROW_SIZE).fill(null).map(() => Array(ARROW_SIZE).fill(null));
  g[0][0] = '→';
  g[0][1] = '↓';
  g[1][1] = '←';
  g[7][0] = '→';
  g[7][1] = '↓';
  g[6][7] = '↑';
  g[5][7] = '←';
  return g;
}

// ============================================================
// 难度曲线
// ============================================================
function _getEmptyProb(level) {
  if (level <= 80) return 0.35 - (level - 1) * (0.27 / 79);
  else if (level <= 160) return 0.08 - (level - 80) * (0.045 / 80);
  else return 0.035 - (level - 160) * (0.01 / 108);
}

// ============================================================
// 核心算法
// ============================================================
function _isValidStart(grid, r, c) {
  const ch = grid[r][c];
  if (!ch) return false;
  const dir = DIRECTIONS[ch];
  let nr = r + dir[0], nc = c + dir[1];
  while (nr >= 0 && nr < ARROW_SIZE && nc >= 0 && nc < ARROW_SIZE) {
    if (grid[nr][nc] !== null) return true;
    nr += dir[0]; nc += dir[1];
  }
  return false;
}

function _collectChain(grid, startR, startC) {
  const collected = [];
  let curR = startR, curC = startC;
  const visited = new Set();
  collected.push([curR, curC]);
  visited.add(`${curR},${curC}`);
  while (true) {
    const ch = grid[curR][curC];
    if (!ch) break;
    const dir = DIRECTIONS[ch];
    let nr = curR + dir[0], nc = curC + dir[1];
    let found = false;
    while (nr >= 0 && nr < ARROW_SIZE && nc >= 0 && nc < ARROW_SIZE) {
      const key = `${nr},${nc}`;
      if (grid[nr][nc] !== null && !visited.has(key)) {
        collected.push([nr, nc]);
        visited.add(key);
        curR = nr; curC = nc;
        found = true;
        break;
      }
      nr += dir[0]; nc += dir[1];
    }
    if (!found) break;
  }
  return collected;
}

function _generateGrid(level) {
  const tutorialDone = localStorage.getItem('paxi_tutorial_done') === 'true';
  if (level === 1 && !tutorialDone) {
    return _getTutorialGrid();
  }

  const emptyProb = _getEmptyProb(level);
  for (let attempt = 0; attempt < 100; attempt++) {
    const newGrid = [];
    for (let r = 0; r < ARROW_SIZE; r++) {
      const row = [];
      for (let c = 0; c < ARROW_SIZE; c++) {
        if (Math.random() < emptyProb) row.push(null);
        else row.push(ARROWS[Math.floor(Math.random() * ARROWS.length)]);
      }
      newGrid.push(row);
    }
    let hasValid = false;
    for (let r = 0; r < ARROW_SIZE; r++) {
      for (let c = 0; c < ARROW_SIZE; c++) {
        if (newGrid[r][c] !== null && _isValidStart(newGrid, r, c)) { hasValid = true; break; }
      }
      if (hasValid) break;
    }
    if (hasValid) return newGrid;
  }
  const fallback = Array.from({length:ARROW_SIZE}, () => new Array(ARROW_SIZE).fill(null));
  fallback[0][0] = '→'; fallback[0][1] = '↓'; fallback[1][1] = '←';
  return fallback;
}

// ============================================================
// 渲染
// ============================================================
function renderArrowPuzzle() {
  return `
    <div class="card">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">📚 ${t('arrow.level')}: <b id="arrowLevel" style="color:var(--primary)">1</b>/268</span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">🏆 ${t('arrow.cleared')}: <b id="arrowScore" style="color:var(--warning)">0</b></span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">❤️ <b id="arrowHearts" style="color:var(--danger)">5</b></span>
        ${GamePay.roundsBadge('arrow-puzzle')}
      </div>
      <div style="position:relative;display:flex;justify-content:center;">
        <div id="arrowBoard" style="display:grid;grid-template-columns:repeat(8,1fr);gap:6px;padding:10px;background:#18212b;border-radius:16px;width:100%;max-width:400px;touch-action:manipulation;"></div>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);border-radius:8px;z-index:10;">
          ${GamePay.overlayHTML('arrow-puzzle', 'game.arrow-puzzle', 'arrow.controls')}
        </div>
        <div id="tutorialOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:none;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);border-radius:8px;z-index:20;padding:20px;pointer-events:none;">
          <div id="tutorialMessage" style="background:#1e2a36;padding:16px 20px;border-radius:16px;max-width:320px;text-align:center;color:#e8ebfa;font-size:15px;line-height:1.8;border:2px solid #4a5490;pointer-events:auto;box-shadow:0 8px 30px rgba(0,0,0,0.8);">
            <div id="tutorialText"></div>
            <button id="tutorialNextBtn" style="display:none;margin-top:12px;padding:10px 28px;border:none;border-radius:60px;background:linear-gradient(90deg,#8fb0ff,#6d8dff);color:#141830;font-weight:700;font-size:14px;cursor:pointer;">下一步</button>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">
        <button id="arrowHintBtn" class="btn sec" style="flex:1;">💡 ${t('arrow.hint')}</button>
        <button id="arrowRestartBtn" class="btn sec" style="flex:1;">🔄 ${t('arrow.restart')}</button>
      </div>
      <div id="arrowStatus" style="text-align:center;color:var(--text-muted);font-size:13px;margin-top:10px;min-height:20px;">${t('arrow.desc')}</div>
    </div>
    <style>
      .arrow-cell{aspect-ratio:1;background:#2c3d4f;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700;color:#dbeafe;box-shadow:0 3px 0 #0f171f;transition:all 0.08s;cursor:pointer;touch-action:manipulation;}
      .arrow-cell:active{transform:scale(0.92);}
      .arrow-cell.empty{background:#1f2c38;box-shadow:inset 0 2px 6px rgba(0,0,0,0.4);color:transparent;pointer-events:none;}
      .arrow-cell.wrong{background:#a03a4a!important;animation:shake 0.2s;}
      .arrow-cell.hint{background:#4f7a4f!important;box-shadow:0 0 12px #7ddf7d;}
      .arrow-cell.tutorial-highlight{background:#f5c542!important;box-shadow:0 0 20px #f5c542;animation:pulse-gold 1s ease-in-out infinite;}
      @keyframes shake{0%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}100%{transform:translateX(0)}}
      @keyframes pulse-gold{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
    </style>
  `;
}

function bindArrowEvents() {
  GamePay.bindStart('arrow-puzzle', () => startArrowGame());
}

// ============================================================
// 教程状态管理
// ============================================================
const TUTORIAL_STEPS = [
  { id: 'step0', text: '👆 <b>点击这个</b> 高亮箭头<br>光会沿着它的方向前进' },
  { id: 'step1', text: '✨ 光遇到箭头会 <b>转向</b>，继续前进' },
  { id: 'step2', text: '🎉 光飞出边界！<b>整条链条消除</b>，得分为链条长度' },
  { id: 'step3', text: '✅ 继续消除剩余箭头，直到清空棋盘过关！' },
];

let _tutorialActive = false;
let _tutorialStep = 0;
let _tutorialTargets = [];

function _startTutorial() {
  const done = localStorage.getItem('paxi_tutorial_done') === 'true';
  if (done) return false;
  if (_arrowState.level !== 1) return false;
  _tutorialActive = true;
  _tutorialStep = 0;
  _showTutorialStep();
  return true;
}

function _showTutorialStep() {
  const overlay = document.getElementById('tutorialOverlay');
  const textEl = document.getElementById('tutorialText');
  const nextBtn = document.getElementById('tutorialNextBtn');
  if (!overlay || !textEl) return;

  overlay.style.display = 'flex';
  const step = TUTORIAL_STEPS[_tutorialStep];
  if (!step) {
    _finishTutorial();
    return;
  }

  textEl.innerHTML = step.text;

  _clearTutorialHighlights();
  if (_tutorialStep === 0) {
    _tutorialTargets = [[0,0], [7,0], [6,7]];
    _applyTutorialHighlights(_tutorialTargets);
  } else {
    _tutorialTargets = [];
  }

  // 最后一步显示“开始游戏”按钮
  if (_tutorialStep === TUTORIAL_STEPS.length - 1) {
    nextBtn.style.display = 'block';
    nextBtn.textContent = '🎯 开始游戏';
    nextBtn.onclick = () => {
      _finishTutorial();
    };
  } else {
    nextBtn.style.display = 'none';
    // 步骤2（索引2）延迟自动进入下一步（步骤3）
    if (_tutorialStep === 2) {
      setTimeout(() => {
        if (_tutorialActive && _tutorialStep === 2) {
          _tutorialStep = 3;
          _showTutorialStep();
        }
      }, 2000);
    }
  }

  document.getElementById('arrowStatus').textContent = `📖 教程 ${_tutorialStep+1}/${TUTORIAL_STEPS.length}`;
}

function _applyTutorialHighlights(targets) {
  const board = document.getElementById('arrowBoard');
  if (!board) return;
  const cells = board.querySelectorAll('.arrow-cell:not(.empty)');
  cells.forEach(el => {
    const r = parseInt(el.dataset.r);
    const c = parseInt(el.dataset.c);
    if (targets.some(([tr, tc]) => tr === r && tc === c)) {
      el.classList.add('tutorial-highlight');
    }
  });
}

function _clearTutorialHighlights() {
  document.querySelectorAll('.arrow-cell.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
}

function _finishTutorial() {
  _tutorialActive = false;
  const overlay = document.getElementById('tutorialOverlay');
  if (overlay) overlay.style.display = 'none';
  document.getElementById('arrowStatus').textContent = '🎯 教程完成，开始挑战！';
  localStorage.setItem('paxi_tutorial_done', 'true');
  _clearTutorialHighlights();
}

function _handleTutorialClick(r, c) {
  if (!_tutorialActive) return null;

  if (_tutorialStep === 0) {
    const isValid = _tutorialTargets.some(([tr, tc]) => tr === r && tc === c);
    if (!isValid) {
      document.getElementById('arrowStatus').textContent = '👆 请点击高亮的箭头';
      return 'blocked';
    }
    // 进入步骤1（索引1）
    _tutorialStep = 1;
    _showTutorialStep();
    // 触发路径动画
    const grid = _arrowState.grid;
    const path = _collectChain(grid, r, c);
    _showPathAnimation(path);
    return 'proceed';
  }

  if (_tutorialStep === 1 || _tutorialStep === 2) {
    // 这些步骤自动过渡，不允许点击
    document.getElementById('arrowStatus').textContent = '⏳ 请等待教程继续…';
    return 'blocked';
  }

  return null; // 步骤3及之后允许正常游戏
}

function _showPathAnimation(path) {
  const board = document.getElementById('arrowBoard');
  if (!board) return;
  const cells = board.querySelectorAll('.arrow-cell:not(.empty)');
  const pathSet = new Set(path.map(([pr, pc]) => `${pr},${pc}`));
  cells.forEach(el => {
    const r = parseInt(el.dataset.r);
    const c = parseInt(el.dataset.c);
    if (pathSet.has(`${r},${c}`)) {
      el.classList.add('hint');
    }
  });
  document.getElementById('arrowStatus').textContent = `✨ 路径上有 ${path.length} 个箭头，光会依次转向`;
  setTimeout(() => {
    cells.forEach(el => el.classList.remove('hint'));
    // 进入步骤2（索引2）
    _tutorialStep = 2;
    _showTutorialStep();
  }, 1800);
}

// ============================================================
// 游戏控制
// ============================================================
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
  };
  _arrowState.grid = _generateGrid(_arrowState.level);

  GamePay.registerRevive('arrow-puzzle', () => {
    if (_arrowState) {
      _arrowState.hearts = 5;
      _arrowState.gameOver = false;
      _arrowState.levelCompleted = false;
      _arrowState.grid = _generateGrid(_arrowState.level);
      _arrowState.hintCells = [];
      _renderArrowBoard();
      document.getElementById('arrowStatus').textContent = `♻️ 已复活，第 ${_arrowState.level} 关`;
    }
  });

  _renderArrowBoard();
  document.getElementById('arrowLevel').textContent = _arrowState.level;
  document.getElementById('arrowScore').textContent = _arrowState.score;
  document.getElementById('arrowHearts').textContent = _arrowState.hearts;

  document.getElementById('arrowHintBtn').onclick = () => _giveHint();
  document.getElementById('arrowRestartBtn').onclick = () => _resetLevel();

  const tutorialStarted = _startTutorial();
  if (!tutorialStarted) {
    document.getElementById('arrowStatus').textContent = `第 ${_arrowState.level} 关，加油！`;
  }

  const board = document.getElementById('arrowBoard');
  board.onclick = (e) => {
    const cell = e.target.closest('.arrow-cell');
    if (!cell || cell.classList.contains('empty')) return;
    if (_arrowState.gameOver || _arrowState.levelCompleted) return;
    const r = parseInt(cell.dataset.r), c = parseInt(cell.dataset.c);
    if (isNaN(r) || isNaN(c)) return;

    if (_tutorialActive) {
      const result = _handleTutorialClick(r, c);
      if (result === 'blocked') return;
      if (result === 'proceed') {
        // 教程步骤1已触发路径动画，无需执行消除
        return;
      }
    }

    _handleClick(r, c, cell);
  };
}

function _handleClick(r, c, cellEl) {
  const s = _arrowState;
  if (!s || !s.grid) return;
  if (s.grid[r][c] === null) return;

  if (!_isValidStart(s.grid, r, c)) {
    s.hearts--;
    document.getElementById('arrowHearts').textContent = s.hearts;
    cellEl.classList.add('wrong');
    setTimeout(() => cellEl.classList.remove('wrong'), 300);
    document.getElementById('arrowStatus').textContent = '❌ 光直接飞出，-1 ❤️';
    if (s.hearts <= 0) {
      s.gameOver = true;
      document.getElementById('arrowStatus').textContent = '💔 生命耗尽';
      GamePay.showGameOver('arrow-puzzle', `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`, { score: s.score });
    }
    return;
  }

  const path = _collectChain(s.grid, r, c);
  for (const [er,ec] of path) s.grid[er][ec] = null;
  s.score += path.length;
  document.getElementById('arrowScore').textContent = s.score;
  document.getElementById('arrowStatus').textContent = `✔️ 消除 ${path.length} 个箭头`;
  s.hintCells = [];
  _renderArrowBoard();

  let emptyCount = 0;
  for (let rr=0; rr<ARROW_SIZE; rr++) for (let cc=0; cc<ARROW_SIZE; cc++) if (s.grid[rr][cc] === null) emptyCount++;
  if (emptyCount === ARROW_SIZE * ARROW_SIZE) {
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
        _renderArrowBoard();
        document.getElementById('arrowLevel').textContent = s.level;
        document.getElementById('arrowHearts').textContent = s.hearts;
        document.getElementById('arrowStatus').textContent = `第 ${s.level} 关，加油！`;
        if (s.level === 2 && !localStorage.getItem('paxi_tutorial_done')) {
          localStorage.setItem('paxi_tutorial_done', 'true');
        }
      }, 1500);
    }
  } else {
    let hasValid = false;
    for (let rr=0; rr<ARROW_SIZE; rr++) for (let cc=0; cc<ARROW_SIZE; cc++) {
      if (s.grid[rr][cc] !== null && _isValidStart(s.grid, rr, cc)) { hasValid = true; break; }
      if (hasValid) break;
    }
    if (!hasValid) {
      document.getElementById('arrowStatus').textContent = '♻️ 无有效箭头，自动重置本关';
      setTimeout(() => {
        s.grid = _generateGrid(s.level);
        s.hintCells = [];
        _renderArrowBoard();
        document.getElementById('arrowStatus').textContent = `第 ${s.level} 关已重置`;
      }, 600);
    }
  }
}

function _giveHint() {
  const s = _arrowState;
  if (!s || s.gameOver || s.levelCompleted) return;
  const valid = [];
  for (let r=0; r<ARROW_SIZE; r++) for (let c=0; c<ARROW_SIZE; c++) {
    if (s.grid[r][c] !== null && _isValidStart(s.grid, r, c)) valid.push([r,c]);
  }
  if (valid.length === 0) {
    document.getElementById('arrowStatus').textContent = '💡 当前无有效箭头';
    return;
  }
  const shuffled = valid.sort(() => Math.random() - 0.5);
  s.hintCells = shuffled.slice(0, 3);
  _renderArrowBoard();
  document.getElementById('arrowStatus').textContent = `💡 高亮 ${s.hintCells.length} 个可消除起点`;
  if (_arrowHintTimer) clearTimeout(_arrowHintTimer);
  _arrowHintTimer = setTimeout(() => {
    if (s) { s.hintCells = []; _renderArrowBoard(); }
  }, 2500);
}

function _resetLevel() {
  const s = _arrowState;
  if (!s) return;
  s.grid = _generateGrid(s.level);
  s.hearts = 5;
  s.gameOver = false;
  s.levelCompleted = false;
  s.hintCells = [];
  _renderArrowBoard();
  document.getElementById('arrowLevel').textContent = s.level;
  document.getElementById('arrowHearts').textContent = s.hearts;
  document.getElementById('arrowStatus').textContent = `🔄 已重置第 ${s.level} 关`;
}

function _renderArrowBoard() {
  const s = _arrowState;
  const board = document.getElementById('arrowBoard');
  if (!board || !s) return;
  board.innerHTML = '';
  for (let r=0; r<ARROW_SIZE; r++) {
    for (let c=0; c<ARROW_SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'arrow-cell';
      const val = s.grid[r][c];
      if (val === null) {
        cell.classList.add('empty');
      } else {
        cell.textContent = val;
        cell.dataset.r = r;
        cell.dataset.c = c;
        if (s.hintCells.some(([hr,hc]) => hr===r && hc===c)) {
          cell.classList.add('hint');
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
    _tutorialActive = false;
  }
};