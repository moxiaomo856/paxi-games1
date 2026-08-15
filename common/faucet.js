// ============================================================
// faucet.js — PRC20 代币空投系统（纯前端 + 链上数据）
// 玩家端：🎁 按钮 → 连接钱包 → 链上校验是否已领 → 提交申请
//         （申请 = 一笔 self-transfer，memo=PAXI_FAUCET_CLAIM，玩家付微量 gas）
// 管理员端：空投台 → 扫描链上申请 → 剔除已领 → 批量发放
// 限领一次判据：空投钱包(默认=管理员)发出的 PRC20 transfer 中
//               wasm.recipient 含该地址（链上记录，清缓存无效）
// 依赖：i18n.js、paxi-sdk.js（state / buildSignAndBroadcast 等）
// ============================================================
window.PaxiFaucet = (() => {

  const CLAIM_MEMO = 'PAXI_FAUCET_CLAIM';
  const SENT_MEMO = 'PAXI_FAUCET_SENT';

  const cfg = () => window.PAXI_CONFIG;
  const prc20 = () => cfg().prc20 || {};
  const live = () => { const p = prc20(); return p.enabled && p.contract; };
  const faucetAddr = () => prc20().faucetAddress || cfg().adminAddress;
  const tokenRaw = (n) => parseFloatToRawUnits(String(n), prc20().decimals || 6);

  function el(tag, html, style) {
    const e = document.createElement(tag);
    if (html !== undefined) e.innerHTML = html;
    if (style) e.style.cssText = style;
    return e;
  }
  function modalShell(width) {
    document.getElementById('paxiFaucetOverlay')?.remove();
    const ov = el('div', '', 'position:fixed;inset:0;background:rgba(8,10,24,.85);z-index:99996;display:flex;align-items:center;justify-content:center;');
    ov.id = 'paxiFaucetOverlay';
    const m = el('div', '', `background:var(--card,#181c36);color:var(--text,#e8ebfa);border:1px solid #3d4680;border-radius:16px;
      padding:24px;width:min(${width || 440}px,94vw);max-height:88vh;overflow:auto;font-family:system-ui,"Microsoft YaHei",sans-serif`);
    ov.appendChild(m);
    document.body.appendChild(ov);
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    return m;
  }
  const btnStyle = 'width:100%;margin:8px 0 0;padding:12px;border:none;border-radius:12px;cursor:pointer;font-weight:700;color:#141830;background:linear-gradient(90deg,#8fb0ff,#6d8dff);font-size:14px;min-height:44px';
  const btnSec = 'width:100%;margin:8px 0 0;padding:12px;border:1px solid #4a5490;border-radius:12px;cursor:pointer;font-weight:600;background:#12152c;color:#eef1ff;font-size:14px;min-height:44px';

  // ---------- 链上查询：地址是否已领过 ----------
  // 返回 true=已领 / false=未领 / null=无法确认
  async function checkClaimed(addr) {
    const lcd = cfg().restEndpoint;
    const src = faucetAddr();
    // 主查询：faucet 发出的交易 + wasm.recipient 事件
    try {
      const q = `events=${encodeURIComponent("message.sender='" + src + "'")}&events=${encodeURIComponent("wasm.recipient='" + addr + "'")}&pagination.limit=5`;
      const res = await fetch(`${lcd}/cosmos/tx/v1beta1/txs?${q}`);
      if (res.ok) {
        const data = await res.json();
        const txs = data.tx_responses || [];
        if (txs.some(tx => tx.code === 0)) return true;
      }
    } catch (e) { /* 继续 fallback */ }
    // 兜底：拉 faucet 最近交易，响应文本中搜地址
    try {
      const q = `events=${encodeURIComponent("message.sender='" + src + "'")}&order_by=ORDER_BY_BLOCK_DESC&pagination.limit=100`;
      const res = await fetch(`${lcd}/cosmos/tx/v1beta1/txs?${q}`);
      if (res.ok) {
        const data = await res.json();
        const txs = data.tx_responses || [];
        return txs.some(tx => tx.code === 0 && JSON.stringify(tx).indexOf(addr) >= 0);
      }
    } catch (e) { /* 忽略 */ }
    return null;
  }

  // ---------- 玩家端：领取弹窗 ----------
  async function openClaim() {
    const p = prc20();
    if (!live()) {
      const m = modalShell();
      m.appendChild(el('h2', t('faucet.title'), 'margin:0 0 10px;font-size:20px'));
      m.appendChild(el('div', t('faucet.notLive'), 'font-size:14px;color:#8b93bd;line-height:1.8'));
      const c = el('button', t('admin.close'), btnSec);
      c.onclick = () => document.getElementById('paxiFaucetOverlay').remove();
      m.appendChild(c);
      return;
    }

    const m = modalShell();
    m.appendChild(el('h2', t('faucet.title'), 'margin:0 0 8px;font-size:20px'));
    m.appendChild(el('div', t('faucet.desc', { n: (p.airdropAmount || 10000).toLocaleString(), sym: p.symbol }), 'font-size:13px;color:#8b93bd;line-height:1.9;margin-bottom:12px'));

    const status = el('div', '', 'font-size:13px;margin-bottom:10px;min-height:22px;color:#8b93bd');
    m.appendChild(status);

    const action = el('button', '', btnStyle);
    action.style.display = 'none';
    m.appendChild(action);

    const close = el('button', t('admin.close'), btnSec);
    close.onclick = () => document.getElementById('paxiFaucetOverlay').remove();
    m.appendChild(close);

    // 连接钱包（若未连接）
    if (typeof state === 'undefined' || !state.connected) {
      status.textContent = t('faucet.needConnect');
      action.style.display = '';
      action.textContent = t('shell.connect');
      action.onclick = async () => {
        action.disabled = true; action.textContent = '...';
        const ok = await connectWallet();
        action.disabled = false;
        if (ok) openClaim();  // 重开刷新状态
        else action.textContent = t('shell.connect');
      };
      return;
    }

    const addr = state.wallet.address;
    status.innerHTML = t('faucet.addrLabel') + ':<br><b style="font-family:monospace;font-size:12px;word-break:break-all">' + addr + '</b>';
    action.style.display = '';

    // 查询是否已领
    const hint = el('div', '', 'font-size:12px;color:#8b93bd');
    m.insertBefore(hint, action);
    const claimed = await checkClaimed(addr);
    if (claimed === true) {
      status.innerHTML += '<br>✅ ' + t('faucet.claimed');
      action.style.display = 'none';
      return;
    }
    if (claimed === null) {
      hint.textContent = '⚠ ' + t('faucet.checkFail');
    } else {
      hint.textContent = '✅ ' + t('faucet.notClaimed') + '　' + t('faucet.cost');
    }

    action.textContent = t('faucet.submit');
    action.onclick = async () => {
      action.disabled = true;
      action.textContent = t('pay.waitPay');
      try {
        const msg = PaxiCosmJS.MsgSend.fromPartial({
          fromAddress: addr,
          toAddress: addr,   // self-transfer，仅作链上申请标记
          amount: [PaxiCosmJS.coins(paxiToUpaxi('0.003888'), cfg().denom)[0]],
        });
        const messages = [PaxiCosmJS.Any.fromPartial({
          typeUrl: '/cosmos.bank.v1beta1.MsgSend',
          value: PaxiCosmJS.MsgSend.encode(msg).finish(),
        })];
        const res = await buildSignAndBroadcast(messages, CLAIM_MEMO, null, state.wallet);
        const tx = res?.tx_response;
        if (!tx?.txhash || (tx.code !== 0 && tx.code !== undefined)) {
          throw new Error(mapError(tx?.code, tx?.raw_log || res?.message));
        }
        action.style.display = 'none';
        status.innerHTML += '<br>✅ ' + t('faucet.submitted');
        showToast(t('faucet.submitted'), 'success');
      } catch (e) {
        showToast(t('pay.payFail', { m: e.message || e }), 'error');
        action.disabled = false;
        action.textContent = t('faucet.submit');
      }
    };
  }

  // ---------- 管理员端：空投台 ----------
  async function openConsole() {
    const p = prc20();
    const m = modalShell(520);
    m.appendChild(el('h2', '🎁 ' + t('faucet.console'), 'margin:0 0 8px;font-size:20px'));
    if (!live()) {
      m.appendChild(el('div', t('faucet.notLive'), 'font-size:13px;color:#8b93bd'));
      return;
    }
    m.appendChild(el('div', `${t('faucet.desc', { n: (p.airdropAmount || 10000).toLocaleString(), sym: p.symbol })}<br>faucet: <b style="font-family:monospace;font-size:11px">${faucetAddr().slice(0, 14)}…</b>`, 'font-size:12px;color:#8b93bd;line-height:1.9;margin-bottom:10px'));

    const list = el('div', '', 'margin:10px 0;font-size:13px');
    m.appendChild(list);
    const scanBtn = el('button', t('faucet.scan'), btnStyle);
    m.appendChild(scanBtn);
    const sendBtn = el('button', '', btnSec);
    sendBtn.style.display = 'none';
    m.appendChild(sendBtn);
    const close = el('button', t('admin.close'), btnSec);
    close.onclick = () => document.getElementById('paxiFaucetOverlay').remove();
    m.appendChild(close);

    let pending = [];

    scanBtn.onclick = async () => {
      scanBtn.disabled = true; scanBtn.textContent = t('faucet.scanning');
      list.innerHTML = '';
      try {
        const applicants = await scanApplications();
        // 逐个查已领状态（小规模可接受）
        pending = [];
        let dup = 0;
        for (const addr of applicants) {
          const claimed = await checkClaimed(addr);
          if (claimed === true) { dup++; continue; }
          pending.push(addr);
        }
        if (pending.length === 0) {
          list.innerHTML = t('faucet.none') + (dup ? '（' + t('faucet.dup', { n: dup }) + '）' : '');
          sendBtn.style.display = 'none';
        } else {
          list.innerHTML = '<label style="display:flex;flex-direction:column;gap:8px">' +
            pending.map((a, i) => `<label style="display:flex;gap:8px;align-items:center;cursor:pointer">
              <input type="checkbox" class="fcItem" value="${i}" checked>
              <span style="font-family:monospace;font-size:11px;word-break:break-all">${a}</span></label>`).join('') +
            '</label>';
          sendBtn.style.display = '';
          sendBtn.textContent = t('faucet.send', { n: pending.length });
        }
      } catch (e) {
        list.innerHTML = '⚠ ' + (e.message || e);
      }
      scanBtn.disabled = false; scanBtn.textContent = t('faucet.scan');
    };

    sendBtn.onclick = async () => {
      const sel = [...m.querySelectorAll('.fcItem:checked')].map(cb => pending[Number(cb.value)]);
      if (!sel.length) return;
      sendBtn.disabled = true; sendBtn.textContent = t('faucet.sending');
      try {
        const messages = sel.map(addr => {
          const exec = PaxiCosmJS.MsgExecuteContract.fromPartial({
            sender: state.wallet.address,
            contract: p.contract,
            msg: new TextEncoder().encode(JSON.stringify({
              transfer: { recipient: addr, amount: tokenRaw(p.airdropAmount || 10000) }
            })),
          });
          return PaxiCosmJS.Any.fromPartial({
            typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
            value: PaxiCosmJS.MsgExecuteContract.encode(exec).finish(),
          });
        });
        const res = await buildSignAndBroadcast(messages, SENT_MEMO, null, state.wallet);
        const tx = res?.tx_response;
        if (!tx?.txhash || (tx.code !== 0 && tx.code !== undefined)) {
          throw new Error(mapError(tx?.code, tx?.raw_log || res?.message));
        }
        const poll = await pollTxStatus(tx.txhash, 20);
        if (poll.confirmed && !poll.success) throw new Error(mapError(poll.code, poll.rawLog));
        showToast(t('faucet.sent', { n: sel.length }) + ' ✓ tx ' + tx.txhash.slice(0, 10) + '…', 'success');
        document.getElementById('paxiFaucetOverlay').remove();
      } catch (e) {
        showToast(t('pay.payFail', { m: e.message || e }), 'error');
        sendBtn.disabled = false; sendBtn.textContent = t('faucet.send', { n: sel.length });
      }
    };
  }

  // ---------- 扫描链上申请（最近交易里 memo=CLAIM_MEMO 的 self-transfer） ----------
  async function scanApplications() {
    const lcd = cfg().restEndpoint;
    const found = new Set();
    for (let page = 1; page <= 3; page++) {
      const q = `order_by=ORDER_BY_BLOCK_DESC&pagination.limit=100&pagination.offset=${(page - 1) * 100}`;
      const res = await fetch(`${lcd}/cosmos/tx/v1beta1/txs?${q}`);
      if (!res.ok) break;
      const data = await res.json();
      const txs = data.tx_responses || [];
      if (!txs.length) break;
      for (const tx of txs) {
        if (tx.code !== 0 || tx.tx?.body?.memo !== CLAIM_MEMO) continue;
        for (const anyMsg of (tx.tx?.body?.messages || [])) {
          if (anyMsg.type_url !== '/cosmos.bank.v1beta1.MsgSend') continue;
          try {
            const dec = PaxiCosmJS.MsgSend.decode(fromBase64(anyMsg.value));
            if (dec.fromAddress === dec.toAddress) found.add(dec.fromAddress);
          } catch (e) { /* 忽略解码失败 */ }
        }
      }
      if (txs.length < 100) break;
    }
    return [...found];
  }

  return { openClaim, openConsole, checkClaimed, scanApplications };
})();
