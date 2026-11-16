# 参考研究

## 实验性历史对话检索

2026-11-16 按轻量实效方向补齐原文与纠正查询。本环境再次搜索 `cordis_inspect_list` 无可用工具，只读核对本机 DSH `0.2.2-rc.3` 安装包 `dsh-session-query/src/index.ts` 的公开 `readSession(id)`：它经原生会话回放校验后返回原始事件与同次观察的 header。历史检索优先使用它，缺席才使用 `readSurface`；记忆来源仅在当前表面找不到所引消息时按需回查原始日志，仍核对身份、项目及 seq/time/hash，明确旧原文可能被替换。无需新数据库、全文索引或后台任务，消息时间与角色过滤在现有读取后完成。

2026-11-16 记忆出处与修订扩展沿用下述 `0.2.2-rc.3` 公开 `readSurface(id)` 的原子 session header/current surface 观察，只捕获当前调用会话的用户文本来源，保留 seq/time/hash，按需读回并核对哈希。官方固定源码 `fcc0ad46` 的 `packages/core/session/src/index.ts` 标明 `eventAt/snapshotEvents` 已弃用，故本扩展不调用这些同步接口；工具调用身份使用公开 `ToolRunContext.agent.session.header`。本环境 Inspect 仍不可调用，来源读取为可选能力；缺席不伪造消息定位，旧文件无证据不补造，实际 UI 与模型链路须另行验收。

同日原生验收发现，`user/message` 还承载宿主上下文，不能仅凭事件类型认定为用户原话。只读核对本机 `0.2.2-rc.3` 安装包内 `dsh-llm/src/message.ts` 的 `MessageSourceMap.user` 与 `dsh-client-ui-chat/src/client/conversation-nodes/message.ts` 的原生分流，确认以 `data.source.kind === 'user'` 识别人工输入。记忆出处捕获、原文邻文和实验性历史检索均据此排除注入及未知来源，缺少标识时不猜测；未复制内部 UI 实现。

2026-11-15 核对本地 `amd47802574/dsh-session-fulltext-search`（MIT，提交 `93d4c0c`，工作区干净）的 README，了解默认关闭的 FTS 与中文分词限制；本功能不复制其代码、不接管其引擎配置。当前工具中没有可调用的 `cordis_inspect_list`，转而只读核对本机 DSH `0.2.2-rc.3` 安装包中 `@deepseek-ai/dsh-session-query/lib/index.js` 的 `filterSessions(filters, signal)` 与 `readSurface(id)`，并对照官方固定源码 `fcc0ad46` 的 `packages/session-query/session-query/src/index.ts`、`types.ts`、`filters.ts` 及 `packages/experimental/tool-session-query/src/workspace-access.ts`。借鉴公开的 cwd 授权及观察后二次检查方式，没有复制其工具或引入依赖；本功能仅投影当前表面的用户／助手文本，采用有界按需字面匹配，与其他项目、原始工具结果和被替换事件隔离。接口核对不等于旧版本、原生模型调用或 GUI 验收，行为以[主 Spec](../src/features/history-search/spec.md)为准。

本文保留开发时的来源与接口核对记录，不随安装包发布。随包版权与许可见[第三方许可](third-party-notices.md)。

## 独立功能页分段导航

响应式优化以自有容器宽度决定左侧／顶部导航，顶部继续复用该公共组件，左侧使用自有主题按钮。已实际查看本机 DSH `0.2.2-rc.3` 的独立页与原生设置弹窗；根据用户后续指定的 ZCode 截图及本地 `SettingsPageParts.tsx` 中 `mx-auto w-full max-w-4xl px-4 ... lg:px-8` 的限宽方式，将六个独立页正文统一收为最大 800px，设置保留 760px，以 220px 最小卡片宽度自动填列。只参考内容宽度与滚动分层，不复制 ZCode 的设置功能。滚动视口延伸至主面板右边缘，居中及留白留在内容层；沿用顶部安全区变量，不新增宿主 DOM 接入。本轮 Inspect 工具仍不可用。

滚动条另只读核对已安装 `@deepseek-ai/dsh-client-ui-theme@0.2.2-rc.3`：包含 `--dsh-scrollbar-width`、`--dsh-scrollbar-thumb-border`、`--dsh-scrollbar-track-margin` 与原生主题颜色；其样式以互斥的标准／WebKit 路径避免 `scrollbar-width:thin` 抑制伪元素皮肤。独立页仅局部设置几何变量，横向导航隐藏滚动条，不修改全局样式。

独立页沿用已接入的 `main`／`sidebar.panellist` slot 与配置源，按用户最终要求移除插件标题与设置齿轮，分段导航靠左。只读核对桌面发行包 `@deepseek-ai/dsh-client-ui-agent-preset@0.2.2-rc.2` 中 `PresetGuideDialog` 对公共 `SegmentedTabs` 的调用，并对照官方提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 的 `ui-primitives/src/SegmentedTabs.tsx`、`SegmentedTabs.module.css`：items/value/onChange/label/id/panelId 协议、4px inset、34px 按钮、等宽列、细边框与原生滑动选中层。直接复用公共组件，缺席时用自有按钮兼容；不运行时导入内部 UI 或 CSS，不访问设置 Shell store 或模拟快捷键。选中按钮查询仅限自有导航容器。Inspect 本轮不可用；接口与布局夹具检查不替代真实 DSH 页面验收。

## DeepSeek Harness 原生插件目录布局

[技能与 MCP 管理界面](../src/client.ts)的搜索、分组、卡片布局及技能页范围 Tab 适配自 DeepSeek Harness 原生内置插件页面，包含卡片展开、悬浮、焦点和底部分隔背景等视觉反馈。使用本插件独立 CSS 类及数据，保留原生主题 token 与尺寸，不运行时导入内部页面组件。工作区选择和提示复用宿主公共 `Menu`、`Tooltip`；具体行为见[技能管理](../src/features/skills/spec.md)、[MCP 管理](../src/features/mcp/spec.md)与 [UI 规范](ui.md#技能与-mcp-管理列表)。未包含无关插件清单、模式选择或配置编辑逻辑。

- [原生 Tab 样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-settings-plugins/src/client/PluginsSettingsSection.module.css)
- [原生目录页面](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.tsx)
- [原生目录样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.module.css)
- 对照发行包：`@deepseek-ai/dsh-client-ui-settings-plugin-inventory@0.2.2-rc.1`。
- 技能目录来源标签另核对官方提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 的 `PluginInventorySettingsTab.module.css` 中 `cardIdentity`，沿用其字体、圆角、内边距、底色和文字色；使用自有局部 CSS，不导入内部 CSS Module。内置技能的包来源按产品要求保留普通文字。
- [上游 MIT 许可证](https://github.com/deepseek-ai/deepseek-harness/blob/master/LICENSE)

```text
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 原生设置下拉触发按钮

任务通知与提示音的下拉触发按钮对照桌面 `0.2.2-rc.2` 发行包 `@deepseek-ai/dsh-client-ui-settings-general` 中 `DesktopChannelRow.tsx`、`DesktopChannelRow.module.css`，以及官方提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 中对应设置选择器的尺寸与状态：36px 高、14px 水平内边距、12px 图文间距、14px／22px 字体及主题交互背景。采用本插件自有类名，并复用公共 `Menu` 和原生 regular 下箭头 sprite；不运行时导入内部设置组件、CSS 或改写宿主 DOM。官方源码使用 MIT 许可证，全文见本文第一节。

- [原生通用设置下拉](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-settings-general/src/client/DesktopChannelRow.tsx)
- [原生下拉触发按钮样式](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-settings-general/src/client/DesktopChannelRow.module.css)

## 原生工作区（Workspace）删除语义

[工作区管理](../src/features/projects/spec.md)的移除操作只调用原生 `workspaceController.delete({ workspaceId })`，沿用 DSH `0.2.2-rc.1` 安装包 `@deepseek-ai/dsh-api-workspace-controller` 与官方提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 的 `packages/workspace/workspace`、`packages/client/ui-workspace` 已核对的语义：删除一条工作区登记，保留目录与全部会话日志，会话回到「未分组」。确认框文案对照原生「删除工作区」的保留说明改写为本功能措辞，行内与确认按钮沿用上文原生危险按钮规格；没有复制其页面结构、组件或代码。

- [原生 Workspace 控制器](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/api/workspace-controller/src)
- [原生 Workspace 注册表](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/workspace/workspace/src)
- 对照发行包：`@deepseek-ai/dsh-api-workspace-controller@0.2.2-rc.1`、`@deepseek-ai/dsh-workspace@0.2.2-rc.1`。
- [上游 MIT 许可证](https://github.com/deepseek-ai/deepseek-harness/blob/master/LICENSE)，全文见本文第一节。

## 原生模型设置按钮规格

[归档管理](../src/features/archive/spec.md)的「取消归档」按钮按用户提供的原生参照，对齐 DSH `0.2.2-rc.1` 安装包 `@deepseek-ai/dsh-client-ui-settings-models` 的 `ModelsSection.module.css` 中 `.rowActions .secondaryButton` 的几何、描边、颜色和 hover token。仅在本插件自有 `power-dsh-archive-*` 类内复现数值，不导入其模块、不引用生成的 CSS 类名，也不复制页面结构或文案。

- [原生模型设置源码](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-settings-models/src/client)
- 对照发行包：`@deepseek-ai/dsh-client-ui-settings-models@0.2.2-rc.1`。
- [上游 MIT 许可证](https://github.com/deepseek-ai/deepseek-harness/blob/master/LICENSE)，全文见上一节。

## 技能与 MCP 来源研究

接口研究依据 DSH `0.2.2-rc.1` 安装包的公开实现：`dsh-skill` 的分层目录、rank 与调用策略，`dsh-skill-filesystem` 的 cwd 与工作区根语义，`dsh-scope` 的上下文所有权，以及 Plugin Manager、Settings、Loader、Cordis Registry / Fiber 和 preset composition。原生服务是否存在须按目标发行包核对；profile 条目清单不能证明没有 preset、Agent 或动态实例。现行行为和接口约束分别维护在[技能管理](../src/features/skills/spec.md)与[MCP 管理](../src/features/mcp/spec.md)，历史版本差异见[兼容性调查](compatibility-audit.md#官方发行标签的接口证据)。

市场检索后的来源研究如下，仅借鉴入口组织、功能边界与状态语义，没有复制或改编实现代码：

| 仓库与确切版本 | 许可 | 参考范围与取舍 |
| --- | --- | --- |
| [alone-tree/dsh-skill-mcp-manager](https://github.com/alone-tree/dsh-skill-mcp-manager/tree/e4a426b23eba07773d15a7b5824ba16db0a364dd)，提交 `e4a426b23eba07773d15a7b5824ba16db0a364dd` | MIT | scope、只读技能护栏与技能调用策略；未采用接管并重写 MCP patch 的架构 |
| [xx529/dsh-capability-settings](https://github.com/xx529/dsh-capability-settings/tree/282f1166356716f25e6973177d0935d308a736e1)，提交 `282f1166356716f25e6973177d0935d308a736e1` | MIT | 技能来源、文件级双向调用键、会话 shadow 优先级及 MCP 配置与会话作用域区分；未引入安装器、自建持久化或提示词重写 |
| [appthin/dsh-mcp-manager-plus](https://github.com/appthin/dsh-mcp-manager-plus)，已安装包 `0.4.5`，原记录未注明提交 | MIT | 只比较 `lib/index.js`、`lib/client.js` 与 README 中的工具展开和管理功能；其 Fiber active 到“已连接”的映射不足以证明网络连接，未采用此语义 |

本次 MCP 设置页故障另只读核对已安装的 [Fishquito7/dsh-skill-mcp-panel](https://github.com/Fishquito7/dsh-skill-mcp-panel) 包 `2.3.7`（MIT，安装包未标明提交）的 `lib/mcp/gateway.js` 与 `lib/index.js`：其 `McpManagerGateway` 注册同名 `mcpManager`，没有原生 `config.servers`，且 `list()` 为异步网关协议。仅用于确认服务名冲突与原生接口归属边界，没有复制代码、调用其管理方法或读取其配置。

这些来源研究不代表 PowerDSH 提供文件级技能启停、服务器增删或连接管理，也不构成其他插件声明的兼容性保证。PowerDSH 不修改共享技能文件，不复制第三方目录扫描器或独立连接器。

## MCP 运行状态参考

从 [市场页](https://awesome-dsh-plugin.com/zh/p/shinelon/dsh-mcp-plugin/) 检索到 [shinelon/dsh-mcp-plugin](https://github.com/shinelon/dsh-mcp-plugin/tree/2852d89c2322a01784a1f0db862bbc20d67987e0)，核对提交 `2852d89c2322a01784a1f0db862bbc20d67987e0`、包版本 `@local/mcp-manager@1.0.0` 与 [MIT 许可证](https://github.com/shinelon/dsh-mcp-plugin/blob/2852d89c2322a01784a1f0db862bbc20d67987e0/LICENSE)（Copyright 2026 shinelon / SunMight）。声明兼容 Node.js `>=22`、DSH `>=0.1.7-rc.2`、React `^18.2.0`；该声明不是 Mod 的跨版本验证结论。

仅参考 `src/host/routes.js` 的 `fiberStatus/listServers` 状态投影、`src/client/locales.ts` 的运行状态命名及 `src/client/section.tsx` 的刷新生命周期，没有复制或改编代码、布局、硬编码颜色或配置写入实现。来源区分配置 disabled 与 Fiber 阶段，使用运行状态而非网络在线状态；其 unloading 合并到 loading、无 Fiber 回落 pending 的规则未沿用，PowerDSH 保留明确的 unloading、inactive 和 unknown。来源的挂载、focus 与写后延时刷新用于理解生命周期，现行刷新和状态约定见 [MCP 管理](../src/features/mcp/spec.md)。研究未执行参考仓库脚本或安装其依赖、插件。

## Plan 模式精简参考

开发前从 [dsh-market](https://dshmarket.com/browse/)检索到 [a903067276-rgb/dsh-plan-switch](https://github.com/a903067276-rgb/dsh-plan-switch/tree/c4b32611eec1b5c4992f01353f60801b78075e61)，浅克隆并阅读提交 `c4b32611eec1b5c4992f01353f60801b78075e61` 的 `lib/client.js` 和 MIT 许可证。仅参考原生 `/plan` 命令、projection 与 UI 入口关系，没有复制代码、图标、样式或旧版接口降级，也没有安装或执行其脚本。

接口依据为 DSH `0.2.2-rc.1` 桌面发行包及官方仓库提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 的 `packages/plan/plan-mode`、`packages/client/ui-plan`、`packages/preset/agent-preset-registry` 和 Web 模式声明。独立实现只启停原生 Plan 模块，不移除拥有历史卡片的 UI 插件，不处理已有 Agent 的状态。完整行为与验收限制见[停用 Plan 模式](../src/features/plan-blocking/spec.md)。

## Goal 模式精简参考

开发前检索 [dsh-market](https://dshmarket.com/browse/) 的 Goal 条目，并浅克隆 [xlennart/dsh-goal-mode-enhance](https://github.com/xlennart/dsh-goal-mode-enhance/tree/628ebe637a928bb14b0692cf54df146141b2ec92)，阅读提交 `628ebe637a928bb14b0692cf54df146141b2ec92` 的 README、MIT 许可证及 `src/client/index.ts` 的目标创建与 slot 注册。仅核对第三方界面通过 `remote.goals.create` 独立创建目标的范围，没有复制代码、控件或样式，也不采用替换原生目标栏的接入方式，未执行参考脚本或安装依赖。

本功能依据 DSH `0.2.2-rc.1` 桌面发行包与官方提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 的 Goal 服务、续跑驱动、命令、工具、原生目标界面和模式声明独立实现。只启停原生目标命令与工具，保留领域服务、续跑驱动与历史界面；第三方目标创建入口不在精简范围。完整行为与验证边界见[停用 Goal 模式](../src/features/goal-blocking/spec.md)。

## 重启插件参考

[hulibuld/dsh-refresh-restart](https://github.com/hulibuld/dsh-refresh-restart/tree/3228af3fc3bcc27eb5b290831e43e5734d85901d)，提交 `3228af3fc3bcc27eb5b290831e43e5734d85901d`，MIT。阅读 `lib/restart.js`、`lib/platform.js` 与 Client 交互，仅借鉴外部助手、正常退出后重开的思路，没有复制代码。其他同类实现、平台取舍与原生确认组件来源见[重启应用](../src/features/restart-button/spec.md#参考与验证)。

Windows 后续实现补充只读参考同仓库提交 `3acfc36373cc33d0b368a0fcfc248ddb54c4587b` 的 `lib/win.js`、`lib/win-helper.ps1`（Explorer 交接外部助手），[CZY1326/dsh-restart-button](https://github.com/CZY1326/dsh-restart-button/tree/70cb30cf54c57bbce3126d3e8d0ff1ecfc73c672) 的 `lib/index.js`（确认退出后重开），以及 [SMPcosy/dsh-easy2restart](https://github.com/SMPcosy/dsh-easy2restart/tree/05da56a6c876b758ffdaaa1589ce65526c3f6ee5) 的 `restart/restart.ps1` 与 Host 调度（Windows 进程树生命周期）。三者均为 MIT，仅借鉴方案，没有复制代码、安装依赖或执行参考插件；不采用修改 ASAR、计划任务或按进程名全局强杀，自行实现当前实例路径／PID／创建时间核对、一次性授权与清理。

## 通知插件参考

任务通知开发前从 [dsh-market](https://dshmarket.com/browse/) 检索并浅克隆以下仓库，仅参考交互设计和接入方式，没有复制或改编其代码：

| 仓库与提交 | 许可 | 参考范围 |
| --- | --- | --- |
| [omdsh-dev/dsh-notification](https://github.com/omdsh-dev/dsh-notification/tree/675aab9b43d5011738feb6185281596c0365ccba) | [MIT](https://github.com/omdsh-dev/dsh-notification/blob/675aab9b43d5011738feb6185281596c0365ccba/LICENSE) | Host 完成摘要投影、Client 通知权限与对应会话前台抑制 |
| [chromoany/dsh-notify-me](https://github.com/chromoany/dsh-notify-me/tree/71ffecacbaa49fa03e92463f8eb71b4743336b6c) | [MIT](https://github.com/chromoany/dsh-notify-me/blob/71ffecacbaa49fa03e92463f8eb71b4743336b6c/LICENSE) | 每条通知使用独立 tag、同毫秒计数器防重，以及 Electron 下不依赖 renotify 的重复提醒设计；只读对照，没有复制其通知桥、原生助手或审批代码 |
| [ztl0001/dsh-notify](https://github.com/ztl0001/dsh-notify/tree/9a8d1a566a47ff376b16c0006c19a88ce0499fdb) | [MIT](https://github.com/ztl0001/dsh-notify/blob/9a8d1a566a47ff376b16c0006c19a88ce0499fdb/LICENSE) | PowerShell 5.1 / WinRT Toast 传输与不 detached 的进程生命周期设计；只读参考 `lib/powershell-toast.js`，本项目另用宿主 subprocess、严格 RPC、编码数据及分组清理实现，没有复制其脚本、资源、身份回退或会话挂钩 |
| [YoyuDev/dsh-ping](https://github.com/YoyuDev/dsh-ping/tree/bbe2cb4bdf19dac3e4f3e876482ab51086ec6622) | [MIT](https://github.com/YoyuDev/dsh-ping/blob/bbe2cb4bdf19dac3e4f3e876482ab51086ec6622/LICENSE) | 完成、出错、输入和审批四类提醒的触发划分，以及 macOS 使用 afplay 的声音播放方式 |
| [DeepseekHarnessPlugins/Notification](https://github.com/DeepseekHarnessPlugins/Notification/tree/5da12d12d31e260e22210efa2779b44d71db8891) | [MIT](https://github.com/DeepseekHarnessPlugins/Notification/blob/5da12d12d31e260e22210efa2779b44d71db8891/LICENSE) | 以系统声音名称选择原生提示音的设计 |

Mod 使用已核对的 DSH `0.2.2-rc.1` 原生会话、交互及 subprocess 通道，自行实现最小投影、系统默认通知与本机系统声音白名单播放，仅借鉴上述项目的设计，没有复制或改编其代码，不引入其依赖、音频文件、脚本或设置页面。Windows 使用固定 WinMM 系统事件别名，接口依据为微软 [PlaySound 文档](https://learn.microsoft.com/en-us/previous-versions/dd743680(v=vs.85))。行为边界见[任务通知](../src/features/notifications/spec.md)。

## 插件更新协议参考

插件更新入口只读参考 [dsh-market/dsh-market](https://github.com/dsh-market/dsh-market/tree/da774820fd49f4915461ff2031eedbef9b48dfe7)（MIT，`1.73.19`）的 `UPDATE-API-V1.md`、`src/routes.ts`、`src/update-api-v1.ts` 公开协议及 `src/client/market-data.ts` 的路径前缀规则，自行实现有界客户端，没有复制安装、恢复、UI 或依赖。API 当前为 beta，采用能力发现与严格校验；边界见[插件更新](../src/features/plugin-updates/spec.md)。

## 推理等级插件参考

开发前检索 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 市场目录（快照 `e190236`），并浅克隆下列仓库，仅用于理解市场做法与宿主接口，**没有复制或改编任何代码、样式或配置写入实现**：

| 仓库与提交 | 许可 | 参考范围 |
| --- | --- | --- |
| [ChimeSky/dsh-effort-keeper](https://github.com/ChimeSky/dsh-effort-keeper/tree/afc2a68) | MIT | Host 侧装饰 `selectModel` 记忆档位，不改动界面 |
| [Ayowait/dsh-official-reasoning-effort](https://github.com/Ayowait/dsh-official-reasoning-effort/tree/7872985) | MIT | 复用官方组件并注入档位，观察官方档位序列 |
| [zszz3/dsh-model-provider-prefix](https://github.com/zszz3/dsh-model-provider-prefix/tree/bc89f42) | MIT | 替换 `conversation.input.model` 座位的做法，作为本项目刻意不采用的对照 |

本功能的信号格、循环序列与点击提交均为独立实现；接口依据为 DSH `0.2.2-rc.1` 安装包只读源码，未执行参考仓库脚本或安装其依赖、插件。行为边界见[推理等级选择器](../src/features/thinking-effort/spec.md)。

## 官网流动背景与壁纸参考

本轮按用户要求结合下列三个实现的职责划分：`dsh-ui-appearance@0.1.28`（提交 `fe6d9b930b9554e99b7fcdd44c8628afc2e1191a`）的媒体淡化／模糊与界面玻璃分离；`dsh-homepage-glass@1.3.1`（提交 `a9bb39e7a9ceb1a83b1467312076f786d6e30fa0`）的动效节流、减少动效和 GPU 回收；`dsh-mpkg-wallpaper`（提交 `ab8d50db9b4a29916be7ba8b45aed452ee80d538`）的零值语义、表面／媒体归属与避免滤镜影响 fixed 弹层定位。PowerDSH 现在由壁纸专页统一选择无壁纸、官网流动、大肥鱼和自定义图片，共用「壁纸可见度」「壁纸模糊」，保留官方组件样式、Host 图片存储、自有图层范围和旧配置；仅作源码研究，未复制第三方样式、着色器或渲染器，也未安装或执行这些插件。各来源链接、许可与边界见下文。

按用户指定，只读核对 [TQSY114514/dsh-ui-appearance](https://github.com/TQSY114514/dsh-ui-appearance/tree/fe6d9b930b9554e99b7fcdd44c8628afc2e1191a)，包 `0.1.28`、提交 `fe6d9b930b9554e99b7fcdd44c8628afc2e1191a`、MIT（Copyright (c) 2026 TQSY114514）。阅读 README、LICENSE、媒体存储与 `applier.ts`，参考媒体层不透明度／背景模糊分离、模糊画面留边、异步图片身份校验与释放的实现思路。流动图案保持原尺寸，只应用背景模糊滤镜；独立壁纸的媒体扩边改按下文 Cindy 参考，允许轻微扩大 cover 裁切；保留既有 Host profile 图片存储和官方公共组件；未移植其样式表、全局主题覆写、视频／URL／配色功能或 IndexedDB 存储，也未执行其安装脚本、构建或安装该插件。

已退役的主页调节面板曾将尺寸与排版适配自官方提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 的 [Modal.module.css](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-primitives/src/Modal.module.css)，独立背景材质层参考同提交的 [MenuSurface.module.css](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-primitives/src/MenuSurface.module.css)。Copyright (c) 2026 DeepSeek，适用本文开头完整保留的 MIT 许可证。使用本功能自有类名与更低底色不透明度，不运行时导入内部样式模块；关闭操作复用公开 `Button`；图片更换与移除现属于独立壁纸设置。

壁纸中的「官网流动」预制（[历史参数与授权](../src/features/flowing-background/spec.md)）参考 [DeepSeek 首页](https://www.deepseek.com/)及市场中的 [Tim5613/dsh-homepage-glass](https://github.com/Tim5613/dsh-homepage-glass/tree/a9bb39e7a9ceb1a83b1467312076f786d6e30fa0)，确切提交 `a9bb39e7a9ceb1a83b1467312076f786d6e30fa0`、包版本 `1.3.1`。阅读其 README、LICENSE 与 `lib/client.js` 中的 FLOW_PARAMS、颜色混合、时间归一化和遮罩；核对蓝白三色、softness 100 的两级宽范围混色、八次旋涡、坐标缩放与慢速流动。该插件背景本身没有 CSS blur，其 `backdrop-filter:blur(14px)` 属于输入卡，未搬入 PowerDSH。官网当前使用有界周期相位，参数也已对照。PowerDSH 独立编写值噪声、旋涡、颜色合成及相位实现，不引入依赖或远程资源。参考插件自身声明 MIT，但同时声明官网 GLSL 为逐字提取；其外层 MIT 不作为官网源码的独立再分发许可，因此没有复制该 shader、皮肤全局 CSS 或宿主 DOM 接入代码。底部采用官网归零遮罩，没有采用参考插件保留 30% 蓝色的改版。WebGL 不可用或上下文丢失时显示自有 CSS 渐变。

全局底层接入另外参考该提交中 `lib/client.js` 的挂载、负层级与结构背景透出思路（416–493 行的布局说明与 `.dhps_flow`，642 行的 `host.appendChild(canvas)`）。参考插件直接处理整页框架/内容列透明度、主题 token 与输入卡片；PowerDSH 没有复制其全局 CSS、卡片样式或宿主 DOM 接入代码。用户已授权独立编写范围受控的 AppFrame 底层适配。初版采用 npm `0.2.2-rc.1` 包中的类名，但直接读取已安装桌面包发现同版 `@deepseek-ai/dsh-client-ui-layout` 的样式及类映射（第 74、83–93 行）使用 `PIRFFq_frame`、`PIRFFq_sidebarCol`、`PIRFFq_centerCol`，`@deepseek-ai/dsh-client-ui-sidebar` 第 116–125 行使用 `kB3qhq_root`，与 npm 包的 `pI_x6G_*`、`hHd-Xa_root` 不同；构建差异导致固定选择器无法命中。当前必需框架映射只读自已加载的两个精确官方 `style[data-plugin-css]` 标签 `@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css`、`@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css`，要求标签及所需简单后缀类名唯一，再核对语义直接子元素和定位布局；不复制、重新注入这些官方样式，也不扫描任意样式表。只对主 Spec 列明的结构表面设置内联透明背景，不将全局主题 token 或任意后代改为透明；输入卡片、编辑器、文件卡片、菜单和弹窗保留原生表面。同一框架的映射或目标表面替换只刷新适配，框架替换或关闭时按原值、优先级与所有权恢复。授权范围、窄窗口抽屉保护、延迟样式恢复、失败保护和验收限制见[官网流动背景 Spec](../src/features/flowing-background/spec.md)。本次未适配操作系统原生标题栏，也未强制清空其他面板的独立不透明内容表面；浏览器未连接，本次映射修复后的全局实屏效果尚未验收。

用户反馈底部 `_fade` 阴影后，另直接只读核对已安装 `0.2.2-rc.1` 官方工作区 Client 的 `WorkspaceBrowser.module.css` 标签、类名映射及分组/平铺/搜索结果渲染结构：原生底部 span.fade 为 24px 渐变，macOS 隐藏。PowerDSH 未复制或重新注入官方样式，仅增加精确模块元数据的可选读取和受控目标的 display 隐藏/恢复；动态哈希和授权范围见功能 Spec。

其他对照来源为 [JohnnyTing/dsh-official-homepage-theme](https://github.com/JohnnyTing/dsh-official-homepage-theme/tree/a80b70e809a091c815f8678d69cf1c88ffa11e91)（提交 `a80b70e809a091c815f8678d69cf1c88ffa11e91`，MIT）和 [yushi-xxh/dsh-homepage-skin](https://github.com/yushi-xxh/dsh-homepage-skin/tree/329f9e0b12cab223b00b3e75e2f73453d9a46ed5)（提交 `329f9e0b12cab223b00b3e75e2f73453d9a46ed5`，MIT）。二者主要复刻 `/harness` 的深海、鲸鱼与流体光效；后者的 20px blur 不能当作根首页三色 pattern 的模糊参数。本次没有复制其代码或资源，也没有安装、执行这些参考插件。另阅读 Paper Design 的公开 warp 说明作为算法分类对照，未复制或引入该代码。

开发前从 [dsh-market](https://dshmarket.com/browse/)检索并浅克隆 [XHR666/dsh-mpkg-wallpaper](https://github.com/XHR666/dsh-mpkg-wallpaper/tree/ab8d50db9b4a29916be7ba8b45aed452ee80d538)，提交 `ab8d50db9b4a29916be7ba8b45aed452ee80d538`，阅读 README、许可证与 Client 壁纸相关模块。仓库主体 MIT，渲染部分另有 GPL-3.0-or-later 声明；这里只对照动态装饰、暂停与背景接入的功能边界，没有复制或改编其代码，也未采用宿主 DOM/CSS 透明化及布局改写方式，未运行其脚本或安装其依赖。

### Cindy 壁纸交互与媒体渲染

按用户要求参考 [makecindy/cindy](https://github.com/makecindy/cindy/tree/a32a54c09b9022ed24461c97a8b769d979f9563e)，确切提交 `a32a54c09b9022ed24461c97a8b769d979f9563e`，适用 [Apache License 2.0](https://github.com/makecindy/cindy/blob/a32a54c09b9022ed24461c97a8b769d979f9563e/LICENSE)。已阅读以下模块：

- [WallpaperSection.tsx](https://github.com/makecindy/cindy/blob/a32a54c09b9022ed24461c97a8b769d979f9563e/apps/desktop/src/renderer/components/settings/WallpaperSection.tsx)：缩略图选择、可见度与模糊两个滑块，拖动预览、松手提交及取消手势。
- [useWallpaperSettings.tsx](https://github.com/makecindy/cindy/blob/a32a54c09b9022ed24461c97a8b769d979f9563e/apps/desktop/src/renderer/hooks/useWallpaperSettings.tsx)：预览与确认状态分离、串行保存、失败回滚及新提交保护。
- [slider.css](https://github.com/makecindy/cindy/blob/a32a54c09b9022ed24461c97a8b769d979f9563e/apps/desktop/src/renderer/components/ui/slider.css)：36px 命中区、6px 轨道、16px 默认滑块、18px hover 与 22×16px 按下形态。PowerDSH 按这些几何关系为原生 range 独立编写样式，颜色和焦点使用 DSH token，不移植 Cindy 的滑块组件、主题变量、样式表或手势实现。
- [useWallpaperBackground.ts](https://github.com/makecindy/cindy/blob/a32a54c09b9022ed24461c97a8b769d979f9563e/apps/desktop/src/renderer/hooks/useWallpaperBackground.ts)与 [globals.css](https://github.com/makecindy/cindy/blob/a32a54c09b9022ed24461c97a8b769d979f9563e/apps/desktop/src/renderer/styles/globals.css)：主题底色遮罩、仅媒体模糊、三个半径扩边裁切及零可见度暂停模糊。

PowerDSH 的[壁纸专页](../src/features/wallpaper/spec.md)由界面首行「开启自定义壁纸」启用，原生设置左侧入口位于全局指令上方；页面参考上述交互与媒体渲染思路，保留自身标题／描述，其下直接展示选择控件，不增加重复字段标题；自定义图片的更换与移除独立放在卡片底部名称右侧，与 radio 互为同级，文件名／格式仅 Tooltip，不保留下方重复文件行。实现自行遵循 DSH 组件、主题 token、共享错误反馈与生命周期；保留既有 profile 图片存储及 owner-only RPC，不移植 Cindy 的 Electron 桥、媒体协议、壁纸库、视频、桌面透视、原生模糊或全局玻璃表面规则，不引入其依赖或资源。参考源码只作本地研究，未安装依赖或执行项目脚本。

### 用户指定的「大肥鱼」壁纸

按用户要求，将其当时正在使用的蓝色海景与鲸鱼壁纸保存为「大肥鱼」／`Big fat fish` 预制。该 JPEG 为 2715×1500、2,102,697 字节，SHA-256 `3ce7069042d4286a7130953b36f0c1ee76dfc804f6c7a38c97140043fd5db07f`；以 data URL 存放于本地静态资源，构建时内嵌到 Client，保留原始图片字节。图片由用户指定，原作者与再分发许可未提供，不宣称为 PowerDSH 或 Cindy 原创，也未执行发布。预制与用户之后导入的自定义图片独立。

## 归档管理插件参考

[归档管理](../src/features/archive/spec.md)开发前从 [dsh-market](https://dshmarket.com/browse/) 检索并浅克隆 [MichengAI/dsh-archive-manager](https://github.com/MichengAI/dsh-archive-manager/tree/c2146d58cfb23066a2df26221bf78de4b4b0cc78)，提交 `c2146d58cfb23066a2df26221bf78de4b4b0cc78`，Apache-2.0。参考「按工作区分组 + 搜索 + 排序/工作区筛选 + 取消归档 + 二次确认删除」的信息结构。其删除依赖私有 `locate()` 及内部记账/投影清理，本项目没有复制其代码或样式，也未采用其永久删除、自动归档与保留时长。PowerDSH 的归档读取由 Host 侧 `workspaceController.follow` 基线配合 `sessionQuery.readTitleSnapshots` 完成，恢复走原生 `unarchiveSession`。

## 使用统计页面参考

[使用统计](../src/features/usage-stats/spec.md)按用户要求参考本机 NCode（`~/code/ZCode`，Apache-2.0）的「使用统计」页面，同步提交 `a9fe401eede6e6e5e01be9048679c206fe6f02d9`，阅读 `packages/ui/src/settings/usage-stats/` 下的摘要条、热力图与趋势/占比图表组件。只借鉴信息层级与交互：顶部五项摘要、52 周活动热力图、范围切换、按模型的每日趋势与模型占比列表。本项目没有复制其代码、Tailwind 类、Recharts 图表、ZCode 专属配色变量或 agent 数据库协议；数据改为读取 DSH 公开 `sessionPersistence` 日志并自行折叠，图表用内联 SVG 路径（趋势线为自实现、控制点受相邻数据范围约束的三次贝塞尔曲线）与自有 CSS 绘制，颜色取宿主主题 token，无新增依赖；热力图按用户要求只保留按天分级，不沿用其每周／累计模式。

- [NCode 仓库](https://github.com/mewcoder/NCode)，同步提交 `a9fe401eede6e6e5e01be9048679c206fe6f02d9`。
- [Apache License 2.0](https://github.com/mewcoder/NCode/blob/main/LICENSE)。

补充：按用户提供的两张 magpie「观测 / 用量」页面截图，只读核对 [yetone/magpie](https://github.com/yetone/magpie) 本机源码，提交 `52c9880cbbfa5757ebcd1d8a66509b92a294edc8`，阅读 `internal/usage`、`internal/usageapi` 与 `internal/gui/assets/plugins/usage` 的请求质量、费用、输出速度、TTFT 与会话聚合定义。PowerDSH 只借鉴信息层级与指标口径（请求尝试 / 失败 / 重试 / 取消、模型输出速度与首字延迟、按模型摘要），不复制其 Go/JS 代码、价格目录、网关统计协议或样式；费用与网络流量依赖网关数据，本项目不引入。研究结论见[使用统计指标扩展研究](usage-stats-research-2026-11-14.md)。

另按用户要求只读核对 [dsh-context](https://github.com/bowenliang123/dsh-context) 已安装的 0.82.1 包：输入三桶互斥、总 Token 按输入／缓存读写／输出四项合计、缓存率以缓存读取除以全部输入，主子会话归组、失败尝试计费样本与已完成步骤计时。祖先历史按原生句柄的精确继承切点排除，避免重复计量。另参考其自定义单月月历的两次点选、悬浮预览与起止区间交互；本项目自行实现键盘跨月导航并由公共 Modal 承载。只借鉴统计定义与交互，不复制其 Client 或 Host 代码、portal、样式、资产或生命周期时长算法，不引入该插件为依赖。本项目累计运行时长独立使用公开步骤事件并按所选范围裁剪，包含步骤内等待，不采用静默间隙推断。

## Lucide Puzzle、Sparkles 与 Cable

记忆导航按用户要求采用 [Lucide Brain](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/brain.svg)（ISC，2026-11-14 读取），保留 24×24 画布与原始八条 path，设置入口与独立页共用同一内联组件。独立页其他导航复用各功能既有设置图标，无新增图标库依赖；许可统一保留在[第三方许可](third-party-notices.md)。

[Mod 图标](../assets/icon.svg)与 Mod 设置导航使用 Lucide Puzzle；[技能与 MCP 设置导航](../src/client.ts)分别使用 Lucide Sparkles 和 Cable；[归档设置导航](../src/features/archive/client.ts)使用 Lucide Archive 与 Folder；[使用统计设置导航](../src/features/usage-stats/client.ts)使用 Lucide ChartColumn；[工作区管理设置导航与行图标](../src/features/projects/client.ts)使用 Lucide Folders 与 Folder。仅内联所需 SVG，不引入 Lucide 运行时依赖。图形使用约定见 [UI 规范](ui.md#logo-与图标)，独立 SVG 中也保留完整许可。

- [Puzzle 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/puzzle.svg)
- [Sparkles 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/sparkles.svg)
- [Cable 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/cable.svg)
- [Archive 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/archive.svg)
- [Folder 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/folder.svg)
- [Folders 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/folders.svg)
- [ChartColumn 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/chart-column.svg)
- [上游许可证](https://raw.githubusercontent.com/lucide-icons/lucide/main/LICENSE)
- 获取日期：2026-11-07。

```text
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```

历史合并背景阶段的「透明度」「毛玻璃」两行设置交互参考同目录 wallpaper 插件与 homepage-glass：wallpaper 以 0–100 的整屏磨砂与表面透明度滑块、homepage-glass 以卡片 `backdrop-filter: blur(14px) saturate(1.5)` 与固定半透明底色呈现毛玻璃，并在系统「减少透明」时退回不透明。当时只借鉴其「磨砂 + 透明度」的思路，用自有图层 `opacity` 与 Canvas `filter: blur()` 实现，未复制其滑块组件、样式表或 DOM 接入代码；当前独立壁纸的可见度与媒体扩边遵循上文 Cindy 参考。

「自定义壁纸」的存储与上传交互参考同目录 wallpaper 插件的本地文件导入思路（本地读取、不自动上传、校验类型与体积）。PowerDSH 未复制其渲染器、壁纸库或界面代码，只实现单个壁纸文件的本地上传、校验与读取；图片保存在用户自己的 DSH profile 内，不上传任何远端。

## 技能导入的来源扫描研究

[技能管理](../src/features/skills/spec.md)的「从其他 Agent 导入」在实现前检索 dsh-market 并阅读以下参考实现，仅用于确定扫描目录、条目格式与冲突语义，没有复制代码、图标或样式：

| 参考仓库 | 提交 | 许可 | 参考内容 |
| --- | --- | --- | --- |
| [Free-LZJ/free-dsh-plugins](https://github.com/Free-LZJ/free-dsh-plugins/tree/a668e48)（`packages/agent-import`） | `a668e48` | MIT | 22 个 agent 的技能目录表、`CODEX_HOME`／`CLAUDE_CONFIG_DIR`／`DSH_AGENTS_HOME` 覆盖、按真实路径合并同一链接技能、项目根优先于用户根 |
| [WilShi/dsh-skill-station](https://github.com/WilShi/dsh-skill-station/tree/b39b84a) | `b39b84a` | MIT | Claude/Codex/Cursor/Gemini 四源扫描、Gemini 的 `antigravity/skills` 变体、只读扫描与冲突检测 |
| [6pofx/dsh-tool-explorer](https://github.com/6pofx/dsh-tool-explorer/tree/63ea4c8) | `63ea4c8` | MIT | 跨 agent 配置导入的整体思路（本项目只用于确认“扫描已知目录”而非读取任意配置） |
| [mjylfz/dsh-skill-mover](https://github.com/mjylfz/dsh-skill-mover/tree/a193e69aecb8138ea541bb13a05c0dbf58be01b6) | `a193e69aecb8138ea541bb13a05c0dbf58be01b6` | MIT | `src/core.js` 的名称／路径聚合与来源记录、`src/client/index.js` 的固定复制交互 |
| [farion1231/cc-switch](https://github.com/farion1231/cc-switch/tree/3c76d3bda670297dd8c27d7d9be9b18a4c9143f5) | `3c76d3bda670297dd8c27d7d9be9b18a4c9143f5` | MIT | `src-tauri/src/services/skill.rs` 与 `app_config.rs` 的多 Agent 状态、来源与更新哈希 |
| [vercel-labs/skills](https://github.com/vercel-labs/skills/tree/e781cb4d07433dfe1d19e924ed45cc61738c55ec) | `e781cb4d07433dfe1d19e924ed45cc61738c55ec` | MIT | `src/installer.ts` 与 `src/skill-lock.ts` 的复制／链接模式及独立安装记录 |

另核对 `6pofx/dsh-tool-explorer` 提交 `63ea4c8192f715c3157af69e71fef67915db8af1` 的内容哈希、安装记录与更新判断。本项目自行实现有界扫描、完整包指纹、路径选择与不覆盖导入；当前直接依据原生目录判断是否已存在，不采用独立导入记录或受管更新流程。上述源码只作设计对照，没有复制实现、样式、图标或依赖，也未安装、执行这些插件。不读取其他 Agent 的 MCP／规则配置、不写入其他 Agent 目录或锁文件，行为边界见主 Spec。

删除交互另对照同一提交的 `src/skills-trash.ts`，只用于理解确认路径和共享目录的边界。本项目独立实现非内置本地技能删除、确认指纹及失败暂存恢复，不采用来源的删除实现、回收站、锁文件或删除历史，也没有复制源码。

## QwenLM/qwen-code 记忆系统

「记忆」方向的机制设计研究，研究结论见[记忆功能研究](memory-research-2026-11-14.md)，当前实现以[主 Spec](../src/features/memory/spec.md)为准。仅作机制对照，没有复制代码、样式或依赖。

| 参考仓库 | 提交 | 许可 | 参考内容 |
| --- | --- | --- | --- |
| [QwenLM/qwen-code](https://github.com/QwenLM/qwen-code/tree/6f754be)（`packages/core/src/memory/`） | `6f754be` | Apache-2.0 | 提示词三层拆分（常驻精简策略 + 后台代理全量 + 索引作请求尾目录数据）、索引由 Host 从 frontmatter 机器重建、提取游标与跳过判定、`pinned/` 保护目录、frontmatter 关键词/分类元数据、提取与 Dream 的快照 fail-closed 校验、记忆目录读写限制与 symlink 加固 |

同轮还核对了 ZCode 本地源码仓 v3.17.2 的 `apps/zcode-cli/packages/core/src/memory/`（非本仓库克隆）与 WorkBuddy AI、Trae CN 安装包，证据口径与结论以[记忆功能研究](memory-research-2026-11-14.md)为准。

2026-11-15 手动整理进一步参考同一 Qwen 提交的 `dreamAgentPlanner.ts` 与 `dream.ts`：保留事实、模型只产出建议、快照版本冲突拒绝、用户确认后备份应用。PowerDSH 不启用其后台 Dream，不复制代码；使用自有严格 JSON 合并计划与可恢复日志。模型接口逐项核对官方 DSH 固定源码 `fcc0ad46` 的 `packages/llm/llm/src/types.ts`、`packages/api/session-controller/src/catalog.ts` 和 `packages/session/session-title-llm/src/index.ts`，Client 默认选择依据 `ui-model-selection` 的 `modelDirectories` 与 `ui-session` 的 `retainedBy.mainView`。当前 Inspect 不可用，旧宿主缺少可选接口时只让整理不可用。

## Codex 开源记忆源码核验

2026-11-15 根据用户补充核对 [openai/codex](https://github.com/openai/codex)（Apache-2.0）：发行标签 `rust-v0.169.0`／提交 `d32063f96c2dff1dc96af839b3952abb6acfeda4`，开发分支固定 `81b995a6c9a4c978f399775cfa5ce50702368749`。重点读取 `codex-rs/memories/write/` 的启动、提取、整合及 V1／V2 模板，`ext/memories/` 阅读路径与 `state` 候选选择／保留策略，完整依据与限制见[源码研究](memory-codex-source-research-2026-11-15.md)。

修正“各家都是同一种索引＋单条文件”概括：Codex 采用会话提取＋批量整合，V1 有经验手册，V2 主要是精简摘要及来源指针。保留规则、使用记录及独立后台模型不能直接套给当前 PowerDSH。没有安装、执行或复制源码，本轮不变更功能。

## Claude Code 与 OpenCode 记忆补充研究

2026-11-15 按用户要求补查文件粒度、写入／召回、查重与整理。完整结论与证据边界见[补充研究](memory-claude-opencode-research-2026-11-15.md)，本轮只更新研究，不改变已确认功能。

| 参考 | 固定版本／提交 | 许可与用途 |
| --- | --- | --- |
| [anthropics/claude-code](https://github.com/anthropics/claude-code) 与官方 memory 文档 | `993543784801341f17fe894abb253905b4f7a634`，发布 `v2.1.325` | 商业条款；官方文档及公开更新日志确认索引＋独立条目、200 行／25KB 索引预算及维护提醒，不把公开仓库当完整 CLI 源码 |
| [anomalyco/opencode](https://github.com/anomalyco/opencode) | 发行标签 `v1.19.5`／`810c0eba1a7348036f8bdf61e6632d0c36c6876c`；开发分支 `9f1639c73223053c7e5bc6f2204995fcd39b15ad` | MIT；区分原生指令、会话压缩及长期记忆插件，分别核对 V1 发行版和 V2 开发快照 |
| [dot-opencode/memory](https://github.com/dot-opencode/memory) | `4d3f2b832ed202f3939492a1fe95180f1da4f2e8` | MIT；单事实文件、生成索引、只读重复报告、交互／无人值守整理与备份边界 |
| [supermemoryai/opencode-supermemory](https://github.com/supermemoryai/opencode-supermemory) | `7de590ee9b715a1390215d050175d73bd4bc75e2` | package.json 与 README 声明 MIT；服务型捕获与召回，未审计服务端去重和提炼算法 |

源码仅在 `reference/` 只读研究，没有安装、执行或复制代码、提示词、资源。

## DSH 社区记忆插件与宿主接线核验

[记忆功能研究](memory-research-2026-11-14.md)第二轮为确认「在真实 DSH 0.2.x 上如何接线」浅克隆并只读核对了四款 MIT 社区实现，用于对照注入 API、存储位置、捕获方式与管理入口；没有复制代码、样式、图标或依赖，也未安装、执行这些插件：

| 参考仓库 | 提交 | 许可 | 参考内容 |
| --- | --- | --- | --- |
| [baosfeng/my-dsh-plugins](https://github.com/baosfeng/my-dsh-plugins/tree/6d1b28f3e21d8b77811c7e8841f6e32970b8caf1)（`plugins/dsh-my-memory`） | `6d1b28f` | MIT | `systemPrompt.section()` 三段式（静态策略／提示词／记忆目录）、三处 `interpolate: false`、`$DSH_HOME` 存储与 git 根 sha256 项目键、自定义记忆工具与 `tools/pre-execute` 写确认门 |
| [littleblacktong/dsh-plugin-memory](https://github.com/littleblacktong/dsh-plugin-memory/tree/5a3f94c59a8966565778ff01d24649558e0ca7f1) | `5a3f94c` | MIT | `systemPrompt.context()` 双段（常驻 boot + 易变尾部 order 900）、按 `context.agent` 会话冻结、prompt 驱动写文件 + skill + digest 兜底、`settings.section` 页面 |
| [ruqinhu/dsh-memory](https://github.com/ruqinhu/dsh-memory/tree/486270dcd751b6ae725a3e34a1bd8cd36d1f5c73) | `486270d` | MIT | `context()` order 130 与宿主既有段位对照、6000 字符阈值全文/索引切换、CJK 二元组确定性召回、8 个自定义工具、正文派生 ID |
| [2424830124/dsh-memory](https://github.com/2424830124/dsh-memory/tree/5611d2adbeb09311ea3bcf1f3b411e0b9b9c2ce9) | `5611d2a` | MIT | `system-prompt/assemble` 瀑布改写（preset 已占用 persona 段时的唯一无冲突位置）、按会话冻结注入文本、写前必读 + 磁盘 hash 乐观锁、`conversation.view` 页面 |

宿主接线核验另以 DSH 官方仓库提交 `fcc0ad46`（`0.2.2-rc.1`）的 `packages/core/system-prompt/src/index.ts`、`packages/sandbox/sandbox/src/roots.ts`、`packages/fs/fs-sandbox/src/index.ts`、`packages/core/agent-loop/src/runtime-context.ts`、`packages/core/agent/src/runtime-types.ts` 为依据，并用本机 `.references/compatibility-tests/` 的 13 个历史发行版安装包逐版核对了 `dsh-system-prompt`、`dsh-tools`、`dsh-agent`、`dsh-session`、`dsh-sandbox-policy` 的公开 API 差异；结论与限制见[记忆功能研究](memory-research-2026-11-14.md#七dsh-宿主接线核验第二轮2026-11-14)。

记忆分组的「打开文件夹」另核对官方 `dsh-v0.2.0-rc.1` 标签与 `fcc0ad46` 的 `packages/api/session-controller/src/index.ts`：公开 `canOpenWorkspacePath()` 返回桌面打开能力，`openWorkspacePath({ path }, signal)` 验证宿主文件系统映射后交给原生打开器，返回 `{ opened: true }`。本项目仅传入 Host 根据作用域核验后的记忆目录，不访问桌面内部 IPC、不增加原生打开依赖。当前会话无 Inspect，依据固定源码核对，未执行实际文件管理器验收。

记忆详情尺寸另核对同一本地官方源码的 `packages/client/ui-agent-preset/src/client/PresetGuideDialog.module.css`（阅读弹窗宽 `min(640px,100%)`）和 `packages/client/ui-primitives/src/DetailDocument.module.css`（正文高度上限 `min(560px,60vh)`），并核对公共 `Modal.tsx` 的 `className` 接口及标题、正文和关闭控件结构。本项目继续使用公共 Modal，仅读取上述尺寸作为自身详情宽度和滚动区的依据，不导入官方功能组件。

## 会话搜索弹窗的同类实现研究

[搜索弹窗](../src/features/search-popup/spec.md)实现前检索 dsh-market 会话搜索类条目并阅读以下参考，用于确认「接管原生搜索入口」没有现成公开实现、以及打开会话与挂载浮层的既有做法，没有复制代码、样式或图标：

| 参考仓库 | 提交 | 许可 | 参考内容 |
| --- | --- | --- | --- |
| [chopperH0824/dsh-session-search-bar](https://github.com/chopperH0824/dsh-session-search-bar/tree/3a97f96) | `3a97f96` | MIT | `conversation.header.leading` 常驻搜索栏、`shell.overlay` frame 级 overlay 席位、`uiWorkspace.openSession` 打开会话的调用方式 |
| [PluckSlugSorrow/dsh-session-history-search](https://github.com/PluckSlugSorrow/dsh-session-history-search/tree/068395a) | `068395a` | MIT | 侧栏独立面板入口与打开会话前的布局处理；其宿主侧 `sessionQuery` 扫描为另一数据源路线，本项目未采用 |

另核对 [awesome-dsh-plugin 目录](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)本机克隆中全部 142 个文件名含 search 的条目，`d0ublecl1ck/dsh-search-enhance`（工作区下拉搜索）、`umineko987/dsh-search-enhance`（联网搜索桥）与 `amd47802574/dsh-session-fulltext-search`（开启原生 FTS 后端）均不接管原生搜索按钮。原生接入依据为本机安装包 `dsh-client-ui-workspace@0.2.2-rc.3` 的只读核对（宽栏／窄栏搜索按钮的 `type="button"` 与 `workspace` 命名空间 `search.sessions.aria` aria 标记、`session.search` 快捷键注册）与官方仓库 `dsh-v0.2.0-rc.1`／`dsh-v0.2.2-rc.1` 标签的 `ui-layout` `shell.overlay` slot 声明、`api-session-controller` 客户端 `search` 契约。本项目自行实现事件路径识别、快捷键匹配与命令面板弹窗，没有复制参考实现。

面板布局依据用户提供的更新版本官方任务搜索截图对齐（顶部输入行、头部标签与工作区筛选、键帽提示与计数、行级「工作区 · 路径」与日期、官方空状态插画与文案、底部类型标签）。该面板在本机 `0.2.2-rc.3` 安装包、上游 `master`（0.2.2-rc.3 合并提交 `39163dd3`）与全部已发布标签中均不存在，仅按截图实现，未以该版本源码核对细节；官方行中的「Local」来源段依赖新版数据，当前版本不渲染。结果行按用户后续提供的双行搜索样式实现：第一行标题加行尾工作区名与日期，第二行命中摘要，查询词以成功色浅底高亮；未参考该样式来源的源码。

全文索引禁用（`SESSION_QUERY_SEARCH_DISABLED`）的降级说明依据官方仓库 `session-query-sqlite/src/index.ts` 的禁用错误与 [amd47802574/dsh-session-fulltext-search](https://github.com/amd47802574/dsh-session-fulltext-search/tree/main)（MIT，本机克隆无本地改动）的部署开关文档：该插件以 `openAt: first-search` 覆盖行与 CJK 子串回退层开启内容搜索，本项目仅据此向用户提示开启路径，未复制其实现。

「搜索增强」开关的宿主写入机制以本仓库[停用官方搜索](../src/features/search-blocking/spec.md)已验收的原生 `configEditor` 模式为依据；`session-query-sqlite` 默认条目（`path: ':memory:'`、`openAt: 'never'`）核对自官方仓库 `packages/bundle/base/cordis.patch.yml`。

2026-11-15 索引同步修复：当前没有可调用的 `cordis_inspect_list`，只读核对本机 `0.2.2-rc.3` 安装包的 `dsh-session-query-sqlite/lib/index.js` 与 `dsh-session-query/lib/index.js`。公开 `searchSessions` 在查询前执行内部同步，持久生成号仅随该同步更新，不能靠轮询数据库主动刷新；活跃会话使用连接私有临时表，另一个 SQLite 连接不能读取。故本插件通过公开查询触发同步，再只读持久缓存，并以公开 `listSessions`、`readSurface` 取得活跃会话当前消息作为覆盖。未调用私有方法、未修改宿主实现，也未将源码存在性视为真实 profile 验收或端到端性能证据。

同日真实 Host 性能测试确认每次同步、枚举和 `readSurface` 是主要开销，后续改为按需增量：已有 SQLite 只作为冷启动种子，用 `sessionPersistence.list` 的 revision 校验；正常热查询不再调用全局同步或目录枚举。`dsh-session` 公开 `session/event`、`session/created`、`session/disposed`、`Session.seq` 与 `Session.surface.contentGeneration/nodes` 支持消息追加与复杂替换失效；`observeSession` 的不可变切片与公开 `buildSessionEventSearchDocuments` 支持规范正文提取且避免重复深复制。观察租约始终释放，不调用已废弃的 `snapshotEvents`/`eventAt`，不读取私有临时表。宿主公开 API 缺失时退回原有公开读取；性能数据与范围见主 Spec，真实服务基准不等于页面计时。

## 第三方网页搜索参考（2026-11-16）

页面优化对照本地保留的 `@deepseek-ai/dsh-client-ui-settings-models@0.2.2-rc.1` 发行包及官方 `ModelsSection.module.css`、`EditorFooter.tsx`，复用模型页 720px 限宽、卡片、32px 字段与操作区规格。另核对公共 `Menu` 的 `className` 和 inline-flex 根包装，为自有添加菜单显式设为整行宽度。改编样式的 MIT 声明已保留在[第三方许可](third-party-notices.md)。本轮未提供 `cordis_inspect_list` 工具，接口以确切发行包为依据；不运行时导入内部组件，不覆盖宿主样式。

同时在运行中的 DSH `0.2.2-rc.3` 只读对照模型列表与编辑面板，核对名称／标签／状态点顺序、编辑标题、灰色内嵌区及右侧取消／保存布局；未提交模型配置。网页页的空搜索列表、本机获取行和整行添加入口已在深色主题实际展示，提供方编辑、窄屏与浅色主题仍需另验。

同日设置不可用排查：原生插件详情明确显示旧 `webSearchChain` 的字符串成员被新对象 schema 拒绝，Host 组件因此异常，Client 随后报告 `PD-SETTINGS-LOAD`。兼容 schema 同时接受字符串与实例对象，旧密钥读取和首次写入转换只使用已核对的凭据及 `configEditor` 接口。通过原生插件开关重载本地链接后，组件恢复运行，设置及原 Tavily 条目恢复；未手写 profile 或移除已有配置。

[第三方网页搜索](../src/features/web-search/spec.md)开发时核对了以下社区实现，仅用于理解接入方式，未复制代码：

- [`wlj521/dsh-ui-tweaks`](https://github.com/wlj521/dsh-ui-tweaks) `src/search.ts`：向 `ctx.web.registerSearchProvider` 注册单一 provider，引擎 id 与插件名同名以避免冲突，密钥经 `ctx.credentials.resolve` 解析、回落到进程环境。
- [`MochiNek0/dsh-web-search-free`](https://github.com/MochiNek0/dsh-web-search-free)：多引擎按序 fallback 的完整实现；每家 provider 自己映射字段，空结果**抛错而不是返回空数组**，否则会截断后续回退链——本模块沿用了这条约定。
- [`240xu/dsh-websearch`](https://github.com/240xu/dsh-websearch)：并发分发到多个引擎后按 URL 去重合并，与本模块的顺序回退是两种取舍。

接口依据仍来自本机安装包：`@deepseek-ai/dsh-web` 的 `registerSearchProvider` / `registerFetchProvider`、`WebSearchResult`、`WebFetchBody`（闭合联合，provider 自行解码 kind），以及 `@deepseek-ai/dsh-credentials` 的 `modifyRecord` / `describeRecord`。原生「插件 → 网页搜索」页通过 `web/listProviders` 列出注册项，因此第三方 provider 会出现在该页下拉中。

免费额度与端点的核对结果见[免费额度调研](web-search-free-tier-research-2026-11-16.md)。

同日测试失败排查：只读核对本机 `0.2.2-rc.3` 发行包中的 `dsh-http-proxy/src/install.ts`、`policy.ts` 与 `dsh/src/profile-boot.ts`，确认启动器依据启动环境快照安装 undici 全局代理 dispatcher，插件的 `fetch` 遵守该策略。DSH 内 Firecrawl 免密钥搜索在约 5 秒后返回 `ECONNRESET`，无 HTTP 状态；同机同参数（公开查询 `DeepSeek`、5 条结果）直连成功，Node 启用环境代理后复现同样连接重置。Tavily 同机请求另有 HTTP 429，不能把两家失败混为额度或密钥问题。当前仅完善安全诊断与超时，不改宿主 dispatcher、系统代理或用户网络配置，不据此声称 DSH 请求成功。
