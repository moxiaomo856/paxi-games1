/**
 * ⛏️ Blockchain Miner — 区块链挖矿模拟（对标 BlockchainX，教育向）
 * 快速点击挖矿填满区块进度；每次点击消耗电力；黑客随机入侵扣电。
 * 电力耗尽 = 系统崩溃死亡；挖出区块显示模拟哈希，电力小幅回充。
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _minerState = null;
let _minerTimer = null;

function renderMiner() {
  return `
    <div class="card">
      <div style="background:var(--bg);border-radius:10px;padding:12px;margin-bottom:12px;margin-top:4px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:4px;">
          <span>${t('miner.progress')}: <b id="minerProgress" style="color:var(--primary)">0%</b></span>
          <span>${t('miner.power')}: <b id="minerPower" style="color:var(--success)">100</b></span>
        </div>
        <div style="height:14px;background:#0a0d1c;border-radius:7px;overflow:hidden;margin-bottom:8px;">
          <div id="minerBar" style="height:100%;width:0%;background:linear-gradient(90deg,#7c9bff,#4ade80);transition:width .1s"></div>
        </div>
        <div style="height:10px;background:#0a0d1c;border-radius:5px;overflow:hidden;">
          <div id="minerPowerBar" style="height:100%;width:100%;background:linear-gradient(90deg,#fbbf24,#f87171)"></div>
        </div>
      </div>
      <div style="position:relative;">
        <div style="text-align:center">
          <button id="minerBtn" class="btn" style="min-width:200px;min-height:72px;font-size:20px;">${t('miner.clickMine')}</button>
          <div style="margin-top:10px;font-size:12px;color:var(--text-muted)">${t('miner.blocks')}: <b id="minerBlocks" style="color:var(--warning)">0</b></div>
          <div id="minerHashBox" style="margin-top:8px;font-family:monospace;font-size:10px;color:var(--text-muted);min-height:16px;word-break:break-all;"></div>
          <div id="minerEvent" style="margin-top:6px;font-size:13px;min-height:20px;color:var(--danger)"></div>
        </div>
        <div id="gpOverlay" style="position:absolute;top:-40px;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);border-radius:8px;z-index:10;">
          ${GamePay.overlayHTML('blockchain-miner', 'game.blockchain-miner', 'miner.controls')}
        </div>
      </div>
    </div>
  `;
}

function bindMinerEvents() {
  GamePay.bindStart('blockchain-miner', () => startMinerGame());
}

function _minerFakeHash() {
  let h = '000000';
  const hex = '0123456789abcdef';
  for (let i = 0; i < 58; i++) h += hex[Math.floor(Math.random() * 16)];
  return h;
}

function startMinerGame(keepScore) {
  if (!GamePay.consumeRound('blockchain-miner')) return;

  const prevBlocks = keepScore && _minerState ? _minerState.blocks : 0;

  _minerState = {
    progress: 0, power: 100, blocks: prevBlocks,
    over: false, hackerIn: 0,
  };
  _minerUI();

  GamePay.registerRevive('blockchain-miner', () => startMinerGame(true));

  const btn = document.getElementById('minerBtn');
  btn.onclick = () => {
    const s = _minerState;
    if (!s || s.over) return;
    s.progress = Math.min(100, s.progress + 6);
    s.power = Math.max(0, s.power - 1.2);
    _minerUI();
    if (s.progress >= 100) _minerBlockMined();
    if (s.power <= 0) _minerDie();
  };

  // 黑客事件循环
  if (_minerTimer) clearInterval(_minerTimer);
  _minerTimer = setInterval(() => {
    const s = _minerState;
    if (!s || s.over) return;
    if (Math.random() < 0.55) {
      const dmg = 8 + Math.floor(Math.random() * 12);
      s.power = Math.max(0, s.power - dmg);
      const ev = document.getElementById('minerEvent');
      if (ev) { ev.textContent = t('miner.hacker', { n: dmg }); setTimeout(() => { if (ev) ev.textContent = ''; }, 1500); }
      _minerUI();
      if (s.power <= 0) _minerDie();
    }
  }, 3500);
}

function _minerBlockMined() {
  const s = _minerState;
  s.blocks++;
  s.progress = 0;
  s.power = Math.min(100, s.power + 12);
  document.getElementById('minerHashBox').textContent = t('miner.hash') + ': ' + _minerFakeHash();
  showToast(t('miner.blockMined') + ' #' + s.blocks, 'success');
  _minerUI();
}

function _minerUI() {
  const s = _minerState;
  document.getElementById('minerProgress').textContent = Math.floor(s.progress) + '%';
  document.getElementById('minerBar').style.width = s.progress + '%';
  document.getElementById('minerPower').textContent = Math.ceil(s.power);
  document.getElementById('minerPowerBar').style.width = s.power + '%';
  document.getElementById('minerBlocks').textContent = s.blocks;
}

function _minerDie() {
  const s = _minerState;
  if (s.over) return;
  s.over = true;
  if (_minerTimer) { clearInterval(_minerTimer); _minerTimer = null; }
  GamePay.showGameOver('blockchain-miner',
    `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.blocks} 🧱</b>`);
}

window.TOOL_REGISTRY['blockchain-miner'] = {
  render: renderMiner,
  bind: bindMinerEvents,
  beforeUnmount: () => {
    if (_minerTimer) { clearInterval(_minerTimer); _minerTimer = null; }
    _minerState = null;
  }
};
