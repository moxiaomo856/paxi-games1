// ============================================================
// game-pay.js — 游戏付费模块（双模式：免费/收费）
// 收费规则（chargeEnabled=true 时生效）：
//   每日免费入场：3 局（按钱包地址+日期隔离）
//   每日免费复活：3 次
//   超过免费次数后：
//     入场：支付 1 PAXI + 50,000 PRC（若PRC20未启用则只收1 PAXI）
//     复活：支付 1 PAXI + 50,000 PRC
//   收款地址：从 config.payeeAddresses 随机选择
// 免费模式（chargeEnabled=false）：
//   所有入场、复活均免费，不消耗每日次数
// 依赖：i18n.js、paxi-sdk.js
// ============================================================
window.GamePay = {
  _reviveFns: {},
  _paying: false,

  cfg() { return window.PAXI_CONFIG; },
  enabled() { return this.cfg().chargeEnabled === true; },
  prcOn() { const p = this.cfg().prc20; return p && p.enabled && p.contract; },

  registerRevive(gameId, fn) { this._reviveFns[gameId] = fn; },

  // ---------- 每日免费计数（按钱包地址 + 日期） ----------
  _today() {
    return new Date().toISOString().slice(0, 10);
  },
  _dailyKey(type) {
    const addr = (typeof state !== 'undefined' && state.wallet) ? state.wallet.address : 'guest';
    return 'paxig_daily_' + type + '_' + this._today() + '_' + addr;
  },
  getDailyFreeEntries() {
    return parseInt(localStorage.getItem(this._dailyKey('entries')) || '3', 10);
  },
  setDailyFreeEntries(n) {
    localStorage.setItem(this._dailyKey('entries'), String(n));
  },
  getDailyFreeRevives() {
    return parseInt(localStorage.getItem(this._dailyKey('revives')) || '3', 10);
  },
  setDailyFreeRevives(n) {
    localStorage.setItem(this._dailyKey('revives'), String(n));
  },

  // ---------- 费用字符串（仅显示用） ----------
  costStr() {
    const c = this.cfg();
    let s = '1 ' + (c.displayDenom || 'PAXI');
    if (this.prcOn()) s += ' + 50,000 ' + c.prc20.symbol;
    return s;
  },

  // ---------- 入场UI ----------
  overlayHTML(gameId, titleKey, descKey) {
    const c = this.cfg();
    // 免费模式：直接显示开始按钮
    if (!this.enabled()) {
      return `
        <div id="gpOverlayTitle" style="font-size:24px;font-weight:800;color:#fff;margin-bottom:12px;">${t(titleKey)}</div>
        <div id="gpOverlaySub" style="font-size:13px;color:var(--text-muted);margin-bottom:20px;text-align:center;">${t(descKey)}</div>
        <button id="gpStartBtn" class="btn" style="min-width:140px;">▶ ${t('pay.freeStart')}</button>
      `;
    }
    // 收费模式：检查每日免费次数
    const freeEntries = this.getDailyFreeEntries();
    if (freeEntries > 0) {
      return `
        <div id="gpOverlayTitle" style="font-size:24px;font-weight:800;color:#fff;margin-bottom:12px;">${t(titleKey)}</div>
        <div id="gpOverlaySub" style="font-size:13px;color:var(--text-muted);margin-bottom:20px;text-align:center;">${t(descKey)}</div>
        <button id="gpStartBtn" class="btn" style="min-width:220px;">🎁 ${t('pay.freeEntry', { n: freeEntries })}</button>
        <div style="font-size:11px;color:var(--text-muted);margin-top:8px;">${t('pay.payEntry')}</div>
      `;
    } else {
      return `
        <div id="gpOverlayTitle" style="font-size:22px;font-weight:800;color:#fff;margin-bottom:8px;">${t(titleKey)}</div>
        <div id="gpOverlaySub" style="font-size:13px;color:var(--text-muted);margin-bottom:14px;text-align:center;">${t(descKey)}</div>
        <button id="gpStartBtn" class="btn" style="min-width:220px;">💳 ${t('pay.payStart', { a: this.costStr() })}</button>
      `;
    }
  },

  roundsBadge(gameId) {
    if (!this.enabled()) return '';
    const free = this.getDailyFreeEntries();
    return `<span style="background:var(--bg);padding:4px 10px;border-radius:6px;font-size:12px;">🎟 ${t('pay.dailyFree')}: ${free} ${t('pay.times')}</span>`;
  },

  bindStart(gameId, startFn) {
    setTimeout(() => {
      const btn = document.getElementById('gpStartBtn');
      if (btn) btn.addEventListener('click', (e) => { e.stopPropagation(); this.onStart(gameId, startFn); });
      const overlay = document.getElementById('gpOverlay');
      if (overlay) overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.id === 'gpOverlayTitle' || e.target.id === 'gpOverlaySub') {
          this.onStart(gameId, startFn);
        }
      });
    }, 100);
  },

  async onStart(gameId, startFn) {
    if (!this.enabled()) { startFn(); return; }   // 免费模式直接开始
    if (typeof state === 'undefined' || !state.connected) {
      const ok = await connectWallet();
      if (!ok) return;
    }
    const free = this.getDailyFreeEntries();
    if (free > 0) {
      // 免费入场
      this.setDailyFreeEntries(free - 1);
      startFn();
      return;
    }
    // 付费入场
    await this._payAndStart(gameId, startFn);
  },

  async _payAndStart(gameId, startFn) {
    if (this._paying) return;
    this._paying = true;
    const btn = document.getElementById('gpStartBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> ' + t('pay.waitPay'); }

    try {
      const tok = this.prcOn() ? 50000 : 0;   // 固定5万
      const r = await payPaxi(1, 'PAXI Game entry: ' + gameId, tok);
      showToast(t('pay.payOk', { h: r.txhash.slice(0, 10) }), 'success');
      refreshBalance();
      startFn();
    } catch (e) {
      showToast(t('pay.payFail', { m: e.message || e }), 'error');
      if (btn) { btn.disabled = false; btn.textContent = '💳 ' + t('pay.payStart', { a: this.costStr() }); }
    } finally {
      this._paying = false;
    }
  },

  consumeRound(gameId) {
    // 此游戏每局独立，无需扣局数，直接返回 true
    return true;
  },

  // ---------- 保存分数到排行榜（本地存储） ----------
  saveScore(score) {
    try {
      const addr = (state && state.wallet) ? state.wallet.address : 'guest';
      const today = new Date().toISOString().slice(0, 10);
      const key = 'paxi_leaderboard';
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      // 只保留今日最高分（多次游戏取最高）
      if (!data[addr] || data[addr].date !== today || score > data[addr].score) {
        data[addr] = { score: score, date: today };
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (e) { /* 忽略存储错误 */ }
  },

  // ---------- 死亡/结束 ----------
  showGameOver(gameId, scoreHTML, opts) {
    const win = opts && opts.win;
    const score = opts && opts.score;   // 若传入分数则保存
    if (score !== undefined && typeof score === 'number') {
      this.saveScore(score);
    }

    const overlay = document.getElementById('gpOverlay');
    if (!overlay) return;
    overlay.style.display = 'flex';

    const mkBtn = (cls, html) => {
      const b = document.createElement('button');
      b.className = 'btn ' + cls;
      b.style.cssText = 'min-width:230px;margin:6px 0;display:block;margin-left:auto;margin-right:auto;';
      b.innerHTML = html;
      return b;
    };

    overlay.innerHTML = '';

    const title = document.createElement('div');
    title.id = 'gpOverlayTitle';
    title.style.cssText = 'font-size:22px;font-weight:800;color:#fff;margin-bottom:10px;';
    title.textContent = win ? t('pay.win') : t('pay.gameOver');
    overlay.appendChild(title);

    const sub = document.createElement('div');
    sub.id = 'gpOverlaySub';
    sub.style.cssText = 'font-size:15px;color:var(--text);margin-bottom:12px;';
    sub.innerHTML = scoreHTML;
    overlay.appendChild(sub);

    const reviveFn = this._reviveFns[gameId];

    // 免费模式：直接提供免费复活和重新开始
    if (!this.enabled()) {
      if (!win && reviveFn) {
        const b = mkBtn('', t('pay.debugRevive'));
        b.onclick = () => { overlay.style.display = 'none'; reviveFn(); };
        overlay.appendChild(b);
      }
      const r = mkBtn('sec', t('pay.freeAgain'));
      r.onclick = () => { overlay.style.display = 'none'; this._restart(gameId); };
      overlay.appendChild(r);
      return;
    }

    // 收费模式
    if (!win && reviveFn) {
      const freeRevives = this.getDailyFreeRevives();
      const st = document.createElement('div');
      st.style.cssText = 'font-size:12px;color:var(--text-muted);margin-bottom:10px;';
      st.innerHTML = `🎟 ${t('pay.dailyFree')} ${t('pay.freeLeft')}：<b style="color:var(--success)">${freeRevives}</b>`;
      overlay.appendChild(st);

      if (freeRevives > 0) {
        const b = mkBtn('', t('pay.freeRevive', { n: freeRevives }));
        b.onclick = () => {
          this.setDailyFreeRevives(freeRevives - 1);
          overlay.style.display = 'none';
          reviveFn();
        };
        overlay.appendChild(b);
      }

      const b1 = mkBtn('', t('pay.revive1', { a: this.costStr() }));
      b1.onclick = async () => {
        b1.disabled = true; b1.innerHTML = '<span class="spinner"></span> ' + t('pay.waitPay');
        try {
          const tok = this.prcOn() ? 50000 : 0;
          const r = await payPaxi(1, 'PAXI Game revive: ' + gameId, tok);
          showToast(t('pay.reviveOk', { h: r.txhash.slice(0, 10) }), 'success');
          refreshBalance();
          overlay.style.display = 'none';
          reviveFn();
        } catch (e) {
          showToast(t('pay.payFail', { m: e.message || e }), 'error');
          b1.disabled = false; b1.textContent = t('pay.revive1', { a: this.costStr() });
        }
      };
      overlay.appendChild(b1);
    }

    const q = mkBtn('sec', win ? t('pay.again', { a: this.costStr() }) : t('pay.quit'));
    q.onclick = () => {
      overlay.style.display = 'none';
      this._restart(gameId);
    };
    overlay.appendChild(q);
  },

  _restart(gameId) {
    const overlay = document.getElementById('gpOverlay');
    const reg = window.TOOL_REGISTRY && window.TOOL_REGISTRY[gameId];
    if (!overlay || !reg) return;
    if (reg.beforeUnmount) reg.beforeUnmount();
    const root = document.getElementById('gameRoot');
    root.innerHTML = reg.render();
    if (reg.bind) reg.bind();
  },
};
// ========== 排行榜工具函数（供游戏调用） ==========
window.Leaderboard = {
  // 保存等级排行榜数据
  saveLevelScore(gameId, address, level, nickname) {
    try {
      const key = 'paxi_leaderboard_' + gameId;
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      if (!data[address] || level > data[address].level) {
        data[address] = { level: level, nickname: nickname || address.slice(0, 8) };
        localStorage.setItem(key, JSON.stringify(data));
      }
    } catch (e) {}
  },
  
  // 保存日累计排行榜数据
  saveDailyScore(gameId, address, count, nickname) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const key = 'paxi_daily_' + gameId;
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      if (!data[address]) {
        data[address] = { daily: {}, nickname: nickname || address.slice(0, 8) };
      }
      if (!data[address].daily[today]) {
        data[address].daily[today] = 0;
      }
      data[address].daily[today] += count;
      if (nickname) data[address].nickname = nickname;
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {}
  },
  
  // 获取等级排行榜
  getLevelRankings(gameId, limit = 50) {
    try {
      const key = 'paxi_leaderboard_' + gameId;
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      return Object.entries(data)
        .map(([addr, d]) => ({ address: addr, level: d.level || 0, nickname: d.nickname || addr.slice(0, 8) }))
        .sort((a, b) => b.level - a.level)
        .slice(0, limit);
    } catch (e) { return []; }
  },
  
  // 获取日累计排行榜
  getDailyRankings(gameId, limit = 50) {
    try {
      const today = new Date().toISOString().slice(0, 10);
      const key = 'paxi_daily_' + gameId;
      const data = JSON.parse(localStorage.getItem(key) || '{}');
      return Object.entries(data)
        .filter(([addr, d]) => d.daily && d.daily[today] > 0)
        .map(([addr, d]) => ({ 
          address: addr, 
          count: d.daily[today] || 0, 
          nickname: d.nickname || addr.slice(0, 8) 
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);
    } catch (e) { return []; }
  }
};