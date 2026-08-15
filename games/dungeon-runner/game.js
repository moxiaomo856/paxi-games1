/**
 * 🏃 Dungeon Runner — 像素平台跑酷（对标 decentralized-game-template / Phaser 风格）
 * 自动奔跑，点击跳跃（二段跳），越过深坑与尖刺，掉坑或碰刺死亡。
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _runnerCanvas = null;
let _runnerCtx = null;
let _runnerState = null;
let _runnerAnimId = null;

const RUN_W = 360;
const RUN_H = 480;
const RUN_GROUND = 400;

function renderRunner() {
  return `
    <div class="card">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('runner.score')}: <b id="runnerScore" style="color:var(--primary)">0</b>m</span>
        ${GamePay.roundsBadge('dungeon-runner')}
      </div>
      <div style="position:relative;display:flex;justify-content:center;">
        <canvas id="runnerCanvas" width="${RUN_W}" height="${RUN_H}" style="background:linear-gradient(180deg,#2a1a0a 0%,#0a0a1a 100%);border-radius:8px;touch-action:none;max-width:100%;height:auto;"></canvas>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);border-radius:8px;z-index:10;">
          ${GamePay.overlayHTML('dungeon-runner', 'game.dungeon-runner', 'runner.controls')}
        </div>
      </div>
    </div>
  `;
}

function bindRunnerEvents() {
  GamePay.bindStart('dungeon-runner', () => startRunnerGame());
}

// 生成一段地形：平台 + 坑 + 尖刺
function _runnerGenSegment(s, startX) {
  const segW = 120 + Math.random() * 100;
  const gap = Math.random() < 0.55 ? (40 + Math.random() * 45) : 0; // 坑宽
  const spike = !gap && Math.random() < 0.45;
  const seg = { x: startX, w: segW, gapW: gap, spike };
  s.terrain.push(seg);
  return startX + segW + gap;
}

function startRunnerGame(keepScore) {
  if (!GamePay.consumeRound('dungeon-runner')) return;

  _runnerCanvas = document.getElementById('runnerCanvas');
  if (!_runnerCanvas) return;
  _runnerCtx = _runnerCanvas.getContext('2d');

  const prevDist = keepScore && _runnerState ? _runnerState.dist : 0;

  _runnerState = {
    hero: { x: 70, y: RUN_GROUND - 24, vy: 0, jumps: 0 },
    terrain: [],
    nextX: 0,
    dist: prevDist,
    speed: 4,
    over: false,
    frame: 0,
  };
  document.getElementById('runnerScore').textContent = Math.floor(prevDist);
  // 初始平地
  let x = 0;
  while (x < RUN_W + 200) x = _runnerGenSegment(_runnerState, x);
  _runnerState.nextX = x;

  GamePay.registerRevive('dungeon-runner', () => startRunnerGame(true));

  const jump = () => {
    const s = _runnerState;
    if (!s || s.over) return;
    if (s.hero.jumps < 2) {
      s.hero.vy = s.hero.jumps === 0 ? -12 : -10;
      s.hero.jumps++;
    }
  };
  _runnerCanvas.onpointerdown = (e) => { e.preventDefault(); jump(); };

  if (_runnerAnimId) cancelAnimationFrame(_runnerAnimId);
  _runnerAnimId = requestAnimationFrame(_runnerLoop);
}

// 地形采样：返回某 x 位置是否有地面
function _runnerGroundAt(s, x) {
  for (const seg of s.terrain) {
    if (x >= seg.x && x <= seg.x + seg.w) return seg;
  }
  return null;
}

function _runnerLoop() {
  const s = _runnerState;
  if (!s || s.over) return;
  s.frame++;

  s.speed = 4 + Math.floor(s.dist / 150);
  s.dist += s.speed * 0.12;
  document.getElementById('runnerScore').textContent = Math.floor(s.dist);

  // 物理
  s.hero.vy += 0.6;
  s.hero.y += s.hero.vy;

  // 地面支撑检测（英雄脚点）
  const footX = s.hero.x;
  const seg = _runnerGroundAt(s, footX);
  const groundY = seg ? RUN_GROUND : RUN_H + 100; // 无地面=坑
  if (s.hero.y >= groundY - 24 && s.hero.vy >= 0 && seg) {
    s.hero.y = groundY - 24;
    s.hero.vy = 0;
    s.hero.jumps = 0;
    // 尖刺
    if (seg.spike && footX > seg.x + seg.w * 0.35 && footX < seg.x + seg.w * 0.65) {
      _runnerDie();
      return;
    }
  }
  if (s.hero.y > RUN_H + 40) { _runnerDie(); return; } // 掉坑

  // 世界滚动：所有地形左移
  for (const g of s.terrain) g.x -= s.speed;
  s.terrain = s.terrain.filter(g => g.x + g.w + g.gapW > -50);
  // 补充新地形
  const rightmost = s.terrain.length ? s.terrain[s.terrain.length - 1].x + s.terrain[s.terrain.length - 1].w + s.terrain[s.terrain.length - 1].gapW : 0;
  if (rightmost < RUN_W + 200) _runnerGenSegment(s, rightmost);

  _runnerDraw(s);
  _runnerAnimId = requestAnimationFrame(_runnerLoop);
}

function _runnerDraw(s) {
  const ctx = _runnerCtx;
  ctx.fillStyle = 'rgba(42,26,10,0.5)';
  ctx.fillRect(0, 0, RUN_W, RUN_H);

  // 火把点缀
  ctx.font = '14px serif';
  for (let i = 0; i < 4; i++) {
    const tx = ((i * 120 - (s.dist * 8) % 120) + RUN_W) % (RUN_W + 60) - 30;
    ctx.fillText('🔥', tx, 80);
  }

  // 地形
  for (const seg of s.terrain) {
    ctx.fillStyle = '#3d2f1f';
    ctx.fillRect(seg.x, RUN_GROUND, seg.w, RUN_H - RUN_GROUND);
    ctx.fillStyle = '#5a4630';
    ctx.fillRect(seg.x, RUN_GROUND, seg.w, 6);
    if (seg.spike) {
      const cx = seg.x + seg.w / 2;
      ctx.fillStyle = '#c0392b';
      ctx.beginPath();
      ctx.moveTo(cx - 14, RUN_GROUND);
      ctx.lineTo(cx, RUN_GROUND - 18);
      ctx.lineTo(cx + 14, RUN_GROUND);
      ctx.fill();
    }
  }

  // 英雄
  ctx.font = '30px serif';
  ctx.fillText('🧝', s.hero.x - 15, s.hero.y + 20);
}

function _runnerDie() {
  const s = _runnerState;
  s.over = true;
  if (_runnerAnimId) cancelAnimationFrame(_runnerAnimId);
  GamePay.showGameOver('dungeon-runner',
    `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${Math.floor(s.dist)}m</b>`);
}

window.TOOL_REGISTRY['dungeon-runner'] = {
  render: renderRunner,
  bind: bindRunnerEvents,
  beforeUnmount: () => {
    if (_runnerAnimId) cancelAnimationFrame(_runnerAnimId);
    _runnerAnimId = null; _runnerState = null; _runnerCanvas = null; _runnerCtx = null;
  }
};
