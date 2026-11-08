# DSH 版本兼容性

本文件维护 power-dsh 的宿主接口依赖、验证状态和发版条件。Mod 版本、DSH 运行时版本、桌面壳版本与 Node.js 版本分别记录，不用同一个数字代替。目标是尽可能覆盖经过验证的旧版，同时保证启停、持久化与卸载行为可靠。

## 当前结论

首版 `0.0.1` 已完成目标分支全部 **12 个实际发行版** 的代码兼容验证：`0.2.0-rc.1`、`0.2.0-rc.2`，`0.2.1-alpha.1` 至 `alpha.5`，以及 `0.2.1-rc.1` 至 `rc.5`。每版对应的隔离 SDK 测试 192 项通过，固定生产 SDK 与相应 Cordis / Tools / 投影服务的 Host 装配检查 3 项通过，均无失败或跳过。

**最低已测基线为 `0.2.0-rc.1`**，也是下一步完整宿主验收目标。该版是所要求 `0.2.0` / `0.2.1` 范围内最早的实际发行版，无须证明所有更早历史版本均不可用。最终 tarball 的完整应用安装、解析和页面仍待验收；未发布的后续 alpha / rc 不自动纳入结论。官方发行清单、同类插件对照及验证限制见[首版兼容性调查](compatibility-audit.md)。

[包清单](../package.json)暂未声明 `engines.dsh`，不表示任意版本都兼容。开发 SDK 固定为 `0.2.2-rc.1`，但这不是候选最低版本的依据；旧宿主没有的接口也不会由普通 SDK 依赖自动补齐。

| 目标 | 已有证据 | 检查结果 | 支持结论 |
| --- | --- | --- | --- |
| `0.1.7-rc.2` | 适配前源码比较和失败复现 | 此次适配后未重新执行该版本矩阵 | 未验证，不承诺支持 |
| `0.2.0-rc.1`、`rc.2` | 官方发行记录及源码、匹配 SDK、当前生产 SDK 配合对应 Host | 每版 192 项通过；另各 3 项 Host 装配通过 | `rc.1` 为最低已测基线，完整安装与页面待测 |
| `0.2.1-alpha.1` 至 `alpha.5` | 官方发行记录、匹配 SDK 及固定生产 SDK 的 Host 装配 | 每版 192 项通过；另各 3 项 Host 装配通过 | 全部 5 个已发布 alpha 通过，完整应用待测 |
| `0.2.1-rc.1` 至 `rc.5` | 同上 | 每版 192 项通过；另各 3 项 Host 装配通过 | 全部 5 个已发布 rc 通过，完整应用待测 |
| `0.2.2-alpha.2` | 官方源码和相同矩阵流程 | 192 项通过；另 3 项 Host 装配通过 | 适配后的回归通过，完整宿主待测 |
| `0.2.2-alpha.3` | 官方标签关键接口存在 | 未独立执行整套 SDK 或宿主测试 | 只有源码证据 |
| `0.2.2-rc.1` | 当前 desktop profile 原生链接安装、实际设置工具调用 | 192 项测试通过；条目 active；六项偏好读写通过 | 源码链接安装已验证，最终 tarball、完整页面及平台验收仍待完成 |
| 其他版本及后续发行 | 未覆盖 | 未验证 | 不从邻近版本外推 |

## 重启按钮的新增范围与证据

重启按钮作为第十一项功能已完成源码实现，但未安装或执行实际退出与重开，不属于上表已有 SDK / Host 装配测试覆盖范围；上表数字、最低已测基线及安装记录均保留原有含义，不能作为重启按钮的旧版兼容结论。

| 环境 | 当前范围 | 已有证据与限制 |
| --- | --- | --- |
| macOS 打包桌面端 | 独立助手方案已实现；实际操作待验收 | 本机 `0.2.2-rc.1` ASAR preload / main 源码核对未发现公开 restart bridge；助手 AppleScript 编译通过，未实际执行助手、退出确认或重开 |
| Windows、Linux | 当前不可用，按钮隐藏，设置仍可保存 | 不承诺跨平台重启，不增加平台警告常驻文案 |
| 普通 Web、CLI、身份未校验的应用 | 当前不可用，按钮隐藏，设置仍可保存 | 不能因连接本机 macOS Host 或可见 `.app` 路径而认定可用 |
| 旧版及其他 DSH 版本 | 未验证 | 不沿用原有矩阵，也不从本机源码或参考插件外推 |

后续须核对当前 bundle 路径与 `com.deepseek.dsh` 身份、detached `/usr/bin/osascript` 助手、graceful quit 与宿主确认、退出后 `/usr/bin/open` 重开同路径、取消或超时不强杀不重开，以及状态 RPC 的 `supported/running/error`。公共确认弹窗、侧栏顺序与显隐、偏好持久化和完整退出/重开分别验收；连接断开不等于成功。当前 Inspect 工具不可用、Agent Browser 离线，未运行 GUI；具体规范见[重启应用](restart-button.md)。

## 精简官方搜索的新增范围与证据

独立 `blockOfficialSearch` 的接口依据为本机 `0.2.2-rc.1` 安装包及固定 SDK：`tool-web` 的 `search` / `fetch` 配置、ConfigEditor 的活动条目编辑与读回、模式组合诊断，以及既有 Tools `guard` / `restrict` 和 Agent 生命周期。未提供 Inspect 工具，实际安装、页面及旧版矩阵尚未验证；本功能不继承上表旧版测试数字，完整范围见[精简官方搜索](search-blocking.md)。

## 接口核对清单

下表来自本项目实际调用点。接口最早出现在哪个版本仍需对照确切发行版确认；当前版本有同名方法不能证明旧版具有相同参数、返回字段、事件和清理行为。

| 范围 | 关键依赖 | 核对重点 |
| --- | --- | --- |
| 整包 Host 加载 | [Host 入口](../index.js)的 `settings`、`tools`、`clientModules`、`pluginManager`、`typert`、`configEditor`、`profileContext` | 服务能否注入、导入的 SDK 是否匹配、配置 schema 与严格 RPC 能否注册 |
| 整包 Client 加载 | [Client 入口](../client.js)的模块加载器、公共 `Menu` / `Tooltip` / `StateDot` / `Modal` / `Button`、`remote.$mount`、`configForms`、slot 注册 | 模块和导出存在，RPC 两端匹配，设置主入口能加载，子功能失败不被误报为正常 |
| 账号与反馈与遥测精简 | [PluginPolicy](../plugin-policy.js)的 `listPlugins()`、`setPluginEnabled()`、`ConfigEditor.edit()` | 条目身份、只读原因、`application` / warnings / error 结果、写后读回与宿主目标模块名 |
| 精简官方搜索 | [SearchPolicy](../search-policy.js)的 ConfigEditor `entries()` / `edit()`、模式组合读回、Tools `guard` / `restrict` | 只改 `config.search`、跳过已停用 owner、保留抓取及 MCP、旧会话限制与卸载释放 |
| 精简Todo工具 | [TodoPolicy](../todo-policy.js)的 `agentPresets.compositionInventory()`、Tools `guard` / `restrict`、Agent 生命周期事件 | 模式清单字段、旧 Agent 的工具限制、重新选择模式后的状态、卸载释放 |
| 技能管理 | [SkillPolicy](../skill-policy.js)的 `skills.registerProvider()` / `snapshot()`、`agentPresets.serviceFor()` / `acquireScope()` / `compositionInventory()`、`createScope()`、`workspaceRegistry.list()` | provider 生命周期、用户与项目优先级、租约释放、模式服务隔离、导入项目字段 |
| MCP 目录与启停 | [McpPolicy](../mcp-policy.js)与[McpProviders](../mcp-providers.js)的 bundle rows、模式清单、Loader entries、Fiber、scope、原生 manager | `fiberPhase` / `fiberState` 含义、Fiber 数字状态映射、归属去重、工具作用域、配置修订与原生写后读回 |
| 任务通知 | [通知投影](../notifications.js)及 Host 注册、Client 的 `sessions.list` / `uiSession.sessionStatus` | 投影注册与释放、`turn/end` 原因、首次订阅基线、重连去重、提问与审批状态字段 |
| 系统声音 | [SystemSounds](../system-sounds.js)、`connection.isLoopback`、subprocess `resolveExecutable` / `spawn` 与托管句柄 | 本机识别、参数与取消语义、平台真实试听、远程界面不会在服务器播放 |
| 个性化 | `profileContext.home`、文件 RPC、宿主全局指令发现 | 正文落在同一个原生全局文件、冲突时不覆盖、禁用入口不改变正文及读取行为 |
| 版本、外观与刷新 | `clientModules.graph().release`、boot release、theme service、桌面 updates bridge、侧栏 slot 与标题栏 | 显示的是宿主版本；桥协议、主题事件、slot props、窗口缩放和系统标题栏偏移 |

## 升级指南核对结果

以下迁移指南用于核对具体调用，不能单凭指南所在目录推导整体最低版本；实际标签比较和 SDK 验证以[调查报告](compatibility-audit.md)为准：

- [投影注册句柄变更](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/upgrade-guide/v0.2.1-rc.2/session-projection-handles/guide.zh.md)记录注册返回值从同步释放函数变为可等待句柄；Mod 只等待注册，不读取该句柄。单凭这个变更不能认定 Mod 最低要求为 `0.2.1-rc.2`，投影 schema 与 Client 摘要字段仍需逐版核对。
- [Menu 定位变更](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/upgrade-guide/v0.2.2-alpha.2/css-anchored-menus/guide.zh.md)涉及移除的定位导出与外部锚点参数；Mod 使用内联 `anchor`，未调用被移除的接口。不能据此把最低版本设为 `0.2.2-alpha.2`；公共组件的导出、props 和浏览器 CSS 支持仍需真实验证。
- [版本检查规则变更](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh/guide.zh.md)正文说明 `0.2.1-alpha.3` 仍忽略 `engines.dsh`，下一版本才优先读取。目标若覆盖这一时期，需单独核对宿主实际检查行为及所需 peer 声明，不能仅添加 engines 就认定旧版会正确阻止不兼容安装。指南所在目录不自动等于新行为的首次发行版本。

源码核对已确认多项技能、preset、插件管理与 UI 接口在更旧版本中存在；本次通过旧版公开 `schemas()` / `get()` 解决 MCP 工具枚举差异，并用真实旧版执行器、投影和注入器验证。`0.2.0-rc.1` 与 `rc.2` 的 Menu 不支持 `minWidthFromAnchor`，项目下拉保持该版原生默认宽度，界面仍需验收；未借助内部字段或覆盖宿主样式补齐。此结论不代表每个接口的绝对首次版本，也不代替完整宿主验收。

## 需要优先验证的初始化行为

功能开关不是版本隔离机制。[Host 入口](../index.js)会在服务注入满足时注册通知投影、绑定 Todo、初始化 MCP 提供方和技能管理；这些操作并非都等到对应开关开启才执行。Client 也在 factory 中读取公共 UI 模块。因此必须先验证所有主开关关闭时的整包加载，再逐个开启功能；不能凭“默认关闭”判断旧版可用。

现有的局部不可用处理也不能替代版本验证。例如没有协议兼容的桌面更新桥时版本按钮只读，系统声音在不支持环境中只提供默认选项，技能或 MCP 的部分读取失败会返回不可用或未知。只有实际覆盖过的场景才能记为可降级，不能推及所有缺失接口。

## 验证与记录

每个要声明支持的运行时版本分别记录以下内容；测试对象使用最终打包产物，不能只运行源码测试：

1. **环境**：Mod 版本与最终提交、DSH 确切运行时版本、桌面壳或浏览器版本、操作系统、Node.js 版本、profile 类型及打包产物校验值。
2. **冷启动与加载**：所有主开关关闭时安装、启动、刷新页面；核对原生 application、诊断、Client 注册和实际入口。服务缺席或 profile 组合不支持时记录实际错误。
3. **功能与持久化**：逐个开启、操作、关闭，读回后端事实；修改后刷新与重启仍保持偏好。精简类在隔离环境核对全部目标与无关实例；技能区分全局和项目，MCP 区分可写项、只读项和运行状态。
4. **生命周期**：停用、重启用、卸载，核对监听、投影、作用域和播放进程释放；不能重复注册或丢失用户配置。
5. **平台与界面**：仅把实际测试过的桌面系统、浏览器和本机/远程组合写为已验证；不能把 macOS 结果代替 Windows 标题栏、PowerShell 音效与系统通知验收。
6. **升级**：验证旧 Mod → 新 Mod 的开关和停用技能名单是否保留；旧 DSH → 新 DSH 的加载与操作复测。本次统一命名后，已有本地安装保留宿主管理的旧 ID，尚未验证偏好自动迁移；不能据源码改名或旧路径符号链接宣称升级验收通过。包名、设置命名空间或 RPC 变化时，通过原生管理机制核对旧安装来源、迁移结果与页面重载，不手工修改 profile。
7. **版本限制**：声明范围内的目标可安装，范围外按宿主规则拒绝；逐个核对 rc / beta 的匹配，不能只测试正式版本。记录源接口存在、仓库检查通过和真实验收通过三类不同证据。

回退到旧 Mod 只有在旧版能安全读取当前配置且已实际验证时才记录为支持；在此之前保留旧产物用于追溯，不承诺自动降级或自动恢复。

新增测试记录时使用以下字段，结果填「通过」「失败」「未验证」或「不适用」并说明原因：

| Mod / 产物 | DSH / 环境 | 加载 | 功能操作 | 持久化与卸载 | 从旧版升级 | 证据与限制 |
| --- | --- | --- | --- | --- | --- | --- |
| 待填 | 待填 | 未验证 | 未验证 | 未验证 | 未验证 | 未执行，不能作为支持依据 |

## 发版条件

- 最低支持版本已验证；尚有失败或未知的关键接口时不填写宽泛范围，也不发布为“全功能兼容”。若需要在旧版限制某功能，先明确决定并完成对应实现和验证。
- 按已验证范围填写 `engines.dsh`，同时核对依赖和 DSH peer 约束；README、更新日志、Release 与市场展示使用相同结论。扩大范围需新发 Mod 版本，不能修改已发布版本的声明。
- 指定本次承诺的平台及 profile 组合，并完成范围边界和升级验证。未来宿主版本不自动继承兼容结论，接近的版本号也不能代替接口检查。
- 运行 `npm run check`，完成上述真实产物验收后，才进入[发版步骤](releasing.md#github-release-操作顺序)。仓库检查不执行历史宿主安装，不能单独证明兼容；未完成兼容矩阵时仅保留开发版和 Release 草稿。

已在独立目录下载官方历史源码、安装测试用 SDK 并执行隔离测试；没有安装或启动完整旧宿主、切换用户 profile 或发布版本。接口发现优先使用目标运行时 Inspect；本会话未提供 Inspect 工具，因此历史核对依据为确切标签源码及相应 SDK，待完整产物验收后再正式声明支持范围。
