# PAXI 游戏平台

基于 Paxi 链的"死亡付费"小游戏平台，纯前端静态部署，完美适配 GitHub Pages。

## 玩法规则

- 进入游戏：**5 PAXI / 局**（config.js 可改）
- 每位玩家累计 **2 次免费复活**
- 死亡后可付费复活：**3 PAXI 复活 1 次**，或 **5 PAXI 复活 2 次**（优惠）
- 每次支付的收款地址从 11 个地址池中**随机选择**
- 钱包：[PaxiHub](https://paxinet.io/paxi_docs/paxihub#paxihub-application)（手机 App，浏览器打开自动唤起）

## 目录结构

```
paxi_game_1.0/
├── index.html              # 游戏大厅（入口）
├── config.js               # ★ 全局配置：链参数 / 付费规则 / 收款地址池 / 管理员
├── common/                 # 共享基础设施（一般不动）
│   ├── compat.js           # PaxiCosmJS 缺失类补丁（来自 paxi-toolbox）
│   ├── paxi-sdk.js         # 钱包连接 + 交易构建/签名/广播 + 上链轮询
│   ├── shell.js            # 游戏页骨架（样式 / 词典 / Toast）
│   ├── game-pay.js         # 付费模块：入场 + 复活规则（GamePay API）
│   └── admin.js            # 管理面板（管理员钱包验证 + 生成 config.js）
├── games/                  # 每个游戏一个独立目录，互不影响
│   ├── tetris/             # 俄罗斯方块（有死亡）
│   ├── plane-war/          # 飞机大战（有死亡）
│   ├── bubble-shooter/     # 泡泡龙（有死亡/通关）
│   ├── 2048/               # 2048（死局可复活）
│   └── klotski/            # 华容道（无死亡，通关结束）
├── paxi-toolbox/           # 调试参考系统（可整体删除，不影响游戏）
└── README.md
```

**独立原则**：改某个游戏只动 `games/<游戏名>/` 里的文件，其他游戏和公共模块不受影响。新增游戏 = 复制一个现有游戏目录改内容 + 大厅 GAMES 数组加一项。

## 部署到 GitHub Pages（逐步操作）

### 第 1 步：注册/登录 GitHub
打开 https://github.com 登录你的账号。

### 第 2 步：创建仓库
1. 点右上角 **+** → **New repository**
2. Repository name 填 `paxi-games`（可自定，Public 必须选 Public）
3. 其他默认，点 **Create repository**

### 第 3 步：上传代码（网页方式，无需装 Git）
1. 在新仓库页面选 **uploading an existing file**（或 Code → Upload files）
2. 把 `H:\paxi_game_1.0` 目录下的这些内容拖进去：
   - `index.html`、`config.js`、`README.md`
   - `common\` 整个文件夹
   - `games\` 整个文件夹
   - ⚠ 不要传 `paxi-toolbox\`（那是本地调试参考）
3. 页面下方 Commit changes 填 "PAXI Games v1.0"，点 **Commit changes**

### 第 4 步：开启 Pages
1. 仓库 **Settings** → 左侧 **Pages**
2. Build and deployment → Source 选 **Deploy from a branch**
3. Branch 选 `main` / `(root)`，点 **Save**
4. 等 1~2 分钟，页面顶部出现地址：
   `https://你的用户名.github.io/paxi-games/`

### 第 5 步：验证
手机/电脑打开上面的地址，确认 11 个游戏、中英切换、🎁 空投按钮都在。

> 改代码后：进入 GitHub 仓库 → 对应文件铅笔图标编辑粘贴 / 或重新 Upload files 覆盖 → Commit，1~2 分钟自动生效。
> 以后代币发布：改 `config.js` 里 `prc20.enabled: true` + `contract` 合约地址 + `symbol`，提交即可。

## 管理员操作（你是管理员）

管理员地址：`paxi1rdarmm997hqwfdgl9wvnpffe28zmex3kfyg7xd`（config.js 中 `adminAddress`）

1. 打开大厅右上角 **⚙️ 管理**
2. 连接管理员钱包验证身份
3. 修改规则（如取消勾选"启用收费"进入调试模式 = 全员免费）
4. 点「生成 config.js」→「下载 config.js」
5. 用它替换 GitHub 仓库根目录的 `config.js` 并提交，1~2 分钟后全体玩家生效

调试期建议：把 `chargeEnabled` 设为 `false`，自己联调全流程后再打开收费。

## 本地测试

任意静态服务器均可：
```bash
cd paxi_game_1.0
python -m http.server 8080
# 浏览器打开 http://localhost:8080
```
注意：PaxiHub 钱包在手机 App 内打开页面时注入；桌面浏览器未装插件时 `window.paxihub` 不存在，会提示安装。

## 安全说明（重要）

- 纯前端方案：复活次数等状态存于玩家浏览器 localStorage，**可被技术玩家篡改**（免费次数方面）
- 但**付款本身是真实链上交易**：每次入场/付费复活都必须经 PaxiHub 签名转账，无法伪造，链上可查
- 收款随机地址池只在前端随机，玩家手动核对交易时可见收款方
- 若未来要彻底防作弊，可升级为智能合约记账（需部署合约 + Gas）
