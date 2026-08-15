/**
 * 泡泡龙 — 移植自 paxi-toolbox（付费逻辑统一到 game-pay.js）
 * 死亡(泡泡压到底)/全部消除 → GamePay.showGameOver → 复活 = 保留分数重开局
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _bubbleCanvas = null;
let _bubbleCtx = null;
let _bubbleState = null;
let _bubbleAnimId = null;
let _bubbleMouseHandler = null;
let _bubbleClickHandler = null;

const BUBBLE_W = 360;
const BUBBLE_H = 480;
const BUBBLE_R = 16;
const BUBBLE_COLS = 10;
const BUBBLE_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6'];

function renderBubbleShooter() {
  return `
    <div class="card">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('bubble.score')}: <b id="bubbleScore" style="color:var(--primary)">0</b></span>
        ${GamePay.roundsBadge('bubble-shooter')}
      </div>
      <div style="position:relative;display:flex;justify-content:center;">
        <canvas id="bubbleCanvas" width="${BUBBLE_W}" height="${BUBBLE_H}" style="background:linear-gradient(180deg,#1a1a3a 0%,#0a0a1a 100%);border-radius:8px;touch-action:none;max-width:100%;height:auto;"></canvas>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);border-radius:8px;z-index:10;">
          ${GamePay.overlayHTML('bubble-shooter', 'bubble.title', 'bubble.controls')}
        </div>
      </div>
    </div>
  `;
}

function bindBubbleEvents() {
  GamePay.bindStart('bubble-shooter', startBubbleGame);
}

function _cleanupInitialGrid() {
  const g = _bubbleState.grid;
  const colsAtRow = (r) => r % 2 === 0 ? BUBBLE_COLS : BUBBLE_COLS - 1;
  const getNeighbors = (r, c) => {
    const offset = r % 2 === 0 ? -1 : 0;
    return [
      [r, c - 1], [r, c + 1],
      [r - 1, c + offset], [r - 1, c + offset + 1],
      [r + 1, c + offset], [r + 1, c + offset + 1],
    ].filter(([nr, nc]) => nr >= 0 && nr < g.length && nc >= 0 && nc < colsAtRow(nr));
  };

  let changed = true;
  while (changed) {
    changed = false;

    const visited = new Set();
    for (let r = 0; r < g.length; r++) {
      for (let c = 0; c < colsAtRow(r); c++) {
        if (!g[r][c]) continue;
        const key = r + ',' + c;
        if (visited.has(key)) continue;

        const color = g[r][c].color;
        const group = [];
        const q = [[r, c]];
        visited.add(key);
        while (q.length > 0) {
          const [cr, cc] = q.shift();
          if (!g[cr][cc] || g[cr][cc].color !== color) continue;
          group.push([cr, cc]);
          for (const [nr, nc] of getNeighbors(cr, cc)) {
            const nk = nr + ',' + nc;
            if (!visited.has(nk) && g[nr] && g[nr][nc] && g[nr][nc].color === color) {
              visited.add(nk);
              q.push([nr, nc]);
            }
          }
        }

        if (group.length >= 3) {
          for (const [gr, gc] of group) g[gr][gc] = null;
          changed = true;
        }
      }
    }

    if (!changed) break;

    const connected = new Set();
    const topQ = [];
    if (g[0]) {
      for (let cc = 0; cc < g[0].length; cc++) {
        if (g[0][cc]) { topQ.push([0, cc]); connected.add('0,' + cc); }
      }
    }
    while (topQ.length > 0) {
      const [cr, cc] = topQ.shift();
      for (const [nr, nc] of getNeighbors(cr, cc)) {
        const nk = nr + ',' + nc;
        if (!connected.has(nk) && g[nr] && g[nr][nc]) {
          connected.add(nk);
          topQ.push([nr, nc]);
        }
      }
    }
    for (let r = 1; r < g.length; r++) {
      for (let c = 0; c < colsAtRow(r); c++) {
        if (g[r][c] && !connected.has(r + ',' + c)) {
          g[r][c] = null;
          changed = true;
        }
      }
    }
  }
}

// keepScore=true 时为复活模式
function startBubbleGame(keepScore) {
  if (!GamePay.consumeRound('bubble-shooter')) return;

  _bubbleCanvas = document.getElementById('bubbleCanvas');
  if (!_bubbleCanvas) return;
  _bubbleCtx = _bubbleCanvas.getContext('2d');

  const prevScore = keepScore && _bubbleState ? _bubbleState.score : 0;

  const grid = [];
  for (let r = 0; r < 6; r++) {
    const row = [];
    const cols = r % 2 === 0 ? BUBBLE_COLS : BUBBLE_COLS - 1;
    for (let c = 0; c < cols; c++) {
      row.push({ color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)] });
    }
    grid.push(row);
  }

  _bubbleState = {
    grid: grid,
    shooter: { x: BUBBLE_W / 2, y: BUBBLE_H - 40, angle: -Math.PI / 2 },
    currentBubble: { color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)] },
    nextBubble: { color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)] },
    flying: null,
    score: prevScore,
    over: false,
    dropping: [],
    frame: 0,
  };
  document.getElementById('bubbleScore').textContent = prevScore;

  _cleanupInitialGrid();

  GamePay.registerRevive('bubble-shooter', () => startBubbleGame(true));

  if (_bubbleMouseHandler) _bubbleCanvas.removeEventListener('mousemove', _bubbleMouseHandler);
  if (_bubbleClickHandler) _bubbleCanvas.removeEventListener('click', _bubbleClickHandler);

  const aim = (clientX, clientY) => {
    if (!_bubbleState || _bubbleState.over) return;
    const rect = _bubbleCanvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (BUBBLE_W / rect.width);
    const y = (clientY - rect.top) * (BUBBLE_H / rect.height);
    _bubbleState.shooter.angle = Math.atan2(y - _bubbleState.shooter.y, x - _bubbleState.shooter.x);
    if (_bubbleState.shooter.angle > -0.2) _bubbleState.shooter.angle = -0.2;
    if (_bubbleState.shooter.angle < -Math.PI + 0.2) _bubbleState.shooter.angle = -Math.PI + 0.2;
  };

  _bubbleMouseHandler = (e) => aim(e.clientX, e.clientY);
  _bubbleClickHandler = () => { _shootBubble(); };

  _bubbleCanvas.addEventListener('mousemove', _bubbleMouseHandler);
  _bubbleCanvas.addEventListener('click', _bubbleClickHandler);

  _bubbleCanvas.ontouchstart = (e) => {
    e.preventDefault();
    aim(e.touches[0].clientX, e.touches[0].clientY);
  };
  _bubbleCanvas.ontouchmove = (e) => {
    e.preventDefault();
    aim(e.touches[0].clientX, e.touches[0].clientY);
  };
  _bubbleCanvas.ontouchend = (e) => {
    e.preventDefault();
    _shootBubble();
  };

  if (_bubbleAnimId) cancelAnimationFrame(_bubbleAnimId);
  _bubbleAnimId = requestAnimationFrame(_bubbleLoop);
}

function _shootBubble() {
  const s = _bubbleState;
  if (!s || s.over || s.flying) return;
  const speed = 8;
  s.flying = {
    x: s.shooter.x, y: s.shooter.y,
    vx: Math.cos(s.shooter.angle) * speed,
    vy: Math.sin(s.shooter.angle) * speed,
    color: s.currentBubble.color,
  };
  s.currentBubble = s.nextBubble;
  s.nextBubble = { color: BUBBLE_COLORS[Math.floor(Math.random() * BUBBLE_COLORS.length)] };
}

function _bubbleLoop() {
  const s = _bubbleState;
  if (!s || s.over) return;
  s.frame++;

  _bubbleCtx.fillStyle = 'rgba(10,10,26,0.5)';
  _bubbleCtx.fillRect(0, 0, BUBBLE_W, BUBBLE_H);

  for (let r = 0; r < s.grid.length; r++) {
    const cols = s.grid[r].length;
    const offsetX = r % 2 === 0 ? 0 : BUBBLE_R;
    for (let c = 0; c < cols; c++) {
      if (!s.grid[r][c]) continue;
      const x = c * BUBBLE_R * 2 + BUBBLE_R + offsetX;
      const y = r * BUBBLE_R * 1.8 + BUBBLE_R;
      _drawBubble(x, y, s.grid[r][c].color);
    }
  }

  if (!s.flying) {
    const ax = s.shooter.x + Math.cos(s.shooter.angle) * 40;
    const ay = s.shooter.y + Math.sin(s.shooter.angle) * 40;
    _bubbleCtx.strokeStyle = 'rgba(255,255,255,0.3)';
    _bubbleCtx.setLineDash([4, 4]);
    _bubbleCtx.beginPath();
    _bubbleCtx.moveTo(s.shooter.x, s.shooter.y);
    _bubbleCtx.lineTo(ax, ay);
    _bubbleCtx.stroke();
    _bubbleCtx.setLineDash([]);
    _drawBubble(s.shooter.x, s.shooter.y, s.currentBubble.color);
  }

  if (s.flying) {
    s.flying.x += s.flying.vx;
    s.flying.y += s.flying.vy;
    if (s.flying.x < BUBBLE_R) { s.flying.x = BUBBLE_R; s.flying.vx *= -1; }
    if (s.flying.x > BUBBLE_W - BUBBLE_R) { s.flying.x = BUBBLE_W - BUBBLE_R; s.flying.vx *= -1; }
    const hit = _checkBubbleCollision(s.flying);
    if (hit || s.flying.y < BUBBLE_R) {
      _snapBubble(s.flying, hit);
      s.flying = null;
    } else {
      _drawBubble(s.flying.x, s.flying.y, s.flying.color);
    }
  }

  for (let i = s.dropping.length - 1; i >= 0; i--) {
    const d = s.dropping[i];
    d.y += d.vy;
    d.vy += 0.3;
    d.life--;
    if (d.life <= 0 || d.y > BUBBLE_H) { s.dropping.splice(i, 1); continue; }
    _drawBubble(d.x, d.y, d.color);
  }

  _bubbleCtx.fillStyle = '#444';
  _bubbleCtx.fillRect(s.shooter.x - 25, s.shooter.y + 15, 50, 8);

  _bubbleAnimId = requestAnimationFrame(_bubbleLoop);
}

function _drawBubble(x, y, color) {
  const ctx = _bubbleCtx;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, BUBBLE_R - 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(x - 4, y - 4, BUBBLE_R / 3, 0, Math.PI * 2);
  ctx.fill();
}

function _checkBubbleCollision(flying) {
  const s = _bubbleState;
  for (let r = 0; r < s.grid.length; r++) {
    const cols = s.grid[r].length;
    const offsetX = r % 2 === 0 ? 0 : BUBBLE_R;
    for (let c = 0; c < cols; c++) {
      if (!s.grid[r][c]) continue;
      const x = c * BUBBLE_R * 2 + BUBBLE_R + offsetX;
      const y = r * BUBBLE_R * 1.8 + BUBBLE_R;
      const dx = flying.x - x;
      const dy = flying.y - y;
      if (dx * dx + dy * dy < (BUBBLE_R * 1.8) ** 2) {
        return { r, c };
      }
    }
  }
  return null;
}

function _snapBubble(flying, hit) {
  const s = _bubbleState;
  let targetR = hit ? hit.r : 0;
  if (!s.grid[targetR]) {
    const newCols = targetR % 2 === 0 ? BUBBLE_COLS : BUBBLE_COLS - 1;
    s.grid[targetR] = new Array(newCols).fill(null);
  }
  const rowArr = s.grid[targetR];
  const cols = rowArr.length;
  const offsetX = targetR % 2 === 0 ? 0 : BUBBLE_R;
  let targetC = Math.round((flying.x - BUBBLE_R - offsetX) / (BUBBLE_R * 2));
  targetC = Math.max(0, Math.min(cols - 1, targetC));

  if (!rowArr[targetC]) {
    rowArr[targetC] = { color: flying.color };
  } else {
    let placed = false;
    for (let dc = 0; dc < cols && !placed; dc++) {
      for (const sign of [1, -1]) {
        const nc = targetC + sign * dc;
        if (nc >= 0 && nc < cols && !rowArr[nc]) {
          rowArr[nc] = { color: flying.color };
          targetC = nc;
          placed = true;
          break;
        }
      }
    }
    if (!placed) {
      const newRowActual = s.grid.length;
      const newCols = newRowActual % 2 === 0 ? BUBBLE_COLS : BUBBLE_COLS - 1;
      s.grid.push(new Array(newCols).fill(null));
      const placedIdx = newCols > 0 ? Math.min(1, newCols - 1) : 0;
      s.grid[s.grid.length - 1][placedIdx] = { color: flying.color };
      targetR = s.grid.length - 1;
      targetC = placedIdx;
    }
  }

  _popBubbles(targetR, targetC);

  // 死亡检查：泡泡压到底
  const maxRows = Math.floor((BUBBLE_H - 80) / (BUBBLE_R * 1.8));
  if (s.grid.length >= maxRows) {
    let hasBubble = false;
    for (const c of s.grid[maxRows - 1] || []) { if (c) { hasBubble = true; break; } }
    if (hasBubble) {
      s.over = true;
      if (_bubbleAnimId) cancelAnimationFrame(_bubbleAnimId);
      GamePay.showGameOver('bubble-shooter', `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`);
    }
  }

  // 胜利：全部消除
  let totalBubbles = 0;
  for (const row of s.grid) for (const c of row) if (c) totalBubbles++;
  if (totalBubbles === 0) {
    s.over = true;
    if (_bubbleAnimId) cancelAnimationFrame(_bubbleAnimId);
    GamePay.showGameOver('bubble-shooter', `${t('bubble.win')}! ${t('bubble.score')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`, { win: true });
  }
}

function _popBubbles(r, c) {
  const s = _bubbleState;
  if (!s.grid[r] || !s.grid[r][c]) return;
  const color = s.grid[r][c].color;
  const visited = new Set();
  const toPop = [];
  const queue = [[r, c]];

  while (queue.length > 0) {
    const [cr, cc] = queue.shift();
    const key = cr + ',' + cc;
    if (visited.has(key)) continue;
    visited.add(key);
    if (!s.grid[cr] || !s.grid[cr][cc] || s.grid[cr][cc].color !== color) continue;
    toPop.push([cr, cc]);
    const offset = cr % 2 === 0 ? -1 : 0;
    const neighbors = [
      [cr, cc - 1], [cr, cc + 1],
      [cr - 1, cc + offset], [cr - 1, cc + offset + 1],
      [cr + 1, cc + offset], [cr + 1, cc + offset + 1],
    ];
    for (const [nr, nc] of neighbors) queue.push([nr, nc]);
  }

  if (toPop.length >= 3) {
    for (const [pr, pc] of toPop) {
      const x = pc * BUBBLE_R * 2 + BUBBLE_R + (pr % 2 === 0 ? 0 : BUBBLE_R);
      const y = pr * BUBBLE_R * 1.8 + BUBBLE_R;
      s.dropping.push({ x, y, vy: -2, life: 40, color: s.grid[pr][pc].color });
      s.grid[pr][pc] = null;
    }
    s.score += toPop.length * 10;
    const scoreEl = document.getElementById('bubbleScore');
    if (scoreEl) scoreEl.textContent = s.score;

    const connectedToTop = new Set();
    const topQ = [];
    if (s.grid[0]) {
      for (let cc0 = 0; cc0 < s.grid[0].length; cc0++) {
        if (s.grid[0][cc0]) { topQ.push([0, cc0]); connectedToTop.add('0,' + cc0); }
      }
    }
    while (topQ.length > 0) {
      const [cr, cc] = topQ.shift();
      const offset = cr % 2 === 0 ? -1 : 0;
      const neighbors = [
        [cr, cc - 1], [cr, cc + 1],
        [cr - 1, cc + offset], [cr - 1, cc + offset + 1],
        [cr + 1, cc + offset], [cr + 1, cc + offset + 1],
      ];
      for (const [nr, nc] of neighbors) {
        if (nr < 0) continue;
        const key = nr + ',' + nc;
        if (connectedToTop.has(key)) continue;
        if (!s.grid[nr] || !s.grid[nr][nc]) continue;
        connectedToTop.add(key);
        topQ.push([nr, nc]);
      }
    }
    let dropped = 0;
    for (let rr = 1; rr < s.grid.length; rr++) {
      if (!s.grid[rr]) continue;
      for (let cc = 0; cc < s.grid[rr].length; cc++) {
        const key = rr + ',' + cc;
        if (s.grid[rr][cc] && !connectedToTop.has(key)) {
          const x = cc * BUBBLE_R * 2 + BUBBLE_R + (rr % 2 === 0 ? 0 : BUBBLE_R);
          const y = rr * BUBBLE_R * 1.8 + BUBBLE_R;
          s.dropping.push({ x, y, vy: 0, life: 60, color: s.grid[rr][cc].color });
          s.grid[rr][cc] = null;
          dropped++;
        }
      }
    }
    if (dropped > 0) {
      s.score += dropped * 20;
      if (scoreEl) scoreEl.textContent = s.score;
    }
  }
}

window.TOOL_REGISTRY['bubble-shooter'] = {
  render: renderBubbleShooter,
  bind: bindBubbleEvents,
  beforeUnmount: () => {
    if (_bubbleAnimId) cancelAnimationFrame(_bubbleAnimId);
    _bubbleAnimId = null;
    if (_bubbleCanvas && _bubbleMouseHandler) _bubbleCanvas.removeEventListener('mousemove', _bubbleMouseHandler);
    if (_bubbleCanvas && _bubbleClickHandler) _bubbleCanvas.removeEventListener('click', _bubbleClickHandler);
    _bubbleState = null;
    _bubbleCanvas = null;
    _bubbleCtx = null;
  }
};
