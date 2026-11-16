# Claude Code 与 OpenCode 记忆机制补充研究

核对日期：2026-11-15（Asia/Shanghai）。补充[上一轮研究](memory-research-2026-11-14.md)，实现现状以[记忆主 Spec](../src/features/memory/spec.md)为准。本次只研究，不修改功能、配置或本机记忆，不安装、执行参考插件。

同日另补[Codex 开源源码核验](memory-codex-source-research-2026-11-15.md)：该产品采用会话提取＋批量整合，V1／V2 产物不同，不将本篇 Claude Code 的单条文件方案推广为所有产品的统一机制。

## 结论

- Claude Code 同样使用 `MEMORY.md` 索引和独立记忆文件，小文件本身不是设计错误；不能从“文件多”直接推导应改成少数大文件。
- 关键是只记录有长期价值的新增信息，优先更新已有主题，索引有预算、正文按需读取，另有明确的整理入口。
- 核对的 OpenCode 原生指令与会话压缩不等于跨会话自动记忆；长期记忆插件应单独比较。发行版 V1 与开发分支 V2 的指令发现行为不同。
- PowerDSH 的索引、条目、写前查找、精确查重、手动预览及备份方向可以保留。现阶段不因本次研究增加定时 Dream、云端记忆、向量库或全库保存时整理。
- 纠正上一轮口头建议：不应直接把所有偏好合成一个文件，也没有足够依据立刻放宽 1,200 字符限制。先用真实模型验证是否出现不必要拆分，再决定是否调整；合并必须保留所有有用事实与例外，不能为减少文件数压丢内容。

## 证据与版本

| 对象 | 核对依据 | 边界 |
| --- | --- | --- |
| Claude Code | [官方记忆文档](https://code.claude.com/docs/en/memory)、[Markdown 版](https://code.claude.com/docs/en/memory.md)；公开仓库 `anthropics/claude-code` 提交 `993543784801341f17fe894abb253905b4f7a634`，更新日志首项 `2.1.325` | `/releases/latest` 跳转 `v2.1.325`；公开仓库不是完整 CLI 实现，不能声称完成内部提取、去重及调度源码审计 |
| OpenCode 发行版 | `anomalyco/opencode` 标签 `v1.19.5`，提交 `810c0eba1a7348036f8bdf61e6632d0c36c6876c` | `/releases/latest` 跳转该标签；核对该标签文件，不把开发分支文档倒推为发行版行为 |
| OpenCode 开发分支 | 同仓提交 `9f1639c73223053c7e5bc6f2204995fcd39b15ad`，`services/site/src/docs/content/`、`packages/core/src/` | 包含 OpenCode V2 文档与实现；只按固定快照描述 |
| 本地记忆插件 | `dot-opencode/memory` 提交 `4d3f2b832ed202f3939492a1fe95180f1da4f2e8` | 社区实现，非 OpenCode 内置 |
| 服务型记忆插件 | `supermemoryai/opencode-supermemory` 提交 `7de590ee9b715a1390215d050175d73bd4bc75e2` | 插件与服务协议可读；服务端提炼、去重算法未审计 |

GitHub REST latest 接口本次被匿名限流，版本以 GitHub Releases latest 的实际重定向、对应标签和公开更新日志交叉核对。官方文档是查询时的滚动版本，不保证全部细节都能回溯到同一发行版本。

参考仓库仅放在被忽略的 `reference/` 中，没有装依赖或执行仓库脚本。OpenCode 与 dot-opencode/memory 含 MIT 许可，opencode-supermemory 的 package.json 与 README 声明 MIT；Claude Code 公开仓库声明 Anthropic 商业条款，不按 MIT 开源实现对待。本次只作机制对照，不复制代码、提示词或资源。

## Claude Code

### 保存什么、如何拆分

手写的 `CLAUDE.md`／`AGENTS.md` 与自动记忆分开。自动记忆保存偏好、纠正、无法从源码推导的项目背景和外部信息位置，类型为 `user`、`feedback`、`project`、`reference`。官方明确不要求每个会话都写记忆，能从代码、Git 历史或已有指令得到的内容不应重复保存。

默认目录为 `~/.claude/projects/<project>/memory/`。同一 Git 仓库的 worktree 与子目录共享自动记忆目录；非 Git 目录按项目根定位。可用 `autoMemoryDirectory` 改位置，但这里不建议 PowerDSH 随之改动已确认的目录。

目录包含 `MEMORY.md` 索引及独立记忆文件，如 `user_role.md`、`feedback_testing.md`。不是按聊天轮次、日期机械新增文件。官方没有在本页公布正文必须限制为 1,200 字符的规则，也没有承诺确定性的保存去重算法。

### 如何读取、限制与整理

会话启动只读取 `MEMORY.md` 的前 200 行或前 25KB，先达到哪个采用哪个限制；正文文件通过普通文件工具按需读取。模型在会话内维护文件与索引。公开文档描述了会话内读写，但不能据此排除其他未公开提取实现；公开更新日志也提到 auto-memory extraction。

写入索引接近限制时宿主提醒模型精简：缩短索引行、把细节放入主题文件、合并或移除陈旧条目。超限写入仍成功，但工具结果报告需要重写索引，避免下次加载丢失尾部内容。这是预算压力触发的维护，不是本次确认到的定时 Dream。

`cleanupPeriodDays` 清理旧会话记录时排除自动记忆；记忆不会仅因存在时间长就被这项保留策略删除，保留到用户或模型修改、删除。没有查到官方承诺的独立定时 Dream、固定自动整理周期、完整历史归档或可恢复批量事务机制；“没有查到”不代表内部一定没有。

### 开关、模型与管理

本地会话默认开启自动记忆，可在 `/memory` 设置或 `autoMemoryEnabled` 关闭，也可用 `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` 禁用。自托管及后台、嵌套启动会话有额外限制，不能把本地默认值推广到所有运行方式。

`/memory` 可浏览指令及记忆位置、打开目录和编辑文件。官方记忆页未公布独立的日常记忆模型选择器；不能将“没有单独选择器”写成所有内部提取请求必定使用当前对话模型。

## OpenCode 原生能力

### 指令文件

发行版 `v1.19.5` 的 `packages/opencode/src/session/instruction.ts` 加载全局／项目 `AGENTS.md`，并按优先级回退 `CLAUDE.md` 等文件，另支持配置的 instructions。这里的去重是文件发现／注入去重，不是语义记忆去重。

开发分支的[Instructions 文档](https://github.com/anomalyco/opencode/blob/9f1639c73223053c7e5bc6f2204995fcd39b15ad/services/site/src/docs/content/instructions.mdx)明确 V2 只识别 `AGENTS.md`，不再回退 `CLAUDE.md`，并有运行中更新与嵌套发现机制。因此不能笼统说“OpenCode 一直兼容 Claude 的全部记忆目录”。

这些是持久指令与项目指导。所核对的原生实现没有证明它会自动维护 Claude Code 那样的索引＋主题记忆库；搜索中的 `environment/memory.ts` 是内存文件系统驱动，不能当作长期记忆功能证据。

### 会话压缩

发行版 `packages/opencode/src/session/compaction.ts` 在上下文不足时生成会话摘要，摘要以会话消息保存，继续当前任务。压缩代理可指定模型，否则使用会话模型；调用不提供工具。插件可向压缩上下文提供补充信息。

开发分支也支持自动／手动压缩及实验性后台压缩，但这是当前会话上下文管理，不等同于把个人偏好存入跨会话主题库。“后台压缩”不能直接比较为“后台 Dream”。

## OpenCode 插件

### dot-opencode/memory：本地文件路线

- 个人记忆存于 `~/.agent-memory/` 的 Git 仓库，分 project／group／workspace；项目 `.memory/` 通过软链接引用。注意 workspace 在这里是环境级范围，不等同于 PowerDSH 的项目范围。
- 一事实一 Markdown 文件，`INDEX.md` 从 frontmatter 生成；相关事实可链接。粒度比“所有偏好放同一个文件”更细。
- `memory dream --report` 只读报告相似、重复、旧事实和索引过大等问题；词重叠只是候选信号，仍需模型阅读判断，改写重复可能漏检。
- 用户启动 `memory dream` 后代理执行整理，支持选模型、超时、按变更增量处理及重建索引。CLI 可接外部调度器，不等于插件安装后默认自行定时运行。
- 无人值守模式可改写保留文件，但不删除／重命名旧文件，只报告人工删除候选；交互式 skill 经过确认后可删除／移动。不能把两条流程写成同一种行为。
- Git 备份、写锁及失败结果帮助恢复；不能将其应用层权限描述为操作系统级沙箱。

### opencode-supermemory：服务型路线

发行版 OpenCode 的生态清单列出该社区插件。它通过已配置 Supermemory 服务保存文档、提炼记忆、搜索召回和管理用户／项目范围；支持自动捕获与明确添加，不以本地每条一个 Markdown 文件作为主要存储协议。

核对的插件支持 V1 与 V2，包含捕获幂等 ID、召回结果相似度过滤及排序；V5 捕获使用文档增量提交和 `dreaming: "dynamic"`，提炼后可召回可能需要数分钟。这里的 dreaming 是服务处理参数，不能当成 OpenCode 自带或本地可审计 Dream。该参数也不等同于开关组织级定时整理。

只核对了客户端协议，没有证实服务端语义去重、冲突裁决及删除策略的具体实现。此路线带来外部服务、认证与数据发送，与 PowerDSH 当前本地文件定位不同，不建议为本次功能引入。

## 对 PowerDSH 的具体建议

| 项目 | 现状与建议 |
| --- | --- |
| 文件粒度 | 保留一个索引＋多份可独立检索的主题记忆；同主题优先更新，别按每句偏好或每次对话机械拆分，也不强行把独立事实塞进固定大文件 |
| 保存查重 | 保留精确查重和写前主题查询；明确子串搜索不能保证改写重复被发现，不为每次保存追加全库模型调用 |
| 保存选择 | 可进一步明确“不保存源码／指令已记录的内容、不保存临时进度、不要求每轮有产物”；先以真实模型验收，不把提示词约束宣称为硬保证 |
| 1,200 字符 | 暂不因本次研究更改；它是当前自定限制，不是 Claude Code／OpenCode 统一标准。合并超长时应保持原条目，不能截断事实 |
| 手动整理 | 保留选范围、选模型、预览、确认、备份与版本冲突保护。当前整理只能依据现有记忆，不能像读取项目源码的 Dream 那样宣称已核实现实中的过期事实 |
| 自动清理 | 不因年龄删除稳定偏好。定时 Dream 暂不增加，除非真实使用证明手动整理不足 |
| 容量与验收 | 当前整理输入及单次修改有上限，不能保证任意规模全库都能一键整理；后续容量需求应单独设计分批方案 |

最小真实验收：同一偏好换三种说法、修改一个偏好、明确撤销一条、重复开启新对话、对重复条目手动整理、对冲突条目检查是否保留不确定性。观察文件数量、事实是否丢失、版本冲突和备份；本次没有调用模型或修改真实记忆完成这些验收。

## 源码定位

- Claude Code：固定提交的 `CHANGELOG.md`（auto-memory 发布、目录设置、worktree 共用、注入内容中和等记录）；行为细节以官方 memory 文档为主。
- OpenCode `v1.19.5`：`packages/opencode/src/session/instruction.ts`、`session/compaction.ts`、`packages/web/src/content/docs/rules.mdx` 与 `ecosystem.mdx`。
- OpenCode 开发分支：`services/site/src/docs/content/instructions.mdx`、`compaction.mdx`，`packages/core/src/session/compaction.ts`、`instruction-discovery.ts`。
- dot-opencode/memory：`README.md`、`src/report.rs`、`src/dream.rs`、`skills/agent-memory/dream/prompt.md`。
- opencode-supermemory：`README.md`、`src/services/client.ts`、`memory-tool.ts`、`recall-results.ts` 与 `src/v2/`。

## 提示词校准（2026-11-16）

针对「记住当前环境是 Windows 却扩写成长篇规则」重新阅读实际模板，区分提炼信息与推测用户要求，而不是继续累加禁止词：

- [Qwen Code `prompt.ts`](https://github.com/QwenLM/qwen-code/blob/6f754be6548903e545e6ff0ed43a34927fe3bfb9/packages/core/src/memory/prompt.ts)：`TYPES_SECTION_INDIVIDUAL` 的反馈与项目记忆强调原因和适用方式，示例会把已知背景归纳成以后可用的信息；原因描述明确指向用户给出的理由。项目日期可归一化，正文按主题组织。这说明不能为了避免发散而一律禁止原因、应用说明或日期。
- [Codex 阶段一模板](https://github.com/openai/codex/blob/81b995a6c9a4c978f399775cfa5ce50702368749/codex-rs/memories/write/templates/memories/stage_one_system.md)：强调有用的可复用学习、证据分级及允许不记录；用户消息是偏好的主要证据，工具核验是项目事实的主要证据，助手总结不能替代用户表达。
- [Codex V2 整合模板](https://github.com/openai/codex/blob/81b995a6c9a4c978f399775cfa5ce50702368749/codex-rs/memories/write/templates/memories/consolidation_v2.md)：警惕过宽或僵硬的历史规则，保留证据支持的范围、确定程度和后续纠正；单任务请求留在任务内，用户偏好应是明确默认值或跨任务支持的工作方式。

PowerDSH 据此改为简短的证据与范围原则：允许自然归纳、改写、合并重复，保留有依据的理由、条件和例外；长度随内容，不固定一句话，也不强制每条补「Why／How」。不把环境事实提升为普遍偏好、不把助手建议写成用户已采纳的规则。不确定解释优先省略，确有价值才保留其不确定性。执行任务时可根据已知事实判断操作方式，但不把通用常识和未核验细节填充进记忆；用户指导或实际核验得到的特定经验可以保留。Windows 与 README 例子留在验收，避免将特定事故清单塞进常驻提示词；补充真实模型场景验证显式 Shell 操作、CI 例外、项目原因及日期不会被过度精简丢掉。

本次使用本地固定提交的开源提示词作为机制依据，自行编写短策略，没有复制完整提示词、引入新模型步骤或修改现有存储。Claude Code 仅继承上文官方文档的证据边界，不宣称读到了其完整内部提示词。
