/**
 * shell.js — 游戏页面外壳
 * 提供：页面骨架、CSS 变量/卡片样式、Toast、钱包按钮、语言切换按钮、
 * 游戏容器渲染。手机优先适配。
 * 依赖：i18n.js（t / setLang / PAXI_LANG）、paxi-sdk.js（state / 钱包函数）
 */

function showToast(msg, type = '') {
  const existing = document.querySelector('.paxi-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.className = 'paxi-toast ' + type;
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 4000);
}

// 显式挂到 window：与 paxi-sdk.js 的全局检测保持一致
window.updateWalletUI = function () {
  const btn = document.getElementById('shellWalletBtn');
  const addr = document.getElementById('shellWalletAddr');
  const bal = document.getElementById('shellWalletBalance');
  if (!btn) return;
  if (state.connected && state.wallet) {
    btn.textContent = t('shell.disconnect');
    if (addr) {
      addr.textContent = state.wallet.address.slice(0, 10) + '...' + state.wallet.address.slice(-6);
      addr.style.display = 'inline';
    }
    if (bal) {
      if (state.balance !== null && state.balance !== undefined) {
        bal.textContent = Number(state.balance).toFixed(1) + ' ' + PAXI_CFG().displayDenom;
        bal.style.display = 'inline';
      } else {
        bal.style.display = 'none';
      }
    }
  } else {
    btn.textContent = t('shell.connect');
    if (addr) addr.style.display = 'none';
    if (bal) bal.style.display = 'none';
  }
};

const SHELL_CSS = `
:root{
  --bg:#0f1222; --bg2:#171b32; --text:#e8ebfa; --text-muted:#8b93bd;
  --primary:#7c9bff; --success:#4ade80; --warning:#fbbf24; --danger:#f87171;
  --card:#181c36; --border:#2c3260;
}
*{box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{overscroll-behavior:none}
body{margin:0;background:radial-gradient(1200px 600px at 50% -100px,#1c2244,var(--bg));
  color:var(--text);font-family:system-ui,"Microsoft YaHei","Segoe UI",sans-serif;min-height:100vh}
.shell-header{display:flex;flex-direction:column;gap:6px;
  padding:10px 12px;position:sticky;top:0;z-index:100;
  background:rgba(15,18,34,.9);backdrop-filter:blur(8px);border-bottom:1px solid var(--border)}
.shell-header-row{display:flex;align-items:center;gap:6px}
.shell-header-row:first-child{justify-content:space-between}
.shell-header-row:last-child{justify-content:center}
.shell-back{color:var(--text-muted);text-decoration:none;font-size:13px;padding:8px 10px;
  border:1px solid var(--border);border-radius:10px;white-space:nowrap}
.shell-back:hover{color:var(--text)}
.shell-title{font-weight:800;font-size:15px;flex:1;text-align:center;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.shell-right{display:flex;align-items:center;gap:6px}
#shellWalletAddr{font-size:11px;color:var(--text-muted);font-family:monospace;display:none;max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#shellWalletBalance{font-size:11px;color:var(--success);font-family:monospace;display:none;margin-left:4px}
.shell-header button{padding:8px 10px;border-radius:10px;border:1px solid var(--border);
  background:var(--bg2);color:var(--text);font-size:12px;cursor:pointer;min-height:36px}
#shellLangBtn{font-weight:700;min-width:44px}
.shell-main{max-width:560px;margin:0 auto;padding:14px 12px 80px}
.card{background:var(--card);border:1px solid var(--border);border-radius:14px;padding:14px}
.card-title{font-weight:800;font-size:15px;margin-bottom:10px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:none;
  border-radius:12px;cursor:pointer;font-weight:700;color:#141830;
  background:linear-gradient(90deg,#8fb0ff,#6d8dff);padding:12px 20px;font-size:14px;min-height:44px}
.btn:disabled{opacity:.5;cursor:not-allowed}
.btn.sec{background:var(--bg2);color:var(--text);border:1px solid var(--border)}
.paxi-toast{position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:99999;
  background:#141830;color:var(--text);border:1px solid var(--border);border-radius:10px;
  padding:10px 18px;font-size:14px;box-shadow:0 8px 30px rgba(0,0,0,.4);max-width:92vw}
.paxi-toast.success{border-color:var(--success)}
.paxi-toast.error{border-color:var(--danger);color:#ffc9c9}
.paxi-toast.warning{border-color:var(--warning)}
.spinner{display:inline-block;width:14px;height:14px;border:2px solid rgba(0,0,0,.3);
  border-top-color:currentColor;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.debug-banner{position:fixed;top:0;left:0;right:0;z-index:99990;background:#7a2b2b;color:#fff;
  text-align:center;font-size:12px;padding:4px}
@media (max-width:480px){
  .card{padding:12px 10px}
  .shell-main{padding:10px 8px 80px}
}
`;

window.PaxiShell = {
  boot(gameId, gameTitle) {
    const style = document.createElement('style');
    style.textContent = SHELL_CSS;
    document.head.appendChild(style);
    document.title = gameTitle + ' - PAXI Games';

    document.body.innerHTML = `
      <div class="shell-header">
        <div class="shell-header-row">
          <a class="shell-back" href="../../index.html">← ${t('shell.lobby')}</a>
          <div class="shell-title">${gameTitle}</div>
          <button id="shellWalletBtn">${t('shell.connect')}</button>
        </div>
        <div class="shell-header-row">
          <span id="shellWalletAddr"></span>
          <span id="shellWalletBalance"></span>
          <button id="shellLangBtn">${window.PAXI_LANG === 'zh' ? 'EN' : '中'}</button>
          <button id="shellFaucetBtn" title="Faucet">🎁</button>
        </div>
      </div>
      <div class="shell-main" id="gameRoot"></div>
    `;

    document.getElementById('shellLangBtn').onclick = () => {
      setLang(window.PAXI_LANG === 'zh' ? 'en' : 'zh');
    };
    document.getElementById('shellFaucetBtn').onclick = () => {
      if (typeof PaxiFaucet !== 'undefined') PaxiFaucet.openClaim();
    };
    document.getElementById('shellWalletBtn').onclick = async () => {
      if (state.connected) disconnectWallet();
      else { await connectWallet(); refreshBalance(); }
    };

    // 立即同步一次钱包 UI（如果之前已连接）
    if (typeof updateWalletUI === 'function') updateWalletUI();

    const reg = window.TOOL_REGISTRY && window.TOOL_REGISTRY[gameId];
    if (!reg) { console.error('Game not registered:', gameId); return; }
    const root = document.getElementById('gameRoot');
    root.innerHTML = reg.render();
    if (reg.bind) reg.bind();
  }
};
