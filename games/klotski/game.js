/**
 * 华容道 — 移植自 paxi-toolbox（付费逻辑统一到 game-pay.js）
 * 本游戏无死亡：通关 → 结束本局，再来一局需重新支付入场费
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _klotskiState = null;
let _klotskiKeyDown = null;
let _klotskiLastTouchTime = 0;

const KLOTSKI_LAYOUT = [
  { id: 'caocao', type: 'big', x: 1, y: 0, w: 2, h: 2, name: '曹操', nameEn: 'Cao Cao' },
  { id: 'zhangfei', type: 'vert', x: 0, y: 0, w: 1, h: 2, name: '张飞', nameEn: 'Zhang Fei' },
  { id: 'zhaoyun', type: 'vert', x: 3, y: 0, w: 1, h: 2, name: '赵云', nameEn: 'Zhao Yun' },
  { id: 'machao', type: 'vert', x: 0, y: 2, w: 1, h: 2, name: '马超', nameEn: 'Ma Chao' },
  { id: 'huangzhong', type: 'vert', x: 3, y: 2, w: 1, h: 2, name: '黄忠', nameEn: 'Huang Zhong' },
  { id: 'guanyu', type: 'horiz', x: 1, y: 2, w: 2, h: 1, name: '关羽', nameEn: 'Guan Yu' },
  { id: 'b1', type: 'small', x: 1, y: 3, w: 1, h: 1, name: '兵', nameEn: 'Soldier' },
  { id: 'b2', type: 'small', x: 2, y: 3, w: 1, h: 1, name: '兵', nameEn: 'Soldier' },
  { id: 'b3', type: 'small', x: 0, y: 4, w: 1, h: 1, name: '兵', nameEn: 'Soldier' },
  { id: 'b4', type: 'small', x: 3, y: 4, w: 1, h: 1, name: '兵', nameEn: 'Soldier' },
];

function renderKlotski() {
  return `
    <div class="card">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;align-items:center;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('klotski.moves')}: <b id="klotskiMoves" style="color:var(--primary)">0</b></span>
        ${GamePay.roundsBadge('klotski')}
        <button id="klotskiResetBtn" style="padding:3px 10px;font-size:12px;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);color:var(--text);border-radius:6px;cursor:pointer;">${t('klotski.reset')}</button>
      </div>
      <div style="position:relative;display:flex;justify-content:center;">
        <div id="klotskiBoard" style="width:280px;max-width:100%;height:auto;aspect-ratio:4/5;background:#8b6f47;border:3px solid #5c4530;border-radius:8px;position:relative;touch-action:none;"></div>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);border-radius:8px;z-index:10;">
          ${GamePay.overlayHTML('klotski', 'klotski.title', 'klotski.controls')}
        </div>
      </div>
    </div>
  `;
}

function bindKlotskiEvents() {
  GamePay.bindStart('klotski', startKlotskiGame);
}

function startKlotskiGame() {
  if (!GamePay.consumeRound('klotski')) return;

  _klotskiState = {
    blocks: JSON.parse(JSON.stringify(KLOTSKI_LAYOUT)),
    selected: null,
    moves: 0,
    won: false,
  };
  _renderKlotskiBoard();

  const resetBtn = document.getElementById('klotskiResetBtn');
  if (resetBtn) {
    resetBtn.onclick = (e) => {
      e.stopPropagation();
      _klotskiState.blocks = JSON.parse(JSON.stringify(KLOTSKI_LAYOUT));
      _klotskiState.selected = null;
      _klotskiState.moves = 0;
      _klotskiState.won = false;
      _renderKlotskiBoard();
    };
  }

  if (_klotskiKeyDown) window.removeEventListener('keydown', _klotskiKeyDown);
  _klotskiKeyDown = (e) => {
    if (!_klotskiState || _klotskiState.won || !_klotskiState.selected) return;
    let dx = 0, dy = 0;
    switch (e.key) {
      case 'ArrowLeft': case 'a': case 'A': dx = -1; break;
      case 'ArrowRight': case 'd': case 'D': dx = 1; break;
      case 'ArrowUp': case 'w': case 'W': dy = -1; break;
      case 'ArrowDown': case 's': case 'S': dy = 1; break;
      default: return;
    }
    e.preventDefault();
    _tryMoveBlock(_klotskiState.selected, dx, dy);
  };
  window.addEventListener('keydown', _klotskiKeyDown);

  const board = document.getElementById('klotskiBoard');
  if (board) {
    let touchStart = null;
    const getBlockAt = (boardX, boardY) => {
      if (!_klotskiState) return null;
      const rect = board.getBoundingClientRect();
      const relX = boardX - rect.left;
      const relY = boardY - rect.top;
      const col = Math.floor((relX / rect.width) * 4);
      const row = Math.floor((relY / rect.height) * 5);
      if (col < 0 || col >= 4 || row < 0 || row >= 5) return null;
      return _klotskiState.blocks.find(b =>
        col >= b.x && col < b.x + b.w && row >= b.y && row < b.y + b.h
      );
    };

    board.ontouchstart = (e) => {
      if (!_klotskiState || _klotskiState.won) return;
      const te = e.touches[0];
      const block = getBlockAt(te.clientX, te.clientY);
      touchStart = { x: te.clientX, y: te.clientY, blockId: block ? block.id : null };
      if (block) _klotskiState.selected = block.id;
      else touchStart = null;
    };
    board.ontouchmove = (e) => {
      e.preventDefault();
      if (!touchStart || !_klotskiState || _klotskiState.won) return;
      const te = e.touches[0];
      const dx = te.clientX - touchStart.x;
      const dy = te.clientY - touchStart.y;
      const absX = Math.abs(dx), absY = Math.abs(dy);
      if (Math.max(absX, absY) > 15 && touchStart.blockId) {
        const dirX = absX > absY ? (dx > 0 ? 1 : -1) : 0;
        const dirY = absX > absY ? 0 : (dy > 0 ? 1 : -1);
        _tryMoveBlock(touchStart.blockId, dirX, dirY, true);
      }
    };
    board.ontouchend = (e) => {
      if (!touchStart || !_klotskiState || _klotskiState.won) { touchStart = null; return; }
      if (!touchStart.blockId) { touchStart = null; return; }
      const te = e.changedTouches[0];
      const dx = te.clientX - touchStart.x;
      const dy = te.clientY - touchStart.y;
      const absX = Math.abs(dx), absY = Math.abs(dy);
      if (Math.max(absX, absY) < 15) {
        _klotskiLastTouchTime = Date.now();
        if (_klotskiState.selected === touchStart.blockId) _klotskiState.selected = null;
        else _klotskiState.selected = touchStart.blockId;
        _renderKlotskiBoard();
      } else {
        _klotskiLastTouchTime = Date.now();
        if (absX > absY) _tryMoveBlock(touchStart.blockId, dx > 0 ? 1 : -1, 0);
        else _tryMoveBlock(touchStart.blockId, 0, dy > 0 ? 1 : -1);
      }
      touchStart = null;
    };
  }
}

function _renderKlotskiBoard() {
  const board = document.getElementById('klotskiBoard');
  if (!board || !_klotskiState) return;
  board.innerHTML = '';

  const cellWPct = 100 / 4;
  const cellHPct = 100 / 5;
  const colors = { big: '#e74c3c', vert: '#3498db', horiz: '#2ecc71', small: '#f39c12' };

  _klotskiState.blocks.forEach(b => {
    const div = document.createElement('div');
    const isSelected = _klotskiState.selected === b.id;
    div.style.cssText = `
      position:absolute;
      left:${b.x * cellWPct}%;
      top:${b.y * cellHPct}%;
      width:${b.w * cellWPct}%;
      height:${b.h * cellHPct}%;
      padding:2px;
      box-sizing:border-box;
      background:${colors[b.type]};
      border-radius:6px;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#fff;
      font-weight:700;
      font-size:${b.type === 'big' ? '16px' : '11px'};
      cursor:pointer;
      box-shadow:${isSelected ? '0 0 0 3px #fff, 0 4px 8px rgba(0,0,0,0.3)' : '0 2px 4px rgba(0,0,0,0.3)'};
      transition:all 0.15s;
      user-select:none;
      -webkit-tap-highlight-color:transparent;
    `;
    div.textContent = window.PAXI_LANG === 'en' ? b.nameEn : b.name;
    div.dataset.blockId = b.id;

    div.addEventListener('click', (e) => {
      e.stopPropagation();
      if (Date.now() - _klotskiLastTouchTime < 300) return;
      if (!_klotskiState || _klotskiState.won) return;
      if (_klotskiState.selected === b.id) _klotskiState.selected = null;
      else _klotskiState.selected = b.id;
      _renderKlotskiBoard();
    });
    board.appendChild(div);
  });

  board.onclick = () => {
    if (Date.now() - _klotskiLastTouchTime < 300) return;
    if (_klotskiState) { _klotskiState.selected = null; _renderKlotskiBoard(); }
  };

  const movesEl = document.getElementById('klotskiMoves');
  if (movesEl) movesEl.textContent = _klotskiState.moves;
}

function _tryMoveBlock(blockId, dx, dy, preview) {
  const block = _klotskiState.blocks.find(b => b.id === blockId);
  if (!block) return false;

  const newX = block.x + dx;
  const newY = block.y + dy;

  if (newX < 0 || newY < 0 || newX + block.w > 4 || newY + block.h > 5) return false;

  for (const other of _klotskiState.blocks) {
    if (other.id === block.id) continue;
    if (newX < other.x + other.w && newX + block.w > other.x &&
        newY < other.y + other.h && newY + block.h > other.y) {
      return false;
    }
  }

  if (preview) {
    block._origX = block.x;
    block._origY = block.y;
    block.x = newX;
    block.y = newY;
    _renderKlotskiBoard();
    block.x = block._origX;
    block.y = block._origY;
    return true;
  }

  block.x = newX;
  block.y = newY;
  _klotskiState.moves++;
  _renderKlotskiBoard();

  if (block.id === 'caocao' && block.x === 1 && block.y === 3) {
    _klotskiState.won = true;
    if (_klotskiKeyDown) { window.removeEventListener('keydown', _klotskiKeyDown); _klotskiKeyDown = null; }
    setTimeout(() => {
      GamePay.showGameOver('klotski', `${t('klotski.win')}! ${t('klotski.moves')}: <b style="color:var(--primary);font-size:20px;">${_klotskiState.moves}</b>`, { win: true });
    }, 300);
  }
  return true;
}

window.TOOL_REGISTRY['klotski'] = {
  render: renderKlotski,
  bind: bindKlotskiEvents,
  beforeUnmount: () => {
    if (_klotskiKeyDown) { window.removeEventListener('keydown', _klotskiKeyDown); _klotskiKeyDown = null; }
    _klotskiState = null;
  }
};
