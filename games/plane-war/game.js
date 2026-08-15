/**
 * 飞机大战 — 移植自 paxi-toolbox（付费逻辑已统一到 game-pay.js）
 * 死亡 → GamePay.showGameOver → 复活 = 保留分数，飞机满血重开一波
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _planeWarCanvas = null;
let _planeWarCtx = null;
let _planeWarState = null;
let _planeWarAnimId = null;
let _planeWarKeyDownHandler = null;
let _planeWarKeyUpHandler = null;
let _planeWarMouseDown = null;
let _planeWarMouseMove = null;
let _planeWarMouseUp = null;

function renderPlaneWar() {
  return `
    <div class="card">
      <div style="display:flex;gap:8px;justify-content:center;margin:4px 0 10px;flex-wrap:wrap;">
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('planeWar.score')}: <b id="pwScore" style="color:var(--primary)">0</b></span>
        <span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">${t('planeWar.hp')}: <b id="pwHp" style="color:var(--success)">❤❤❤</b></span>
        ${GamePay.roundsBadge('plane-war')}
      </div>
      <div style="position:relative;display:flex;justify-content:center;">
        <canvas id="planeWarCanvas" width="360" height="500" style="background:linear-gradient(180deg,#0a0a1a 0%,#1a1a3a 50%,#0a0a1a 100%);border-radius:8px;touch-action:none;max-width:100%;height:auto;"></canvas>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.7);border-radius:8px;z-index:10;">
          ${GamePay.overlayHTML('plane-war', 'planeWar.title', 'planeWar.controls')}
        </div>
      </div>
    </div>
  `;
}

function bindPlaneWarEvents() {
  GamePay.bindStart('plane-war', startPlaneWarGame);
}

// keepScore=true 时为复活模式：保留分数
function startPlaneWarGame(keepScore) {
  if (!GamePay.consumeRound('plane-war')) return;

  _planeWarCanvas = document.getElementById('planeWarCanvas');
  if (!_planeWarCanvas) return;
  _planeWarCtx = _planeWarCanvas.getContext('2d');

  const prevScore = keepScore && _planeWarState ? _planeWarState.score : 0;

  const W = _planeWarCanvas.width;
  const H = _planeWarCanvas.height;

  _planeWarState = {
    W, H,
    player: { x: W / 2, y: H - 80, w: 36, h: 44, speed: 5, hp: 3, maxHp: 3 },
    bullets: [], enemies: [], particles: [],
    score: prevScore,
    gameOver: false,
    lastShot: 0, shootInterval: 200,
    enemySpawnRate: 1200, lastEnemySpawn: 0,
    frame: 0,
    stars: Array.from({ length: 50 }, () => ({
      x: Math.random() * W, y: Math.random() * H,
      speed: 0.5 + Math.random() * 2, size: Math.random() * 2 + 0.5
    })),
    keys: {}, touchX: null, touchY: null, autoShoot: true,
  };
  document.getElementById('pwScore').textContent = prevScore;
  _updateHpDisplay();

  // 注册复活：保留分数重开一波
  GamePay.registerRevive('plane-war', () => startPlaneWarGame(true));

  // 键盘
  if (!_planeWarKeyDownHandler) {
    _planeWarKeyDownHandler = (e) => { if (_planeWarState) _planeWarState.keys[e.key] = true; };
    _planeWarKeyUpHandler = (e) => { if (_planeWarState) _planeWarState.keys[e.key] = false; };
    window.addEventListener('keydown', _planeWarKeyDownHandler);
    window.addEventListener('keyup', _planeWarKeyUpHandler);
  }

  // 触摸/鼠标
  _planeWarCanvas.ontouchstart = _planeWarCanvas.ontouchmove = (e) => {
    e.preventDefault();
    if (!_planeWarState || _planeWarState.gameOver) return;
    const rect = _planeWarCanvas.getBoundingClientRect();
    const touch = e.touches[0] || e.changedTouches[0];
    _planeWarState.touchX = (touch.clientX - rect.left) * (W / rect.width);
    _planeWarState.touchY = (touch.clientY - rect.top) * (H / rect.height);
  };
  _planeWarCanvas.ontouchend = () => { if (_planeWarState) { _planeWarState.touchX = null; _planeWarState.touchY = null; } };

  _planeWarMouseDown = (e) => { if (!_planeWarState) return; _planeWarState.mouseDown = true; _planeWarMouseMove(e); };
  _planeWarMouseMove = (e) => {
    if (!_planeWarState || !_planeWarState.mouseDown) return;
    const rect = _planeWarCanvas.getBoundingClientRect();
    _planeWarState.touchX = (e.clientX - rect.left) * (W / rect.width);
    _planeWarState.touchY = (e.clientY - rect.top) * (H / rect.height);
  };
  _planeWarMouseUp = () => { if (_planeWarState) { _planeWarState.mouseDown = false; _planeWarState.touchX = null; _planeWarState.touchY = null; } };
  _planeWarCanvas.onmousedown = _planeWarMouseDown;
  _planeWarCanvas.onmousemove = _planeWarMouseMove;
  window.onmouseup = _planeWarMouseUp;

  if (_planeWarAnimId) cancelAnimationFrame(_planeWarAnimId);
  _planeWarAnimId = requestAnimationFrame(gameLoop);
}

function gameLoop() {
  const s = _planeWarState;
  if (!s || s.gameOver) return;

  s.frame++;

  _planeWarCtx.fillStyle = 'rgba(10,10,26,0.3)';
  _planeWarCtx.fillRect(0, 0, s.W, s.H);

  for (const star of s.stars) {
    star.y += star.speed;
    if (star.y > s.H) { star.y = 0; star.x = Math.random() * s.W; }
    _planeWarCtx.fillStyle = `rgba(255,255,255,${0.3 + star.speed * 0.2})`;
    _planeWarCtx.fillRect(star.x, star.y, star.size, star.size);
  }

  const p = s.player;
  if (s.keys['ArrowLeft'] || s.keys['a'] || s.keys['A']) p.x -= p.speed;
  if (s.keys['ArrowRight'] || s.keys['d'] || s.keys['D']) p.x += p.speed;
  if (s.keys['ArrowUp'] || s.keys['w'] || s.keys['W']) p.y -= p.speed;
  if (s.keys['ArrowDown'] || s.keys['s'] || s.keys['S']) p.y += p.speed;

  if (s.touchX !== null) {
    const dx = s.touchX - p.x;
    const dy = s.touchY - p.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 2) {
      p.x += (dx / dist) * Math.min(dist, 8);
      p.y += (dy / dist) * Math.min(dist, 8);
    }
  }

  p.x = Math.max(p.w / 2, Math.min(s.W - p.w / 2, p.x));
  p.y = Math.max(p.h / 2, Math.min(s.H - p.h / 2, p.y));

  const now = performance.now();
  if (s.autoShoot && now - s.lastShot > s.shootInterval) {
    s.bullets.push({ x: p.x, y: p.y - p.h / 2, vx: 0, vy: -10, w: 3, h: 12, dmg: 1 });
    s.lastShot = now;
  }

  if (now - s.lastEnemySpawn > s.enemySpawnRate) {
    const size = 24 + Math.random() * 16;
    const type = Math.random() < 0.15 ? 'big' : 'small';
    const hp = type === 'big' ? 3 : 1;
    const speed = type === 'big' ? 1 : (2 + Math.random() * 1.5);
    s.enemies.push({
      x: size / 2 + Math.random() * (s.W - size), y: -size,
      w: size, h: size,
      vx: (Math.random() - 0.5) * 1.5, vy: speed,
      hp: hp, maxHp: hp, type: type,
      shootCooldown: type === 'big' ? now + 1500 + Math.random() * 2000 : null,
    });
    s.lastEnemySpawn = now;
    s.enemySpawnRate = Math.max(400, 1200 - s.frame * 0.3);
  }

  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i];
    b.x += b.vx; b.y += b.vy;
    if (b.y < -20 || b.y > s.H + 20 || b.x < -20 || b.x > s.W + 20) s.bullets.splice(i, 1);
  }

  for (let i = s.enemies.length - 1; i >= 0; i--) {
    const e = s.enemies[i];
    e.x += e.vx; e.y += e.vy;
    if (e.x < e.w / 2 || e.x > s.W - e.w / 2) e.vx *= -1;
    if (e.type === 'big' && e.shootCooldown && now > e.shootCooldown) {
      const angle = Math.atan2(p.y - e.y, p.x - e.x);
      s.bullets.push({ x: e.x, y: e.y + e.h / 2, vx: Math.cos(angle) * 4, vy: Math.sin(angle) * 4, w: 4, h: 4, dmg: 1, enemy: true });
      e.shootCooldown = now + 2000 + Math.random() * 1500;
    }
    if (e.y > s.H + 30) { s.enemies.splice(i, 1); continue; }
  }

  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i];
    if (b.enemy) continue;
    for (let j = s.enemies.length - 1; j >= 0; j--) {
      const e = s.enemies[j];
      if (b.x > e.x - e.w / 2 && b.x < e.x + e.w / 2 && b.y > e.y - e.h / 2 && b.y < e.y + e.h / 2) {
        e.hp -= b.dmg;
        s.bullets.splice(i, 1);
        createExplosion(e.x, e.y, 5);
        if (e.hp <= 0) {
          createExplosion(e.x, e.y, 15);
          s.score += e.type === 'big' ? 50 : 10;
          s.enemies.splice(j, 1);
        }
        break;
      }
    }
  }

  for (let j = s.enemies.length - 1; j >= 0; j--) {
    const e = s.enemies[j];
    if (Math.abs(p.x - e.x) < (p.w + e.w) / 2 - 4 && Math.abs(p.y - e.y) < (p.h + e.h) / 2 - 4) {
      p.hp--;
      createExplosion(e.x, e.y, 20);
      s.enemies.splice(j, 1);
      _updateHpDisplay();
      if (p.hp <= 0) { gameOver(); return; }
    }
  }

  for (let i = s.bullets.length - 1; i >= 0; i--) {
    const b = s.bullets[i];
    if (!b.enemy) continue;
    if (Math.abs(p.x - b.x) < p.w / 2 && Math.abs(p.y - b.y) < p.h / 2) {
      p.hp--;
      s.bullets.splice(i, 1);
      createExplosion(b.x, b.y, 10);
      _updateHpDisplay();
      if (p.hp <= 0) { gameOver(); return; }
    }
  }

  for (let i = s.particles.length - 1; i >= 0; i--) {
    const pt = s.particles[i];
    pt.x += pt.vx; pt.y += pt.vy; pt.life--;
    if (pt.life <= 0) s.particles.splice(i, 1);
  }

  drawPlayer(p);

  for (const b of s.bullets) {
    _planeWarCtx.fillStyle = b.enemy ? '#ff4444' : '#66ff66';
    _planeWarCtx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    _planeWarCtx.shadowColor = b.enemy ? '#ff4444' : '#66ff66';
    _planeWarCtx.shadowBlur = 6;
    _planeWarCtx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
    _planeWarCtx.shadowBlur = 0;
  }

  for (const e of s.enemies) drawEnemy(e);

  for (const pt of s.particles) {
    _planeWarCtx.fillStyle = `rgba(${pt.r},${pt.g},${pt.b},${pt.life / pt.maxLife})`;
    _planeWarCtx.beginPath();
    _planeWarCtx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    _planeWarCtx.fill();
  }

  document.getElementById('pwScore').textContent = s.score;

  _planeWarAnimId = requestAnimationFrame(gameLoop);
}

function drawPlayer(p) {
  const ctx = _planeWarCtx;
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.fillStyle = '#4fc3f7';
  ctx.beginPath();
  ctx.moveTo(0, -p.h / 2);
  ctx.lineTo(-p.w / 2, p.h / 2);
  ctx.lineTo(-p.w / 4, p.h / 3);
  ctx.lineTo(0, p.h / 2.5);
  ctx.lineTo(p.w / 4, p.h / 3);
  ctx.lineTo(p.w / 2, p.h / 2);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#81d4fa';
  ctx.beginPath();
  ctx.moveTo(0, -p.h / 3);
  ctx.lineTo(-p.w / 3, p.h / 4);
  ctx.lineTo(0, p.h / 5);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#0288d1';
  ctx.beginPath();
  ctx.arc(0, -p.h / 8, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b3e5fc';
  ctx.beginPath();
  ctx.arc(-2, -p.h / 6, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#ff9800';
  const flameSize = 4 + Math.sin(performance.now() / 50) * 2;
  ctx.beginPath();
  ctx.moveTo(-5, p.h / 2);
  ctx.lineTo(0, p.h / 2 + flameSize + 6);
  ctx.lineTo(5, p.h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffeb3b';
  ctx.beginPath();
  ctx.moveTo(-2, p.h / 2);
  ctx.lineTo(0, p.h / 2 + flameSize + 3);
  ctx.lineTo(2, p.h / 2);
  ctx.closePath();
  ctx.fill();

  ctx.restore();
}

function drawEnemy(e) {
  const ctx = _planeWarCtx;
  ctx.save();
  ctx.translate(e.x, e.y);

  if (e.type === 'big') {
    ctx.fillStyle = '#e57373';
    ctx.beginPath();
    ctx.moveTo(0, -e.h / 2);
    ctx.lineTo(-e.w / 2, 0);
    ctx.lineTo(-e.w / 3, e.h / 2);
    ctx.lineTo(e.w / 3, e.h / 2);
    ctx.lineTo(e.w / 2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ef5350';
    ctx.fillRect(-4, -4, 8, 8);
    const hpPct = e.hp / e.maxHp;
    ctx.fillStyle = '#333';
    ctx.fillRect(-e.w / 2, -e.h / 2 - 6, e.w, 3);
    ctx.fillStyle = hpPct > 0.5 ? '#4caf50' : hpPct > 0.25 ? '#ff9800' : '#f44336';
    ctx.fillRect(-e.w / 2, -e.h / 2 - 6, e.w * hpPct, 3);
  } else {
    ctx.fillStyle = '#ffb74d';
    ctx.beginPath();
    ctx.moveTo(0, -e.h / 2);
    ctx.lineTo(-e.w / 2, e.h / 3);
    ctx.lineTo(0, e.h / 2);
    ctx.lineTo(e.w / 2, e.h / 3);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ff9800';
    ctx.fillRect(-3, -2, 6, 4);
  }

  ctx.restore();
}

function createExplosion(x, y, count) {
  const s = _planeWarState;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 4;
    s.particles.push({
      x, y,
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      size: 1 + Math.random() * 3,
      life: 20 + Math.random() * 20, maxLife: 40,
      r: 255, g: 150 + Math.random() * 100, b: Math.random() * 50,
    });
  }
}

function _updateHpDisplay() {
  const s = _planeWarState;
  const hpEl = document.getElementById('pwHp');
  if (!hpEl || !s) return;
  hpEl.textContent = '❤'.repeat(s.player.hp) + '🖤'.repeat(s.player.maxHp - s.player.hp);
}

function gameOver() {
  const s = _planeWarState;
  if (!s) return;
  s.gameOver = true;
  if (_planeWarAnimId) cancelAnimationFrame(_planeWarAnimId);
  GamePay.showGameOver('plane-war', `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`);
}

window.TOOL_REGISTRY['plane-war'] = {
  render: renderPlaneWar,
  bind: bindPlaneWarEvents,
  beforeUnmount: () => {
    if (_planeWarAnimId) cancelAnimationFrame(_planeWarAnimId);
    _planeWarAnimId = null;
    _planeWarState = null;
    _planeWarCanvas = null;
    _planeWarCtx = null;
    if (_planeWarKeyDownHandler) {
      window.removeEventListener('keydown', _planeWarKeyDownHandler);
      window.removeEventListener('keyup', _planeWarKeyUpHandler);
      _planeWarKeyDownHandler = null;
      _planeWarKeyUpHandler = null;
    }
  }
};
