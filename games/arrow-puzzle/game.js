/**
 * ➡️ 箭头消除（极简稳定版 + 昵称系统 + 动态尺寸 + 双排行榜）
 * 每个箭头判断：指向空格或边界 → 点击消除，否则扣心
 * 清空棋盘过关，支持268关
 * 连接钱包后显示关卡进度，支持昵称设置
 * 双排行榜：等级榜（最高关卡）+ 日累计榜（每日通关数）
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _arrowState = null;
let _arrowHintTimer = null;
const MAX_LEVEL = 268;
const ARROWS = ['↑', '↓', '←', '→'];
const DIR_MAP = {
  '↑': { dx: 0, dy: -1 },
  '↓': { dx: 0, dy: 1 },
  '←': { dx: -1, dy: 0 },
  '→': { dx: 1, dy: 0 }
};
const SAVE_KEY = 'arrow_puzzle_save';
const NICKNAME_KEY = 'paxi_nicknames';

// ========== 棋盘尺寸（动态） ==========
function _getBoardSize(level) {
  if (level <= 50) return { rows: 8, cols: 8 };      // 1-50关: 8×8
  if (level <= 150) return { rows: 10, cols: 8 };    // 51-150关: 10×8
  if (level <= 250) return { rows: 10, cols: 10 };   // 151-250关: 10×10
  return { rows: 12, cols: 10 };                      // 251-268关: 12×10
}

// ========== 昵称系统 ==========
function _getWalletAddress() {
  return (typeof state !== 'undefined' && state.connected && state.wallet) 
    ? state.wallet.address 
    : null;
}

function _getNicknames() {
  try {
    return JSON.parse(localStorage.getItem(NICKNAME_KEY) || '{}');
  } catch { return {}; }
}

function _saveNicknames(data) {
  localStorage.setItem(NICKNAME_KEY, JSON.stringify(data));
}

function _getMyNickname() {
  const addr = _getWalletAddress();
  if (!addr) return null;
  const nicknames = _getNicknames();
  return nicknames[addr] || null;
}

function _isNicknameTaken(nickname, excludeAddr) {
  const nicknames = _getNicknames();
  for (const [addr, nick] of Object.entries(nicknames)) {
    if (addr !== excludeAddr && nick.toLowerCase() === nickname.toLowerCase()) {
      return true;
    }
  }
  return false;
}

function _setNickname(nickname) {
  const addr = _getWalletAddress();
  if (!addr) return { success: false, error: '请先连接钱包' };
  if (!nickname || nickname.trim().length < 2) {
    return { success: false, error: '昵称至少2个字符' };
  }
  if (nickname.length > 16) {
    return { success: false, error: '昵称不能超过16个字符' };
  }
  if (!/^[a-zA-Z\u4e00-\u9fa5][a-zA-Z0-9\u4e00-\u9fa5_]{1,15}$/.test(nickname)) {
    return { success: false, error: '昵称只能包含字母、数字、中文、下划线' };
  }
  if (_isNicknameTaken(nickname, addr)) {
    return { success: false, error: '该昵称已被使用，请换一个' };
  }
  const nicknames = _getNicknames();
  nicknames[addr] = nickname.trim();
  _saveNicknames(nicknames);
  return { success: true, nickname: nickname.trim() };
}

// ========== 存档功能 ==========
function _saveProgress() {
  if (!_arrowState) return;
  const addr = _getWalletAddress();
  try {
    const saveData = {
      level: _arrowState.level,
      score: _arrowState.score,
      hearts: _arrowState.hearts,
      grid: _arrowState.grid,
      rows: _arrowState.rows,
      cols: _arrowState.cols,
      savedAt: Date.now(),
      address: addr || 'guest'
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(saveData));
  } catch (e) {}
}

function _loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data.level || !data.grid || !Array.isArray(data.grid)) return null;
    return data;
  } catch (e) {
    return null;
  }
}

function _clearProgress() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch (e) {}
}

// ========== 排行榜存储 ==========
function _saveLeaderboard(level, dailyCleared) {
  const addr = _getWalletAddress();
  if (!addr) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const key = 'paxi_arrow_leaderboard';
    const data = JSON.parse(localStorage.getItem(key) || '{}');
    
    if (!data[addr]) {
      data[addr] = { 
        maxLevel: 0, 
        daily: {}, 
        nickname: _getMyNickname() || addr.slice(0, 8)
      };
    }
    
    // 更新最高等级
    if (level > data[addr].maxLevel) {
      data[addr].maxLevel = level;
    }
    
    // 更新日累计
    if (!data[addr].daily[today]) {
      data[addr].daily[today] = 0;
    }
    data[addr].daily[today] += dailyCleared;
    
    // 更新昵称
    const nick = _getMyNickname();
    if (nick) data[addr].nickname = nick;
    
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {}
}

// ========== 生成棋盘 ==========
function _generateGrid(level) {
  const { rows, cols } = _getBoardSize(level);
  const emptyRatio = Math.min(0.5, 0.1 + level * 0.002);
  const grid = Array(rows).fill(null).map(() => Array(cols).fill(null));
  let placed = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (Math.random() < emptyRatio) continue;
      const shuffled = ARROWS.slice().sort(() => Math.random() - 0.5);
      for (const dir of shuffled) {
        const d = DIR_MAP[dir];
        const nr = r + d.dy, nc = c + d.dx;
        if (nr < 0 || nr >= rows || nc < 0 || nc >= cols || grid[nr][nc] === null) {
          grid[r][c] = dir;
          placed++;
          break;
        }
      }
    }
  }
  const minDim = Math.min(rows, cols);
  if (placed < Math.max(4, minDim)) {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (grid[r][c] === null) {
          const candidates = ARROWS.filter(dir => {
            const d = DIR_MAP[dir];
            const nr = r + d.dy, nc = c + d.dx;
            return nr < 0 || nr >= rows || nc < 0 || nc >= cols || grid[nr][nc] === null;
          });
          if (candidates.length > 0) {
            grid[r][c] = candidates[0];
            placed++;
          }
        }
        if (placed >= minDim * 2) break;
      }
      if (placed >= minDim * 2) break;
    }
  }
  return grid;
}

// ========== 检查箭头是否可消除 ==========
function _isRemovable(grid, r, c) {
  const ch = grid[r][c];
  if (!ch) return false;
  const d = DIR_MAP[ch];
  const nr = r + d.dy, nc = c + d.dx;
  const rows = grid.length;
  const cols = grid[0] ? grid[0].length : 0;
  return nr < 0 || nr >= rows || nc < 0 || nc >= cols || grid[nr][nc] === null;
}

// ========== 昵称弹窗 ==========
function _showNicknameModal() {
  const existing = document.querySelector('.nickname-modal');
  if (existing) existing.remove();
  
  const myNick = _getMyNickname();
  const modal = document.createElement('div');
  modal.className = 'nickname-modal';
  modal.innerHTML = `
    <div class="nickname-modal-content">
      <h3 style="margin:0 0 4px;">${myNick ? '✏️ 修改昵称' : '🏷️ 设置昵称'}</h3>
      <p style="font-size:12px;color:var(--text-muted);margin:0 0 6px;">2-16个字符，支持中文、字母、数字、下划线，不可重复</p>
      <input id="nicknameInput" type="text" placeholder="输入昵称..." value="${myNick || ''}" maxlength="16" autofocus>
      <div id="nicknameStatus" style="font-size:12px;color:var(--danger);min-height:20px;"></div>
      <div class="btn-group">
        <button id="nicknameCancelBtn" style="background:var(--bg2);color:var(--text);border:1px solid var(--border);">取消</button>
        <button id="nicknameSaveBtn" style="background:linear-gradient(90deg,#8fb0ff,#6d8dff);color:#141830;">${myNick ? '保存' : '设置'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  
  const input = modal.querySelector('#nicknameInput');
  const status = modal.querySelector('#nicknameStatus');
  
  modal.querySelector('#nicknameCancelBtn').onclick = () => modal.remove();
  modal.querySelector('#nicknameSaveBtn').onclick = () => {
    const val = input.value.trim();
    const result = _setNickname(val);
    if (result.success) {
      status.style.color = 'var(--success)';
      status.textContent = '✅ 昵称设置成功！';
      showToast('🏷️ 昵称已设置为: ' + result.nickname, 'success');
      setTimeout(() => {
        modal.remove();
        const reg = window.TOOL_REGISTRY && window.TOOL_REGISTRY['arrow-puzzle'];
        if (reg) {
          const root = document.getElementById('gameRoot');
          root.innerHTML = reg.render();
          if (reg.bind) reg.bind();
        }
      }, 800);
    } else {
      status.style.color = 'var(--danger)';
      status.textContent = '❌ ' + result.error;
    }
  };
  
  input.onkeydown = (e) => {
    if (e.key === 'Enter') modal.querySelector('#nicknameSaveBtn').click();
    if (e.key === 'Escape') modal.remove();
  };
  setTimeout(() => input.focus(), 100);
  
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

// ========== 渲染界面 ==========
function renderArrowPuzzle() {
  const addr = _getWalletAddress();
  const myNick = _getMyNickname();
  const saved = _loadProgress();
  const levelDisplay = saved ? saved.level : 1;
  const scoreDisplay = saved ? saved.score : 0;
  
  return `
    <div class="card">
      <!-- 玩家信息栏 -->
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;flex-wrap:wrap;background:var(--bg);padding:6px 10px;border-radius:8px;">
        <span style="font-size:12px;color:var(--text-muted);">👤</span>
        ${addr ? `
          <span style="font-size:12px;color:var(--success);font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
            ${myNick ? '🏷️ ' + myNick : '🔗 ' + addr.slice(0, 8) + '…' + addr.slice(-6)}
          </span>
          <span style="font-size:11px;color:var(--primary);background:rgba(124,155,255,0.15);padding:2px 10px;border-radius:10px;">
            📚 进度: ${levelDisplay}/268
          </span>
        ` : `
          <span style="font-size:12px;color:var(--text-muted);flex:1;">未连接钱包 (进度保存在本地)</span>
        `}
        <button id="arrowNickBtn" style="font-size:11px;padding:3px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text);cursor:pointer;">
          ${myNick ? '✏️ 改昵称' : '🏷️ 设置昵称'}
        </button>
      </div>
      
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">📚 ${t('arrow.level')}: <b id="arrowLevel" style="color:var(--primary)">${levelDisplay}</b>/268</span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">🏆 ${t('arrow.cleared')}: <b id="arrowScore" style="color:var(--warning)">${scoreDisplay}</b></span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">❤️ <b id="arrowHearts" style="color:var(--danger)">5</b></span>
        ${GamePay.roundsBadge('arrow-puzzle')}
      </div>
      
      <!-- 排行榜快捷入口 -->
      <div style="display:flex;gap:6px;justify-content:center;margin-bottom:8px;">
        <button id="arrowRankBtn" class="btn sec" style="flex:1;padding:6px 10px;font-size:12px;min-height:32px;">🏆 等级排行榜</button>
        <button id="arrowDailyRankBtn" class="btn sec" style="flex:1;padding:6px 10px;font-size:12px;min-height:32px;">📊 日累计排行榜</button>
      </div>
      
      <div style="position:relative;width:100%;max-width:420px;margin:0 auto;">
        <div id="arrowBoard" style="display:grid;gap:5px;padding:10px;background:#18212b;border-radius:16px;width:100%;aspect-ratio:1;touch-action:manipulation;"></div>
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
      .arrow-cell{aspect-ratio:1;background:#2c3d4f;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:28px;font-weight:700;color:#dbeafe;box-shadow:0 3px 0 #0f171f;transition:all 0.1s;cursor:pointer;touch-action:manipulation;}
      .arrow-cell:active{transform:scale(0.92);}
      .arrow-cell.empty{background:#1f2c38;box-shadow:inset 0 2px 6px rgba(0,0,0,0.4);color:transparent;pointer-events:none;}
      .arrow-cell.wrong{background:#a03a4a!important;animation:shake 0.2s;}
      .arrow-cell.hint-highlight{background:#4f7a4f!important;box-shadow:0 0 12px #7ddf7d;}
      @keyframes shake{0%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}100%{transform:translateX(0)}}
      #gpOverlay #gpOverlayTitle{font-size:20px!important;margin-bottom:8px!important;}
      #gpOverlay #gpOverlaySub{font-size:12px!important;margin-bottom:12px!important;line-height:1.5;max-width:100%;}
      #gpOverlay #gpStartBtn{min-width:160px!important;font-size:14px!important;padding:8px 16px!important;}
      .nickname-modal{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:99998;display:flex;align-items:center;justify-content:center;padding:20px;}
      .nickname-modal-content{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:24px;max-width:380px;width:100%;}
      .nickname-modal-content input{width:100%;padding:10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:16px;margin:10px 0;}
      .nickname-modal-content .btn-group{display:flex;gap:10px;margin-top:10px;}
      .nickname-modal-content .btn-group button{flex:1;padding:10px;border:none;border-radius:8px;cursor:pointer;font-weight:600;}
      .rank-modal{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:99999;display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;}
      .rank-modal-content{background:var(--card);border:1px solid var(--border);border-radius:16px;padding:20px;max-width:420px;width:100%;max-height:80vh;overflow-y:auto;}
      .rank-modal-content h3{margin:0 0 12px;text-align:center;color:var(--warning);}
      .rank-item{display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin-bottom:4px;background:var(--bg);border-radius:8px;font-size:13px;}
      .rank-item .pos{font-weight:700;color:var(--primary);width:36px;flex-shrink:0;}
      .rank-item .name{flex:1;margin:0 8px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);}
      .rank-item .score{font-weight:700;color:var(--warning);flex-shrink:0;}
      .rank-item.top1{background:#2a2a1a;border:1px solid #fbbf24;}
      .rank-item.top2{border:1px solid #8b93bd;}
      .rank-item.top3{border:1px solid #cd7f32;}
      .rank-empty{text-align:center;color:var(--text-muted);padding:30px 0;}
      .rank-close{width:100%;margin-top:12px;padding:10px;border:none;border-radius:8px;background:var(--bg2);color:var(--text);cursor:pointer;font-weight:600;border:1px solid var(--border);}
    </style>
  `;
}

// ========== 排行榜弹窗 ==========
function _showRankModal(type) {
  const existing = document.querySelector('.rank-modal');
  if (existing) existing.remove();
  
  const addr = _getWalletAddress();
  const nicknames = _getNicknames();
  
  try {
    const key = 'paxi_arrow_leaderboard';
    const raw = localStorage.getItem(key);
    if (!raw) {
      _showRankEmptyModal(type);
      return;
    }
    const data = JSON.parse(raw);
    const today = new Date().toISOString().slice(0, 10);
    
    let list = [];
    
    if (type === 'level') {
      // 等级排行榜：按最高等级降序
      list = Object.entries(data)
        .filter(([a, d]) => d.maxLevel > 0)
        .map(([a, d]) => ({
          address: a,
          nickname: d.nickname || a.slice(0, 8),
          score: d.maxLevel || 0
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);
    } else {
      // 日累计排行榜：按今日通关数降序
      list = Object.entries(data)
        .filter(([a, d]) => d.daily && d.daily[today] > 0)
        .map(([a, d]) => ({
          address: a,
          nickname: d.nickname || a.slice(0, 8),
          score: d.daily[today] || 0
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 50);
    }
    
    if (list.length === 0) {
      _showRankEmptyModal(type);
      return;
    }
    
    const modal = document.createElement('div');
    modal.className = 'rank-modal';
    const title = type === 'level' ? '🏆 等级排行榜' : '📊 日累计排行榜（今日）';
    const subTitle = type === 'level' ? '最高关卡' : '今日通关数';
    
    let html = `
      <div class="rank-modal-content">
        <h3>${title}</h3>
        <div style="text-align:center;font-size:11px;color:var(--text-muted);margin-bottom:10px;">${subTitle}</div>
        <div>
    `;
    
    list.forEach((item, index) => {
      const rank = index + 1;
      let cls = 'rank-item';
      if (rank === 1) cls += ' top1';
      else if (rank === 2) cls += ' top2';
      else if (rank === 3) cls += ' top3';
      
      const isMe = item.address === addr;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '#' + rank;
      
      html += `
        <div class="${cls}" style="${isMe ? 'border:1px solid var(--primary);' : ''}">
          <span class="pos">${medal}</span>
          <span class="name">${item.nickname}${isMe ? ' 👈' : ''}</span>
          <span class="score">${item.score}</span>
        </div>
      `;
    });
    
    html += `
        </div>
        <button class="rank-close" onclick="document.querySelector('.rank-modal').remove()">关闭</button>
      </div>
    `;
    modal.innerHTML = html;
    document.body.appendChild(modal);
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
  } catch (e) {
    _showRankEmptyModal(type);
  }
}

function _showRankEmptyModal(type) {
  const modal = document.createElement('div');
  modal.className = 'rank-modal';
  const title = type === 'level' ? '🏆 等级排行榜' : '📊 日累计排行榜';
  modal.innerHTML = `
    <div class="rank-modal-content">
      <h3>${title}</h3>
      <div class="rank-empty">📭 暂无数据<br>快来挑战吧！</div>
      <button class="rank-close" onclick="document.querySelector('.rank-modal').remove()">关闭</button>
    </div>
  `;
  document.body.appendChild(modal);
  modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
}

function bindArrowEvents() {
  GamePay.bindStart('arrow-puzzle', () => startArrowGame());
}

// ========== 游戏启动 ==========
function startArrowGame(keepScore) {
  if (!GamePay.consumeRound('arrow-puzzle')) return;

  const overlay = document.getElementById('gpOverlay');
  if (overlay) overlay.style.display = 'none';

  const saved = _loadProgress();
  
  let prevScore = 0;
  let prevLevel = 1;
  let prevHearts = 5;
  let savedGrid = null;
  let savedRows = 8;
  let savedCols = 8;
  
  if (saved && !keepScore) {
    if (saved.hearts > 0 && saved.level <= MAX_LEVEL) {
      prevScore = saved.score || 0;
      prevLevel = saved.level || 1;
      prevHearts = saved.hearts || 5;
      savedGrid = saved.grid;
      savedRows = saved.rows || 8;
      savedCols = saved.cols || 8;
      if (savedGrid) {
        let valid = true;
        const rows = savedGrid.length;
        const cols = savedGrid[0] ? savedGrid[0].length : 0;
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            const val = savedGrid[r][c];
            if (val !== null && !ARROWS.includes(val)) { valid = false; break; }
          }
          if (!valid) break;
        }
        if (!valid) savedGrid = null;
      }
    }
  }
  
  if (keepScore && _arrowState) {
    prevScore = _arrowState.score;
    prevLevel = _arrowState.level;
    prevHearts = _arrowState.hearts;
    savedGrid = null;
  }

  const { rows, cols } = _getBoardSize(prevLevel);
  _arrowState = {
    level: prevLevel,
    score: prevScore,
    hearts: prevHearts,
    grid: null,
    rows: rows,
    cols: cols,
    gameOver: false,
    levelCompleted: false,
    hintCells: [],
    hintUsed: 0,
    hintLimit: 3,
    // 记录本局通关数（用于日累计）
    clearedInSession: 0
  };

  if (savedGrid) {
    _arrowState.grid = savedGrid;
    _arrowState.rows = savedRows;
    _arrowState.cols = savedCols;
    let hasRemovable = false;
    const rLen = _arrowState.grid.length;
    const cLen = _arrowState.grid[0] ? _arrowState.grid[0].length : 0;
    for (let r = 0; r < rLen; r++) {
      for (let c = 0; c < cLen; c++) {
        if (_arrowState.grid[r][c] !== null && _isRemovable(_arrowState.grid, r, c)) {
          hasRemovable = true;
          break;
        }
      }
      if (hasRemovable) break;
    }
    if (!hasRemovable) {
      _arrowState.grid = _generateGrid(_arrowState.level);
      _arrowState.rows = rows;
      _arrowState.cols = cols;
    }
    document.getElementById('arrowStatus').textContent = `📂 读取存档，第 ${_arrowState.level} 关继续！`;
  } else {
    _arrowState.grid = _generateGrid(_arrowState.level);
    _arrowState.rows = rows;
    _arrowState.cols = cols;
    document.getElementById('arrowStatus').textContent = `第 ${_arrowState.level} 关，点击可消除的箭头！`;
  }

  GamePay.registerRevive('arrow-puzzle', () => {
    if (_arrowState) {
      _arrowState.hearts = 5;
      _arrowState.gameOver = false;
      _arrowState.levelCompleted = false;
      const { rows: newRows, cols: newCols } = _getBoardSize(_arrowState.level);
      _arrowState.rows = newRows;
      _arrowState.cols = newCols;
      _arrowState.grid = _generateGrid(_arrowState.level);
      _arrowState.hintCells = [];
      _arrowState.hintUsed = 0;
      _renderBoard();
      _updateUI();
      _saveProgress();
      document.getElementById('arrowStatus').textContent = `♻️ 已复活，第 ${_arrowState.level} 关`;
    }
  });

  _renderBoard();
  _updateUI();
  document.getElementById('arrowStatus').textContent = `第 ${_arrowState.level} 关，点击可消除的箭头！`;

  document.getElementById('arrowHintBtn').onclick = () => _giveHint();
  document.getElementById('arrowRestartBtn').onclick = () => _resetLevel();
  
  // 排行榜按钮
  document.getElementById('arrowRankBtn').onclick = () => _showRankModal('level');
  document.getElementById('arrowDailyRankBtn').onclick = () => _showRankModal('daily');
  
  const nickBtn = document.getElementById('arrowNickBtn');
  if (nickBtn) nickBtn.onclick = () => {
    const addr = _getWalletAddress();
    if (!addr) {
      showToast('请先连接钱包再设置昵称', 'warning');
      return;
    }
    _showNicknameModal();
  };

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
  const rows = s.grid.length;
  const cols = s.grid[0] ? s.grid[0].length : 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
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
      _saveProgress();
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
    _saveProgress();
    if (s.hearts <= 0) {
      s.gameOver = true;
      GamePay.showGameOver('arrow-puzzle', `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`, { score: s.score });
    }
    return;
  }

  grid[r][c] = null;
  s.score++;
  document.getElementById('arrowScore').textContent = s.score;
  document.getElementById('arrowStatus').textContent = `✔️ 消除 1 个箭头`;
  s.hintCells = [];
  _renderBoard();

  const rows = s.grid.length;
  const cols = s.grid[0] ? s.grid[0].length : 0;
  let remaining = 0;
  for (let rr = 0; rr < rows; rr++) {
    for (let cc = 0; cc < cols; cc++) {
      if (grid[rr][cc] !== null) remaining++;
    }
  }

  if (remaining === 0) {
    s.levelCompleted = true;
    s.clearedInSession = (s.clearedInSession || 0) + 1;
    
    if (s.level >= MAX_LEVEL) {
      document.getElementById('arrowStatus').textContent = '🏆🏆🏆 通关全部268关！';
      s.gameOver = true;
      // 保存排行榜（通关全部268关）
      _saveLeaderboard(s.level, s.clearedInSession);
      _clearProgress();
      GamePay.showGameOver('arrow-puzzle', `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`, { win: true, score: s.score });
    } else {
      // 每通过一关，保存排行榜（更新最高等级和日累计）
      _saveLeaderboard(s.level, 1);
      
      document.getElementById('arrowStatus').textContent = `🎉 第 ${s.level} 关通过！进入下一关`;
      setTimeout(() => {
        s.level++;
        s.hearts = 5;
        s.gameOver = false;
        s.levelCompleted = false;
        const { rows: newRows, cols: newCols } = _getBoardSize(s.level);
        s.rows = newRows;
        s.cols = newCols;
        s.grid = _generateGrid(s.level);
        s.hintCells = [];
        s.hintUsed = 0;
        _renderBoard();
        _updateUI();
        _saveProgress();
        document.getElementById('arrowStatus').textContent = `第 ${s.level} 关，加油！`;
      }, 1200);
    }
  } else {
    let hasRemovable = false;
    for (let rr = 0; rr < rows; rr++) {
      for (let cc = 0; cc < cols; cc++) {
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
        const { rows: newRows, cols: newCols } = _getBoardSize(s.level);
        s.rows = newRows;
        s.cols = newCols;
        s.grid = _generateGrid(s.level);
        s.hintCells = [];
        s.hintUsed = 0;
        _renderBoard();
        _updateUI();
        _saveProgress();
        document.getElementById('arrowStatus').textContent = `第 ${s.level} 关已重置`;
      }, 800);
    } else {
      _saveProgress();
    }
  }
}

function _resetLevel() {
  const s = _arrowState;
  if (!s) return;
  const { rows, cols } = _getBoardSize(s.level);
  s.rows = rows;
  s.cols = cols;
  s.grid = _generateGrid(s.level);
  s.hearts = 5;
  s.gameOver = false;
  s.levelCompleted = false;
  s.hintCells = [];
  s.hintUsed = 0;
  _renderBoard();
  _updateUI();
  _saveProgress();
  document.getElementById('arrowStatus').textContent = `🔄 已重置第 ${s.level} 关`;
}

function _renderBoard() {
  const s = _arrowState;
  const board = document.getElementById('arrowBoard');
  if (!board || !s) return;
  const rows = s.grid.length;
  const cols = s.grid[0] ? s.grid[0].length : 0;
  board.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;

  board.innerHTML = '';
  const grid = s.grid;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cell = document.createElement('div');
      cell.className = 'arrow-cell';
      const val = grid[r][c];
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
    _saveProgress();
    _arrowState = null;
  }
};