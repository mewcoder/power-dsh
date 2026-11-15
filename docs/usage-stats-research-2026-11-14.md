# 使用统计指标扩展研究（2026-11-14）

> 研究材料，不是功能 Spec。依据用户提供的两张 magpie「观测 / 用量」页面截图、本机 magpie 源码（`yetone/magpie`，提交 `52c9880cbbfa5757ebcd1d8a66509b92a294edc8`）与 power-dsh 当前实现。用于下一轮指标取舍，不构成实现授权。

> **实现状态更新（2026-11-14）**：用户已确认先落地请求质量与输出速度 / 首字延迟，并按模型展示请求质量，当前范围与行为见[使用统计主 Spec](../src/features/usage-stats/spec.md)。本文其余 P1 / P2 内容仍为研究建议，不构成实现授权。

## 〇、结论

**值得加，但不应照搬参考页。** 参考页是模型网关的全局观测台，power-dsh 是本机 DSH 会话日志的只读分析页。两者都能回答「用了多少」，但参考页强在费用、账户、网关流量，我们强在会话、工作区、轮次和上下文结构。按价值与数据可得性，建议分三批：

- **P0（优先做）**：请求数、失败 / 重试 / 取消与成功率；输出速度（token/s）与首字延迟（TTFT）；模型用量列表升级为「模型性能表」；把已经算出但未显示的活跃天数、峰值、连续天数、最长会话上屏。
- **P1（值得做）**：按工作区筛选与排行；会话 Token 分布（中位数 / p90）与最耗会话 Top N。
- **P2（有余力再做）**：CSV 导出、趋势图指标切换、星期 × 小时活动热力图。
- **不做**：费用 / 余额、上下行流量、图片文件大小、账户 / 密钥筛选、逐请求明细表。费用是参考页最显眼、但最不可直接复用的指标：magpie 自己也有 5,719 次调用未计价，DSH 日志只有 `TokenUsage`，没有价格、账户和账单字段，强行估算会误导。

上述 P0 / P1 指标全部能从事先已经读取的 `sessionPersistence` 事件中推导，不需要新增采集、网络请求或权限；TTFT 与速度的口径可直接对齐宿主 `sessionStats` 投影。

## 一、参考页拆解

### 1.1 「请求」页

- 顶部时间范围：今天、24 小时、7 天、30 天、全部、自定义。
- 筛选：Agent、用途、供应商、模型、账户、失败、重试后成功；搜索和导出 CSV。
- 五张摘要卡：Token、请求、费用、缓存命中率、输出速度。
  - 请求卡显示失败数、成功率、重试后成功数、取消数、网络上下行、图片文件大小。
  - 速度卡显示平均 token/s、首字平均耗时、采样请求数。
- 按日堆叠柱状图：Token，支持切换费用 / 请求 / 速度 / 流量，按模型 / 供应商 / Agent 拆分。
- 右侧模型排行：Token、费用、请求数、速度、首字延迟、失败数；下方另有「模型速度」表（速度、首字耗时、请求数）。

### 1.2 「会话」页

- 顶部筛选：Agent、模型、文件夹；时间范围：今天、7 天、30 天、90 天、全部。
- 六张摘要卡：会话数（中位数 / p90 Token）、Token、费用、缓存读取（命中率）、活跃时长、项目数。
- 每日趋势：Token / 输出 Token / 消息 / 会话 / 费用 / 活跃，可切换指标。
- 项目排行、模型排行，均带 Token 与费用。
- 星期 × 小时活动热力图，标注「最忙：周二 15:00」。
- 最耗会话列表，可按 Token / 费用 / 活跃排序。

### 1.3 它实际回答的四类问题

| 层次 | 参考页代表指标 | 回答的问题 |
| --- | --- | --- |
| 规模 | Token、输入 / 输出、请求数、费用 | 用了多少、贵不贵 |
| 效率 | 缓存命中率、输出速度、首字延迟 | 快不快、缓存有没有生效 |
| 质量 | 失败、重试、成功、取消 | 调用稳不稳、异常多不多 |
| 分布 | 模型、项目、会话、时段 | 花在谁身上、什么时候花 |

## 二、现状对照

当前页面见 [使用统计主 Spec](../src/features/usage-stats/spec.md)：

- 三张摘要卡：总 Token（输入、输出）、缓存 Token（缓存率）、会话（累计运行时长）。
- 模型用量列表：Token、占比、悬浮显示请求次数。
- 53 周按日 Token 热力图。
- 按模型的每日 Token 趋势（近 7 / 30 日）。

### 2.1 差距表

| 指标 / 数据 | 参考页 | power-dsh 当前 | 数据条件 | 判断 |
| --- | --- | --- | --- | --- |
| 总 Token、输入、输出 | 有 | 有 | 已有 | 保留 |
| 缓存 Token、缓存率 | 有 | 有 | 已有 | 保留 |
| 请求数 | 有 | 已计算但未显示；`usageRequestCount` 文案未被使用 | 已有 `requestCount`，但只统计有非零用量的结算 | P0 修正并上屏 |
| 失败、重试、取消、成功率 | 有 | 无 | `assistant/attempt`、`llm/retry`、`turn/end` 可推导 | P0 |
| 输出速度、首字延迟 | 有 | 无 | `assistant/message.stream` 的 token 时间可推导 | P0 |
| 模型排行 | 有 | 只有 Token、占比，请求数在悬浮里 | 已有模型聚合 | P0 升级为性能表 |
| 会话数 | 有 | 有 | 已有 | 保留 |
| 活跃时长 | 有 | 有，但口径是已完成步骤的运行时间，不等于会话墙钟时间 | 已有 | 保留并说明口径 |
| 会话 Token 中位数 / p90 | 有 | 无 | 按会话折叠后可算 | P1 |
| 工作区 / 项目拆分 | 有 | 无 | `header.cwd` 已在 `sessionPersistence.list()` 中返回 | P1 |
| 最耗会话 | 有 | 无 | 需要每会话 Token 与标题；`session/title` 事件可读 | P1 |
| 上下文占用 | 参考页有独立「上下文」页 | 无 | `request/context.contextWindow` 与每次用量可推导 | P2 |
| 星期 × 小时热力图 | 有 | 只有按日 53 周 | 事件时间可推导 | P2 |
| CSV 导出 | 有 | 无 | 客户端可由快照生成 | P2 |
| 费用 | 有 | 无 | 日志没有价格字段 | 不做 |
| 上下行流量、图片大小 | 有 | 无 | 日志没有字节统计 | 不做 |
| 账户 / 密钥筛选 | 有 | 无 | DSH 没有多账户模型 | 不做 |
| 逐请求明细表 | 有 | 无 | 需要保留逐请求事件或另行落盘 | 不做 |

### 2.2 已经算出但没显示的数据

当前 `UsageSummary` 已经包含 `peakDayTokens`、`longestSessionMs`、`currentStreakDays`、`longestStreakDays`、`activeDays`、`turnCount`；`UsageDayRow` 已经包含 `turnCount`、`toolCallCount`、`requestCount`。这些字段目前没有进入页面，属于零采集成本的补强：

- 热力图卡片下方加一行：`活跃 12 天 · 当前连续 3 天 · 峰值 1.2 亿`。
- 「会话」卡详情：`N 个会话 · N 轮 · N 次工具调用 · 累计 N 小时`。
- 最长会话、当前 / 最长连续天数放进 Tooltip 或摘要行。

### 2.3 需要先修正的现有口径

- `UsageDayRow.requestCount` 的注释写的是「包括没有用量的 assistant 消息」，但 [usage-fold.ts](../src/features/usage-stats/usage-fold.ts) 在 `flushSlot()` 中对 `totalTokens === 0` 直接返回，实际只统计有非零用量的结算。若直接把它标成「请求」，会漏掉失败尝试与零用量请求。
- `summary.turnCount` 与 `UsageDayRow.turnCount` 已累计但无消费方；`UsageDayRow.toolCallCount` 同样如此。
- 参考页的「请求」是网关请求尝试，我们的 `requestCount` 是「计费结算样本」。两者不能共用同一个名字；展示时应明确「请求尝试」和「计费用量」两个口径。

## 三、P0：优先补的四项

### 3.1 请求质量：请求数、失败、重试、取消、成功率

**为什么值得做**：参考页用一整张卡说明「失败 134、成功率 99.5%、重试成功 208、取消 183」；这是判断模型 / 网络是否稳定的第一信息。当前 power-dsh 只有 Token，异常时用户看不出「贵是因为重试」还是「正常用量」。

**数据来源**：

| 指标 | 事件 / 字段 | 说明 |
| --- | --- | --- |
| 请求尝试数 | `assistant/message` + `assistant/attempt` | 每次模型结算算一次；失败尝试也计入 |
| 成功数 | `assistant/message` 且 `interrupted !== true` | 有可见消息的结算 |
| 失败尝试数 | `assistant/attempt` | 包括重试前失败、流错误、取消等无消息结算 |
| 重试次数 | `llm/retry` | 可按 `failure.code` 给出原因分布 |
| 实际开始的重试 | `llm/retry-started` | 用于区分「计划重试」与「真的重试」 |
| 取消 | `turn/end.data.reason.kind` 为 `aborted` / `interrupted` | 回合级统计；不要与请求级失败强行合并 |
| 成功率 | 成功数 ÷ 请求尝试数 | 分子分母固定后再写入 Spec，避免同名不同义 |

**建议展示**：三卡保持现状，在总 Token 卡的小字增加「N 次请求 · 成功率 X%」；或在三卡下方加一条 12px 的摘要行。模型列表的悬浮标题补充失败 / 重试。不建议再加一张与现有卡片同高的「请求」卡，页面的三列布局和窄屏规则会变得拥挤。

### 3.2 输出速度与首字延迟

**为什么值得做**：参考页的「输出速度 129 token/s、首字平均 9.9 秒」和「模型速度」表是它区别于普通 Token 统计的核心。DSH 日志中的结算流已经带时间，完全可以在不增加读取的情况下算出来。

**口径**（与宿主 `sessionStats` 投影一致）：

- 首字延迟 `TTFT = 首个 token 时间 - step/start 时间`。
- 解码时长 `decode = assistant/message 时间 - 首个 token 时间`。
- 输出速度 `tokens/s = outputTokens ÷ (decode / 1000)`。
- 只统计同时具备 `step/start`、首个 token、`outputTokens > 0` 的步骤；没有样本时显示 `—`，不要用 0 冒充。
- 总速度使用 `Σ outputTokens ÷ Σ decode` 的加权平均，不能对每次请求的 t/s 再取平均，否则短请求会严重拉偏。
- 首个 token 的判定复用 `assistantStreamFirstTokenTime()`：文本、推理、工具调用参数都算，与宿主一致。

**建议展示**：在「模型用量」列表中增加「速度」「首字」两列，或在模型卡内切换「Token / 速度」视图。总览只在卡片小字或 Tooltip 显示平均速度和采样数，避免三卡信息过载。

### 3.3 模型性能表

把现有模型列表从「色点 + 名称 + Token + 占比 + 占比条」扩展为紧凑表：

`模型 | Token（占比） | 请求 | 速度 | 首字 | 缓存率`

- 仍按 Token 降序，仍保留色点与占比条，避免和趋势图图例脱节。
- 超过 6 个模型时，趋势图仍只画前 6 个，但列表继续显示全部。
- 窄容器下把「速度 / 首字 / 缓存率」收进第二行或悬浮明细，不横向溢出。
- 模型名仍取 `message.source`，失败尝试没有来源时沿用 `request/context` 的当前路由。

### 3.4 让已有摘要字段上屏

- 热力图标题右侧或下方显示 `活跃 N 天 · 当前连续 X 天 · 最长连续 Y 天`。
- 摘要行显示 `峰值日期 / 峰值 Token`；会话卡 Tooltip 显示 `最长会话`。
- 这样不增加任何新字段，就能补上参考页「会话数下方中位数 / p90」之外的长期视角。

## 四、P1：值得做的分布数据

### 4.1 按工作区筛选与排行

参考页的「项目」排行（power-dsh 17.53 亿 ≈ ¥2195+）说明用户需要知道「哪个项目在烧 Token」。DSH 的 `sessionPersistence.list()` 已经返回 `header.cwd`，Host 可以按目录聚合，页面可在时间范围旁增加「全部工作区」下拉，并在模型卡旁增加工作区排行。

注意：

- 只需要 `cwd`，不需要读取工作区配置文件；无 `cwd` 的会话归为「未归工作区」。
- 如果按工作区过滤，最好由 Host 侧过滤会话集合，而不是把全量逐日数据传给 Client 再过滤；否则快照会膨胀。
- 路径只显示最后一级目录，完整路径放 Tooltip，避免设置页出现长绝对路径。

### 4.2 会话 Token 分布与最耗会话

参考页的「会话数 118，中位 23.5 万、p90 2747.1 万」提示：会话 Token 是强长尾分布，平均值没有解释力。本机 126 个 power-dsh 会话的只读样本也验证了这一点：中位数约 862 万，p90 约 9,392 万，最大约 5.56 亿。

建议增加：

- `summary.sessionTokensMedian` 与 `summary.sessionTokensP90`，显示在「会话」卡小字。
- 「最耗会话 Top 5」列表：标题、Token、请求数、活跃时长、最后活动时间；按 Token / 活跃时间切换排序。
- 标题从 `session/title` 事件读取，不额外扫描文件；不把会话 id 暴露到界面。
- 列表最多 5 条，避免快照和页面无限增长。

### 4.3 上下文占用与压缩（P2，可选）

DSH 原生 `ContextMeter` 只显示当前会话的实时上下文；跨会话的「平均上下文占用、峰值、压缩次数」仍是空白。`request/context.contextWindow` 提供模型窗口，`assistant/message.usage` 的输入三桶相加得到请求上下文 Token，可以计算：

- 每次请求的上下文占比 = `(inputTokens + cacheReadTokens + cacheWriteTokens) ÷ contextWindow`。
- 会话内平均 / 峰值占比，按有 `contextWindow` 的请求统计。
- `compaction/start` / `compaction/end` 事件计数，显示「压缩 N 次」。

这项更偏「上下文」而不是「Token 用量」，建议作为 P2，或在页面底部单独一段，不挤进三卡。

## 五、P2 与不建议做的项

### 5.1 可延后

- **CSV 导出**：由 Client 把当前范围的三卡、每日、模型行导出为 CSV 即可，不需要 Host 新接口。适合财务 / 周报场景，但与「看趋势」不是同一优先级。
- **趋势图指标切换**：参考页的趋势可在 Token / 输出 Token / 消息 / 会话 / 费用 / 活跃之间切换。我们可先做 `Token / 输出 Token / 请求 / 速度`，但需要先有按日的请求和速度聚合；建议等 P0 数据稳定后再加。
- **星期 × 小时热力图**：参考页用来回答「最忙时段」。DSH 的 53 周按日热力图已经覆盖长期节奏，再加一张 7×24 网格会增加页面密度；只有在用户明确需要「什么时候最忙」时再做。

### 5.2 不建议做

| 指标 | 原因 | 替代 |
| --- | --- | --- |
| 费用估算 | DSH 日志没有模型单价、峰谷价、缓存价与账单币种；维护价格表会变成长期数据工程，且不同供应商 / 账户价格不同。参考页自己也有大量「未计价」调用 | 保持 Token 口径；费用看 magpie 或供应商账单 |
| 账户余额 | 原生账户设置已经展示；放进使用统计会重复入口，且需要账户服务与网络 | 保持原生账户页 |
| 上下行流量 / 图片文件大小 | 会话日志只记录消息和附件引用，不记录实际网络字节；无法从 Token 推算 | 不做 |
| 账户 / 密钥筛选 | DSH 桌面版是单机单账户模型，没有网关式多账户维度 | 不做 |
| 逐请求明细表 | 需要保留每次请求的模型、状态、耗时、费用等完整行，快照会从 KB 级涨到 MB 级；与「轻量设置页」定位冲突 | 需要时做 CSV 导出聚合结果 |

## 六、口径与实现边界

### 6.1 事件与聚合

- 继续只读 `sessionPersistence`：`list()` → `open(id,'read')` → 从 `inheritedEventCount` 读取自有事件 → `close()`；不新增网络、进程、凭据或文件写入。
- 现有 `foldSession` 已经把 `assistant/message`、`assistant/attempt`、`llm/retry`、`request/context`、`step/start`、`step/end`、`tool/call` 纳入折叠；新增指标只增加聚合字段，不需要改变读取范围。
- 按 `revision` + 时区缓存的机制可以继续复用；新增字段随 `SessionUsageFold` 一起缓存，刷新只重读有变化的会话。
- 快照只保留按日 / 按模型 / 按会话的聚合，不保留逐请求流、正文或工具输出。

### 6.2 需要扩展的类型（建议）

- `UsageDayRow`：增加 `attemptCount`、`failedAttemptCount`、`retryCount`、`ttftMs`、`ttftSteps`、`decodeMs`、`decodeTokens`。
- `UsageModelRow`：增加同样的请求 / 失败 / 重试 / 时间聚合。
- `UsageSummary`：增加 `sessionTokensMedian`、`sessionTokensP90`、`attemptCount`、`failedAttemptCount`、`retryCount`。
- `UsageSnapshot`：按需增加 `topSessions`（最多 5 条）或按工作区聚合行；不要增加逐请求数组。
- 严格 codec 同步更新，Host / Client 同包构建，不保留旧版本字段兼容分支。

### 6.3 性能与隐私

- 本机 126 个会话、约 135 MB 压缩日志的只读统计可以正常完成；新增时间字段不会增加 I/O，只会增加 CPU 折叠。
- 请求级失败原因、会话标题只在本机快照内使用，不写日志、不上传。
- `cwd`、会话标题属于本机路径 / 内容，界面只展示必要部分，完整值放 Tooltip；继续遵守「不接收会话标识或原始事件」的现有 Client 边界。

### 6.4 UI 约束

当前 [UI 规范](ui.md#使用统计列表) 和三卡布局明确要求三列同一行、窄屏不换行。新增指标不要直接做成第四、第五张同高卡片，否则 800px 页面和 420px 窄屏都会拥挤。建议采用：

1. 三卡保持，补充小字 / Tooltip；
2. 模型卡内部升级为性能表；
3. 热力图下方加一行长期摘要；
4. 工作区排行和模型排行在宽屏并排、窄屏堆叠。

## 七、本机可行性核验

对当前机器 `~/.dsh/sessions/--Users-mew-code-power-dsh--/` 的 126 个会话日志做只读聚合（2026-11-14 快照，仅用于验证口径，不是产品数据）：

- 事件：18,532 条 `assistant/message`、90 条 `assistant/attempt`、30 条 `llm/retry`、845 个 `turn/start`、29,043 次 `tool/call`。
- 回合结束：774 次 `completed`、36 次 `error`、32 次 `aborted`、2 次 `interrupted`。
- Token：约 45.93 亿总量，其中缓存读取约 25.44 亿，缓存率约 55.5%；125 个会话有用量。
- 会话分布：中位数约 862 万 Token，p90 约 9,392 万，最大约 5.56 亿。
- 按模型计算的速度示例：`magpie/group/deepseek-flash` 约 176 token/s、首字约 3.8 秒；`magpie-responses/group/sol` 约 163 token/s、首字约 14.6 秒；`magpie-responses/miwu/gpt-6.1-sol` 约 141 token/s、首字约 21.8 秒。

这些数字证明 P0 的请求质量、速度和模型性能表都有真实数据支撑；也说明会话 Token 的 p90 远高于中位数，单看总量会掩盖长尾。

## 八、参考来源

- 用户提供的两张 magpie 截图（「观测 / 用量 / 请求」与「观测 / 用量 / 会话」）。
- [yetone/magpie](https://github.com/yetone/magpie) 本机源码，提交 `52c9880cbbfa5757ebcd1d8a66509b92a294edc8`；其 `internal/usage`、`internal/usageapi` 与 `internal/gui/assets/plugins/usage` 提供费用、速度、TTFT、请求状态等指标定义。
- DSH 本机参考源码：`packages/session/session-stats/src/projection.ts`（`sessionStats` 的 turns / steps / llmMs / toolMs / ttftMs / decodeMs 定义）、`packages/llm/llm/src/assistant-stream.ts`（首 token 提取）、`packages/core/session/src/types.ts`（`SessionEventMap` 与 `TurnEndReason`）。
- 当前实现：[usage-stats/spec.md](../src/features/usage-stats/spec.md)、[usage-fold.ts](../src/features/usage-stats/usage-fold.ts)、[usage-service.ts](../src/features/usage-stats/usage-service.ts)、[wire.ts](../src/shared/types/wire.ts)。
- 早期市场判断见[市场调研](market-research-2026-11-12.md)；本文对其「费用估算 / 账户余额」的 P0 结论作修正：这两项在 DSH 本机日志上没有可靠数据源，不建议纳入本功能。
