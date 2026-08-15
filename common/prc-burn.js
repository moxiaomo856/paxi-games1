// ============================================================
// prc-burn.js — PRC20 代币销毁功能（页面底部面板）
// 规则：销毁一笔固定收 2 PAXI 手续费（同时 burn 代币 + 转账 PAXI 手续费）
// 依赖：config.js、i18n.js (t)、paxi-sdk.js (buildSignAndBroadcast / connectWallet / state)
// ============================================================
window.PRCBurn = {
  FEE_PAXI: 2,  // 每笔销毁固定收 2 PAXI 手续费

  cfg() { return window.PAXI_CONFIG; },

  // --- 读取用户钱包 ---
  _wallet() { return (typeof state !== 'undefined' && state.wallet) ? state.wallet : null; },
  async _ensureWallet() {
    if (this._wallet()) return true;
    if (typeof connectWallet === 'function') return await connectWallet();
    showToast(t('pay.needWallet'), 'error');
    return false;
  },

  // --- 查询 PRC20 余额 ---
  async queryPRCBalance(contract, owner) {
    const cfg = this.cfg();
    if (!contract) return 0;
    const msg = btoa(JSON.stringify({ balance: { address: owner } }));
    const res = await fetch(
      `${cfg.restEndpoint}/cosmwasm/wasm/v1/contract/${contract}/smart/${msg}`
    ).catch(e => null);
    if (!res || !res.ok) return 0;
    const d = await res.json().catch(e => null);
    const raw = d?.data?.balance || 0;
    return String(raw);
  },

  rawToDisplay(rawStr, decimals) {
    try {
      const r = BigInt(rawStr || '0');
      const d = BigInt(decimals || 6);
      const div = BigInt(10) ** d;
      const whole = r / div;
      const frac = r % div;
      const fracStr = frac.toString().padStart(Number(d), '0').replace(/0+$/, '');
      return fracStr ? `${whole}.${fracStr}` : whole.toString();
    } catch (e) { return '0'; }
  },
  displayToRaw(display, decimals) {
    return parseFloatToRawUnits(String(display || '0'), decimals || 6);
  },

  // --- 渲染底部 Burn 面板 HTML ---
  renderHTML() {
    const cfg = this.cfg();
    const prc = cfg.prc20 || {};
    const defContract = prc.contract || '';
    const defSymbol = prc.symbol || 'TOKEN';
    const defDecimals = prc.decimals || 6;
    return `
      <div style="max-width:520px;margin:18px auto 28px;">
        <div class="card" id="burnCard" style="padding:14px 14px 16px;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
            <div style="font-size:15px;font-weight:800;color:#fff;">🔥 ${t('burn.title')}</div>
            <div style="font-size:11px;color:var(--text-muted);">${t('burn.feeLabel')}：<b style="color:var(--warning)">${this.FEE_PAXI} PAXI</b></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div>
              <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">${t('burn.contract')}</label>
              <input id="burnContract" type="text" placeholder="${t('burn.contractPh')}"
                value="${defContract}"
                style="width:100%;box-sizing:border-box;padding:9px 11px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;font-family:monospace;">
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
              <div>
                <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">${t('burn.symbol')}</label>
                <input id="burnSymbol" type="text" value="${defSymbol}"
                  style="width:100%;box-sizing:border-box;padding:9px 11px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;">
              </div>
              <div>
                <label style="font-size:12px;color:var(--text-muted);display:block;margin-bottom:4px;">${t('burn.decimals')}</label>
                <input id="burnDecimals" type="number" min="0" max="18" value="${defDecimals}"
                  style="width:100%;box-sizing:border-box;padding:9px 11px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;">
              </div>
            </div>
            <div>
              <div style="display:flex;justify-content:space-between;align-items:baseline;">
                <label style="font-size:12px;color:var(--text-muted);margin-bottom:4px;">${t('burn.amount')}</label>
                <button id="burnQueryBtn" type="button" style="font-size:11px;padding:2px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text);cursor:pointer;">🔍 ${t('burn.checkBalance')}</button>
              </div>
              <div style="display:flex;gap:6px;align-items:center;margin-top:4px;">
                <input id="burnAmount" type="number" step="any" min="0" placeholder="${t('burn.amountPh')}"
                  style="flex:1;box-sizing:border-box;padding:9px 11px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:13px;">
                <span id="burnMyBalance" style="font-size:11px;color:var(--text-muted);white-space:nowrap;"></span>
              </div>
              <div style="display:flex;gap:6px;justify-content:flex-end;margin-top:6px;">
                <button class="burnMaxBtn" data-pct="25" type="button" style="font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text);cursor:pointer;">25%</button>
                <button class="burnMaxBtn" data-pct="50" type="button" style="font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text);cursor:pointer;">50%</button>
                <button class="burnMaxBtn" data-pct="100" type="button" style="font-size:11px;padding:3px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg2);color:var(--text);cursor:pointer;">${t('burn.max')}</button>
              </div>
            </div>
            <button id="burnExecuteBtn" class="btn" style="width:100%;margin-top:4px;">🔥 ${t('burn.executeBtn')}</button>
          </div>
        </div>
      </div>
    `;
  },

  // --- 绑定事件 ---
  bind(rootEl) {
    const scope = rootEl || document;
    const contractEl = scope.querySelector('#burnContract');
    const symbolEl = scope.querySelector('#burnSymbol');
    const decimalsEl = scope.querySelector('#burnDecimals');
    const amountEl = scope.querySelector('#burnAmount');
    const balanceEl = scope.querySelector('#burnMyBalance');
    const execBtn = scope.querySelector('#burnExecuteBtn');
    const queryBtn = scope.querySelector('#burnQueryBtn');

    // 缓存当前钱包的余额，避免每次点都查
    let lastBalanceRaw = '0';

    const _dec = () => Number(decimalsEl?.value) || 6;
    const _sym = () => (symbolEl?.value || 'TOKEN').toUpperCase();

    const _showBal = async () => {
      if (!balanceEl) return;
      balanceEl.textContent = '…';
      const contract = contractEl?.value?.trim();
      if (!contract) { balanceEl.textContent = t('burn.inputContractFirst'); return; }
      if (!(await this._ensureWallet())) { balanceEl.textContent = ''; return; }
      const w = this._wallet();
      const raw = await this.queryPRCBalance(contract, w.address);
      lastBalanceRaw = raw;
      const d = this.rawToDisplay(raw, _dec());
      balanceEl.textContent = `${t('burn.myBalance')}: ${d} ${_sym()}`;
    };

    if (queryBtn) queryBtn.onclick = () => _showBal();
    if (contractEl) {
      contractEl.addEventListener('blur', () => _showBal());
    }

    scope.querySelectorAll('.burnMaxBtn').forEach(btn => {
      btn.onclick = async () => {
        const pct = Number(btn.dataset.pct) || 100;
        const contract = contractEl?.value?.trim();
        if (!contract) { showToast(t('burn.inputContractFirst'), 'error'); return; }
        if (!this._wallet()) {
          if (!(await this._ensureWallet())) return;
        }
        const w = this._wallet();
        if (!lastBalanceRaw || lastBalanceRaw === '0') {
          const raw = await this.queryPRCBalance(contract, w.address);
          lastBalanceRaw = raw;
        }
        try {
          const raw = BigInt(lastBalanceRaw || '0');
          let targetRaw;
          if (pct >= 100) targetRaw = raw;
          else targetRaw = (raw * BigInt(pct)) / BigInt(100);
          amountEl.value = this.rawToDisplay(targetRaw.toString(), _dec());
        } catch (e) { amountEl.value = ''; }
      };
    });

    if (execBtn) execBtn.onclick = async () => {
      const contract = contractEl?.value?.trim();
      if (!contract) { showToast(t('burn.inputContractFirst'), 'error'); return; }
      const dec = _dec();
      const display = amountEl?.value?.trim();
      if (!display || Number(display) <= 0) { showToast(t('burn.inputAmountFirst'), 'error'); return; }
      if (!(await this._ensureWallet())) return;

      const w = this._wallet();
      const payees = this.cfg().payeeAddresses || [];
      const feeTo = (this.cfg().adminAddress && payees.includes(this.cfg().adminAddress))
        ? this.cfg().adminAddress
        : (payees[Math.floor(Math.random() * payees.length)] || this.cfg().adminAddress);
      if (!feeTo) { showToast(t('admin.payeesEmpty'), 'error'); return; }

      const burnRaw = this.displayToRaw(display, dec);
      if (BigInt(burnRaw) <= 0) { showToast(t('burn.inputAmountFirst'), 'error'); return; }

      execBtn.disabled = true;
      const prev = execBtn.innerHTML;
      execBtn.innerHTML = '<span class="spinner"></span> ' + t('pay.waitPay');

      try {
        // --- PRC20 burn 消息 ---
        const burnExec = PaxiCosmJS.MsgExecuteContract.fromPartial({
          sender: w.address,
          contract: contract,
          msg: new TextEncoder().encode(JSON.stringify({
            burn: { amount: burnRaw }
          })),
        });
        const messages = [
          PaxiCosmJS.Any.fromPartial({
            typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
            value: PaxiCosmJS.MsgExecuteContract.encode(burnExec).finish(),
          })
        ];
        // --- 2 PAXI 手续费消息（独立的 MsgSend）---
        const feeRaw = paxiToUpaxi(this.FEE_PAXI);
        const sendMsg = PaxiCosmJS.MsgSend.fromPartial({
          fromAddress: w.address,
          toAddress: feeTo,
          amount: [PaxiCosmJS.coins(feeRaw, this.cfg().denom)[0]],
        });
        messages.push(PaxiCosmJS.Any.fromPartial({
          typeUrl: '/cosmos.bank.v1beta1.MsgSend',
          value: PaxiCosmJS.MsgSend.encode(sendMsg).finish(),
        }));

        const sym = _sym();
        const memo = `Burn ${display} ${sym} (fee ${this.FEE_PAXI} PAXI)`;
        const res = await buildSignAndBroadcast(messages, memo, null, w);
        const txhash = res?.tx_response?.txhash;
        const code = res?.tx_response?.code;
        if (!txhash) throw new Error(mapError(code, res?.tx_response?.raw_log || res?.message));
        if (code !== 0 && code !== undefined) throw new Error(mapError(code, res.tx_response.raw_log));

        const poll = await pollTxStatus(txhash, 20);
        if (poll.confirmed && !poll.success) throw new Error(mapError(poll.code, poll.rawLog));

        showToast(t('burn.ok', { n: display, s: sym, h: txhash.slice(0, 10) }), 'success');
        lastBalanceRaw = '0';
        amountEl.value = '';
        if (balanceEl) balanceEl.textContent = '';
        if (typeof refreshBalance === 'function') refreshBalance();
      } catch (e) {
        showToast(t('burn.fail', { m: e.message || e }), 'error');
      } finally {
        execBtn.disabled = false;
        execBtn.innerHTML = prev;
      }
    };
  },
};
