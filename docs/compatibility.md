# DSH 版本兼容性

本文件维护 power-dsh 的宿主接口依赖、验证状态和发版条件。Mod 版本、DSH 运行时版本、桌面壳版本与 Node.js 版本分别记录，不用同一个数字代替。目标是尽可能覆盖经过验证的旧版，同时保证启停、持久化与卸载行为可靠。

## 当前结论

**最低已测基线为 `0.2.0-rc.1`，首版安装范围为 `>=0.2.0-rc.1 <0.3.0-0`，面向 DSH 桌面版。** 这是目标 `0.2.0` / `0.2.1` 分支最早的实际发行版，无须证明所有更早版本均不可用。安装门槛不等于范围内每版、每平台与每个功能场景都已完成实机验收；具体证据分别记录。

[2026-11-08 历史快照](compatibility-audit.md#sdk-验证方法与结果)覆盖两个分支的全部 12 个实际发行版；[2026-11-09 后续单版复测](compatibility-audit.md#后续单版复测)覆盖目录调整与清理修复时的 `0.2.0-rc.1`；[模块化后的回归](compatibility-audit.md#模块化与-npm-产物回归)分别验证 `0.2.0-rc.1` 和 `0.2.1-rc.5` 的隔离 SDK、生产 Host 装配及本地 npm 产物解析。[TS/tsdown 迁移后](compatibility-audit.md#typescript-与-tsdown-迁移)复验这两版 SDK，并验证独立 npm 消费者使用公开声明。测试对象、通过数量、方法和日志标识统一在调查中维护；单版结果不能扩展到其余版本，测试后的新增改动也不自动视为已测。

标准 npm 包已完成独立生产依赖安装与公开入口验证。[2026-11-12 首版候选回归](compatibility-audit.md#2026-11-12-首版候选回归与实机反馈)在 `0.2.0-rc.1`、`0.2.1-rc.5` 分别通过 558 项测试与 7 项 Host 装配检查；macOS 的 `0.2.2-rc.1` 已验证 GitHub 来源安装、冷启动与 PowerDSH 设置入口，Windows 保留用户实际使用反馈。完整功能场景、各版本共享依赖身份和来源切换升级不因这些结果自动视为已验收。

[包清单](../package.json)通过 `engines.dsh` 声明上述安装范围，并排除 `0.3.0` 系列及其预发布版本。开发 SDK 固定为 `0.2.2-rc.1`，不是最低版本的依据；旧宿主没有的接口也不会由普通 SDK 依赖自动补齐。

| 目标 | 支持结论与证据边界 |
| --- | --- |
| `0.1.7-rc.2` | 仅适配前诊断，未对后续实现重新复测，不承诺支持；见[历史诊断](compatibility-audit.md#sdk-验证方法与结果) |
| 已发布的 12 个 `0.2.0` / `0.2.1` 版本 | [历史全矩阵](compatibility-audit.md#sdk-验证方法与结果)通过；模块化后只复测 `0.2.0-rc.1` 与 `0.2.1-rc.5`，完整宿主待测 |
| `0.2.2-alpha.2` | [历史 SDK 与 Host 装配回归](compatibility-audit.md#sdk-验证方法与结果)通过，完整宿主待测 |
| `0.2.2-alpha.3` | 只有[标签接口证据](compatibility-audit.md#官方发行标签的接口证据)，没有独立完整测试 |
| `0.2.2-rc.1` | 有历史 SDK 回归、源码链接安装及部分偏好读回；本轮补充 macOS GitHub 来源安装、冷启动和设置入口，见[本轮记录](compatibility-audit.md#2026-11-12-首版候选回归与实机反馈)；不是完整功能场景验收 |
| 其他版本及后续发行 | 范围内未逐版实测，不从邻近版本外推；范围外按宿主版本检查机制拒绝安装或启动 |

桌面平台分别维护证据：macOS 有本轮直接安装与运行验证；Windows 有用户实际使用反馈，但未补录确切版本及逐项验收；Linux 没有新增实机结果。不能把 Windows 写成从未使用，也不把一次使用扩写成全平台、全功能保证。

[Windows 通知后续反馈](compatibility-audit.md#2026-11-12-windows-通知后续反馈)补录 Win11 24H2 / DSH `0.2.2-rc.2` / PowerDSH `0.0.4` 的实际横幅失败。后续原生 Toast 修复的自动化检查不等于 Windows 实机修复已确认；通知、声音、驻留及清理仍须针对新产物复测。

[通知通道握手与手动更新入口](compatibility-audit.md#2026-11-12-通知通道握手与手动更新入口)补录 `0.0.5` 后续反馈、真实通道尚未确认的限制与本轮 596 项回归。两版旧 SDK 的隔离检查通过；通知横幅和插件实际自更新仍未完成实机验收。

## 重启按钮的新增范围与证据

重启按钮不能继承 2026-11-08 历史矩阵的兼容结论。后续源码与隔离检查也不能证明真实退出和重开；接口及编译证据集中见[安装与平台验证记录](compatibility-audit.md#安装与平台验证记录)，行为及完整验收条件见[重启应用 Spec](../src/features/restart-button/spec.md)。

| 环境 | 当前范围 | 已有证据与限制 |
| --- | --- | --- |
| macOS 打包桌面端 | 显示重启设置行，菜单入口仍按 Host 能力确认；独立助手实际操作待验收 | 本机 `0.2.2-rc.1` ASAR preload / main 源码核对未发现公开 restart bridge；助手 AppleScript 编译通过，未实际执行助手、退出确认或重开 |
| Windows、Linux | 重启设置行与菜单入口均隐藏，保留已有偏好和状态 | 不承诺跨平台重启，不增加平台警告常驻文案 |
| 普通 Web、CLI | 重启设置行与菜单入口均隐藏，保留已有偏好和状态 | 普通浏览器连接本机 macOS Host 仍隐藏 |
| macOS 打包桌面端但应用身份未校验 | 设置行可见，菜单入口隐藏，保留已有偏好和状态 | 不能只凭可见 `.app` 路径认定重启能力可用 |
| 旧版及其他 DSH 版本 | 未验证 | 不沿用原有矩阵，也不从本机源码或参考插件外推 |

实际验收分别覆盖公共确认与宿主退出确认、应用身份、助手交接、取消与超时、同路径重开、状态读回和偏好保留；页面断连不能作为成功依据。完整场景见[重启应用验收要求](../src/features/restart-button/spec.md#参考与验证)。

## 停用官方搜索的新增范围与证据

接口依据为 DSH `0.2.2-rc.1` 安装包及固定 SDK 的 `tool-web`、ConfigEditor、Tools 与 Agent 生命周期，详见[停用官方搜索 Spec](../src/features/search-blocking/spec.md#实现与验证依据)。本功能不继承 2026-11-08 的历史测试覆盖结论；单版隔离复测不代替完整宿主中的实际安装与页面验证。

## 屏蔽双击重命名的新增范围与证据

DSH `0.2.2-rc.1` 安装包已核对会话行事件标记，作为有限 DOM 例外的依据。标记变化可能使屏蔽失效，旧版历史矩阵和隔离测试均不能证明实际页面行为；具体接入与验收见[屏蔽双击重命名 Spec](../src/features/double-click-rename/spec.md)。

## 推理等级选择器的新增范围与证据

推理等级按钮依赖 `dsh-client-ui-conversation` 的 `conversation.input.right`（session scope，`standardProps` 含 `sessionId`）与 `dsh-client-ui-model-selection` 的 `ctx.modelDirectories.directoryFor(sessionId)`（`store` / `load()` / `select()`），以及模型目录中的 `reasoning.efforts`、`defaultEffort`。接口依据为本机 DSH `0.2.2-rc.1` 安装包只读源码，运行时 Inspect 已核对 slot 的注册选项、标准 props 与单个 active 注册项，`modelDirectories` 未被 Service Inspect 编目、仍以该安装包源码为依据；`dsh.client.inject` 已声明这两个客户端模块，服务或 slot 缺席时按钮静默隐藏。它不继承 2026-11-08 的历史矩阵结论，也没有在新版或旧版上复测；具体接入与验收条件见[推理等级 Spec](../src/features/thinking-effort/spec.md)。

## Plan 模式精简的新增范围与证据

[停用 Plan 模式](../src/features/plan-blocking/spec.md)按用户确认仅面向新对话，依赖原生 `@deepseek-ai/dsh-plan-mode` 全局条目、模式嵌套声明与 composition inventory 读回。接口依据为本机 DSH `0.2.2-rc.1` 桌面发行包和同版 SDK，已有 Agent 的旧模式代际不被主动修改。保留 `dsh-client-ui-plan` 的历史计划呈现，不依赖新的工具或命令过滤 API。本功能没有继承已有历史版本矩阵结论，实际安装与页面尚待验收。

## Goal 模式精简的新增范围与证据

[停用 Goal 模式](../src/features/goal-blocking/spec.md)只启停新对话使用的原生目标命令和工具声明，依据为 DSH `0.2.2-rc.1` 桌面发行包及同版参考源码。全局 `dsh-goal`、`dsh-goal-round-driver` 和 `dsh-client-ui-goal` 均保留；续跑驱动在装载或卸载时会解除已有目标的运行，因此不将它作为精简目标。已有 Agent 保留旧模式代际，不主动暂停、完成或取消目标；第三方插件与原生 Goal API 仍可使用。新功能未继承历史矩阵结论，实际安装与页面待验收。

## 使用统计的新增范围与证据

[使用统计](../src/features/usage-stats/spec.md)只读依赖原生 `sessionPersistence`：`list({signal})` 的 `header.{id,createdAt,cwd}` 与 `revision`、`open(id,'read',{signal})` 的 `read()`/`close()`，以及 `assistant/message.data.usage`（`TokenUsage`）与 `message.source.{provider,model}`、`turn/start`、`tool/call` 的 `time`。接口依据为本机 DSH `0.2.2-rc.1` 桌面安装包与官方仓库提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 的 `packages/session/session-persistence`、`session-persistence-jsonl` 与 `dsh-llm` 类型；本机 224 个真实会话日志的只读实测确认了日志分帧、事件形状与逐会话 `revision` 的存在。它不继承历史矩阵结论，也未在旧版或 Windows 上复测；实际安装、页面数字核对与缺服务降级尚待验收。

## 接口核对清单

下表来自本项目实际调用点。接口最早出现在哪个版本仍需对照确切发行版确认；当前版本有同名方法不能证明旧版具有相同参数、返回字段、事件和清理行为。

| 范围 | 关键依赖 | 核对重点 |
| --- | --- | --- |
| 整包 Host 加载 | [Host 入口](../src/index.ts)的 `settings`、`tools`、`clientModules`、`pluginManager`、`typert`、`configEditor`、`profileContext` | 服务能否注入、导入的 SDK 是否匹配、配置 schema 与严格 RPC 能否注册 |
| 整包 Client 加载 | [Client 入口](../src/client.ts)的模块加载器、公共 `Menu` / `Tooltip` / `StateDot` / `Modal` / `Button`、`remote.$mount`、`configForms`、slot 注册 | 模块和导出存在，RPC 两端匹配，设置主入口能加载，子功能失败不被误报为正常 |
| 账号与反馈与遥测精简 | [PluginPolicy](../src/shared/host/plugin-policy.ts)的 `listPlugins()`、`setPluginEnabled()`、`ConfigEditor.edit()` | 条目身份、只读原因、`application` / warnings / error 结果、写后读回与宿主目标模块名 |
| 停用官方搜索 | [SearchPolicy](../src/features/search-blocking/search-policy.ts)的 ConfigEditor `entries()` / `edit()`、模式组合读回、Tools `guard` / `restrict` | 只改 `config.search`、跳过已停用 owner、保留抓取及 MCP、旧会话限制与卸载释放 |
| 停用 Todo 工具 | [TodoPolicy](../src/features/todo-blocking/todo-policy.ts)的 ConfigEditor `entries()` / `edit()`、`agentPresets.compositionInventory()` 与全局 Plugin Manager | 模式声明读回、对新代际生效、旧 Agent 不受主动干预、待办历史保留、卸载写入保护 |
| 停用 Plan 模式 | [PlanPolicy](../src/features/plan-blocking/plan-policy.ts)的 ConfigEditor `entries()` / `edit()`、`agentPresets.compositionInventory()` 与全局 Plugin Manager | 只匹配 Plan 模块、保留嵌套 group 和 section、对新模式代际生效、不干预旧 Agent、不移除历史卡片 |
| 停用 Goal 模式 | [GoalPolicy](../src/features/goal-blocking/goal-policy.ts)的模式声明编辑、分模块数量与启停状态读回、全局 Plugin Manager | 仅目标命令与工具，不卸载目标服务或续跑驱动，不改已有目标状态，旧模式代际保留 |
| 技能管理 | [SkillPolicy](../src/features/skills/skill-policy.ts)的 `skills.registerProvider()` / `snapshot()`、`agentPresets.serviceFor()` / `acquireScope()` / `compositionInventory()`、`createScope()`、`workspaceRegistry.list()` | provider 生命周期、用户与工作区优先级、租约释放、模式服务隔离、导入工作区字段 |
| MCP 目录与启停 | [McpPolicy](../src/features/mcp/mcp-policy.ts)与[McpProviders](../src/features/mcp/mcp-providers.ts)的 bundle rows、模式清单、Loader entries、Fiber、scope、原生 manager | `fiberPhase` / `fiberState` 含义、Fiber 数字状态映射、归属去重、工具作用域、配置修订与原生写后读回 |
| 归档管理 | [ArchiveService](../src/features/archive/archive-service.ts)的 `workspaceController.follow()` / `unarchiveSession()`、`sessionQuery.readTitleSnapshots()`、`sessionController.list()` | 基线帧 `items` / `archivedSessionIds` 形状、工作区归属、标题/`updatedAt`/`createdAt`、服务缺席降级；永久删除使用已核对的单代 JSONL 与原生写锁；自动归档队列检查当前核对至 0.2.2-rc.1 |
| 工作区管理 | [ProjectsService](../src/features/projects/projects-service.ts)的 `workspaceController.follow()` / `delete()`、`sessionController.list()` | 基线帧 `items[].{workspaceId,title,path,sessionIds}` 形状、登记顺序、`delete` 只删登记并保留目录与会话、`list().items[].updatedAt` 与侧栏同源、服务缺席降级 |
| 任务通知 | [通知投影](../src/features/notifications/notifications.ts)及 Host 注册、Client 的 `sessions.list` / `uiSession.sessionStatus` | 投影注册与释放、`turn/end` 原因、首次订阅基线、重连去重、提问与审批状态字段 |
| 系统声音 | [SystemSounds](../src/features/notifications/system-sounds.ts)、`connection.isLoopback`、subprocess `resolveExecutable` / `spawn` 与托管句柄 | 本机识别、参数与取消语义、平台真实试听、远程界面不会在服务器播放 |
| 全局指令 | `profileContext.home`、文件 RPC、宿主全局指令发现 | 正文落在同一个原生全局文件、冲突时不覆盖、禁用入口不改变正文及读取行为 |
| 版本、外观与刷新 | `clientModules.graph().release`、boot release、theme service、桌面 updates bridge、侧栏 slot 与标题栏 | 显示的是宿主版本；桥协议、主题事件、slot props、窗口缩放和系统标题栏偏移 |

## 升级指南核对结果

以下迁移指南用于核对具体调用，不能单凭指南所在目录推导整体最低版本；实际标签比较和 SDK 验证以[调查报告](compatibility-audit.md)为准：

- [投影注册句柄变更](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/upgrade-guide/v0.2.1-rc.2/session-projection-handles/guide.zh.md)记录注册返回值从同步释放函数变为可等待句柄；Mod 只等待注册，不读取该句柄。单凭这个变更不能认定 Mod 最低要求为 `0.2.1-rc.2`，投影 schema 与 Client 摘要字段仍需逐版核对。
- [Menu 定位变更](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/upgrade-guide/v0.2.2-alpha.2/css-anchored-menus/guide.zh.md)涉及移除的定位导出与外部锚点参数；Mod 使用内联 `anchor`，未调用被移除的接口。不能据此把最低版本设为 `0.2.2-alpha.2`；公共组件的导出、props 和浏览器 CSS 支持仍需真实验证。
- [版本检查规则变更](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/upgrade-guide/v0.2.1-alpha.3/plugin-engines-dsh/guide.zh.md)正文说明 `0.2.1-alpha.3` 仍忽略 `engines.dsh`，下一版本才优先读取。目标若覆盖这一时期，需单独核对宿主实际检查行为及所需 peer 声明，不能仅添加 engines 就认定旧版会正确阻止不兼容安装。指南所在目录不自动等于新行为的首次发行版本。

源码核对已确认多项技能、preset、插件管理与 UI 接口在更旧版本中存在；本次通过旧版公开 `schemas()` / `get()` 解决 MCP 工具枚举差异，并用真实旧版执行器、投影和注入器验证。`0.2.0-rc.1` 与 `rc.2` 的 Menu 不支持 `minWidthFromAnchor`，工作区下拉保持该版原生默认宽度，界面仍需验收；未借助内部字段或覆盖宿主样式补齐。此结论不代表每个接口的绝对首次版本，也不代替完整宿主验收。

## 需要优先验证的初始化行为

功能开关不是版本隔离机制。[Host 入口](../src/index.ts)会在服务注入满足时注册通知投影、绑定 Todo、初始化 MCP 提供方和技能管理；这些操作并非都等到对应开关开启才执行。Client 也在 factory 中读取公共 UI 模块。因此必须先验证所有主开关关闭时的整包加载，再逐个开启功能；不能凭“默认关闭”判断旧版可用。

现有的局部不可用处理也不能替代版本验证。例如没有协议兼容的桌面更新桥时版本按钮只读，系统声音在不支持环境中只提供默认选项，技能或 MCP 的部分读取失败会返回不可用或未知。只有实际覆盖过的场景才能记为可降级，不能推及所有缺失接口。

## 验证与记录

每个要声明支持的运行时版本分别记录以下内容；测试对象使用最终打包产物，不能只运行源码测试：

1. **环境**：Mod 版本与最终提交、DSH 确切运行时版本、桌面壳或浏览器版本、操作系统、Node.js 版本、profile 类型及打包产物校验值。
2. **冷启动与加载**：所有主开关关闭时安装、启动、刷新页面；核对原生 application、诊断、Client 注册和实际入口。服务缺席或 profile 组合不支持时记录实际错误。
3. **功能与持久化**：逐个开启、操作、关闭，读回后端事实；修改后刷新与重启仍保持偏好。精简类在隔离环境核对全部目标与无关实例；技能区分全局和工作区，MCP 区分可写项、只读项和运行状态。
4. **生命周期**：停用、重启用、卸载，核对监听、投影、作用域和播放进程释放；不能重复注册或丢失用户配置。
5. **平台与界面**：仅把实际测试过的桌面系统、浏览器和本机/远程组合写为已验证；不能把 macOS 结果代替 Windows 标题栏、PowerShell 音效与系统通知验收。
6. **升级**：验证旧 Mod → 新 Mod 的开关和停用技能名单是否保留；旧 DSH → 新 DSH 的加载与操作复测。旧 ID 设置回退及部分重装读回证据见[调查记录](compatibility-audit.md#安装与平台验证记录)；完整偏好自动迁移尚未验证，不能据源码改名或旧路径符号链接宣称升级验收通过。包名、设置命名空间或 RPC 变化时，通过原生管理机制核对旧安装来源、迁移结果与页面重载，不手工修改 profile。
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
- 运行 `npm run check`，完成上述真实产物验收后，才进入[发版步骤](releasing.md#npm-发布与升级)。仓库检查不执行历史宿主安装，不能单独证明兼容；未完成兼容矩阵时仅保留开发版和 Release 草稿。

历史测试与安装事实集中保存在[兼容性调查](compatibility-audit.md)，其证据边界不随文档更新扩大。接口发现优先使用目标运行时 Inspect，替代来源须记录确切发行包或标签；完成真实产物和宿主验收后再声明支持范围。
