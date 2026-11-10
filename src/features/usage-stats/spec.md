# 使用统计

模块 id：`usage-stats`；主开关 `usageStatsEnabled` 默认 `false`。模块的[定义](definition.ts)、[配置](config.ts)、[Host](host.ts)、[Client](client.ts)与[行为测试](tests/)在本目录维护。当前为**已实现源码**，实际安装与页面验收尚未执行。

## 标识、入口与范围

在 **设置 → PowerDSH → 管理** 打开「使用统计」开关，设置侧栏新增独立 **使用统计** Tab（与技能、MCP、全局指令、归档同样的 `settings.section` 接入方式，`order: 55`）。开关默认关闭、独立持久化，只控制统计页入口。

目标：让用户不必逐个翻会话，就能看到本机 DSH 会话累计消耗了多少 Token、哪一天最多、连续使用了多久，以及各模型的占比和每日趋势。

保留：DSH 的会话日志本身是宿主能力，本功能只读、只聚合，不写入会话、不修改任何配置或日志。明确不包含：费用估算、账户余额、远端或官方额度、按工作区/项目筛选、按会话下钻、导出、自动刷新轮询以外的后台统计。Token 只取适配器上报的用量，不做字符数估算。

## 配置与行为

唯一配置键 `usageStatsEnabled`（`z.boolean().default(false).volatile()`，与现有开关一起经宿主 `configForms` 持久化）。统计结果是读取会话日志即时计算的派生数据，不另存、不缓存到配置。

- 页面挂载时读取一次，窗口重新获得焦点时再读一次；「刷新」按钮手动重读。读取期间按钮忙碌并禁止重复提交，已显示的旧数据保留。
- 顶部五格摘要：累计 Token 数、峰值 Token 数（单日最高）、最长聊天时长、当前连续天数、最长连续天数。数值按浏览器语言做紧凑格式，时长按天/小时/分钟取最大的两级。
- 「Token 活动」热力图固定显示最近 53 个自然周（周日起始），按本地时区归日；「每日」按当日 Token 分级，「每周」按该周合计分级，「累计」按截至该周的累计值分级，五级色阶使用宿主业务强调色与模块底色混色，主题切换自动跟随。每个格子经原生 `Tooltip` 显示日期、Token 数与轮数（周/累计模式显示周末日期与该列合计）。
- 「时间范围」提供「近 7 日」「近 30 日」，只影响下方趋势图的横轴，不影响摘要与热力图；选择不持久化。
- 「每日 Token 趋势图」按模型画折线，最多取累计 Token 前 6 个模型，每个模型一色并在图例标注模型名；横轴按所选范围连续补齐日期，末端为最近活动日。没有用量时显示空状态。
- 「模型用量」按累计 Token 降序列出全部模型，显示模型名、占比条、Token 数与请求次数。
- 读取失败显示可重试的页面级错误；部分会话日志无法读取时保留其余结果，并在页面顶部提示统计不完整，不伪造为零。

## 生命周期、权限与兼容

- 关闭开关即移除统计 Tab 与图标；卸载释放订阅与监听。统计结果、会话日志与开关偏好保留。
- 只读本机已落盘的会话日志：经原生 `sessionPersistence.list()` 取得可读会话与 `revision`，`open(id,'read')` 逐会话读取事件后立即 `close()`，只读取 `assistant/message` 的 `usage`/`message.source`、`turn/start` 与 `tool/call` 的时间戳。不写入、不删除、不修改会话，无网络、无进程、无凭据。
- 逐会话聚合按 `revision` 与报告时区缓存，最多 512 条，刷新时只重读有变化的会话；并发读取上限 4。日志读取或解析失败的会话被跳过并计入「不完整」，不影响其他会话。
- 原生接口依据（本机 DSH `0.2.2-rc.1` SDK 与官方仓库 `fcc0ad46` 源码核对）：`sessionPersistence.list({signal})` 的 `header.{id,createdAt,cwd}`、`revision`、`location`；`sessionPersistence.open(id,'read',{signal})` 的 `read(offset,length,{signal})` 与 `close()`；事件 `assistant/message` 的 `data.usage`（`TokenUsage`：`inputTokens`、`outputTokens`、`totalTokens?`、`cacheReadTokens?`、`cacheWriteTokens?`）与 `data.message.source.{provider,model}`，以及 `turn/start`、`tool/call` 的 `time`。
- 服务缺席（无 `sessionPersistence` 的宿主）时，Host 方法抛 `usageUnavailable`，页面显示「当前 Host 不支持使用统计」，不伪造空列表或成功状态。Host 通过可选 `ctx.inject` 获取服务，缺席不会阻止其余功能加载。

## 验收条件与验证

可观察条件：
- 开启开关后出现「使用统计」Tab 与其图标，关闭后两者消失，且不增加重复监听或订阅。
- 摘要五项与日志中的实际用量一致：累计为各 `assistant/message.usage.totalTokens`（缺失时按 input+output+缓存求和）之和；峰值为单日最高；最长聊天时长为单会话从创建/首事件到末事件的最大跨度；连续天数按有 Token 的日期计算。
- 热力图按本地时区归日，53 列周日起始；三种模式切换只改变分级依据，格子数与月份标签不变。
- 切换近 7 日/近 30 日只改变趋势图横轴与点数，摘要与热力图不变。
- 趋势图只画前 6 个模型，无用量模型不出现；模型用量列表按 Token 降序且占比合计约 100%。
- 读取失败显示页面错误并可重试；部分日志失败时显示不完整提示，其余数据正常展示。
- 关闭开关或卸载后，焦点/窗口监听、订阅与 RPC 调用不再增加。

实现与测试：
- 纯逻辑 [usage-fold.ts](usage-fold.ts)：按会话折叠 `foldSession`、跨会话合并 `mergeUsage`、时区日键 `dayKeyFormatter`、连续天数 `streakDays`、补齐 `fillDays`。
- Host 服务 [usage-service.ts](usage-service.ts)：`list`/`open`/`read`/`close`、并发上限、`revision`+时区缓存、跳过失败会话、清理失效缓存。
- RPC 契约见 [rpc.ts](rpc.ts)，严格 codec 校验快照全部字段。
- [行为测试](tests/usage-fold.test.mjs)覆盖用量提取与总量回退、模型归属、时区归日、连续天数（含单日断档与过期断档）、日序列补齐、合并排序与不完整标记。
- [Host 行为测试](tests/usage-service.test.mjs)覆盖读取成功、缓存命中不重复读、revision 变化重读、失败会话被跳过、服务缺席报错与缓存清理。
- [页面行为测试](tests/client.test.mjs)覆盖开关增删 Tab 与图标、摘要与热力图渲染、三种热力图模式、范围切换、趋势图模型上限、错误与不完整提示。
- 尚未执行：真实 slots 注册渲染、真实会话日志下的页面数字核对、跨版本缺服务降级与 Windows 表现。以上按[分层验证](../../../docs/development.md#验证方法与限制)分别记录，不以源码存在代替实际页面验收。

## 参考来源

按用户要求参考 NCode（本机 `~/code/ZCode`，Apache-2.0，同步提交 `a9fe401eede6e6e5e01be9048679c206fe6f02d9`）的「使用统计」页面信息结构：顶部五项摘要条、52 周 Token 活动热力图（每日/每周/累计）、时间范围切换、按模型的每日趋势折线、模型用量占比。只借鉴信息层级与交互，不复制其代码、Tailwind/Recharts 组件、ZCode 专属配色或 agent 数据库协议；本项目改为读取 DSH 公开 `sessionPersistence` 日志，自行实现折叠、原生主题 token 与内联 SVG 折线，无新增依赖。确切许可与参考边界见[第三方资源声明](../../../docs/third-party-notices.md)。
