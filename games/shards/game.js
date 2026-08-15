/**
 * 💠 Shards — 碎片收集 + 哈希凭证（对标 Shards 的"收集+验证"概念）
 * 拖动底部节点左右移动，接住蓝色碎片；红色病毒碰到扣血。
 * 每收集 10 个碎片 → 生成一个"链上凭证"（展示模拟哈希）。
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _shardsCanvas = null;
let _shardsCtx = null;
let _shardsState = null;
let _shardsAnimId = null;
let _shardsPointerHandler = null;

const SHARDS_W = 360;
const SHARDS_H = 480;

function renderShards() {
  return `
    <div class="card">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('shards.score')}: <b id="shardsScore" style="color:var(--primary)">0</b></span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">❤ <b id="shardsHp" style="color:var(--success)">3</b></span>
        ${GamePay.roundsBadge('shards')}
      </div>
      <div style="position:relative;display:flex;justify-content:center;">
        <canvas id="shardsCanvas" width="${SHARDS_W}" height="${SHARDS_H}" style="background:linear-gradient(180deg,#12142e 0%,#0a0a1a 100%);border-radius:8px;touch-action:none;max-width:100%;height:auto;"></canvas>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);border-radius:8px;z-index:10;">
          ${GamePay.overlayHTML('shards', 'game.shards', 'shards.controls')}
        </div>
      </div>
      <div id="shardsProof" style="text-align:center;margin-top:8px;font-family:monospace;font-size:10px;color:var(--text-muted);min-height:14px;word-break:break-all;"></div>
    </div>
  `;
}

function bindShardsEvents() {
  GamePay.bindStart('shards', () => startShardsGame());
}

function _shardsFakeHash() {
  let h = '';
  const hex = '0123456789abcdef';
  for (let i = 0; i < 40; i++) h += hex[Math.floor(Math.random() * 16)];
  return h;
}

function startShardsGame(keepScore) {
  if (!GamePay.consumeRound('shards')) return;

  _shardsCanvas = document.getElementById('shardsCanvas');
  if (!_shardsCanvas) return;
  _shardsCtx = _shardsCanvas.getContext('2d');

  const prevScore = keepScore && _shardsState ? _shardsState.score : 0;

  _shardsState = {
    paddle: { x: SHARDS_W / 2, w: 70 },
    drops: [],
    score: prevScore,
    hp: 3,
    over: false,
    frame: 0,
    lastDrop: 0,
  };
  document.getElementById('shardsScore').textContent = prevScore;
  document.getElementById('shardsHp').textContent = 3;

  GamePay.registerRevive('shards', () => startShardsGame(true));

  // 拖动控制（指针事件统一鼠标/触摸）
  if (_shardsPointerHandler) _shardsCanvas.removeEventListener('pointermove', _shardsPointerHandler);
  _shardsPointerHandler = (e) => {
    const s = _shardsState;
    if (!s || s.over) return;
    const rect = _shardsCanvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (SHARDS_W / rect.width);
    s.paddle.x = Math.max(s.paddle.w / 2, Math.min(SHARDS_W - s.paddle.w / 2, x));
  };
  _shardsCanvas.addEventListener('pointermove', _shardsPointerHandler);
  _shardsCanvas.addEventListener('pointerdown', _shardsPointerHandler);

  if (_shardsAnimId) cancelAnimationFrame(_shardsAnimId);
  _shardsAnimId = requestAnimationFrame(_shardsLoop);
}

function _shardsLoop() {
  const s = _shardsState;
  if (!s || s.over) return;
  s.frame++;

  // 生成掉落物
  const now = performance.now();
  const interval = Math.max(420, 900 - s.score * 8);
  if (now - s.lastDrop > interval) {
    s.lastDrop = now;
    const bad = Math.random() < 0.3;
    s.drops.push({
      x: 20 + Math.random() * (SHARDS_W - 40),
      y: -20,
      vy: 2.2 + Math.random() * 1.5 + s.score * 0.02,
      bad,
    });
  }

  // 更新掉落物
  const py = SHARDS_H - 50;
  for (let i = s.drops.length - 1; i >= 0; i--) {
    const d = s.drops[i];
    d.y += d.vy;
    if (d.y > py - 12 && d.y < py + 16 &&
        Math.abs(d.x - s.paddle.x) < s.paddle.w / 2 + 10) {
      s.drops.splice(i, 1);
      if (d.bad) {
        s.hp--;
        document.getElementById('shardsHp').textContent = s.hp;
        if (s.hp <= 0) { _shardsDie(); return; }
      } else {
        s.score++;
        document.getElementById('shardsScore').textContent = s.score;
        if (s.score % 10 === 0) {
          const proof = document.getElementById('shardsProof');
          if (proof) proof.textContent = '✓ ' + t('shards.proof') + ' #' + (s.score / 10) + ': ' + _shardsFakeHash();
          showToast(t('shards.proofOk'), 'success');
        }
      }
      continue;
    }
    if (d.y > SHARDS_H + 20) s.drops.splice(i, 1);
  }

  _shardsDraw(s);
  _shardsAnimId = requestAnimationFrame(_shardsLoop);
}

function _shardsDraw(s) {
  const ctx = _shardsCtx;
  ctx.fillStyle = 'rgba(18,20,46,0.6)';
  ctx.fillRect(0, 0, SHARDS_W, SHARDS_H);

  // 掉落物
  for (const d of s.drops) {
    if (d.bad) {
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.arc(d.x, d.y, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ff9c9c';
      for (let k = 0; k < 6; k++) {
        const a = k * Math.PI / 3 + s.frame * 0.02;
        ctx.beginPath();
        ctx.moveTo(d.x + Math.cos(a) * 9, d.y + Math.sin(a) * 9);
        ctx.lineTo(d.x + Math.cos(a) * 14, d.y + Math.sin(a) * 14);
        ctx.stroke();
      }
    } else {
      ctx.save();
      ctx.translate(d.x, d.y);
      ctx.rotate(s.frame * 0.05);
      ctx.fillStyle = '#5fd4ff';
      ctx.beginPath();
      ctx.moveTo(0, -10); ctx.lineTo(8, 0); ctx.lineTo(0, 10); ctx.lineTo(-8, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  // 底部节点
  const py = SHARDS_H - 50;
  ctx.fillStyle = '#7c9bff';
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(s.paddle.x - s.paddle.w / 2, py, s.paddle.w, 14, 7);
    ctx.fill();
  } else {
    ctx.fillRect(s.paddle.x - s.paddle.w / 2, py, s.paddle.w, 14);
  }
  ctx.fillStyle = 'rgba(124,155,255,.3)';
  ctx.beginPath();
  ctx.arc(s.paddle.x, py + 7, 18 + Math.sin(s.frame * 0.1) * 3, 0, Math.PI * 2);
  ctx.fill();
}

function _shardsDie() {
  const s = _shardsState;
  s.over = true;
  if (_shardsAnimId) cancelAnimationFrame(_shardsAnimId);
  GamePay.showGameOver('shards',
    `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score} 💠</b>`);
}

window.TOOL_REGISTRY['shards'] = {
  render: renderShards,
  bind: bindShardsEvents,
  beforeUnmount: () => {
    if (_shardsAnimId) cancelAnimationFrame(_shardsAnimId);
    _shardsAnimId = null;
    if (_shardsCanvas && _shardsPointerHandler) _shardsCanvas.removeEventListener('pointermove', _shardsPointerHandler);
    _shardsState = null; _shardsCanvas = null; _shardsCtx = null;
  }
};
