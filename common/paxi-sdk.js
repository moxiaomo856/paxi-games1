// ============================================================
// paxi-sdk.js — PAXI 游戏平台核心 SDK（经典 script，全局函数）
// 提炼自 paxi-toolbox/shared.js 的已验证交易管线：
//   PaxiHub 连接 / 交易构建签名广播 / Gas 模拟 / 上链轮询 / 错误映射
// 依赖：config.js（先加载）、paxi-cosmjs.umd.js、compat.js
// ============================================================

// ---------- 网络快捷访问 ----------
function PAXI_CFG() { return window.PAXI_CONFIG; }
function getLCD()   { return PAXI_CFG().restEndpoint; }
function getDenom() { return PAXI_CFG().denom; }
function getChainId() { return PAXI_CFG().chainId; }

// ---------- 全局状态（钱包） ----------
const state = {
  wallet: null,      // { address, public_key }
  connected: false,
  balance: null,
};

// ---------- 工具 ----------
function toBase64(bytes) {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}
function fromBase64(b64) {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
// 纯字符串/BigInt 精度转换：'5' -> '5000000'
function parseFloatToRawUnits(amountStr, decimals) {
  if (amountStr === null || amountStr === undefined) return '0';
  const str = String(amountStr).trim();
  if (!str || str === '.' || !/^\d+\.?\d*$/.test(str)) return '0';
  const dotIdx = str.indexOf('.');
  let intPart = dotIdx === -1 ? str : str.substring(0, dotIdx) || '0';
  let decPart = dotIdx === -1 ? '' : str.substring(dotIdx + 1);
  if (decPart.length < decimals) decPart = decPart.padEnd(decimals, '0');
  else if (decPart.length > decimals) decPart = decPart.substring(0, decimals);
  try {
    return (BigInt(intPart || '0') * (BigInt(10) ** BigInt(decimals)) + BigInt(decPart || '0')).toString();
  } catch (e) { return '0'; }
}
function paxiToUpaxi(amountStr) { return parseFloatToRawUnits(amountStr, PAXI_CFG().decimals); }

// ---------- 错误映射（节选自 toolbox） ----------
const PAXI_ERROR_KEYWORDS = [
  { pattern: /insufficient fund/i, msg: t('pay.balanceShort') },
  { pattern: /account sequence mismatch|expected.*got/i, msg: '账户序列号不匹配，可能已发过其他交易，请重试' },
  { pattern: /out of gas|gas.*exhausted/i, msg: 'Gas 不足' },
  { pattern: /timeout|timed out/i, msg: '网络超时，请重试' },
  { pattern: /rejected|denied|cancelled/i, msg: '你取消了交易' },
];
function mapError(code, rawLog) {
  if (rawLog && typeof rawLog === 'string') {
    for (const { pattern, msg } of PAXI_ERROR_KEYWORDS) {
      if (pattern.test(rawLog)) return msg;
    }
  }
  if (rawLog) return typeof rawLog === 'string' ? rawLog.slice(0, 150) : String(rawLog);
  return '未知错误';
}

// ============================================================
// 钱包连接（PaxiHub）
// ============================================================
async function connectWallet() {
  if (typeof window.paxihub === 'undefined') {
    showToast(t('shell.installWallet'), 'error');
    // 移动端：深度链接跳转 PaxiHub，未安装则跳下载页
    if (/Mobi/.test(navigator.userAgent)) {
      window.location.href = 'paxi://hub/explorer?url=' + encodeURIComponent(window.location.href);
      setTimeout(() => {
        window.location.href = 'https://paxinet.io/paxi_docs/paxihub#paxihub-application';
      }, 1000);
    }
    return false;
  }
  try {
    const sender = await window.paxihub.paxi.getAddress();
    state.wallet = sender;
    state.connected = true;
    if (typeof updateWalletUI === 'function') updateWalletUI();
    showToast(t('wallet.connected'), 'success');
    return true;
  } catch (e) {
    showToast(t('wallet.connectFail', { m: e.message || e }), 'error');
    return false;
  }
}

function disconnectWallet() {
  state.wallet = null;
  state.connected = false;
  state.balance = null;
  if (typeof updateWalletUI === 'function') updateWalletUI();
  showToast(t('wallet.disconnected'));
}

async function refreshBalance() {
  if (!state.wallet) return;
  try {
    const res = await fetch(`${getLCD()}/cosmos/bank/v1beta1/balances/${state.wallet.address}`);
    if (!res.ok) return;
    const data = await res.json();
    const b = data.balances?.find(x => x.denom === getDenom());
    state.balance = b ? (Number(b.amount) / Math.pow(10, PAXI_CFG().decimals)) : 0;
    if (typeof updateWalletUI === 'function') updateWalletUI();
  } catch (e) { /* 忽略 */ }
}

// ============================================================
// 交易构建 & 签名 & 广播（来自 toolbox 已验证管线）
// ============================================================
async function simulateGas(messages, memo, sequence, pubKey) {
  const denom = getDenom();
  // 【已优化】静态估算下调：MsgSend 实际约 5.5~6.5 万 gas；留出小余地
  let gasSum = 0;
  for (const msg of messages) {
    if (msg.typeUrl?.includes('MsgSend')) gasSum += 65000;
    else if (msg.typeUrl?.includes('MsgExecuteContract')) gasSum += 160000;
    else gasSum += 120000;
  }
  const dummyGas = gasSum + 20000;
  // 模拟 Gas 单价降低：0.25 → 0.08 upaxi/gas，仅用于 simulate 时不会因为 Fee 太少失败
  const dummyFee = { amount: [PaxiCosmJS.coins(Math.max(1, Math.floor(dummyGas * 0.08)).toString(), denom)[0]], gasLimit: BigInt(dummyGas) };

  const pubkeyBytes = typeof pubKey === 'string' ? fromBase64(pubKey) : new Uint8Array(pubKey);
  const pubkeyAny = {
    typeUrl: '/cosmos.crypto.secp256k1.PubKey',
    value: PaxiCosmJS.PubKey.encode({ key: pubkeyBytes }).finish(),
  };
  const txBody = PaxiCosmJS.TxBody.fromPartial({ messages, memo: memo || '' });
  const authInfo = PaxiCosmJS.AuthInfo.fromPartial({
    signerInfos: [{ publicKey: pubkeyAny, modeInfo: { single: { mode: 1 } }, sequence: BigInt(sequence) }],
    fee: dummyFee,
  });
  const txRaw = PaxiCosmJS.TxRaw.fromPartial({
    bodyBytes: PaxiCosmJS.TxBody.encode(txBody).finish(),
    authInfoBytes: PaxiCosmJS.AuthInfo.encode(authInfo).finish(),
    signatures: [new Uint8Array(64)],
  });
  const res = await fetch(`${getLCD()}/cosmos/tx/v1beta1/simulate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tx_bytes: toBase64(PaxiCosmJS.TxRaw.encode(txRaw).finish()) }),
  });
  if (!res.ok) throw new Error('simulate HTTP ' + res.status);
  const data = await res.json();
  const gasUsed = data.gas_info?.gas_used || data.gasUsed || data.gas_info?.gas_wanted;
  if (gasUsed && Number(gasUsed) > 0) return Number(gasUsed);
  throw new Error('simulate 无有效 gas');
}

async function buildSignAndBroadcast(messages, memo, gasLimit, wallet) {
  if (!wallet || !wallet.address) throw new Error('钱包未连接');
  const pubKey = wallet.public_key || wallet.publicKey;
  if (!pubKey) throw new Error('钱包公钥缺失');

  const cfg = PAXI_CFG();
  const accountRes = await fetch(`${cfg.restEndpoint}/cosmos/auth/v1beta1/accounts/${wallet.address}`);
  if (!accountRes.ok) throw new Error('获取账户信息失败: HTTP ' + accountRes.status);
  const accountData = await accountRes.json();
  const account = accountData.account?.base_account || accountData.account;
  const accountNumber = Number(account.account_number);
  const sequence = Number(account.sequence);

  // Gas：模拟 + 5% 缓冲（原为15%），失败降级为静态估算，均已下调
  let totalGas = gasLimit || 120000;
  if (!gasLimit) {
    try {
      const sim = await simulateGas(messages, memo, sequence, pubKey);
      if (sim > 0) totalGas = Math.floor(sim * 1.05);
    } catch (e) { console.warn('[Tx] simulate 降级:', e.message); }
  }

  const txBody = PaxiCosmJS.TxBody.fromPartial({ messages, memo });
  // 【优化】Gas 单价：原 0.25 → 0.08 upaxi/gas，成本省 ~70%
  //  0.08 * 8万 gas ≈ 0.0064 PAXI 手续费
  const fee = {
    amount: [PaxiCosmJS.coins(Math.max(1, Math.floor(totalGas * 0.08)).toString(), cfg.denom)[0]],
    gasLimit: BigInt(totalGas),
  };
  const pubkeyBytes = typeof pubKey === 'string' ? fromBase64(pubKey) : new Uint8Array(pubKey);
  const pubkeyAny = {
    typeUrl: '/cosmos.crypto.secp256k1.PubKey',
    value: PaxiCosmJS.PubKey.encode({ key: pubkeyBytes }).finish(),
  };
  const authInfo = PaxiCosmJS.AuthInfo.fromPartial({
    signerInfos: [{ publicKey: pubkeyAny, modeInfo: { single: { mode: 1 } }, sequence: BigInt(sequence) }],
    fee,
  });
  const signDoc = PaxiCosmJS.SignDoc.fromPartial({
    bodyBytes: PaxiCosmJS.TxBody.encode(txBody).finish(),
    authInfoBytes: PaxiCosmJS.AuthInfo.encode(authInfo).finish(),
    chainId: cfg.chainId,
    accountNumber: BigInt(accountNumber),
  });

  const txObj = {
    bodyBytes: toBase64(signDoc.bodyBytes),
    authInfoBytes: toBase64(signDoc.authInfoBytes),
    chainId: cfg.chainId,
    accountNumber: signDoc.accountNumber.toString(),
  };
  const result = await window.paxihub.paxi.signAndSendTransaction(txObj);
  if (!result || !result.success) throw new Error(result?.message || '钱包签名失败或被拒绝');

  const sigBytes = fromBase64(result.success);
  const txRaw = PaxiCosmJS.TxRaw.fromPartial({
    bodyBytes: signDoc.bodyBytes,
    authInfoBytes: signDoc.authInfoBytes,
    signatures: [sigBytes],
  });
  const base64Tx = toBase64(PaxiCosmJS.TxRaw.encode(txRaw).finish());

  const broadcastRes = await fetch(`${cfg.restEndpoint}/cosmos/tx/v1beta1/txs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tx_bytes: base64Tx, mode: 'BROADCAST_MODE_SYNC' }),
  }).then(r => r.json());
  return broadcastRes;
}

// 构建并发送一笔支付（自动随机选择收款地址）
// amountWhole: PAXI 数量；prc20Amount(可选): PRC20 代币数量（config.prc20 启用时生效）
// 两者在同一笔交易中转给同一个随机收款地址。
// 返回 { txhash } ；抛错 = 失败
async function payPaxi(amountWhole, memo, prc20Amount) {
  const cfg = PAXI_CFG();
  if (!state.connected || !state.wallet) {
    const ok = await connectWallet();
    if (!ok) throw new Error(t('pay.needWallet'));
  }
  const to = cfg.payeeAddresses[Math.floor(Math.random() * cfg.payeeAddresses.length)];
  const amountRaw = paxiToUpaxi(amountWhole);
  const msg = PaxiCosmJS.MsgSend.fromPartial({
    fromAddress: state.wallet.address,
    toAddress: to,
    amount: [PaxiCosmJS.coins(amountRaw, cfg.denom)[0]],
  });
  const messages = [PaxiCosmJS.Any.fromPartial({
    typeUrl: '/cosmos.bank.v1beta1.MsgSend',
    value: PaxiCosmJS.MsgSend.encode(msg).finish(),
  })];

  // PRC20 代币转账（MsgExecuteContract transfer），与 PAXI 同一笔交易
  const p20 = cfg.prc20;
  if (prc20Amount > 0 && p20 && p20.enabled && p20.contract) {
    const tokenRaw = parseFloatToRawUnits(String(prc20Amount), p20.decimals || 6);
    const execMsg = PaxiCosmJS.MsgExecuteContract.fromPartial({
      sender: state.wallet.address,
      contract: p20.contract,
      msg: new TextEncoder().encode(JSON.stringify({
        transfer: { recipient: to, amount: tokenRaw }
      })),
    });
    messages.push(PaxiCosmJS.Any.fromPartial({
      typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
      value: PaxiCosmJS.MsgExecuteContract.encode(execMsg).finish(),
    }));
  }

  const res = await buildSignAndBroadcast(messages, memo || 'PAXI Game', null, state.wallet);
  const txhash = res?.tx_response?.txhash;
  const code = res?.tx_response?.code;
  if (!txhash) throw new Error(mapError(code, res?.tx_response?.raw_log || res?.message));
  if (code !== 0 && code !== undefined) throw new Error(mapError(code, res.tx_response.raw_log));
  // 轮询上链确认（不阻塞太久）
  const poll = await pollTxStatus(txhash, 20);
  if (poll.confirmed && !poll.success) throw new Error(mapError(poll.code, poll.rawLog));
  return { txhash, payee: to };
}

// 交易上链轮询
async function pollTxStatus(txhash, maxAttempts = 25, intervalMs = 3000) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${getLCD()}/cosmos/tx/v1beta1/txs/${txhash}`);
      if (res.ok) {
        const data = await res.json();
        const tx = data.tx_response || data;
        if (tx && tx.height && parseInt(tx.height) > 0) {
          return { confirmed: true, success: tx.code === 0, code: tx.code, rawLog: tx.raw_log || '' };
        }
      }
    } catch (e) { /* 未上链，继续 */ }
    await new Promise(r => setTimeout(r, intervalMs));
  }
  return { confirmed: false };
}
