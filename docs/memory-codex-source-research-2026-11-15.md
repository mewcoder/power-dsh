# Codex 开源记忆机制核验

日期：2026-11-15（Asia/Shanghai）。补充[原研究](memory-research-2026-11-14.md)及[Claude Code／OpenCode 对照](memory-claude-opencode-research-2026-11-15.md)。用户指出 Codex 也是开源项目，本轮从文档级依据补到实现级依据；只研究，不修改功能或本机记忆。

## 版本与证据边界

- [openai/codex](https://github.com/openai/codex) 使用 Apache-2.0，包含 Rust CLI 的记忆实现，不应只看产品文档而忽略开源源码。
- `/releases/latest` 本次跳转到 `rust-v0.169.0`，标签提交 `d32063f96c2dff1dc96af839b3952abb6acfeda4`。
- 本机浅克隆主分支固定在 `81b995a6c9a4c978f399775cfa5ce50702368749`。另拉取发行标签，逐文件比较本轮关键实现；V1／V2 模板、启动器、产物同步与验证代码在两者一致。提取调用接口和少量基础设施存在变化，不把主分支整个实现等同于发行版。
- 定位以实际代码为准：模块在 `codex-rs/memories/write/`、`codex-rs/ext/memories/`、`codex-rs/state/` 等处。仓库 `codex-rs/memories/README.md` 的部分路径与时间回退描述已落后，不能只转述 README。
- 参考克隆位于忽略目录 `reference/openai/codex/`；没有安装、编译或运行参考源码，没有复制实现、提示词或资源。

## 主要结论

Codex 与 Claude Code／Qwen 的“每条独立事实一个文件”不同。它以会话为输入，先提取，再集中整合，并保留可追溯的会话摘要。存在 V1、V2 两套产物，不能把 `MEMORY.md` 当作所有版本必有的主文件。

| 项目 | V1 | V2 |
| --- | --- | --- |
| 根目录 | `$CODEX_HOME/memories/` | `$CODEX_HOME/memories_v2/` |
| 提取结果 | 会话摘要、raw memory、slug | 会话摘要、slug |
| 整合输入文件 | `raw_memories.md`、`rollout_summaries/` 及扩展输入 | `rollout_summaries/` 及扩展输入；同步阶段不生成 raw 文件 |
| 主要整合产物 | `MEMORY.md` 经验手册、`memory_summary.md` 精简摘要，可有 skills | 必需产物为 `memory_summary.md`，不要求 `MEMORY.md` |
| 粒度 | `MEMORY.md` 内按项目／任务族聚合多个任务与经验 | 摘要按项目、日期组织路线，指向会话摘要及明确来源 |
| 预算 | 摘要与中间经验手册职责不同，不按固定条目数机械生成 | 摘要须小于 10,000 UTF-8 字节，由代码校验 |

两套摘要文件的首行格式标记都可以是 `v1`；这个标记不等于选择了 V1 流水线。应看配置与存储目录判断版本。

## 什么时候记录

`write/src/start.rs` 在满足条件的根会话启动时异步运行流水线；临时会话、子代理及特性关闭时跳过，状态数据库缺席时跳过。不是每次普通记忆保存就整理整个库，也不是单纯按固定时钟定时 Dream。

阶段一从数据库领取符合条件的历史会话，考虑会话来源、年龄、空闲时间、任务锁、失败重试与启动扫描上限。输出结构化摘要，允许“没有值得记录的内容”，生成字段经过凭据脱敏后保存到状态数据库。锁／任务领取防止重复处理同一任务，不等于语义查重。

所核对版本默认值：每次启动最多处理 2 个会话、会话年龄窗口 10 天、最少空闲 6 小时；这些是输入筛选参数，不能理解成记忆每 6 小时删除或只保存 10 天。

“使用过 MCP 或联网就一律不提取”不是通用结论：`disable_on_external_context` 是独立配置，默认值为 `false`，应以当前配置及线程记忆模式判断。

## 怎么整合、控制重复和碎片

阶段二领取全局整合任务和文件工作区锁，选择有限数量的候选提取结果，按使用次数和最近使用／来源更新时间排序。同步被选中的会话摘要，并以 Git 基线计算新增、修改和删除差异。

输入没有变化且产物合法时，直接完成，不再调用整合模型。有变化才启动专用整合代理。V1 提示词要求把同类经验聚合到任务族，重复表述保留更忠实的原意再合并，避免固定文件数、条目数导向；V2 则把有价值信息压到精简摘要，并用指针保留详细来源。

这不是逐条保存时的确定性语义去重：主体是批量模型整合，加上任务领取、快照、差异及产物验证。模型仍可能误判，源码结构不能证明内容始终正确。

## 历史、过期和删除

- `max_unused_days` 默认 30 天：阶段二候选按 `last_usage` 判断，未使用过的结果回退到 `source_updated_at`。不是按一个偏好最早创建时间一刀切删除。
- 阶段一会分批清除超出保留窗口且 `selected_for_phase2 = 0` 的旧提取行，保留上一轮整合基线及任务水位，避免还没处理差异就丢失依据。
- `rollout_summaries/` 与当前被选输入同步，不再选中的摘要会被清理。整合代理收到删除差异，再去移除仅由这些来源支撑的结论；有其他来源支持的内容应保留。
- `extensions/*/resources/` 有独立的 14 天资源保留窗口；不能将这个数泛化为用户偏好或全部记忆的有效期。显式记忆修改使用的 ad-hoc notes 又是另一种输入。
- V2 要求用户后续纠正覆盖先前说法，已纠正或删除的信息不能从旧摘要中复活；证据冲突时保留不确定性。这里既有代码筛选，也有模型判断，需分别看待。

因此，源码证明 Codex 确有自动保留与清理机制，但不能概括为“所有历史永远保留”或“30 天没用就直接删掉全部偏好”。

## 模型、召回和用户修正

`extract_model` 与 `consolidation_model` 可分别配置。未配置时使用 provider 的记忆提取／整合默认模型，而不是简单继承当前聊天模型。Codex 的后台任务比 PowerDSH 当前的会话工具记忆更独立，不能直接照搬为设置需求。

V1 使用精简摘要导航到经验手册及来源；V2 将精简摘要注入新会话，必要时按指针读取 `rollout_summaries/`，无需每次机械重读整个历史库。默认根目录选择也有迁移逻辑：没有 V1 目录的新环境、启用特性且无显式版本或迁移退出时可选择 V2，已有 V1 或显式配置需分别处理。

明确的记住／忘记／纠正请求可写成 `extensions/ad_hoc/notes/` 下的小笔记，后续整合吸收；V2 阅读提示不允许普通对话直接修改生成文件。不要把“纠正”简化为覆盖一段摘要：必须避免下一轮从旧证据恢复已撤销的信息。

## 对 PowerDSH 的影响

1. 继续采用现有索引＋主题条目即可；这是 Claude Code／Qwen 的有据可查路线，但不是所有产品唯一共识。Codex 证明“会话摘要＋集中整合”也是有效的另一条路线。
2. 优先借鉴“无新信号则不处理、只看变化、保留来源、保留纠正和删除结果”，而不是新增更多文件类别或后台任务。
3. 当前的精确查重与手动整理定位可以保留；它们不等于 Codex 的历史会话提取流水线。不在本次研究中增加历史会话扫描、独立后台模型、定时 Dream 或使用频率淘汰。
4. 后续若需要自动治理，应另外定义使用记录、候选选择、分批与删除语义。现有创建／更新时间不能冒充“最近使用”，也不应直接复制 30 天参数。
5. 先做真实模型验收：不同措辞重复偏好、后续纠正、明确忘记、重新整理后是否复活。源码研究不能代替 PowerDSH 的模型端验收。

## 代码依据

以下发行标签链接固定本次依据：

- [启动与双版本调度](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/memories/write/src/start.rs)
- [阶段一提取与模型选择](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/memories/write/src/phase1.rs)
- [阶段二选择、差异与整合](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/memories/write/src/phase2.rs)
- [V1 整合规范](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/memories/write/templates/memories/consolidation.md)、[V2 整合规范](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/memories/write/templates/memories/consolidation_v2.md)
- [产物同步](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/memories/write/src/storage.rs)、[产物校验](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/memories/write/src/workspace.rs)
- [数据库保留与选择](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/state/src/runtime/memories.rs)、[配置与默认值](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/config/src/types.rs)
- [V2 阅读与显式修改](https://github.com/openai/codex/blob/rust-v0.169.0/codex-rs/ext/memories/templates/memories/read_path_v2.md)

本次只核对源码、模板及相关测试文本，未编译运行 Codex，也未核验桌面产品可能额外注入的私有编排行为。
