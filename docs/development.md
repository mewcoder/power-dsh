# 开发指南

本指南是开发与 AI 协作的执行入口。功能行为以[功能 Spec 索引](README.md#功能规格spec)为准，发布操作见[发布与升级](releasing.md)。

## 目录职责

| 位置 | 职责与约定 |
| --- | --- |
| [src/features/](../src/features/) | 每项功能拥有定义、配置、Host/Client、协议、文案、唯一主 Spec 和 `tests/`；不创建空职责文件 |
| [src/app/](../src/app/) 与 [src/shared/](../src/shared/) | 显式装配与真正共享的队列、外壳、codec；公开门面保留在 `src/index.ts` 与 `src/client.ts` |
| [dist/index.js](../dist/index.js)、[index.d.ts](../dist/index.d.ts)、[client.js](../dist/client.js) | 提交到源码仓库的 Host ESM、公开声明与 Client factory；修改源码或类型后重建并一并交付 |
| [tests/](../tests/) | 集成与功能组合、共享机制及测试夹具；功能单测在各特性目录，均用 Node.js 内置测试运行器 |
| [scripts/](../scripts/) | tsdown 构建、结构与文档检查、递归测试、实际 tarball 检查及隔离 SDK 回归 |
| [assets/locale/](../assets/locale/) 与 [assets/icon.svg](../assets/icon.svg) | 双语元数据、文案与插件图标 |
| [docs/](./) | 跨功能规范、流程、验证依据和 Spec 索引；主 Spec 在对应模块，真实截图在 [images/](images/) |
| [cordis.patch.yml](../cordis.patch.yml) 与 [screenshots.json](../screenshots.json) | 包根目录中的 DSH Bundle 与市场截图入口 |
| [.github/workflows/](../.github/workflows/) 与 [.node-version](../.node-version) | 只执行检查的 CI 和开发 Node 版本；pnpm 版本由包清单声明 |
| 根目录的说明与配置 | [README](../README.md)、[CHANGELOG](../CHANGELOG.md)、[AGENTS](../AGENTS.md)、[package.json](../package.json)、[pnpm-lock.yaml](../pnpm-lock.yaml)、[tsconfig.json](../tsconfig.json)、[tsdown.config.ts](../tsdown.config.ts)与 [.gitignore](../.gitignore) |
| `reference/` 与 `.references/` | 本地忽略的第三方与官方参考源码；保留原位，不提交、不打包，不为整理目录而改动 |

[包清单](../package.json)的公开导出键保持 `.`、`./client`、`./locale/*.json`、`./icon`，目标分别为 `dist/index.js`、`dist/client.js`、`assets/locale/*.json`、`assets/icon.svg`。源码组织与依赖约束见[特性模块约定](feature-modules.md)。移动实现时同步相对导入、资源定位、测试引用和打包清单，不改变调用方的包路径。当前代码地图见[架构规范](architecture.md#包与文件职责)。

## 协作流程

1. **读文档、确认范围。** 先读[仓库首页](../README.md)、[更新日志](../CHANGELOG.md)与[协作入口](../AGENTS.md)，再按[文档索引](README.md)读取产品、UI、架构和受影响的主 Spec。核对用户授权与已有约定；开发功能前完成[源码与接口发现](#源码与接口发现)。
2. **检查工作区。** 运行以下命令并阅读目标文件，识别已有修改、未跟踪文件和协作者负责范围；不覆盖、回退或夹带无关改动。

   ```sh
   git status --short
   git diff --stat
   git diff
   ```

3. **先明确 Spec，再实现并同步。** 每项用户功能在[功能索引](README.md#功能规格spec)对应一份主 Spec，按[功能 Spec 规范](feature-spec.md)明确范围、配置、生命周期与验收条件，再修改最小必要范围；同步受影响的 Spec、必要测试、双语文案、资源与包清单及更新日志。只为实际行为补必要测试，不为占位结构添加依赖或框架。所有功能按[错误处理规范](error-handling.md)复用共享反馈与诊断处理，明确失败后的数据保留、控件权限与恢复动作；仅在关键意外故障确有排障需要时使用宿主日志，不把异常吞成成功或空列表。不得替换宿主根节点、覆盖宿主布局、注入全局 CSS、查询其他插件 DOM 或运行时导入内部 UI 组件；仅遵循主 Spec 中已获授权的有限例外。[自定义背景](../src/features/flowing-background/spec.md)按用户全局预览请求，获准在唯一已核对的 AppFrame 内设置局部 isolation、挂载自有底层画布，并仅对明确的 sidebarCol、centerCol、原生 SidebarRoot 及任意 phase 的主 ConversationRoot 临时设置内联透明背景。必需框架适配所需类名只读自当前两个精确官方样式标签 `@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css`、`@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css` 的唯一简单类名元数据，结合语义直接子元素和定位布局核对；同版本 CSS Modules 哈希可能因构建而异，不得硬编码 npm 哈希或猜测模糊选择器。head 的样式加载/替换观察和 body 的目标生命周期观察均随本功能释放。按用户后续明确要求，另允许从同一 SidebarRoot 官方样式标签读取唯一 `_scrollFade` 类名，仅对原生 SidebarRoot 内匹配该类名且 `aria-hidden="true"` 的底部滚动渐隐层临时设置 `display:none !important`，关闭或卸载按所有权恢复；该装饰类名为可选项，缺失或歧义不得阻断背景挂载。用户反馈的另一底部阴影获准从第三个精确官方标签 `@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css` 读取唯一 root/treeBody/fade 映射，只隐藏原生 SidebarRoot 内工作区 root 下 treeBody 的直接 span.fade；该模块及类名同样可选，禁止固定哈希、全局 fade 匹配或扩大读取内容。用户另已授权 Windows 顶部整行操作栏尽量透明，允许只对已核对 AppFrame 且直接拥有自有背景层的 `::before` 添加受 `html[data-windows-titlebar]` 限制的局部透明背景规则，随背景层样式节点释放；不修改拖动布局、全局主题 token、原生窗口按钮或内部桌面 IPC。按用户要求，另允许对该已核对 AppFrame 的直接 sidebarCol，在 Windows 非抽屉模式且直接拥有自有背景层时设置原生同款 0.5px 主题色右边框，随自有样式节点释放。不得扩大为任意样式扫描，或涉及输入卡片、编辑器、文件卡片、菜单、弹窗、全局主题 token、任意后代；不适配操作系统原生标题栏。关闭、框架替换或卸载须按原值和优先级恢复仍属于本功能的写入，保留第三方后写值。
   用户另明确授权[壁纸手势预览](../src/features/wallpaper/spec.md#选择导入与调节交互)临时隐藏原生设置弹窗，仅限自有滑块向上核对的设置 overlay 的内联 visibility:hidden，并通过自有滑块行的 visibility:visible 保留当前操作控件可见；不得扩展到其他弹窗，恢复与错误行为以该 Spec 为准。

4. **检查仓库与实际产物。** 按[环境与检查](#环境与检查)准备依赖，再执行：

   ```sh
   npm run check
   npm run check:package
   npm run check:install
   git diff --check
   ```

   核对包中包含编译后的 Host/Client JS、公开类型声明、模块 Spec、资源、Bundle 入口、用户首页与更新日志、发布截图及第三方声明，并保留 npm 自动收录的[文档索引](README.md)；开发指南、规范、研究材料、测试与脚本留在仓库，没有凭据、参考仓库或个人日志，具体清单见[发版准备](releasing.md#首次发版前的准备)。目录调整后确认导出目标、资源路径和测试入口。按影响选择[分层验证](#验证方法与限制)与兼容检查；错误行为按[验收要求](error-handling.md#实现与验收)覆盖失败展示、详情复制与敏感信息保护；确有按需日志时验证其失败不改变业务结果。纯文档任务核对本地链接与 diff，无需安装；多人协作时由负责整合者执行约定的完整检查。
5. **按授权安装验证。** 任务已授权安装或运行预览时，按[修改与安装](#修改与安装)通过原生管理器执行，核对应用结果与运行代际，再验证实际页面、状态和生命周期。未获授权时记录未验证部分。发布产物另按[发布流程](releasing.md#npm-发布与升级)验收。
6. **交付。** 再看 `git status --short` 与本次 diff，说明修改范围、检查结果、实际安装与页面验证情况、遗留限制。提交、推送、发布和市场投稿按各自授权执行。

## 环境与检查

安装后的运行时仍需 Node.js `>=22`，同时满足 DSH 自身要求。仓库通过 [.node-version](../.node-version)固定开发与 CI 的 Node [24.14.0](https://nodejs.org/dist/v24.14.0/)，通过[包清单](../package.json)的 `packageManager` 固定 pnpm `12.5.1`。tsdown 支持的开发 Node 范围是 `^22.18.0 || ^24.11.0 || >=26.0.0`，其他允许版本不自动视为已测。实际包检查另需系统 `tar`。

全部运行源码使用 TypeScript，配置见[tsconfig.json](../tsconfig.json)：`strict`、`noEmit`、`erasableSyntaxOnly` 与显式 `.ts` 相对导入。Node 原生类型擦除运行现有 `.mjs` 行为测试导入的源码，类型契约负例在 [tests/types/](../tests/types/)，由 `tsc` 检查。TypeScript、tsdown、Node/React 类型声明都是开发依赖；Host 编译为 ESM，Client 编译为单 factory IIFE，运行时仍复用原 SDK、宿主 React 与公共组件。

```sh
pnpm install --ignore-scripts
npm run build
npm run check
```

修改源码或类型后执行 `npm run build`，更新 `dist/index.js`、`dist/index.d.ts` 与 `dist/client.js`；`build:client` 仅用于客户端开发。`check:types` 执行严格类型检查，`check:build` 在内存验证三个产物新鲜度；`check` 还核对完整源码是否纳入类型检查、特性登记、配置归属、Spec/测试、依赖边界、浏览器模块图、资源、文案与链接，再递归执行行为测试。检查不自动改写产物来掩盖遗漏。

[实际包检查](../scripts/check-package.mjs)在系统临时目录生成并解包标准 npm tarball，核对编译 JS、公开声明、运行导入/依赖、Client factory、图标许可、locale、截图和十八份 Spec，排除 TS 编译输入、测试、构建配置/脚本及开发规范。文档另允许第三方声明、截图与 npm 自动收录的索引。

`npm run check:install` 运行[独立安装检查](../scripts/check-install.mjs)：重新验证产物新鲜度，将实际 tarball 安装到仓库外的临时项目，只安装生产依赖、禁止安装脚本，验证所有公开导出、Host 配置、Client 登记和独立 TypeScript 消费者的 `Context.plugin` 接入，并确认没有安装编译器、打包工具或另一份 React。它需要访问公共 npm 注册表；成功或失败都会清理临时项目，不使用用户 DSH/profile。包内容检查本身不下载依赖，两项都不能替代实际宿主验收。

### 自动检查

[CI](../.github/workflows/ci.yml)在 push、pull request 或手动触发时运行，只拥有仓库内容读取权限。Node 读取版本文件，pnpm 读取 `packageManager`；安装方式依据 [pnpm Action 官方说明](https://github.com/pnpm/action-setup/tree/v6)。执行顺序为：

```sh
pnpm install --frozen-lockfile --ignore-scripts
npm run check
npm run check:package
npm run check:install
```

新鲜度检查之前不执行 `build`，以便发现遗漏或过期的已提交产物。修改源码后在本地构建并包含三个产物；CI 不替开发者改写产物、不提交代码、不发布 npm 或 Release。此顺序已在本地验证，GitHub 远端执行状态以实际运行记录为准。

### 历史 SDK 检查

历史版本检查默认覆盖已发布的 12 个 `0.2.0` / `0.2.1` 版本，也可指定单版：

```sh
npm run check:compat
npm run check:compat -- 0.2.0-rc.1
npm run check:compat -- 0.2.2-alpha.2
```

[兼容检查脚本](../scripts/check-compatibility.mjs)在忽略目录复制源码和测试，安装匹配 SDK / Cordis / schema（禁止安装脚本），重建隔离 SDK 对应的产物，执行仓库检查及当前编译 Host 在历史 SDK 上的装配检查，保留日志，不启动 DSH 或修改 profile。历史结果、后续单版复测及限制见[兼容性调查](compatibility-audit.md#sdk-验证方法与结果)。

## 源码与接口发现

开发新插件或功能前，先在 [dsh-market](https://dshmarket.com/browse/) 按关键词和分类检索同类插件；用户点名时优先查该插件。找到源仓库后浅克隆到 `reference/<owner>/<repo>/`，阅读相关模块，再结合当前 API 和本项目约束决定接入方式。已有克隆先核对 remote、提交和本地改动，不覆盖或自动重置。未找到可用参考时再自行实现。

```sh
git clone --depth 1 --single-branch https://github.com/wlj521/dsh-ui-tweaks.git reference/wlj521/dsh-ui-tweaks
git clone --depth 1 --single-branch https://github.com/deepseek-ai/deepseek-harness.git .references/deepseek-harness
```

核对许可证、目标 DSH 版本和实现方式，在[第三方资源声明](third-party-notices.md)记录实际参考的仓库、提交和模块。复制或改编须遵循许可证；没有许可证不默认允许复制。参考源码无需安装依赖或执行脚本，仍须满足本项目接入约束。[忽略规则](../.gitignore)覆盖两个参考目录，不提交或打包。上游主分支可能领先目标发行版；接口依据应来自目标运行时 Inspect 或确切发行包，参考仓库用于理解与对照。

在 Harness 内设计或修改插件时，加载适用技能，先 `cordis_inspect_list`，再用返回的方法定向查询：

- Slot 树、owner props、注册选项和占用情况。
- 目标 service 方法、event 模式与 Config schema。
- 主题 token、桌面桥与 Client 模块加载约定；Inspect 未暴露的部分再查安装包公开类型或实现。

Inspect 是只读发现机制，不能当业务 service 调用。不可用时记录采用的确切发行包、源码及验证限制；缺少目标版本依据时明确假设，不猜接口或兼容性。

## 安装与使用

### 配置档（profile）

DSH 按配置档隔离插件、依赖和设置，各自位于 `$DSH_HOME/profiles/<名称>/`。常见两个：

| profile | 使用者 | 目录 |
| --- | --- | --- |
| `desktop` | 桌面应用 | `$DSH_HOME/profiles/desktop` |
| `web` | `dsh web` 启动的网页端 | `$DSH_HOME/profiles/web` |

两个配置档互不影响：装进 `web` 的插件不会出现在桌面端，反之亦然。桌面应用自行管理 `desktop` profile，**桌面端请在应用内的插件管理器安装**，不要在应用运行时从命令行改动该 profile。

命令行安装时用 `--profile` 指明目标，按实际使用者选择：

```sh
# 桌面端（应用未运行时，谨慎使用；通常改用应用内插件管理器）
dsh plugin --profile desktop add github:mewcoder/power-dsh

# dsh web
dsh plugin --profile web add github:mewcoder/power-dsh
```

自建的其他配置档把 `desktop`／`web` 换成对应名称。安装后按宿主提示刷新或重启，进入 **设置 → PowerDSH** 查看入口。

### 从 GitHub 安装

在 DSH 插件管理页选择安装第三方插件，输入：

```text
github:mewcoder/power-dsh
```

原生管理器通过 pnpm 获取 Git 来源及[包清单](../package.json)声明的运行依赖。安装使用随源码提交的 `dist/index.js`、`dist/index.d.ts` 与 `dist/client.js`，无需本机 TS 编译器；没有 `prepare` 或安装构建脚本，也不提交 `node_modules/`。开发者修改源码或类型后须重建并提交三个产物，仓库与包检查会拒绝过期输出。安装需要访问 GitHub 与依赖注册表；`private: true` 不阻止 Git 安装。依赖若要求执行安装脚本，以原生管理器提示为准。

Git 来源获取远端已推送代码。可用 `github:mewcoder/power-dsh#<commit>` 固定提交，标签须实际存在。来源验收状态见[兼容性调查](compatibility-audit.md#安装与平台验证记录)；本地链接安装和 SDK 测试不能替代 GitHub 安装验收。

### 本地开发安装

本地目录使用链接安装，先在仓库准备自己的依赖：

```sh
pnpm install --ignore-scripts
npm run build
npm run check
```

然后在 DSH 插件管理页选择安装第三方插件，输入仓库绝对目录。不要在用户 profile 下运行包管理器或手写配置。GitHub 与 tarball 依赖由原生管理器安装；普通 `npm pack` 产物不包含全部依赖，不能作为离线安装包，见[分发方式](releasing.md#选择分发方式)。

### 启用与功能行为

启用后进入 **设置 → PowerDSH**，按需开启功能。入口、默认值和操作行为以[二十项主 Spec](README.md#功能规格spec)为准，分类与键盘交互见 [UI 规范](ui.md#分类-tab)。

安装和验收时注意：

- 精简会更改宿主持久配置。停用或卸载 Mod 不会自动恢复其他插件；需要撤销时先关闭对应精简开关，并核对实际目标，见[原生精简操作](architecture.md#原生精简操作)。
- 桌面端点击版本号可能开始下载更新，见[显示版本号](../src/features/version-display/spec.md)。
- 重启会退出应用，系统通知与声音依赖平台及权限；按对应主 Spec 的验收条件操作。
- [自定义背景](../src/features/flowing-background/spec.md)在「界面」中默认关闭，经原生 `configForms` 独立保存。验收全局单张连续画布、侧栏与主内容区的底层透出，以及已有对话与运行间切换时动画持续；插件、使用统计等全局面板出现时中心列恢复原生不透明底色而侧边栏继续透出，离开后中心列重新透出。核对只适配已授权结构表面，窄窗口侧栏抽屉保留原生底色，输入卡片、编辑器、文件卡片、菜单和弹窗不被透明化；独立不透明内容表面与操作系统原生标题栏不在强制透明范围。另核对样式原值与优先级恢复、第三方后写值保留、动态表面替换不重启动画、关闭或框架替换后的 GPU/观察器/节点释放、减少动态效果静态、页面隐藏暂停和 WebGL 静态降级。缺失、歧义或不支持的框架不得回退前景。源码实现、本次检查、安装状态与实际页面结果分别记录，旧版新建聊天范围的检查不能代替本次全局验证。
- 旧 ID 设置回退与目录链接不等于完整配置迁移；升级时按[兼容性验证要求](compatibility.md#验证与记录)读回偏好。

## 修改与安装

Agent 使用原生 `plugin_manager`，不手写 profile manifest/patch，也不在 profile 下运行包管理器。安装影响同一 profile 的其他会话，须在任务授权范围内执行。

读取管理工具结果的 application、warnings 和诊断；如有 nextStep 按提示处理。插件内原生 ChangeResult 使用 error.diagnostic、error.code 或 restartReason，区分已应用、需重启和失败。更新后确认运行代际；相同 slot id 不能证明加载了新代码。本仓库不提供替代 DSH GUI 的开发服务器，也不承诺保存后自动更新现有页面。

## 验证方法与限制

| 层次 | 验证方法 | 证明范围 |
| --- | --- | --- |
| 仓库 | `npm run check` | 语法、资源、文案、链接和测试覆盖的行为 |
| 实际产物 | `npm run check:package` | tarball 中的编译 JS、声明、导出、依赖声明、Client 登记、资源及开发文件排除 |
| 独立安装 | `npm run check:install` | 生产依赖下载、独立 Host/Client 与公开导出、原生 API 类型接入；不证明 DSH 激活或实际页面 |
| 加载 | 原生管理器 application 与诊断 | 当前 profile 是否应用 Bundle，是否有 Loader 或 metadata 错误 |
| 注册 | Inspect 查看设置页、图标和侧栏追加容器 | Client 注册存在，不能证明实际视觉 |
| 策略 | 同一 Host 开关操作并读回实际模块状态 | 目标启停、无关实例保留及重新应用结果 |
| 生命周期 | 停用、重启用或重载，检查重复注册与监听清理 | 已执行场景的清理与持久状态 |
| 布局夹具 | 用真实 Mod CSS 和核对过的原生结构验证布局 | 夹具中的尺寸和响应式行为，不能替代 DSH GUI |
| 页面 | 在实际 DSH 操作并检查语言、焦点、主题与错误恢复 | 实际点击链路和视觉表现 |

按受影响主 Spec 选择场景；已有结果不替代新改动验证，也不代表跨版本兼容。确切宿主版本、接口依据、平台与升级证据集中维护在[兼容性调查](compatibility-audit.md)，支持结论见[版本兼容性](compatibility.md)。编译助手脚本不等于已经执行，页面断连不等于重启成功，注册成功不等于系统通知已经显示。

页面验收遵循 [UI 清单](ui.md#验收清单)。没有页面控制时如实报告静态、注册或状态检查。验收结束恢复任务开始时的语言、主题与开关；精简开关关闭可能启用全部匹配目标，须分别核对。

## 交付

说明修改、验证方法与结果、未验证部分。涉及 UI 时给出实际入口，区分“检查通过”“已安装”“已注册”和“实际展示已验收”。版本、发布与市场操作见[发布与升级](releasing.md)，准备文档和本地检查不构成提交、推送或发布授权。
