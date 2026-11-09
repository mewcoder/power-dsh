# 开发指南

本指南是开发与 AI 协作的执行入口。功能行为以[功能 Spec 索引](README.md#功能规格spec)为准，发布操作见[发布与升级](releasing.md)。

## 目录职责

| 位置 | 职责与约定 |
| --- | --- |
| [src/](../src/) | 当前 Host 入口、Client、策略、RPC 及辅助模块，无编译步骤；下一步结构见[特性模块架构方案](feature-modules.md)，实施时同步接入与分发约束 |
| [tests/](../tests/) | 所有 `*.test.mjs` 测试，使用 Node.js 内置测试运行器；与运行时代码分开维护 |
| [scripts/](../scripts/) | 仓库检查 `check.mjs`、实际产物检查 `check-package.mjs` 与隔离兼容检查 `check-compatibility.mjs` |
| [assets/locale/](../assets/locale/) 与 [assets/icon.svg](../assets/icon.svg) | 双语元数据、文案与插件图标 |
| [docs/](./) | 现行规范、主 Spec、验证依据与架构方案；真实截图在 [images/](images/) |
| [cordis.patch.yml](../cordis.patch.yml) 与 [screenshots.json](../screenshots.json) | 包根目录中的 DSH Bundle 与市场截图入口 |
| 根目录的说明与配置 | [README](../README.md)、[CHANGELOG](../CHANGELOG.md)、[AGENTS](../AGENTS.md)、[package.json](../package.json)、[pnpm-lock.yaml](../pnpm-lock.yaml) 与 [.gitignore](../.gitignore) |
| `reference/` 与 `.references/` | 本地忽略的第三方与官方参考源码；保留原位，不提交、不打包，不为整理目录而改动 |

[包清单](../package.json)的公开导出键保持 `.`、`./client`、`./locale/*.json`、`./icon`，目标分别为 `src/index.js`、`src/client.js`、`assets/locale/*.json`、`assets/icon.svg`。移动实现时同步相对导入、资源定位、测试引用和打包清单，不改变调用方的包路径。当前代码地图见[架构规范](architecture.md#包与文件职责)。

## 协作流程

1. **读文档、确认范围。** 先读[仓库首页](../README.md)、[更新日志](../CHANGELOG.md)与[协作入口](../AGENTS.md)，再按[文档索引](README.md)读取产品、UI、架构和受影响的主 Spec。核对用户授权与已有约定；开发功能前完成[源码与接口发现](#源码与接口发现)。
2. **检查工作区。** 运行以下命令并阅读目标文件，识别已有修改、未跟踪文件和协作者负责范围；不覆盖、回退或夹带无关改动。

   ```sh
   git status --short
   git diff --stat
   git diff
   ```

3. **先明确 Spec，再实现并同步。** 每项用户功能在[功能索引](README.md#功能规格spec)对应一份主 Spec，按[功能 Spec 规范](feature-spec.md)明确范围、配置、生命周期与验收条件，再修改最小必要范围；同步受影响的 Spec、必要测试、双语文案、资源与包清单及更新日志。只为实际行为补必要测试，不为占位结构添加依赖或框架。不得替换宿主根节点、覆盖宿主布局、注入全局 CSS、查询其他插件 DOM 或运行时导入内部 UI 组件；仅遵循主 Spec 中已获授权的有限例外。
4. **检查仓库与实际产物。** 按[环境与检查](#环境与检查)准备依赖，再执行：

   ```sh
   npm run check
   npm run check:package
   git diff --check
   ```

   核对包中包含运行时代码、资源、Bundle 入口、用户首页与更新日志、发布截图及第三方声明，并保留 npm 自动收录的[文档索引](README.md)；开发指南、规范、研究材料、测试与脚本留在仓库，没有凭据、参考仓库或个人日志，具体清单见[发版准备](releasing.md#首次发版前的准备)。目录调整后确认导出目标、资源路径和测试入口。按影响选择[分层验证](#验证方法与限制)与兼容检查。纯文档任务核对本地链接与 diff，无需安装；多人协作时由负责整合者执行约定的完整检查。
5. **按授权安装验证。** 任务已授权安装或运行预览时，按[修改与安装](#修改与安装)通过原生管理器执行，核对应用结果与运行代际，再验证实际页面、状态和生命周期。未获授权时记录未验证部分。发布产物另按[发布流程](releasing.md#github-release-操作顺序)验收。
6. **交付。** 再看 `git status --short` 与本次 diff，说明修改范围、检查结果、实际安装与页面验证情况、遗留限制。提交、推送、发布和市场投稿按各自授权执行。

## 环境与检查

需要 Node.js 22 或更新版本，同时满足 DSH 自身要求；实际产物检查还需系统 `tar` 命令。Host 依赖 DSH 工具 SDK、Typert 与 schema 库；Client 复用宿主 React 和 shell 预置公共 UI 模块，无编译步骤。

```sh
pnpm install --ignore-scripts
npm run check
```

`check` 包含目录职责、JavaScript 语法、Bundle 资源与导出、双语 key、SVG、截图清单、本地文档链接及策略与 Client 测试。[实际产物检查](../scripts/check-package.mjs)通过 `npm run check:package` 在系统临时目录生成并用 `tar` 解包实际 npm tarball，核对 exports、全部运行源码及导入、声明依赖、Client factory 登记、图标许可、locale 和截图，并确认不携带测试、脚本、协作入口、开发指南、规范或研究材料；文档资源允许第三方声明、发布截图及 npm 自动收录的文档索引。结束清理临时产物。这些检查不下载依赖、不安装 DSH 或修改 profile，不能替代宿主加载和页面验收。

历史版本检查默认覆盖已发布的 12 个 `0.2.0` / `0.2.1` 版本，也可指定单版：

```sh
npm run check:compat
npm run check:compat -- 0.2.0-rc.1
npm run check:compat -- 0.2.2-alpha.2
```

[兼容检查脚本](../scripts/check-compatibility.mjs)在忽略目录复制源码和测试，安装匹配 SDK / Cordis / schema（禁止安装脚本），执行仓库检查及固定生产 SDK 的 Host 装配检查，保留日志，不启动 DSH 或修改 profile。历史结果、后续单版复测及限制见[兼容性调查](compatibility-audit.md#sdk-验证方法与结果)。

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

### 从 GitHub 安装

在 DSH 插件管理页选择安装第三方插件，输入：

```text
github:mewcoder/power-dsh
```

原生管理器通过 pnpm 获取 Git 来源及[包清单](../package.json)声明的运行依赖。本项目直接运行 JavaScript，没有 `build`、`prepare` 或安装脚本，无需先编译或提交 `node_modules/`。安装需要访问 GitHub 与依赖注册表；`private: true` 不阻止 Git 安装。依赖若要求执行安装脚本，以原生管理器提示为准。

Git 来源获取远端已推送代码。可用 `github:mewcoder/power-dsh#<commit>` 固定提交，标签须实际存在。来源验收状态见[兼容性调查](compatibility-audit.md#安装与平台验证记录)；本地链接安装和 SDK 测试不能替代 GitHub 安装验收。

### 本地开发安装

本地目录使用链接安装，先在仓库准备自己的依赖：

```sh
pnpm install --ignore-scripts
npm run check
```

然后在 DSH 插件管理页选择安装第三方插件，输入仓库绝对目录。不要在用户 profile 下运行包管理器或手写配置。GitHub 与 tarball 依赖由原生管理器安装；普通 `npm pack` 产物不包含全部依赖，不能作为离线安装包，见[分发方式](releasing.md#选择分发方式)。

### 启用与功能行为

启用后进入 **设置 → PowerDSH**，按需开启功能。入口、默认值和操作行为以[十三项主 Spec](README.md#功能规格spec)为准，分类与键盘交互见 [UI 规范](ui.md#分类-tab)。

安装和验收时注意：

- 精简会更改宿主持久配置。停用或卸载 Mod 不会自动恢复其他插件；需要撤销时先关闭对应精简开关，并核对实际目标，见[原生精简操作](architecture.md#原生精简操作)。
- 桌面端点击版本号可能开始下载更新，见[显示版本号](version-display.md)。
- 重启会退出应用，系统通知与声音依赖平台及权限；按对应主 Spec 的验收条件操作。
- 旧 ID 设置回退与目录链接不等于完整配置迁移；升级时按[兼容性验证要求](compatibility.md#验证与记录)读回偏好。

## 修改与安装

Agent 使用原生 `plugin_manager`，不手写 profile manifest/patch，也不在 profile 下运行包管理器。安装影响同一 profile 的其他会话，须在任务授权范围内执行。

读取管理工具结果的 application、warnings 和诊断；如有 nextStep 按提示处理。插件内原生 ChangeResult 使用 error.diagnostic、error.code 或 restartReason，区分已应用、需重启和失败。更新后确认运行代际；相同 slot id 不能证明加载了新代码。本仓库不提供替代 DSH GUI 的开发服务器，也不承诺保存后自动更新现有页面。

## 验证方法与限制

| 层次 | 验证方法 | 证明范围 |
| --- | --- | --- |
| 仓库 | `npm run check` | 语法、资源、文案、链接和测试覆盖的行为 |
| 实际产物 | `npm run check:package` | tarball 内源码、导出、依赖声明、Client 登记、资源及开发文件排除；不证明依赖下载或 DSH 激活 |
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
