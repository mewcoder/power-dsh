# DSH 市场插件调研（2026-11-12）

> 研究材料，不是功能 Spec。用于为 PowerDSH 下一轮功能增加提供同类插件参考与取舍依据。
>
> 数据口径：市场目录取自 [dshmarket.com/browse](https://dshmarket.com/browse/)；包清单取自 [dsh-plugin-catalog/index.json](https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json)；插件热度取自 [awesome-dsh-plugin](https://awesome-dsh-plugin.com/) 插件详情页（2026-11-12 实时抓取，显示 GitHub Stars 与近 30 天下载量）。热度只代表关注度，不代表质量、兼容性、安全性或许可证。

## 一、结论摘要

- 市场已经非常成熟：站点当前展示 **10,581 条目录条目、23 个分类**，索引 JSON 收录 **5,437 个独立包**。最大类目是 UI 增强（2,102）、工具与能力（1,450）、会话与消息（806）、工作流与自动化（636）、用量与计费（562）。
- PowerDSH 的差异化仍然成立：市场以“单点插件”为主，PowerDSH 是**一个安装项、设置页内统一管理、默认关闭、按需开启**的增强套件。下一步不宜追“大而全”的界面改造，而应把现有管理页补成 DSH 的轻量控制台。
- **关键修正：先看原生。** DSH 0.2.2 原生已经提供上下文 `ContextMeter`、Automation tasks 页、会话搜索、Markdown/ZIP 会话导出、文件树/终端/浏览器侧栏、模型与推理选择等。很多市场热门插件是在补原生缺口或做深度扩展，不能直接当成 PowerDSH 的机会。
- **真正的原生空位**：跨会话使用统计与费用/余额、任务通知的外部渠道、技能管理深度（导入/导出/诊断）、MCP 运维（探活/重连）。这些原生只提供底层服务或完全没有 UI，且 PowerDSH 已有对应模块，适合做深度增强。
- 按 P 级排序：
  - **P0（本轮直接做）**：**E 使用统计深度扩展**：费用估算 / 账户余额 / CSV 导出 / 按会话下钻；原生只有单会话统计，PowerDSH 已有跨会话聚合基础。
  - **P1（下一阶段）**：**D 通知 Webhook 渠道**（复用现有四类任务通知，先做单向出站）；**H 技能管理增强**（导入/导出/诊断）；**I MCP 连接诊断**（探活/重连）。
  - **P2（有余力再做）**：提示词库/输入历史、自动继续、归档回收站、会话 HTML/分享。
  - **P3（不做）**：上下文胶囊、定时任务页、会话全局搜索、工作区管理/打开目录、文件树/终端/浏览器/拖拽上传，以及侧边栏工作台、主题皮肤、桌宠、完整 IM、记忆、Provider、消息回退、配置备份——原生已有或与定位冲突。

## 二、市场全景

### 2.1 分类体量

站点分类与条目数（2026-11-12）：

| 类目 | 条目数 | 与 PowerDSH 的关系 |
| --- | ---: | --- |
| UI Enhancements | 2,102 | 最大类，但多为侧边栏/主题/桌宠/终端等重界面；只适合选轻量输入框与信息展示增强 |
| Tools & Capabilities | 1,450 | 工具包、MCP、搜索、数据库等；PowerDSH 已有 MCP 管理，可补探活 |
| Sessions & Messages | 806 | **重点机会**：搜索、导出、导入、历史、回收站 |
| Workflow & Automation | 636 | **重点机会**：定时任务、自动继续、任务板 |
| Development & Runtime | 608 | 运行时、开发工作台；不做 |
| Usage & Billing | 562 | **重点机会**：上下文、费用、余额、预算 |
| Models & Providers | 540 | 模型接入与 Provider；不做（凭据与路由风险） |
| Memory | 455 | 长期记忆；不做（数据模型与检索架构重） |
| Themes & Appearance | 387 | 皮肤与外观；已有壁纸，不做 |
| Skills | 380 | 技能包与管理；PowerDSH 已有技能管理，可补导入导出/诊断 |
| Notifications & Integrations | 355 | 通知、IM、邮件；已有桌面通知，可补 Webhook |
| Just for Fun | 351 | 桌宠、动画、游戏；不做 |
| Remote & Mobile | 306 | 手机/远程访问；不做 |
| Security & Permissions | 272 | 权限、审批、审计；不做（敏感） |
| Browser & Web | 218 | 浏览器/网页能力；不做 |
| Docs & Rendering | 199 | 文档与渲染；可选做代码块/预览，但非优先 |
| Vision & Multimodal | 195 | 视觉与多模态；不做 |
| Git & Code Review | 187 | Git 与评审；不做 |
| Voice & Audio | 141 | 语音；不做 |
| Plugin Markets & Managers | 140 | 市场与管理器；dsh-market 已绝对领先，不重复 |
| Identity & Communication | 131 | 身份与通信；不做 |
| WSL & Windows Interop | 87 | WSL/Windows 适配；不做 |
| AGI Architecture Exploration | 73 | 实验性架构；不做 |

### 2.2 热度参考（相关类目）

以下数字来自 awesome-dsh-plugin 插件详情页，2026-11-12：

| 插件 | 分类 | 热度 | 可参考点 |
| --- | --- | --- | --- |
| [dsh-context](https://awesome-dsh-plugin.com/p/bowenliang123/dsh-context/) | Usage | ★ 4,963 / ⬇ 459,383 | 上下文洞察页、`/context` 命令、Context 浏览器、压缩/注入事件、按会话拆解 |
| [dsh-cost-meter](https://awesome-dsh-plugin.com/p/Han-1413141/dsh-cost-meter/) | Usage | ★ 675 / ⬇ 149,903 | 会话/每日费用、预算、官方余额、峰谷计价、价格同步、历史看板 |
| [dsh-usage-stats](https://awesome-dsh-plugin.com/p/Ychris12138/dsh-usage-stats/) | Usage | ★ 188 / ⬇ 7,836 | 多供应商用量看板、按供应商/模型/日期下钻、账户余额 |
| [dsh-bottom-info-bar](https://awesome-dsh-plugin.com/p/songoao25/dsh-bottom-info-bar--plugin/) | UI | ★ 60 / ⬇ 34,797 | 底部信息栏：模型、余额、峰谷价、会话/今日/近一月花费 |
| [dsh-archive-manager](https://awesome-dsh-plugin.com/p/MichengAI/dsh-archive-manager/) | Session | ★ 336 / ⬇ 111,247 | 设置页归档会话：按工作区搜索、恢复、删除 |
| [dsh-chat-import](https://awesome-dsh-plugin.com/p/Nwflower/dsh-chat-import/) | Session | ★ 308 / ⬇ 17,452 | 从 13 家 coding agent 导入完整对话为可续聊会话 |
| [dsh-session-manager](https://awesome-dsh-plugin.com/p/hkkz9522/dsh-session-manager/) | Session | ★ 112 / ⬇ 15,726 | 删除/回收站、恢复归档、未读标记、分组排序、上下文压缩阈值 |
| [dsh-share](https://awesome-dsh-plugin.com/p/hellodigua/dsh-share/) | Session | ★ 43 / ⬇ 1,937 | 一键分享对话 |
| [dsh-session-flow](https://awesome-dsh-plugin.com/p/YeqingTang/dsh-session-flow/) | Session | ★ 7 / ⬇ 2,432 | 跨会话档案柜、折叠时间线、全文检索、ZIP 导出 |
| [dsh-history](https://awesome-dsh-plugin.com/p/chenproton/dsh-history/) | Session | ★ 14 / ⬇ 920 | 当前会话全部用户消息、搜索、复制、点击定位 |
| [dsh-automation](https://awesome-dsh-plugin.com/p/MichengAI/dsh-automation/) | Workflow | ★ 36 / ⬇ 42,157 | 设置页定时任务、独立会话执行、运行历史、暂停/恢复/立即运行 |
| [dsh-auto-continue](https://awesome-dsh-plugin.com/p/HsiangNianian/dsh-auto-continue/) | UI | ★ 191 / ⬇ 12,484 | 网络/超时/崩溃等非人为中断自动续跑，错误分类与退避 |
| [dsh-im](https://awesome-dsh-plugin.com/p/xmanrui/dsh-im/) | Notify | ★ 3,118 / ⬇ 129,060 | 飞书/微信/钉钉/企微/QQ/Slack/Telegram/Discord/WhatsApp 九渠道双向机器人 |
| [dsh-im-connect](https://awesome-dsh-plugin.com/p/MichengAI/dsh-im-connect/) | Notify | ★ 118 / ⬇ 67,015 | 多 IM 渠道接入，每个聊天对应独立工作区频道 |
| [dsh-notifier](https://awesome-dsh-plugin.com/p/THEWOLFWALKER/dsh-notifier/) | Notify | ★ 59 / ⬇ 2,262 | 28 个出站渠道、6 条入站控制通道、通知与控制 UI |
| [dsh-prompt-history](https://awesome-dsh-plugin.com/p/Xiaofei-fei/dsh-prompt-history/) | UI | ★ 11 / ⬇ 11,576 | 输入框 ↑/↓ 历史、Ctrl+R、补全、选中工具栏、右键粘贴 |
| [dsh-composer-history](https://awesome-dsh-plugin.com/p/PerryLink/dsh-composer-history/) | UI | ★ 18 / ⬇ 3,062 | 终端式输入历史、草稿/光标还原、`/save`/`/load` 片段库 |
| [dsh-prompt-market](https://awesome-dsh-plugin.com/p/yi-yezhiqiu/dsh-prompt-market/) | UI | ★ 111 / ⬇ 970 | 对话旁提示词市场：在线源、收藏、自建、选中插入 |
| [dsh-skill-hub](https://awesome-dsh-plugin.com/p/cheshireez/dsh-skill-hub/) | Skills | ★ 38 / ⬇ 8,673 | 技能浏览/搜索/启停/诊断/新建，附技能市场 |
| [dsh-mcp-panel](https://awesome-dsh-plugin.com/p/PerryLink/dsh-mcp-panel/) | Dev | ★ 90 / ⬇ 10,014 | MCP 只读运行时面板：连接状态、工具、错误、重连计数、脱敏 |
| [dsh-config-manager](https://awesome-dsh-plugin.com/p/xiajiajun516/dsh-config-manager/) | Tools | ★ 287 / ⬇ 28,805 | 整套 DSH 配置备份/导出/导入、密钥默认不导出、预览与回滚 |
| [dsh-at-file](https://awesome-dsh-plugin.com/p/FSMargoo/dsh-at-file/) | UI | ★ 568 | `@file` 文件引用；README 已注明官方新版已内置 `@file`/`@session`，不再推荐新建 |
| [dsh-better-sidebar](https://awesome-dsh-plugin.com/p/omdsh-dev/DSH-better-sidebar/) | UI | ★ 5,092 / ⬇ 317,535 | 侧边栏工作台（文件、终端、Git、子代理）；重 UI，不建议跟进 |
| [dsh-TUI](https://awesome-dsh-plugin.com/p/ccch1mneyyy/dsh-TUI/) | UI | ★ 7,530 / ⬇ 72,782 | 全屏终端 UI；与桌面设置套件定位不同 |
| [OpenViking 记忆插件](https://awesome-dsh-plugin.com/p/volcengine/OpenViking--examples-dsh-memory-plugin/) | Memory | ★ 41,884 / ⬇ 45,401 | 长期记忆与上下文召回；架构重，不建议作为下一个功能 |

### 2.3 市场趋势判断

1. **从单点改造走向工作台**：`dsh-better-sidebar`（5,092★ / 317,535 次下载）和 `dsh-TUI`（7,530★）证明用户愿意为完整工作台付费/使用，但这与 PowerDSH“设置页增强、低常驻负担”的定位不同。
2. **可观测性成为刚需**：`dsh-context` 以 4,963★ / 459,383 次下载位列非市场类插件头部，`dsh-cost-meter` 149,903 次下载；上下文、费用、余额、预算已经从“附加信息”变成主需求。
3. **会话数据正在资产化**：归档、导入、导出、搜索、回退、分享、回收站都有成熟插件；PowerDSH 已有归档和会话日志读取能力，具备低成本延展条件。
4. **自动化从“聊天”走向“计划任务”**：`dsh-automation` 42,157 次下载，`dsh-auto-continue` 12,484 次下载；用户希望 DSH 在无人值守时继续工作。
5. **通知正在向 IM 与远程控制演进**：`dsh-im` 3,118★ / 129,060 次下载，`dsh-notifier` 覆盖 28 个出站渠道；但完整双向机器人涉及配对、权限、消息协议，PowerDSH 只适合先做单向 Webhook 子集。
6. **插件市场自身已成熟**：`dsh-market` 10,295★ / 1,176,287 次下载，具备分类、收藏、分组、备注、备份恢复、更新 API、热停用与启动恢复。PowerDSH 不应重复市场能力，只保留“本插件更新”入口即可。

### 2.4 先看宿主：原生 DSH 已覆盖的能力

只看市场会误判机会。当前 desktop profile 的 209 个插件条目和官方 `0.2.2-rc.1` 源码显示，DSH 原生已经覆盖了大量热门市场插件的能力：

| 原生能力 | 原生模块 / 位置 | 对功能判断的影响 |
| --- | --- | --- |
| 定时任务 / 自动化 | `ui-schedule`：Automation tasks 侧栏页、任务编辑器、执行记录、Session 头部时钟与行标记 | `dsh-automation` 等是在原生之上的增量；PowerDSH 不应重做 |
| 会话导出 | `session-log-export`：Session 头部「Copy Session as Markdown」「Download session log」（ZIP，含子会话与附件）、`/export` 命令 | 普通导出已有；只剩 HTML/可分享格式等窄增量 |
| 会话搜索 | `ui-workspace`：标题、工作区、Session id 匹配 + 250ms 防抖的当前会话内容片段 | 全局搜索已有基础；不应把“能搜会话”当作空白 |
| 文件浏览 / 上传 / 拖拽 | `ui-sidebar-files`、`ui-sidebar-terminal`、`ui-sidebar-browser`、`file-upload`、`ui-file-drag`、`ui-file-actions`、`ui-open-in-app` | 不做文件树、终端、浏览器、拖拽上传 |
| 模型与推理选择 | `ui-model-selection`：模型弹窗 + composer 模型座位 + 推理等级 | PowerDSH 的快捷切换只是操作捷径，不是模型选择能力缺口 |
| 上下文占用 | `ui-conversation` 的 `ContextMeter`：环形百分比 + 点击展开系统提示词/工具定义/对话消息 | 上下文胶囊已是原生；重复实现没有价值 |
| 会话级统计 | `session-stats` 投影与 composer 统计 pill | 缺的是跨会话历史汇总，不是单会话读数 |
| 插件发现 / 清单 | `ui-plugin-market` Discover、`ui-settings-plugin-inventory` | 不做插件市场或插件清单 |
| 技能调用 | `ui-skill`：`/name` 技能选择、技能调用卡 | 已有调用，缺的是管理页（浏览/启停/编辑/导入） |
| 全局指令加载 | `agent-instructions`：自动加载 `AGENTS.md`/`CLAUDE.md` 链 | 已有读取，缺的是可视化编辑入口 |
| 工作区管理 | `ui-workspace`：新建、重命名、排序、搜索、归档、删除工作区 | PowerDSH 的工作区管理页增量有限，需重新评估 |
| 任务通知 | 原生只有账号通知，没有任务完成/失败/审批的桌面通知与外部渠道 | 这是 PowerDSH 的既有差异点，可继续深化 |
| 自定义壁纸 / 外观 | 原生主题 token 与外观设置，无自定义壁纸 | 这是 PowerDSH 的既有差异点 |
| 插件更新 | `ui-plugin-market` Discover 只显示可用更新状态，没有升级动作 | PowerDSH 的市场更新入口是真实补位 |

结论：**市场热度和“原生缺口”不是一回事。** 很多热门插件是在原生之前出现、或只做很小的增量；PowerDSH 的下一批功能应当优先落在原生没有的“管理面”，而不是重复原生 UI。

## 三、PowerDSH 现状对照

| 市场方向 | 代表插件与热度 | PowerDSH 现状 | 判断 |
| --- | --- | --- | --- |
| 上下文/用量 | dsh-context ★4,963 / ⬇459,383；dsh-cost-meter ★675 / ⬇149,903 | 已有「使用统计」：Token、缓存、时长、53 周热力图、趋势、模型占比 | **补强首选**：增加上下文占用、费用/余额、导出与按会话下钻 |
| 归档/会话 | dsh-archive-manager ★336 / ⬇111,247；dsh-chat-import ★308 / ⬇17,452；dsh-session-manager ★112 / ⬇15,726 | 已有「归档」：工作区分组、搜索、排序、恢复、永久删除、自动归档 | **补强首选**：全局会话搜索、导出、回收站 |
| 通知 | dsh-im ★3,118 / ⬇129,060；dsh-notifier ★59 / ⬇2,262 | 已有「任务通知」：完成/出错/等待输入/审批，声音、测试、原生 Toast | **可扩展**：Webhook/IM 单向通知；不做完整机器人 |
| 自动化 | dsh-automation ★36 / ⬇42,157；dsh-auto-continue ★191 / ⬇12,484 | 无 | **新功能机会** |
| 技能 | dsh-skill-hub ★38 / ⬇8,673；多个 skill manager | 已有「技能管理」：全局/工作区、启停、详情 Markdown | **可补**：导入/导出、文件树、诊断 |
| MCP | dsh-mcp-panel ★90 / ⬇10,014 | 已有「MCP 管理」：列表、启停、详情、工具列表 | **可补**：连接测试、重连、探活 |
| 全局指令 | 少量同类 | 已有「全局指令」编辑 | 保持 |
| 工作区 | dsh-workspace-explorer ★52 / ⬇1,681；dsh-open-in-vscode ★53 | 已有「工作区管理」：列表、搜索、排序、移除登记 | **可补**：打开目录/文件管理器 |
| 提示词 | dsh-prompt-history ★11 / ⬇11,576；dsh-composer-history ★18 / ⬇3,062 | 无 | **新功能机会** |
| 配置备份 | dsh-config-manager ★287 / ⬇28,805；dsh-market 自带备份恢复 | 无（仅插件更新） | **不建议重复**：市场已覆盖整套 profile |
| 主题/外观 | 大量主题、壁纸、皮肤 | 已有「自定义壁纸」 | 不做，市场拥挤 |
| 侧边栏/工作台 | dsh-better-sidebar ★5,092 / ⬇317,535 | 无 | 不做，重 UI 且与定位冲突 |

## 四、重新定级：先扣掉原生，再看市场

### 4.0 结论

初稿把“市场有同类插件”当成了“PowerDSH 有机会”，但真实顺序应当是：

1. **原生 DSH 有没有？** 有就不做（ContextMeter、定时任务、会话导出、会话搜索、文件树、模型选择等）。
2. **原生没有、市场是否已经很强？** 强就不正面做（上下文洞察、IM、主题、记忆、配置备份）。
3. **原生没有、市场也只是一些弱增量，且与 PowerDSH 既有模块重合？** 这才是 PowerDSH 的机会（使用统计深度、通知渠道、技能/MCP 管理深度）。

### 4.1 P 级总表

| P 级 | 功能 | 成本 | 原生状态 | 判断 |
| --- | --- | --- | --- | --- |
| **P0** | E 使用统计深度扩展：费用估算 / 账户余额 / 导出 / 按会话下钻 | M-L | 原生只有单会话统计，没有全量历史、费用、余额 | PowerDSH 已有使用统计页，这是最自然的深度增强 |
| **P1** | D 通知 Webhook 渠道 | M | 原生只有账号通知，没有任务完成/失败/审批的外部渠道 | PowerDSH 已有四类任务通知，接外部渠道最顺 |
| **P1** | H 技能管理增强：导入 / 导出 / 诊断 | M | 原生只有 `/name` 技能调用，没有管理页 | PowerDSH 已有技能管理页，补管理深度 |
| **P1** | I MCP 连接诊断：探活 / 重连 / 脱敏错误 | S-M | 原生有 `mcpManager` 服务，没有管理界面 | PowerDSH 已有 MCP 页，补运维能力 |
| **P2** | F 提示词库与输入历史 | M | 原生没有持久化输入历史/片段库 | 纯客户端，适合后续做 |
| **P2** | G 自动继续 | M | 原生只有手动「继续生成」，没有自动续跑 | 高风险，必须硬上限 |
| **P2** | K 归档回收站 / 批量清理 | M | 原生可归档但无 Session 删除 | 适合补在现有归档模块 |
| **P2** | B 会话可读分享：HTML / 分享链接 | M | 原生已有 Markdown 复制 + ZIP 导出 | 只剩分享形态，增量有限 |
| **P3** | 上下文胶囊 / 上下文洞察页 | — | 原生 `ContextMeter` 已提供百分比与三类构成；dsh-context 已占深水区 | 重复建设，不做 |
| **P3** | 定时任务页 | — | 原生 `ui-schedule` 已有完整 Automation tasks 页、编辑器和执行记录 | 不做 |
| **P3** | 会话全局搜索 | — | 原生 `ui-workspace` 搜索已覆盖标题/工作区/id/内容片段 | 不做 |
| **P3** | 工作区管理 / 打开目录 | — | 原生 `ui-workspace` + `ui-open-in-app` 已覆盖 | 增量太小 |
| **P3** | 文件树 / 终端 / 浏览器 / 拖拽上传 | — | 原生 `ui-sidebar-*`、`file-upload`、`ui-file-drag` 已覆盖 | 不做 |

### 4.2 P0：使用统计深度扩展

- **参考**：[dsh-cost-meter](https://awesome-dsh-plugin.com/p/Han-1413141/dsh-cost-meter/)（★675 / ⬇149,903）、[dsh-usage-stats](https://awesome-dsh-plugin.com/p/Ychris12138/dsh-usage-stats/)（★188 / ⬇7,836）、[dsh-bottom-info-bar](https://awesome-dsh-plugin.com/p/songoao25/dsh-bottom-info-bar--plugin/)（★60 / ⬇34,797）。
- **原生空位**：原生 `session-stats` 只给当前会话的 composer 读数；没有跨会话、跨模型、跨日期的历史看板，也没有费用、预算、账户余额与导出。
- **建议形态**：复用现有「使用统计」页，增加三个独立可选项：`费用估算`（模型单价 + 缓存/峰谷，明确标注“估算”）、`账户余额`（仅官方登录可用）、`导出 CSV`；并增加「按会话」列表，可下钻查看每个会话的 Token/费用/活跃时间。默认全部关闭，不改变现有统计口径。
- **实现要点**：复用 [usage-stats](../src/features/usage-stats/spec.md) 的 Host 日志聚合；费用需维护带版本/日期的本地价格表；余额通过 `deepseekAccount.getBalance`；按会话下钻复用 `sessionPersistence` 已读聚合；导出由 Client 生成 CSV。
- **成本/风险**：M-L。价格变动、峰谷与缓存计价差异、第三方 Provider 无价格数据；必须避免让用户把估算当账单。
- **推荐指数**：★★★★☆

### 4.3 P1：通知、技能、MCP 的深度增强

#### D. 通知 Webhook 渠道

- **参考**：[dsh-notifier](https://awesome-dsh-plugin.com/p/THEWOLFWALKER/dsh-notifier/)（★59 / ⬇2,262）、[dsh-suite plugin-notify](https://awesome-dsh-plugin.com/p/whyihaveyou/dsh-suite--packages-plugins-plugin-notify/)（★42）、[dsh-im](https://awesome-dsh-plugin.com/p/xmanrui/dsh-im/)（★3,118 / ⬇129,060，仅参考事件模型）。
- **建议形态**：在现有「任务通知」下增加「Webhook 通知」开关与渠道管理：飞书/企业微信/钉钉/Slack/自定义 URL，选择事件（完成/出错/等待输入/审批），提供测试发送。首期只做单向出站，不做完整 IM 机器人。
- **实现要点**：复用 `notifications` 的四类事件源；Host 用 `fetch` 发送 JSON；URL 和 secret 使用宿主 credentials，不写日志；失败只影响该渠道。
- **成本/风险**：M。密钥、网络失败、渠道限流；文案要明确“已提交请求”而非“已送达”。
- **推荐指数**：★★★★☆

#### H. 技能管理增强

- **参考**：[dsh-skill-hub](https://awesome-dsh-plugin.com/p/cheshireez/dsh-skill-hub/)（★38 / ⬇8,673）、[AKS1st/dsh-skill-manager](https://github.com/AKS1st/dsh-skill-manager)、[YTxue/dsh-skill-manager-ytxue](https://github.com/YTxue/dsh-skill-manager-ytxue)。
- **原生空位**：原生只有 `/name` 技能调用与技能卡，没有管理页；PowerDSH 已有技能管理，但没有导入/导出/诊断。
- **建议形态**：现有技能页增加 zip/文件夹导入、导出、文件树查看/编辑、重名与无效 frontmatter 诊断；共享/系统技能保持只读。
- **实现要点**：`skills` 服务用于读取；写入走文件系统并做路径、重名与大小校验；不修改共享技能文件。
- **成本/风险**：M。路径校验、只读保护、重名冲突。

#### I. MCP 连接诊断

- **参考**：[dsh-mcp-panel](https://awesome-dsh-plugin.com/p/PerryLink/dsh-mcp-panel/)（★90 / ⬇10,014）。
- **原生空位**：原生 `mcpManager` 有 `probe`/`restart` 服务，但没有设置页管理界面；PowerDSH 已有 MCP 列表，可补运维能力。
- **建议形态**：现有 MCP 服务器卡片增加「测试连接」「重连」，显示阶段、耗时与脱敏错误；不修改服务器配置。
- **实现要点**：注入 `mcpManager`，调用 `probe(name)`/`restart(name)`；超时、凭据缺失、连接失败分类展示。
- **成本/风险**：S-M。避免泄漏密钥、命令、URL 路径；探针不得影响已连接实例。

### 4.4 P2：后续可选

| 功能 | 参考 | 说明 |
| --- | --- | --- |
| 提示词库与输入历史 | [dsh-prompt-history](https://awesome-dsh-plugin.com/p/Xiaofei-fei/dsh-prompt-history/)（★11 / ⬇11,576）、[dsh-composer-history](https://awesome-dsh-plugin.com/p/PerryLink/dsh-composer-history/)（★18 / ⬇3,062） | 纯 Client、本地存储；快捷键与输入法兼容是主要风险 |
| 自动继续 | [dsh-auto-continue](https://awesome-dsh-plugin.com/p/HsiangNianian/dsh-auto-continue/)（★191 / ⬇12,484） | 只处理非人为中断；必须设次数与错误分类硬上限 |
| 归档回收站 | [dsh-session-manager](https://awesome-dsh-plugin.com/p/hkkz9522/dsh-session-manager/)（★112 / ⬇15,726） | 原生无 Session 删除，补可恢复删除与批量清理 |
| 会话 HTML / 分享链接 | [dsh-share](https://awesome-dsh-plugin.com/p/hellodigua/dsh-share/)（★43 / ⬇1,937） | 原生已有 Markdown 复制和 ZIP，只做增量分享 |

### 4.5 P3：不做或不再重复

| 方向 | 原因 |
| --- | --- |
| 上下文胶囊 / 上下文洞察页 | 原生 `ContextMeter` 已覆盖基础读数；`dsh-context` 已覆盖深度洞察，正面竞争成本高 |
| 定时任务 / 自动化页 | 原生 `ui-schedule` 已覆盖完整任务编辑、执行记录与提醒 |
| 会话搜索 / 文件树 / 终端 / 浏览器 / 拖拽上传 | 原生 `ui-workspace`、`ui-sidebar-*`、`file-upload`、`ui-file-drag` 已覆盖 |
| 插件市场 / 插件清单 | 原生 `ui-plugin-market`、`ui-settings-plugin-inventory` 已覆盖；dsh-market 已领先 |
| 主题皮肤 / 桌宠 / 完整 IM / 记忆 / Provider / 消息回退 / 配置备份 | 与 PowerDSH 克制定位冲突或维护成本过高 |

## 五、功能路径与 UI（P0/P1）

### 5.1 功能路径总览

```text
设置 → PowerDSH → 管理 → 使用统计
  → 右上「统计选项」→ 勾选费用估算 / 账户余额 / 导出
  → 三卡 + 费用卡 + 余额卡 → 导出 CSV
  → 按会话列表 → 点击会话查看明细

设置 → PowerDSH → 通用 → 任务通知
  → 打开「Webhook 通知」→ 管理渠道 → 添加渠道 → 测试 → 保存

设置 → PowerDSH → 管理 → 技能管理
  → 技能详情 → 导入 / 导出 / 诊断

设置 → PowerDSH → 管理 → MCP 管理
  → 服务器卡片 → 测试连接 / 重连
```

### 5.2 使用统计扩展

```text
使用统计                                          [统计选项 ▾] [刷新]
查看 Token 用量
[今天 | 本周 | 本月 | 全部 | 自定义]                          [导出 CSV]
┌ 总 Token ┐ ┌ 缓存 Token ┐ ┌ 会话 ┐
│ 1.2M     │ │ 860K  72%  │ │ 12   │
└──────────┘ └────────────┘ └──────┘
┌ 费用估算（可选） ─────────────┐ ┌ 账户余额（可选） ──────────┐
│ 今日 ¥3.42   本月 ¥28.10      │ │ ¥68.00   更新于 14:32       │
│ 按当前价格表估算，非账单      │ │ 官方账户                    │
└───────────────────────────────┘ └─────────────────────────────┘
[Token 热力图]
[Token 趋势图]
[模型用量]
[按会话用量]  会话 / Token / 费用 / 活跃时间 / [查看]
```

统计选项菜单：

```text
┌ 统计选项 ───────────────────┐
│ [x] 显示费用估算             │
│ [x] 显示账户余额             │
│ [x] 显示导出按钮             │
└──────────────────────────────┘
```

### 5.3 通知 Webhook 渠道

```text
PowerDSH / 通用
┌──────────────────────────────────────────────────────────────┐
│ 任务通知                                [仅在未聚焦时提醒 ▾]│
│ 任务完成、失败或需要确认时发送桌面通知                        │
│                                                              │
│ 通知声音                                            [●────]  │
│ 提示音                                [系统默认 ▾]   [▶]    │
│                                                              │
│ Webhook 通知                                        [●────]  │
│ 向飞书 / 企微 / 钉钉 / Slack 或自定义地址推送通知             │
│ 通知渠道                                      [管理渠道]    │
└──────────────────────────────────────────────────────────────┘

┌─ 通知渠道 ────────────────────────────────────────────────┐
│ [+ 添加渠道]                                              │
│ ┌ 飞书机器人 ───────────────────────────────── 已启用 ┐    │
│ │ URL   https://open.feishu.cn/open-apis/bot/v2/...    │    │
│ │ 事件  完成 / 出错 / 等待输入                          │    │
│ │                            [测试] [编辑] [删除]      │    │
│ └──────────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

### 5.4 技能与 MCP 增强

```text
设置 → PowerDSH → 管理 → 技能管理
┌ 技能详情：code-review ───────────────────────────┐
│ 来源：用户 .dsh        [导入] [导出] [诊断]     │
│ 文件：SKILL.md / references/                    │
└─────────────────────────────────────────────────┘

设置 → PowerDSH → 管理 → MCP 管理
┌ browser ─────────────────────────────── 已连接 ┐
│ 工具 3 个   [测试连接] [重连] [详情]          │
└─────────────────────────────────────────────────┘
```

### 5.5 P2 功能路径

| 功能 | 路径 |
| --- | --- |
| 提示词库/历史 | 设置 → PowerDSH → 管理 → 提示词；输入框左侧 `+` 插入，`↑/↓` 历史 |
| 自动继续 | 设置 → PowerDSH → 通用 → 自动继续；会话状态条显示 `自动继续 2/3` |
| 归档回收站 | 设置 → PowerDSH → 管理 → 归档 → 回收站 Tab |
| 会话 HTML/分享 | 设置 → PowerDSH → 管理 → 归档/会话详情 → 分享 |

## 六、建议路线

### 方案一：先做「使用统计深度」（推荐）

组合：**E 使用统计扩展**。理由：原生只有单会话统计，PowerDSH 已有跨会话聚合基础；`dsh-cost-meter` 149,903 次下载验证需求，但 PowerDSH 不需要做完整费用工作台，只做“费用估算 + 余额 + CSV + 按会话下钻”即可。

### 方案二：通知外部渠道

组合：**D 通知 Webhook**。理由：PowerDSH 已有四类任务通知，原生没有外部渠道；先做单向通知，避免完整 IM 的协议与安全成本。

### 方案三：管理模块深度增强

组合：**H 技能增强 + I MCP 诊断**。理由：原生只有调用与底层服务，PowerDSH 已有管理页；这是低成本、低风险的“把现有功能做完整”。

## 七、参考实现约束（来自当前宿主 Inspect）

| 能力 | 当前宿主服务 / Slot | 用途 |
| --- | --- | --- |
| 用量与会话日志 | `sessionPersistence`、`sessionQuery.listSessions/readSession` | 使用统计、按会话下钻、费用计算 |
| 账户余额 | `deepseekAccount.getBalance(client)` | 使用统计余额（需官方登录） |
| 通知事件 | 现有 `notifications` 模块的完成/出错/等待输入/审批订阅 | Webhook 复用 |
| 技能管理 | `skills` 服务 + 文件系统 | 导入/导出/诊断 |
| MCP 探活 | `mcpManager.probe(name)`、`restart(name)`、`watch(signal)` | MCP 连接测试/重连 |
| 原生上下文胶囊 | `ui-conversation` 的 `ContextMeter`，读取 `contextPressure` / `contextBreakdown` | 直接使用，不重复实现 |
| 原生定时任务 | `ui-schedule` + `schedule` 服务 | 直接使用，不重复实现 |
| 原生会话导出 | `session-log-export`：Markdown 复制 + ZIP + `/export` | 不重复实现基础导出 |
| 原生搜索 | `ui-workspace` 侧栏搜索 | 不重复实现标题/内容基础搜索 |

## 八、下一步建议

1. 从 P0「使用统计深度」开始：先写主 Spec，明确费用估算、余额、CSV、按会话下钻的边界；不把估算当账单。
2. 再评估 P1 的通知 Webhook 与技能/MCP 管理增强；三者都复用现有模块，不引入新常驻入口。
3. 不实现上下文胶囊、定时任务页、会话搜索、文件树等原生已有能力；这些从候选池移除。
4. 按仓库流程浅克隆参考仓库、记录第三方声明、写测试与验收；实现前先核对目标宿主版本的原生能力。

---

*本报告是 2026-11-12 的调研记录；P 级结论以本节“先扣掉原生”后的判断为准。*
