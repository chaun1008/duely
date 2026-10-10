# AGENTS.md

本文件是给在**这个仓库里工作的 agent** 的约定。改动代码前先读一遍。

## 文档与语言

- **名字**：中文名 **如期而至**，英文名 **Duely**（due「到期」+ duly「按时」）。文档里首次出现用「Duely（如期而至）」的对照写法。
  仓库名 / npm 包名 / Cargo 包名已统一为 `duely` / `Duely` —— Cargo 包名用大写 `Duely`，
  这样 dev 模式下可执行文件名就是 `Duely`，macOS Dock 悬停气泡显示正确的英文名（纯 ASCII，不会触发中文可执行名那个崩溃）。
- **唯二例外是 bundle identifier `com.ruqierzhi` 与由它决定的数据目录**（`~/Library/Application Support/com.ruqierzhi/`）——
  **不要改**：老用户的本地数据（events/categories/settings.json）认这个标识，改了等于让数据「搬家」。
  以后若真要迁移，得先写数据搬迁逻辑再改。
- **README 必须中英同步**：`README.md`（中文，仓库首页展示）与 `README.en.md`（英文）是**同一份文档的两个版本**。
  改动任意一份的任何内容（功能、命令、截图、目录结构、路线图、措辞…）时，**在同一次改动里把另一份一起改掉**，
  不要留到「之后再说」。
- **界面文案以应用内置的 i18n 为准**：写 README / 截图说明时，按钮名、设置项名等取自 `src/app.js` 里的
  `I18N.zh` 与 `I18N.en`，不要自己另翻一套，否则和实际界面对不上（例如按钮是 `+ 新增提醒` / `+ Add Reminder`）。
- 代码注释用中文（HTML / CSS / JS / Rust 一致），与现有风格保持一致。
- 新增截图放 `docs/screenshots/`（`.gitignore` 已放行该目录下的 png）。
  **新增任何 `.md` 文件都要在 `.gitignore` 里补一条 `!文件名`** —— 用户全局 gitignore 排除了 `*.md`，
  不补的话文件不会被 git 跟踪，推到 GitHub 上就是裂图 / 缺文件。
- **截图分两套，与 README 一一对应**：
  - `docs/screenshots/*.png` —— 中文界面，`README.md` 引用
  - `docs/screenshots/en-*.png` —— **英文界面**，`README.en.md` 引用
  界面一改两套都要重出。生成方式：真实 `style.css` + 从 `src/index.html` 抽的真实标记，
  文案取 `I18N.zh` / `I18N.en`（不要自己另翻）；无头 Chrome `--force-device-scale-factor=2`，
  窗口 1100×879（主页/弹窗/日历/浅色）或 1100×829（分类/废纸篓/设置）。
  注意：弹窗标题、规则芯片、续订周期下拉等是 JS 填的（没有 `data-i18n`），须在脚本里补上；
  弹窗 HTML 不能拼进 `<script>`（会让整段 JS 语法报错）。

## 版本与发布

**每发布一个新版本，必须同步下面三件事，缺一不可**：

1. **更新 `CHANGELOG.md`**：把「未发布」小节整理成新版本条目，日期写发布当天，
   按 `新增 / 变更 / 修复 / 移除 / 内部` 分类。条目写「用户能看到的行为」，
   别把中间过程的反复（先删后加之类）也记进去。格式与写法照文件头与既有条目。
2. **同步版本号**：`package.json`、`src-tauri/Cargo.toml`、`src-tauri/tauri.conf.json`
   三处 `version` 必须一致（`Cargo.lock` 里本包的 version 由 cargo 自动更新，不用手改）。
3. **打附注 tag**：`git tag -a vX.Y.Z`，tag 名与版本号一致（带 `v` 前缀），
   附注里写该版本要点。

约定：

- **tag 必须与代码里的版本号对得上**：不允许 tag 是 `v0.2.0` 而三处 `version` 还是 `0.1.0`。
- 版本号遵循[语义化版本](https://semver.org/lang/zh-CN/)：加功能升 minor，修 bug 升 patch，
  破坏兼容才动 major。
- 只改 `CHANGELOG.md` 的文字、或改代码但**不对外发版本**时，**不要**动版本号 ——
  版本号只在「正式发布一个版本」时才升。
- **推送 tag（`git push --tags`）与在 GitHub 上建 Release 属于对外发布动作，先取得用户同意**；
  本地 `git tag` 不算发布。

## 开发环境

- Node.js 需要 **20.19+ / 22.12+**（Vite 8 的要求）。
- **dev server 必须在沙箱外启动**：在沙箱内起的 Vite 会把文件读取代理到 broker socket，broker 被回收后，
  进程会**占着 3000 端口却读不到任何文件**（页面只剩裸 HTML、样式 404）。
  识别特征：`dev-server.log` 里出现 `connect ENOENT …/broker.sock`，或「入口 HTML 500、静态资源 404」。
  处置：结束僵死进程后，用干净环境（去掉 brokered-fs 垫片）+ 独立会话重新启动。
- **改图标后必须重编二进制**：`tauri-build` 没对 `icons/` 声明 `rerun-if-changed`，只跑 `npm run icon` 不会生效。
  dev 下 `touch src-tauri/tauri.conf.json` 后重启；打包时 `tauri build` 会自动重跑 build script。

## 验证

- 前端改动：`node --check src/app.js` + `npm run build:vite` 必须通过。
- 涉及布局 / 视觉的改动，用无头 Chrome 按真实 CSS + 真实标记渲染核对（可量像素位置，
  比肉眼判断可靠）；注意 headless 的整页截图会把 `position: sticky` 元素画在滚动位置，属于截图假象。
- 提交前：`cargo check`、`cargo test`、`npm run build` 通过。
