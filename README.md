# dsh-turn-ding

> 会话跑完时，在 Windows 任务栏的 DSH 图标上显示未读数字徽标，并播放一声提示音。

[![npm version](https://img.shields.io/npm/v/dsh-turn-ding.svg)](https://www.npmjs.com/package/dsh-turn-ding)
[![license](https://img.shields.io/npm/l/dsh-turn-ding.svg)](./LICENSE)
[![platform](https://img.shields.io/badge/platform-Windows-0078D6.svg)](https://www.npmjs.com/package/dsh-turn-ding)

DSH 没有内置「会话完成提醒」：任务栏图标不会累计未读数，也没有完成提示音。`dsh-turn-ding` 补上这个缺口——每个会话正常结束时徽标 +1 并响一声，回到窗口自动清零，效果类似 Codex 的完成提醒。

## 功能

- 任务栏图标右上角的红底白字数字徽标（超过 99 显示 `99+`）
- 完成时播放系统提示音，音效可替换
- 只在会话**正常完成**（`turn/end` + `completed`）时计数；中断、报错、耗尽 token、子会话都不计
- DSH 是一窗多会话，因此即使窗口在前台也照常计数
- 回到窗口（后台 → 前台）自动清零；一直停留时约 10 秒后自动淡出
- Explorer 重启、窗口隐藏后徽标可自愈重绘

## 环境要求

| | |
| --- | --- |
| 系统 | Windows（`win32`，见 `os` 字段） |
| DSH | `>=0.2.1-alpha.2 <0.4.0` |
| 运行时 | Node >= 20、PowerShell 5.1+（Windows 自带，无需 `pwsh`） |

## 安装

### 从 npm 安装（推荐）

DSH 侧栏「插件 → 安装第三方插件」输入包名：

```
dsh-turn-ding
```

或用命令行（`desktop` 换成你使用的 profile）：

```bash
dsh plugin --profile desktop add dsh-turn-ding
```

> 桌面版需**完全退出 DSH** 后安装或更新，装好重新打开。
> 终端里找不到 `dsh` 时，先在桌面版菜单选「管理 dsh 命令」。

### 从「发现」安装（DSH 0.2.2+ 实验功能）

在「插件 → 实验性插件」启用**自定义插件索引**，再到「发现 → 添加索引源」填入本仓库 `index.json` 的公开地址：

```
https://raw.githubusercontent.com/<owner>/dsh-turn-ding/main/index.json
```

索引只是省掉手输包名这一步，装的仍是同一个 npm 包。

### 离线 / 本地目录

```bash
dsh plugin --profile desktop add "D:/path/to/dsh-turn-ding"
dsh plugin --profile desktop add "file:D:/path/to/dsh-turn-ding-0.1.1.tgz"
```

## 配置

在对应 profile 的 `cordis.patch.yml`（Windows 默认 `%USERPROFILE%\.dsh\profiles\desktop\cordis.patch.yml`）里，给插件行加上 `config`：

```yaml
- id: turn-ding
  name: 'dsh-turn-ding'
  config:
    sound: true
    soundFile: 'C:\Windows\Media\Windows Notify System Generic.wav'
    badge: true
    ignoreSubagents: true
```

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `sound` | `true` | 是否播放提示音 |
| `soundFile` | `C:\Windows\Media\Windows Notify System Generic.wav` | 任意本地 `.wav` 路径 |
| `badge` | `true` | 是否显示数字徽标 |
| `ignoreSubagents` | `true` | 是否忽略子会话的结束事件 |

其它可选系统音效位于 `C:\Windows\Media\`，例如 `Windows Ding.wav`、`chimes.wav`。留空即使用上表默认值。

## 工作原理

- `lib/index.js` 监听 `session/event`，识别正常完成的 turn，通过 stdin 行协议驱动一个常驻辅助进程。
- `lib/badge-server.ps1` 用 Win32 `ITaskbarList3.SetOverlayIcon` 绘制徽标，用 `System.Media.SoundPlayer` 播放音效，并轮询处理焦点变化与窗口句柄重绑定。

DSH 的插件 host 是独立 Node 进程，拿不到 `BrowserWindow`，因此徽标由辅助进程按窗口句柄直接绘制到任务栏按钮上。

## 开发

```bash
npm pack --dry-run              # 确认将要发布的文件
node test/host-harness.mjs      # host 事件判定逻辑
node test/e2e-badge.mjs         # 端到端徽标绘制
node test/focus-regression.mjs  # "前台也计数"回归测试
```

仓库 `test/` 下另有辅助进程协议、自动清零、索引校验等脚本；截图为本地生成产物，不纳入版本控制。

### 发布（维护者）

```bash
npm login --registry=https://registry.npmjs.org/
npm version patch
npm pack --dry-run
npm publish --registry=https://registry.npmjs.org/ --access public
```

发布后同步 `index.json` 中的 `version` 与 `publishTimestamp`（Unix 秒），用 `@deepseek-ai/dsh-plugin-market-index` 的 `parseMarketIndex()` 校验通过，再更新托管地址。

> 若 `~/.npmrc` 指向了镜像源，publish 需显式加 `--registry=https://registry.npmjs.org/`。开启两步验证的账号发布时需输入 OTP，或改用 Automation token 免去验证码。

`os: ["win32"]` 会阻止在非 Windows 机器上安装。`engines.dsh` 仅作声明：安装器按 `peerDependencies` 做兼容校验，本包不设该字段。

## 已知限制

- 仅支持 Windows；macOS / Linux 需要另一套实现。
- 安装或更换版本后需重启 DSH 才会加载。
- 窗口隐藏到托盘时任务栏按钮不存在，徽标不可见；重新显示窗口后会自愈重绘。
- 徽标是任务栏 **overlay 图标**，不是 Windows 通知中心里的 Toast 数字。

## 项目结构

```
dsh-turn-ding/
├── package.json          # dsh.bundle.patch 是"这是 DSH 插件"的标记
├── cordis.patch.yml      # 插件注入声明
├── index.json            # 「发现」用的格式 1 索引（托管到公开 URL 后使用）
├── README.md
├── LICENSE
├── .gitignore
├── lib/
│   ├── index.js          # host 侧：事件监听与辅助进程生命周期
│   └── badge-server.ps1  # Win32 侧：徽标绘制、提示音、轮询维护
└── test/                 # 验证脚本（截图为本地生成，不入库）
```

## 许可证

[MIT](./LICENSE)
