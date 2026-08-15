/**
 * 🐸 CROAK Quest — Web3 迷你跳跃（对标 CROAK Quest）
 * 青蛙自动前进，点击跳跃（可二段跳），躲开地面尖刺与飞虫。
 * 碰撞 = 死亡；复活 = 保留距离分数，满血继续。
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _croakCanvas = null;
let _croakCtx = null;
let _croakState = null;
let _croakAnimId = null;

const CROAK_W = 360;
const CROAK_H = 480;
const CROAK_GROUND = 420;

function renderCroak() {
  return `
    <div class="card">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('croak.score')}: <b id="croakScore" style="color:var(--primary)">0</b>m</span>
        ${GamePay.roundsBadge('croak-quest')}
      </div>
      <div style="position:relative;display:flex;justify-content:center;">
        <canvas id="croakCanvas" width="${CROAK_W}" height="${CROAK_H}" style="background:linear-gradient(180deg,#0a2a1a 0%,#0a0a1a 100%);border-radius:8px;touch-action:none;max-width:100%;height:auto;"></canvas>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);border-radius:8px;z-index:10;">
          ${GamePay.overlayHTML('croak-quest', 'game.croak-quest', 'croak.controls')}
        </div>
      </div>
    </div>
  `;
}

function bindCroakEvents() {
  GamePay.bindStart('croak-quest', () => startCroakGame());
}

function startCroakGame(keepScore) {
  if (!GamePay.consumeRound('croak-quest')) return;

  _croakCanvas = document.getElementById('croakCanvas');
  if (!_croakCanvas) return;
  _croakCtx = _croakCanvas.getContext('2d');

  const prevDist = keepScore && _croakState ? _croakState.dist : 0;

  _croakState = {
    frog: { x: 70, y: CROAK_GROUND - 20, vy: 0, jumps: 0 },
    obstacles: [],
    dist: prevDist,
    speed: 4,
    over: false,
    lastSpawn: 0,
    frame: 0,
  };
  document.getElementById('croakScore').textContent = Math.floor(prevDist);

  GamePay.registerRevive('croak-quest', () => startCroakGame(true));

  const jump = () => {
    const s = _croakState;
    if (!s || s.over) return;
    if (s.frog.jumps < 2) {
      s.frog.vy = s.frog.jumps === 0 ? -11 : -9.5;
      s.frog.jumps++;
    }
  };
  _croakCanvas.onpointerdown = (e) => { e.preventDefault(); jump(); };

  if (_croakAnimId) cancelAnimationFrame(_croakAnimId);
  _croakAnimId = requestAnimationFrame(_croakLoop);
}

function _croakLoop() {
  const s = _croakState;
  if (!s || s.over) return;
  s.frame++;

  // 物理与地面
  s.frog.vy += 0.55;
  s.frog.y += s.frog.vy;
  if (s.frog.y >= CROAK_GROUND - 20) {
    s.frog.y = CROAK_GROUND - 20;
    s.frog.vy = 0;
    s.frog.jumps = 0;
  }

  // 难度与距离
  s.speed = 4 + Math.floor(s.dist / 200);
  s.dist += s.speed * 0.1;
  document.getElementById('croakScore').textContent = Math.floor(s.dist);

  // 生成障碍
  const now = performance.now();
  if (now - s.lastSpawn > Math.max(900, 1800 - s.dist * 2)) {
    s.lastSpawn = now;
    const flying = Math.random() < 0.35;
    s.obstacles.push({
      x: CROAK_W + 30,
      y: flying ? CROAK_GROUND - 110 - Math.random() * 40 : CROAK_GROUND - 18,
      w: flying ? 26 : 22,
      h: flying ? 20 : 36,
      flying,
    });
  }

  // 移动/碰撞
  for (let i = s.obstacles.length - 1; i >= 0; i--) {
    const o = s.obstacles[i];
    o.x -= s.speed;
    if (o.x < -40) { s.obstacles.splice(i, 1); continue; }
    const fx = s.frog.x, fy = s.frog.y;
    if (fx + 16 > o.x && fx - 16 < o.x + o.w &&
        fy + 16 > o.y && fy - 16 < o.y + o.h) {
      _croakDie();
      return;
    }
  }

  _croakDraw(s);
  _croakAnimId = requestAnimationFrame(_croakLoop);
}

function _croakDraw(s) {
  const ctx = _croakCtx;
  ctx.fillStyle = 'rgba(10,42,26,0.55)';
  ctx.fillRect(0, 0, CROAK_W, CROAK_H);

  // 地面
  ctx.fillStyle = '#1d4a2c';
  ctx.fillRect(0, CROAK_GROUND, CROAK_W, CROAK_H - CROAK_GROUND);
  ctx.fillStyle = '#2f6b3f';
  for (let i = 0; i < CROAK_W; i += 40) {
    const off = (s.dist * 10) % 40;
    ctx.fillRect(i - off, CROAK_GROUND, 20, 5);
  }

  // 障碍
  for (const o of s.obstacles) {
    if (o.flying) {
      ctx.font = '20px serif';
      ctx.fillText('🦟', o.x, o.y + 14);
    } else {
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        ctx.moveTo(o.x + k * (o.w / 3), o.y + o.h);
        ctx.lineTo(o.x + k * (o.w / 3) + o.w / 6, o.y);
        ctx.lineTo(o.x + (k + 1) * (o.w / 3), o.y + o.h);
      }
      ctx.fill();
    }
  }

  // 青蛙
  ctx.font = '32px serif';
  const squash = s.frog.jumps > 0 ? 0 : 1;
  ctx.fillText('🐸', s.frog.x - 16, s.frog.y + 14 + squash * 2);
}

function _croakDie() {
  const s = _croakState;
  s.over = true;
  if (_croakAnimId) cancelAnimationFrame(_croakAnimId);
  GamePay.showGameOver('croak-quest',
    `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${Math.floor(s.dist)}m</b>`);
}

window.TOOL_REGISTRY['croak-quest'] = {
  render: renderCroak,
  bind: bindCroakEvents,
  beforeUnmount: () => {
    if (_croakAnimId) cancelAnimationFrame(_croakAnimId);
    _croakAnimId = null; _croakState = null; _croakCanvas = null; _croakCtx = null;
  }
};
