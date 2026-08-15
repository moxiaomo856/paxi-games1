/**
 * 🃏 Crypto Mafia — 区块链卡牌策略（对标 CryptoMafia）
 * 你 vs 对手帮派：轮流出牌（袭击/防御/疗伤/敛财），先打空对方血量获胜。
 * 死亡（你的血量归零）→ 可复活：保留已造成伤害，满血继续同一局。
 */
if (!window.TOOL_REGISTRY) window.TOOL_REGISTRY = {};

let _mafiaState = null;

const MAFIA_CARD_TYPES = ['attack', 'attack', 'attack', 'defend', 'heal', 'gold'];

function renderMafia() {
  return `
    <div class="card">
      <div style="display:flex;justify-content:space-between;gap:8px;margin:4px 0 12px;">
        <div style="flex:1;background:var(--bg);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:12px;color:var(--text-muted)">${t('mafia.you')}</div>
          <div style="font-size:18px;font-weight:800;color:var(--success)">❤ <span id="mafiaYouHp">20</span></div>
          <div style="font-size:11px;color:var(--warning)">🪙 <span id="mafiaYouCoins">0</span></div>
        </div>
        <div style="flex:1;background:var(--bg);border-radius:10px;padding:10px;text-align:center;">
          <div style="font-size:12px;color:var(--text-muted)">${t('mafia.rival')}</div>
          <div style="font-size:18px;font-weight:800;color:var(--danger)">💀 <span id="mafiaRivalHp">20</span></div>
        </div>
      </div>
      <div id="mafiaStatus" style="text-align:center;font-size:13px;color:var(--text);margin-bottom:10px;min-height:20px;"></div>
      <div style="position:relative;">
        <div id="mafiaHand" style="display:flex;gap:8px;justify-content:center;min-height:150px;"></div>
        <div id="gpOverlay" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,0.75);border-radius:8px;z-index:10;">
          ${GamePay.overlayHTML('card-mafia', 'game.card-mafia', 'mafia.controls')}
        </div>
      </div>
    </div>
    <style>
      .mafia-card{width:74px;border-radius:12px;padding:10px 6px;text-align:center;cursor:pointer;
        user-select:none;-webkit-user-select:none;transition:transform .12s;border:1px solid var(--border);background:var(--bg2)}
      .mafia-card:active{transform:scale(.94)}
      .mafia-card .ic{font-size:28px}
      .mafia-card .nm{font-size:11px;font-weight:700;margin-top:4px}
      .mafia-card .vl{font-size:12px;color:var(--warning);font-weight:800;margin-top:2px}
      .mafia-card.attack{border-color:#7a3b3b}.mafia-card.defend{border-color:#3b5a7a}
      .mafia-card.heal{border-color:#3b7a4f}.mafia-card.gold{border-color:#7a6a3b}
    </style>
  `;
}

function bindMafiaEvents() {
  GamePay.bindStart('card-mafia', () => startMafiaGame());
}

function _mafiaDraw() {
  const type = MAFIA_CARD_TYPES[Math.floor(Math.random() * MAFIA_CARD_TYPES.length)];
  return { type, value: type === 'attack' ? 2 + Math.floor(Math.random() * 4) : (type === 'heal' ? 3 : (type === 'gold' ? 2 : 0)) };
}

function startMafiaGame(keepScore) {
  if (!GamePay.consumeRound('card-mafia')) return;

  const prevScore = keepScore && _mafiaState ? _mafiaState.score : 0;
  const rivalHp = keepScore && _mafiaState ? _mafiaState.rivalHp : 20;

  _mafiaState = {
    youHp: 20, youCoins: 0, rivalHp: rivalHp,
    score: prevScore,               // 已造成的总伤害
    hand: [], turn: 'you', over: false,
    youDefended: false, rivalDefended: false,
  };
  for (let i = 0; i < 4; i++) _mafiaState.hand.push(_mafiaDraw());

  GamePay.registerRevive('card-mafia', () => startMafiaGame(true));
  _mafiaRenderHand();
  _mafiaUI();
  _mafiaStatus(t('mafia.yourTurn'));
}

function _mafiaUI() {
  document.getElementById('mafiaYouHp').textContent = Math.max(0, _mafiaState.youHp);
  document.getElementById('mafiaYouCoins').textContent = _mafiaState.youCoins;
  document.getElementById('mafiaRivalHp').textContent = Math.max(0, _mafiaState.rivalHp);
}

function _mafiaStatus(msg, color) {
  const el = document.getElementById('mafiaStatus');
  if (el) { el.textContent = msg; el.style.color = color || 'var(--text)'; }
}

function _mafiaRenderHand() {
  const handEl = document.getElementById('mafiaHand');
  if (!handEl) return;
  handEl.innerHTML = '';
  const icons = { attack: '🗡️', defend: '🛡️', heal: '💊', gold: '🪙' };
  _mafiaState.hand.forEach((card, i) => {
    const d = document.createElement('div');
    d.className = 'mafia-card ' + card.type;
    d.innerHTML = `<div class="ic">${icons[card.type]}</div>
      <div class="nm">${t('mafia.card.' + card.type)}</div>
      <div class="vl">${card.type === 'attack' ? '-' + card.value : (card.type === 'heal' ? '+' + card.value : (card.type === 'gold' ? '+' + card.value + ' 🪙' : '🛡'))}</div>`;
    d.onclick = () => _mafiaPlayCard(i);
    handEl.appendChild(d);
  });
}

function _mafiaPlayCard(i) {
  const s = _mafiaState;
  if (!s || s.over || s.turn !== 'you') return;
  const card = s.hand.splice(i, 1)[0];
  _mafiaRenderHand();

  if (card.type === 'attack') {
    let dmg = card.value + Math.floor(s.youCoins / 5); // 每5金币+1伤害
    if (s.rivalDefended) {
      s.rivalDefended = false;
      _mafiaStatus(t('mafia.blocked'), 'var(--warning)');
    } else {
      s.rivalHp -= dmg;
      s.score += dmg;
      _mafiaStatus('🗡️ -' + dmg, 'var(--danger)');
    }
  } else if (card.type === 'defend') {
    s.youDefended = true;
    _mafiaStatus('🛡️', 'var(--primary)');
  } else if (card.type === 'heal') {
    s.youHp = Math.min(20, s.youHp + card.value);
    _mafiaStatus('💊 +' + card.value, 'var(--success)');
  } else if (card.type === 'gold') {
    s.youCoins += card.value;
    _mafiaStatus('🪙 +' + card.value, 'var(--warning)');
  }
  _mafiaUI();

  if (s.rivalHp <= 0) { _mafiaWin(); return; }

  s.turn = 'rival';
  setTimeout(() => _mafiaRivalTurn(), 900);
}

function _mafiaRivalTurn() {
  const s = _mafiaState;
  if (!s || s.over) return;
  const roll = Math.random();
  if (roll < 0.55) {
    // attack
    const dmg = 2 + Math.floor(Math.random() * 4);
    if (s.youDefended) {
      s.youDefended = false;
      _mafiaStatus('🛡️ ' + t('mafia.blocked'), 'var(--primary)');
    } else {
      s.youHp -= dmg;
      _mafiaStatus('💀 -' + dmg, 'var(--danger)');
    }
  } else if (roll < 0.75 && s.rivalHp < 12) {
    s.rivalHp = Math.min(20, s.rivalHp + 3);
    _mafiaStatus('💊 +3', 'var(--success)');
  } else {
    s.rivalDefended = true;
    _mafiaStatus('🛡️', 'var(--warning)');
  }
  _mafiaUI();

  if (s.youHp <= 0) { _mafiaLose(); return; }

  // 补牌到手牌4张
  while (s.hand.length < 4) s.hand.push(_mafiaDraw());
  _mafiaRenderHand();
  s.turn = 'you';
  _mafiaStatus(t('mafia.yourTurn'));
}

function _mafiaWin() {
  const s = _mafiaState;
  s.over = true;
  GamePay.showGameOver('card-mafia',
    `${t('mafia.victory')}<br>${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`,
    { win: true });
}

function _mafiaLose() {
  const s = _mafiaState;
  s.over = true;
  GamePay.showGameOver('card-mafia',
    `${t('pay.finalScore')}: <b style="color:var(--primary);font-size:20px;">${s.score}</b>`);
}

window.TOOL_REGISTRY['card-mafia'] = {
  render: renderMafia,
  bind: bindMafiaEvents,
  beforeUnmount: () => { _mafiaState = null; }
};
