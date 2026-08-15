// ============================================================
// PAXI 游戏平台 全局配置
// 管理员：在大厅点「⚙️ 管理」，连接管理员钱包后可修改规则并
// 生成新的 config.js，替换仓库根目录同名文件并提交即生效。
// ============================================================
window.PAXI_CONFIG = {
  // ---- 区块链网络（Paxi 主网）----
  chainId: "paxi-mainnet",
  chainName: "Paxi Chain",
  rpcEndpoint: "https://mainnet-rpc.paxinet.io",
  restEndpoint: "https://mainnet-lcd.paxinet.io",   // LCD
  denom: "upaxi",              // 链上最小单位
  displayDenom: "PAXI",        // 显示名称
  decimals: 6,                 // 1 PAXI = 1000000 upaxi
  sdkUrl: "https://mainnet-api.paxinet.io/resources/js/paxi-cosmjs.umd.js",

  // ---- 管理员（保留，但界面上已隐藏管理按钮）----
  adminAddress: "paxi1rdarmm997hqwfdgl9wvnpffe28zmex3kfyg7xd",

  // ---- 收费开关（false = 免费模式，true = 收费模式）----
  // 当前部署为免费模式，待需要收费时改为 true 即可
  chargeEnabled: false,

  // ---- 付费规则（chargeEnabled = true 时生效）----
  entryFee: 1,              // 入场费（PAXI）
  entryRounds: 1,           // 每局独立，固定为1
  freeRevives: 3,           // 每日免费复活次数（已按日重置）
  reviveSingle: 1,          // 单次复活（PAXI）
  reviveDouble: 2,          // 优惠复活（PAXI）——暂未使用
  doubleReviveCount: 2,     // 优惠复活获得次数——暂未使用

  // ---- PRC20 代币（双币付费）----
  // 代币发布后：把 enabled 改为 true 并填入 contract 合约地址即可启用。
  // 启用后：入场/复活每次支付 1 PAXI + 50,000 代币
  prc20: {
    enabled: false,          // ⬅ 代币发布后改为 true
    contract: "",            // ⬅ PRC20 合约地址（发布后填入）
    symbol: "TOKEN",         // 显示符号（改成你的代币名）
    decimals: 6,             // 代币精度（按合约实际填）
    entryAmount: 50000,      // 入场代币数量
    reviveSingleAmount: 50000,   // 单次复活代币数量
    reviveDoubleAmount: 50000,   // 优惠复活代币数量（暂未使用）
    airdropAmount: 10000,    // 空投：每个地址可免费领取的代币数量
    faucetAddress: ""        // 空投发送钱包（留空=管理员地址）
  },

  // ---- 收款地址池（每次支付随机选一个，PAXI 与代币同笔交易转同一地址）----
  payeeAddresses: [
    "paxi1ngut7ymp4cmzu7drjrc2gv7rhtnq4p0u6cgl0g",
    "paxi1kg0fzzyldr5ldggd8hhvvmyhg9xx3j3uvkn8eg",
    "paxi1m62c5kqs0marmv54scz88nw4cx4k06yehd92fk",
    "paxi120u6khy4n4yk89vmmkynl8r6yruen6sd7k47pe",
    "paxi1c2z42224lqss50t5mme36nmu22r4fwef4rlwxu",
    "paxi19qfjacug75d4jkj5d7r8maachnezgwus0w8wup",
    "paxi164lc3lq67u9ghkuy0k2aa7xcun4al23putcmzn",
    "paxi1hm83zslpckq2xrnsgk3qswksll6esc76suf9sw",
    "paxi16smk5dq5qwyqvhkchrrwxhg9e2w7cvxpsx9f49",
    "paxi194kpjqhyz7re2g749lc2030cgeg4sql5ldvyem",
    "paxi1ykgjrygltdctjlthmhvzv09h3yey0acefmyfnm"
  ]
};