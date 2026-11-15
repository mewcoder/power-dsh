# 记忆功能研究（2026-11-14）

> **实现状态更新**：用户已授权一期实现，当前范围见[记忆主 Spec](../src/features/memory/spec.md)。本文的「未立项」描述仅保留当时研究状态，不再作为当前范围依据。
>
> **2026-11-15 补充**：[Claude Code／OpenCode 研究](memory-claude-opencode-research-2026-11-15.md)确认小文件方案有官方先例，同时区分 OpenCode 原生指令、会话压缩及社区记忆插件；不得将本文早期概括的「全行业共识」推广为所有产品相同存储、同样具备语义查重或定时整理。

> 研究材料，不是功能 Spec。为「记忆」方向的设计提供同类产品机制依据与取舍参考，并回应[市场调研](market-research-2026-11-12.md)中 Memory 类目的 P3 结论。范围、立项与验收以将来的主 Spec 为准。
>
> 证据分三档，逐条标注：**官方文档**、**官方源码**（ZCode 本地源码仓、Qwen Code 开源仓浅克隆、DSH 官方仓库）、**本机核验**（WorkBuddy／Trae／ZCode 安装包与运行数据、DSH 发行包与兼容性测试环境）。所有路径以 `~` 或仓库相对形式记录，不随安装包发布。

## 〇、总体结论与建议

**研究结论：建议立项做一期，但按「Host 独占写入 + 模型专用工具」的形态做，不按第一轮草案的「模型直接 Write」做。** 依据：五家产品与四款 DSH 社区插件都验证了「索引 + Markdown 条目 + 每轮注入索引 + 默认关」的轻量文件制可行；DSH 没有原生记忆，但 `systemPrompt` 注入点、工作区定位与快照持久化都已代码级核验（第七节）。市场调研把 Memory 判为 P3 的「架构重」依据（OpenViking 式向量检索）不是主流形态，该判断应刷新为「可做、成本可控」；是否立项与范围仍由用户确认，本文不构成实现授权。

**怎么做（一期一句话）**：Host 的 `MemoryStore` 独占全部文件写入（`profileContext.home/power-dsh/memories/`），模型经注册的 `power_dsh_memory` 工具提交条目；`systemPrompt.section()` 注入常驻策略、`systemPrompt.context()` 注入动态索引；设置页提供条目管理。两条硬约束：**记忆文件只能 Host 写**（agent 原生 Write/Edit 的可写根不含 profile，7.3）、**注入文本必须中和 `{{`**（旧宿主 context 无条件严格插值，7.2）。

**一期不做、留二期**：会话后提取子代理、Dream 自动整理、关键词/语义检索、团队共享、导入导出、跨设备同步。**不跟随**：向量检索与云端记忆服务（五家与社区实测均未默认采用）。

**实施顺序**：先立 `src/features/memory/spec.md`（含配置键、工具契约、版本降级与验收）→ `memory-store.ts` → `memory-tool.ts` → `injection.ts` → `host.ts`/`rpc.ts` → `client.ts` 管理页 → `npm run check` 与安装后页面验收。详见[设计草案](memory-design-2026-11-14.md)。

## 一、结论摘要

1. 五家产品的记忆都是**「索引 + 条目」的轻量文件制或结构化条目制**，没有任何一家在默认路径上使用向量检索。市场调研把 Memory 定为 P3 所依据的「数据模型与检索架构重」（OpenViking 式）不是主流形态，该成本判断需要刷新；是否立项仍以 Spec 为准。
2. 全行业共识的架构是五段式：**作用域分层（全局／项目，可选团队）→ 存储（索引 + 主题文件）→ 捕获（三条路线）→ 注入（每轮回灌索引或摘要）→ 治理（上限、淘汰、脱敏、开关）**。
3. 捕获三条路线的成本差异决定实现分期：prompt 驱动（agent 自己写文件）最轻；会话后提取子代理居中；后台独立提炼 pass 最重。ZCode 与 Qwen Code 都同时实现前两条，语义召回分支存在但默认关闭（ZCode 常量 `PROJECT_MEMORY_SEMANTIC_RECALL_ENABLED = false`）。
4. 对 DSH 宿主：`0.2.2-rc.1` 源码确认**没有原生记忆**，但有已核对的注入点——`@deepseek-ai/dsh-system-prompt` 的 `SystemPrompt` 服务（`section()`／`context()`／`variable()`），`agent-instructions` 是官方自己的注入参考实现；注入自 `0.2.0-rc.1` 起可用，但 `context()` 的 `interpolate`／`required` 与 `refreshContext()` 自 `0.2.1-alpha.2` 才存在（第七节版本矩阵）。**第一轮「写记忆可复用原生 Write／Edit、无需新增工具」的结论已被推翻**：默认 `workspace-write` 的 agent 写工具不能写 profile（可写根只有工作区、显式附加目录与临时目录），记忆条目写入必须由 Host 侧工具／RPC 完成，或把记忆库放进工作区（第七节 7.3）。
5. 最值得借鉴的开源参考是 Qwen Code（Apache-2.0，约 5 万行）：三层提示词拆分、索引由 Host 机器重建而非模型手编、提取游标 + 多种跳过判定、`pinned/` 保护目录、关键词元数据为确定性检索留路。
6. DSH 社区已有一批记忆插件（2026-08 起）：四份实测源码全部用 `systemPrompt` 注入、都用 Host 侧 `node:fs` 写工作区外的自有数据目录、三家注册自定义工具捕获、没有一家使用 owner-only RPC；`interpolate: false` 是踩过事故的硬需求（含 `{{…}}` 的记忆会让每个请求组装抛错）。见第八节。

## 二、五产品机制对比

| | 存储 | 捕获 | 注入 | 治理 |
| --- | --- | --- | --- | --- |
| **Codex** | `~/.codex/memories/`：`memory_summary.md` + `MEMORY.md` + `raw_memories.md` + `rollout_summaries/` | 后台异步提炼：线程空闲后跑提取 pass；跳过活跃/短会话与用过 MCP/联网的会话；速率余额低于阈值跳过；`extract_model` + `consolidation_model` 两段式 | 只注入 `memory_summary`，按需检索 `MEMORY.md`，再打开支撑材料 | 默认关（`[features] memories = true`）；`/memories` 线程级开关；secret 脱敏；定位为 generated state，不建议手编 |
| **Qoder** | 本地记忆文件组；设置页显示每组文件数与更新时间 | Agent Mode 对话中自动留存 + 显式「记住」 | 跨任务自动复用偏好与项目背景 | Global／Project 独立开关；查看文件夹、整组删除；关闭只停读写不删文件；禁存密码/验证码/API key |
| **WorkBuddy** | 三层：用户级 `~/.workbuddy/MEMORY.md`；工作区级 `<工作区>/.workbuddy/memory/`（`MEMORY.md` + 按日期日志）；云端画像 | 用户级显式「记住」才写；工作区级每轮强制追加日志，30 天后按主题蒸馏进长期记忆 | 每轮把两层 MEMORY.md 包进 `<working_memory_content>`／`<user_memory>` 注入，另有 `<memory>` 云端画像块 | 注入上限：工作区 3,000 字符/轮（清理提示 10,000 触发）、用户级 4,000 字符/轮；禁存密钥；跨工作区会话目录禁读 |
| **Trae** | 结构化条目（Rust `core_memory` 域）；本地文件 `user_profile.md`／每项目 `PROJECT_MEMENTO.md`（默认加载前 2,000 字符）；另含云端作用域 | `manage_core_memory` 工具（add/delete/forget）+ 自动捕捉；每次变更加快照（before/after/eviction），支持撤销 | 渲染成 `context_core_memories_snippet` 模板变量注入 | 全局/项目各上限 20 条，满额按引用频率与最近使用自动淘汰；设置中心管理、悬浮删除；本地 Memory file 可手编（不改文件名/路径） |
| **ZCode** | 项目级 `~/.zcode/cli/memories/projects/<slug>-<hash16>/memory/`：`MEMORY.md` 索引 + 一记忆一文件 | 双路：会话内 prompt 驱动 + 会话后提取子代理（游标增量、双重跳过判定）；另有 24h 一次的 Dream 整理通道 | 索引每轮载入 system section（`injectionTarget: "system"`），正文按需打开 | 设置 → 常规开关默认关；四类型 user/feedback/project/reference；索引上限 200 行/25KB，超限截断并附 WARNING；信任边界文案 |

## 三、逐产品机制

### Codex（OpenAI）

2026-11-15 已补[开源源码核验](memory-codex-source-research-2026-11-15.md)：以下为上一轮文档快照，不能当作全部版本固定机制。发行源码已有 V1／V2；V2 不要求 `MEMORY.md`，外部工具上下文是否排除由配置控制，后台提取／整合有独立模型及基于使用记录的保留规则。

官方文档（developers.openai.com/codex/memories，2026-11 抓取）：

- 双层记忆：`AGENTS.md` 手动维护、每会话加载（全局/项目/目录逐级，合并上限 32KiB，`AGENTS.override.md` 覆盖同目录文件），承载「必须生效」的规则；Memories 是**本地召回层**，明确「不要作为规则的唯一来源」。
- Memories 默认关闭；EEA/UK/瑞士必须显式开启。开启后由 Codex 把「合格历史线程」转成本地记忆文件：跳过进行中和过短的会话、脱敏、**后台异步**（线程空闲足够久才生成，不在每轮结束时立即生成），速率余额低于 `memories.min_rate_limit_remaining_percent` 时跳过。
- 存储在 `~/.codex/memories/`：`memory_summary.md`（精简概览）、`MEMORY.md`（可检索经验手册）、`raw_memories.md`（整合中间输入）、`rollout_summaries/`（会话摘要与证据引用）。
- 注入不整读：每轮只带 `memory_summary`，需要时检索 `MEMORY.md` 并打开支撑材料。
- 治理：`/memories` 控制当前线程是否使用记忆、是否作为生成输入；`memories.generate_memories`／`use_memories`／`disable_on_external_context` 配置项；`extract_model` 与 `consolidation_model` 分离（逐线程提取 + 全局合并两段式）；官方定位为 generated state，不鼓励手编。

### Qoder（阿里）

官方文档（docs.qoder.com/qoder/memory，2026-11 抓取）：

- Settings → Memory 管理本机长期记忆；Global（跨项目偏好）与 Project（仓库规则/经验）两组独立开关，显示每组记忆文件数与最后更新时间，可打开文件夹查看或整组删除。
- 关闭某组 = 停止读取和更新，不删除既有文件。
- 内容边界：稳定偏好、长期项目背景、反复使用的工具/验证方法进记忆；一次性指令、临时调试状态、当前任务验收标准留在任务或项目文件；不存密码、验证码、API key。
- 配套三件套分工：Memory（跨任务偏好）、Repo Wiki（从代码生成的项目知识库）、Knowledge Base（团队结构化知识）。

### WorkBuddy（腾讯）——本机核验

证据：`WorkBuddy AI.app` 的 `app.asar`（MemoryCollector 与记忆系统提示词，2026-11-14 提取）。三层架构与系统提示词全文可从包内还原：

**第 1 层——云端记忆（只读）**：(A) 服务端生成的用户长期画像，会话开始时以 `<memory>...</memory>` 块注入，本地缓存在用户目录 `memory/` 下，本地写入会在下次会话被覆盖；(B) `conversation_search` 工具按服务端排序检索全部历史会话，用于召回「当前上下文里没有的特定往事」。

**第 2 层——用户级本地记忆（读写）**：`~/.workbuddy/MEMORY.md`（`WORKBUDDY_CONFIG_DIR` 可覆盖；登录后为设备根下 `user-<uid>-<企业ID>` 每用户目录）。作用域全部项目，**每轮注入上限 4,000 字符**，超长截断。注入包裹为 `<user_memory>` 块。仅当用户显式要求长期记住且不绑定具体项目时由模型就地更新；定位「精确、必须严格执行的规则」（与云端画像「隐式学习」相对）。

**第 3 层——工作区记忆（读写）**：`<工作区>/.workbuddy/memory/` 下两个文件：

- `YYYY-MM-DD.md` 按日期工作日志，**只追加，从不覆写**；
- `MEMORY.md` 策展的长期项目笔记，**每轮注入上限 3,000 字符**；工作记忆块以 10,000 字符为界，超限时在注入内容里附带「ACTION REQUIRED」指令，要求模型先合并去重、精简重写 MEMORY.md 再继续任务——**用截断压力驱动自愈**，而不是后台进程。

写入时机（提示词原文明示 MUST）：完成实质性工作后立即用 Edit 工具向当日日志追加一条简要记录（构建/修改应用、修 bug、写报告/文档、重构/架构变更、选定技术方案、用户分享项目约定或偏好——最后一项同时就地更新 MEMORY.md）。维护规则：**把超过 30 天的日志按主题蒸馏进 MEMORY.md，然后删除旧日志文件**（自动提炼由 agent 按提示词执行，无独立后台进程）。不存密钥（除非用户显式要求）。

检索策略与边界：本项目历史 → 先读最近的本地日志或 MEMORY.md；跨项目或不确定位置 → `conversation_search`；无历史依赖 → 跳过读记忆。工作区记忆只是补充，不替代正常回复或交付物。禁止对 `~/.workbuddy/projects` 等其他工作区会话目录执行 Grep/Glob/Read/Bash。

其他：`USER.md`／`IDENTITY.md`／`SOUL.md`／`MEMORY.md`／`BOOTSTRAP.md`／`workspace-state.json` 六个文件组成身份族，登录后按 uid 每用户目录迁移（迁移有 owner 锁与断点续迁）；quick 模式跳过全部记忆收集；另有 MemoryArchive 服务（锁、采样日志、uid 脱敏）。

### Trae（字节）——本机核验 + 官方文档

证据：`Trae CN.app` 的 workbench bundle 与 `modules/ai-agent/libai_agent.dylib`（Rust 服务 `apps/icube_server_rs/modules/ai-agent/src/domain/memory/core_memory/`），2026-11-14 提取；官方文档 docs.trae.ai/ide/memories。

- 官方文档：全局记忆 + 项目记忆，本地存储不跨设备；**每类上限 20 条**；自动捕捉 + 主动添加；更新方式为内容覆盖 + **满额自动淘汰（按引用频率与最近使用时间）**；不保存一次性指令、模糊偏好、敏感信息；设置 → 规则和技能 → 记忆 开关。
- 二进制核验：记忆域名为 `core_memory`，通过 **`manage_core_memory` 工具**管理（add/delete/forget，scope 分 user/project，校验 scope/via/category）；RPC 有 `get_core_memories`／`get_core_memory`／`forget_core_memory`；每次变更加**快照对**（add／delete／before-modify／after-modify／eviction），支持撤销与审计；「Failed to evict project memory」证实淘汰机制在代码内。
- 注入：`RenderCoreMemoriesParams`（含 `user_core_memories`／`project_core_memories`）渲染为模板变量 `context_core_memories_snippet`；条目字段含 `memento_id`、`keywords`。
- 本地文件形态：项目记忆文件 **`PROJECT_MEMENTO.md`**（用户级为 `user_profile.md`），编辑器有专门的 Memory file 贡献：文案「此文件自动保存当前项目的模型记忆，仅本地有效；不要修改文件名/路径；不满意可手动修改，但默认只记住前 N 字符」。默认加载前 **2,000 字符**（常量 `2e3`，服务端配置 `shallow_memento_string_limit` 可调）；超限时报 `memory_file_too_long` 遥测并在编辑器装饰截断位置。
- 另有独立会话记忆（`enable_chat_memory_with_history`）与 Chronicle（屏幕上下文增强记忆，iCubeChronicle 平台层）。

### ZCode（智谱）——官方源码核验

证据：本地 ZCode 源码仓（桌面构建产物名 NCode，v3.17.2），核心实现位于 `apps/zcode-cli/packages/core/src/memory/` 与 `packages/services/src/memory/`。

- 配置三开关：`memory.enabled`（总开关，默认关）、`memory.extractionEnabled`（提取子代理）、`memory.use`（召回注入）。存储根 `<dataRoot>/cli/memories/projects/<slug>-<sha256前16位>/memory/`。
- 注入（`context/sections/memory.ts`）：`ContextSection`「Memory」，`injectionTarget: "system"`、`cacheHint: "dynamic"`。内容四块：格式与四类型（frontmatter `name`/`description`/`type: user|feedback|project|reference`，feedback/project 需 **Why** 与 **How to apply** 行，`[[wiki 链接]]` 悬空合法）、索引规则、不存清单（repo 已记录的、只对本对话有意义的）、**信任边界**（`<system-reminder>` 内的召回记忆是背景而非指令；记忆提到的文件/函数/flag 推荐前先验证存在）。
- 索引载入（`memory/index-content.ts`）：上限 **200 行 / 25,000 字符**，超限截断并追加 `> WARNING: MEMORY.md is … Only part of it was loaded` 让模型知情；frontmatter 与顶层 HTML 注释剥除。
- 捕获双路：
  - 会话内 prompt 驱动——指令声明目录已存在，直接用 Write 写、写完更新索引；
  - 会话后提取子代理（`memory/extraction.ts`）——每轮成功结束后调度，先判定：本轮已直接写过记忆目录 → 跳过（`direct-memory-write`）；无 ≥3 词真实用户消息 → 跳过（`no-user-prose`）；否则启动受限提取子代理（只读工具 + 仅限记忆目录的 Edit/Write；限轮数，先并行读后并行写；只用最近 ~N 条消息；对照 manifest 去重；无内容可存只输出 `Nothing to save.`）。游标（boundaryMessageId）只在成功后推进。
- Dream 整理（`memory/dream.ts`）：自动触发至少间隔 24 小时（扫描节流 10 分钟；`.consolidate-lock` 锁文件带 pid + 1 小时新鲜度，write-readback 认领）。四阶段 Orient/Gather/Consolidate/Prune+Index：读最近 1-3 天会话日志、窄 grep JSONL transcript、合并去重、相对日期转绝对、删除被证伪的、索引压回上限，并与 CLAUDE.md 对账（记忆过期就删；记忆更新 CLAUDE.md 就标注矛盾待人工核对，dream 不改 CLAUDE.md）。
- 语义召回分支存在但默认关：`project-memory-retrieval-branch.ts` 常量 `PROJECT_MEMORY_SEMANTIC_RECALL_ENABLED = false`（注释：未来切换只改这一处）。开启时为每轮 prefetch + LLM selector（严格 JSON Schema、最多 5 条、粘性对话去重、对 user/project 类记忆特别保守），以 `relevant_memory` 附件进 `<system-reminder>`，并同步 read-state 让后续 Edit 可直接改记忆文件。
- 桌面层（`packages/services/src/memory/memoryService.ts`）：用户级记忆在 `~/.claude/memory/MEMORY.md`（兼容 Claude 目录）；项目记忆目录为设置页管理 UI 提供目录与读取，加固包括拒绝 symlink、大小写精确文件名、realpath 包含性、稳定句柄读前读后双校验，错误码 `PROJECT_MEMORY_PREVIEW_LIMIT_EXCEEDED`／`PROJECT_MEMORY_FILE_CHANGED`。

## 四、开源参考实现：Qwen Code

仓库 `QwenLM/qwen-code`（Apache-2.0），浅克隆 `6f754be`，位于 `reference/QwenLM/qwen-code/`；记忆实现集中在 `packages/core/src/memory/`（约 5 万行含测试）。与 ZCode 同为 gemini-cli 血统，结构同源，但工业化程度更高。登记细节见[参考研究](reference-research.md#qwenlmqwen-code-记忆系统)。

对 PowerDSH 有参考价值的机制（按优先级）：

1. **提示词三层拆分**（`memory/prompt.ts`）：全量提示词（后台代理用，含类型示例/分类/不存清单）+ 常驻精简策略（主会话每个请求都发，只留「用户显式说记/忘」所需最小集）+ 索引作为请求尾部目录数据（`wrapSystemReminder` 包裹，标注 data-not-instructions，嵌套 reminder 标签转义防注入）。
2. **索引由 Host 机器重建**（`indexer.ts` + `extract.ts`）：模型只写主题文件，MEMORY.md 从 frontmatter 重建；项目级重建失败必须冒泡（游标不推进，保证可重试），用户级 best-effort 非对称隔离。比 ZCode 的模型手编 + 截断警告可靠，管理页删除条目后也天然一致。
3. **提取游标与跳过判定**（`extract-cursor.json` + `extract-cadence.ts`）：增量推进、失败不推进；跳过原因含 `already_running`／`memory_tool`／`memory_pressure`（宿主内存压力门）／`cadence`（空跑后最多跳 3 轮）；历史净化（剥 system-reminder/thought、补模型 ack 修复交替、part 级覆盖证明去重）；touchedTopics 从写入路径推导，不要求代理输出 JSON。
4. **`pinned/` 保护目录**：用户置顶记忆不被提取/Dream 修改删除；管理页可提供置顶。
5. **富元数据**：frontmatter 增加 `category`（20 个固定分类，两级总览树）、`keywords`（2-6 个判别性检索词，≤64 字符）、`usage_scenarios`（1-3 个未来场景）；正文 ≤1,200 字符。为将来的确定性检索升级留路（Qwen 召回是「确定性打分 ≤2 条 + 模型选择器 ≤5 条」双路，CJK bigram 分词，无 embedding）。
6. **Dream fail-closed 校验**（`dream.ts`）：before/after 快照对比，所有内容变化的文档必须合法（不只代理自报路径——代理持有 shell，未报告的写入也会落盘）；merge/split/delete 走协议文件由可信代码执行。
7. **安全清单**：提取代理读与写都限制在记忆目录内（防继承的不可信历史借代理读全盘）；symlink 拒绝 + 可信锚 canonicalize；团队记忆写入前 gitleaks 精选规则密钥扫描、命中即拒。

不跟随：team 记忆层（git 同步 + secret guard，超出单机增强定位）、structured/legacy 双模式与迁移 machinery、语义召回。

## 五、共性架构与设计约束

1. **规则与记忆分离**：必须生效的规范留在 AGENTS.md/Rules（手编、可版本化）；记忆是召回层，generated state，可淘汰可覆盖。五家一致。
2. **作用域两层起步**：全局（用户级）+ 项目（工作区）；团队层只有 Qwen 与 Trae（云端）有。
3. **轻量存储**：索引 + markdown 条目（ZCode/Codex/WorkBuddy/Qwen）或结构化条目（Trae/Qoder）；索引每轮注入、正文按需打开；上限 + 截断警告是标配。
4. **捕获三条路线**按成本递进：prompt 驱动 < 会话后提取子代理 < 独立后台提炼；语义召回/向量全部处于关闭或不存在状态。
5. **治理三件套**：上限/淘汰、敏感信息脱敏与禁存、独立开关 + 用户可查看/删除/手编（可手编的一方都警告不要改文件名或只加载前缀）。
6. **安全边界**：召回记忆以数据（非指令）身份注入并声明信任边界；记忆引用的事实推荐前先验证现状；记忆目录读写限制与路径加固。

## 六、对 PowerDSH 的实现路径建议（草案，未立项）

> 本节是第一轮结论；第二轮宿主核验（第七节）与社区插件对照（第八节）修正了写入路径与注入细节，具体设计以[记忆功能设计草案](memory-design-2026-11-14.md)为准。

宿主现状：DSH `0.2.2-rc.1` 无原生记忆（`.references/deepseek-harness` 全量检索无 memories 实现；context 层仅 agent-instructions 等）。可行注入点：`@deepseek-ai/dsh-system-prompt` 的 `SystemPrompt` 服务（`section()`／`context()`／`variable()`，支持 scope），`agent-instructions` 为官方注入参考。**写记忆不能复用原生 Write/Edit 写 profile**（沙箱可写根不含 home，见 7.3）；一期改为 Host 侧独立写入 + 一个模型可调用的记忆工具。

一期（若立项）——文件制最小闭环：

- 存储：`profileContext.home`（默认 `~/.dsh`）下 `power-dsh/memories/`，per-workspace 子目录（slug-<hash8>），`MEMORY.md` 索引 + 类型子目录主题文件 + frontmatter（含 `pinned` 与 `schemaVersion`）
- 写入：Host 的 `MemoryStore` 独占全部文件写入，模型经注册的 `power_dsh_memory` 工具提交条目（不依赖原生 Write/Edit）
- 注入：`systemPrompt.section()` 注册静态策略（`interpolate: false`），`systemPrompt.context()` 注册动态索引（文本先做 `{{` 中和，capable 版本再带 `interpolate: false`）
- 捕获：一期只做 prompt 驱动（模型调用 `power_dsh_memory` 工具）；提取子代理（含游标与跳过判定）留二期
- 索引重建：Host 侧从 frontmatter 重建，不信任模型手编
- 管理：沿用六功能页模式（列表/查看/删除/置顶），owner-only RPC，路径加固照抄 ZCode/Qwen
- 开关：独立持久化默认关；关闭移除注入、工具与管理入口，保留文件

第一轮的三项待核对问题已由第七节回答：① 第三方插件可 `inject: ['systemPrompt']`（四款社区插件实测）；② 工作区键取 `context.agent.session.header.cwd`（`AssembleContext.agent` 自 `0.1.7-rc.2` 起存在，同步可读）；③ `context()` 的 provider 在每步装配与请求准入时重新求值，新会话首请求已被覆盖。仍需在目标安装包上用 `cordis_inspect_list` 复核具体服务是否在当前 profile 挂载。

## 七、DSH 宿主接线核验（第二轮，2026-11-14）

> 本轮把设计草案里「实现前必须核对」的三项做成了代码级核验，并顺带核对了写入边界、工具注册契约与消息 source 扩展性。证据来自 DSH 官方仓库提交 `fcc0ad46`（`0.2.2-rc.1`）与本机 `.references/compatibility-tests/` 里 13 个历史发行版的安装包；`cordis_inspect_list` 在当前会话不可用，因此以安装包公开类型与实现为准，逐版差异按实际包核对。

### 7.1 三项待核对问题的答案

| 问题 | 结论 | 证据 |
| --- | --- | --- |
| ① 第三方插件能否注入／使用 `systemPrompt` | **能**。`systemPrompt` 是公开 Cordis service，第三方插件 `inject: ['systemPrompt']` 后即可 `section()`／`context()`。四款社区记忆插件全部这么接线（第八节）；本机 `@deepseek-ai/dsh-system-prompt@0.2.2-rc.1` 已含该实现 | `packages/core/system-prompt/src/index.ts`（`declare module '@deepseek-ai/cordis' { interface Context { systemPrompt: SystemPrompt } }`）、`reference/` 四款插件源码 |
| ② scope key 与工作区的对应 | **不需要 scope key**。`AssembleContext.agent` 自 `0.1.7-rc.2` 起存在（`agent?: Agent`），provider 内直接读 `context.agent.session.header.cwd` 即可得到该会话的工作区绝对路径；这是同步读取，符合 provider 同步求值的要求 | `packages/core/agent/src/runtime-types.ts` 的 `interface AssembleContext { agent?: Agent }`；`packages/core/session/src/types.ts` 的 `SessionHeader.cwd` |
| ③ `context()` 的 durable snapshot 是否覆盖新会话首请求 | **覆盖**。`agent/pre-step` 里先 `systemPrompt.assemble()` 再 `runtimeContext.project()`，首请求即包含当步 context；`RuntimeContextProjection` 会把内容不同的快照作为 `runtime-context` user 消息追加进会话日志并持久化，重载时从最新 surface 节点恢复 | `packages/core/agent-loop/src/agent.ts:294-305`、`packages/core/agent-loop/src/runtime-context.ts:128-168` |

### 7.2 `systemPrompt` 的版本矩阵（逐版实测）

| 能力 | 0.2.0-rc.1 / rc.2 | 0.2.1-alpha.1 | 0.2.1-alpha.2 起 | 0.2.1-rc.5 / 0.2.2 系列 |
| --- | --- | --- | --- | --- |
| `section()` / `context()` / `getSectionOrder` | 有 | 有 | 有 | 有 |
| `PromptSection.interpolate` | 有 | 有 | 有 | 有 |
| `PromptContext.interpolate` / `required` | **无** | **无** | 有 | 有 |
| `refreshContext()`（请求准入时重算 context） | **无** | **无** | 有 | 有 |
| `CONTEXT_ORDERS.WORKING_DIRECTORY`（值 100） | **无** | **无** | 有 | 有 |
| `CONTEXT_ORDERS.TEAM_IDENTITY` / `HARNESS_SOURCE` / `WEB_SURFACE` | **无** | **无** | alpha.2 无、alpha.3 起有 | 有 |
| `AssembleContext.agent` | 有（0.1.7-rc.2 起） | 有 | 有 | 有 |
| `tools.register(definition, { when })` | 只有单参 `register(definition)` | 同左 | 同左 | `0.2.2-alpha.2` 起有 `when` |

对设计的直接影响：

1. **`context()` 在最低基线没有 `interpolate` 字段**，且 0.2.0-rc.1 的 `renderContextSections` 对 context **无条件做严格 `{{变量}}` 插值**。记忆正文是用户／模型数据，含 `{{…}}` 会让整个 prompt 组装抛错、**每个请求都失败**（社区插件 `baosfeng` 的 CHANGELOG 记录过这次真实事故）。因此注入前必须自行把 `{{` 中和成 `{` + U+200B + `{`（社区 `dsh-global-context` 同款做法），不能只依赖 `interpolate: false`。
2. **最低基线没有 `required`**：部署若设 `includeRuntimeContext: false`（如 `minimal` preset），context 会被整体抑制。若记忆索引放 `context()`，在旧宿主 + minimal preset 下会静默消失；这是可接受的降级还是改用 `section()`，需要在 Spec 里明确。
3. **最低基线没有 `getContextOrder('WORKING_DIRECTORY')`**：该函数对未知名字返回 `undefined`，而 `context()` 要求 `order` 是有限数（否则 `TypeError`）。必须用字面量兜底（例如 `getContextOrder(...) ?? 130` 或直接常量 130），不能假设命名位存在。
4. **`refreshContext` 自 0.2.1-alpha.2 起才有**：旧版只在装配时求值。若记忆索引在一步的中途被工具改写，旧宿主上要等到下一步才生效；可接受，但验收条件不要写成「同步生效」。

### 7.3 写入边界：agent 的原生 Write／Edit 写不进 profile

这是本轮最重要的修正。DSH 的文件沙箱对「可写根」只有一处推导：

- `packages/sandbox/sandbox/src/roots.ts:82-100`：`workspace-write` 的可写根 = `workspaceRoot` + 显式 `additionalWritableRoots` + `/tmp` + `os.tmpdir()`；**没有任何 home、`DSH_HOME`、profile 路径参与**。
- `packages/fs/fs-sandbox/src/index.ts:156-178`：write/edit/patch/delete/move 五类变更都在 canonicalize 后做包含性检查，越界抛 `FS_SANDBOX_DENIED`；读操作不设防（同文件头注释）。
- `packages/sandbox/sandbox/src/escalation.ts:29-32`：升级只有「放宽模式」一档（`workspace-write → danger-full-access`），没有「只授权某个目录」；而 `danger-full-access` 是整盘放开。
- `additionalWritableRoots` 在 `0.2.0-rc.1`～`0.2.1-rc.5` 的 `dsh-sandbox-policy` 公开类型里**都不存在**（本轮逐版核对），只在 `0.2.2-rc.1` 源码中可见；且该配置属于部署级 `cordis.yml`，插件无法自行授权。
- 本机 desktop profile 的 `defaultPreset` 是 `danger-full-access`（用户自己的 patch），所以本机实测「能写」不能外推到默认部署；`web` profile 与发布默认是 `workspace-write`。

结论：记忆条目若放 `~/.dsh/power-dsh/memories/`，**只能由 Host 侧用 `node:fs` 写**（官方 `credentials-local`、`attachment-local`、`anonymous-user-id`、`liveshare` 都是这个模式；`app-boot` 还向插件 `provide('dshHomePath', dshHomePath)`）。模型侧要写记忆，就必须注册一个专用工具（`ctx.tools.register`）或走 owner-only RPC，不能靠提示词让模型直接 `write`。备选是把记忆库放进工作区（agent 可写），但只能得到工作区级记忆，且会污染用户仓库；草案的两层作用域（global + workspace）只有 Host 写入这一条路。

### 7.4 工具注册契约（若采用专用记忆工具）

- `ctx.tools.register(definition)` 在最低基线即为该签名，且**强制要求 `output { schema, render }`**（缺了直接 `TypeError: tool "…" must declare output { schema, render, presentationMeta? }`，0.2.0-rc.1 的 `dsh-tools` 内联校验可见）。
- `ToolRegistrationOptions.when`（按步启用／隐藏工具）自 `0.2.2-alpha.2` 起才有；旧版只能注册／释放 effect 来开关，或让工具始终可见并在 `execute` 内按配置拒绝。
- 官方工具清单里没有 `memory`（现有原生工具为 `read`／`write`／`edit`／`apply_patch`／`read_image`／`bash`／`pwsh`／`glob`／`grep`／`web_search`／`web_fetch`／`lsp`／`session_query`／`goal`／`schedule`／`workflow`／`subagent`／`report`／`computer_use`／`run_code`／`todo_write` 等），但全局工具名是跨插件的同一命名空间，市场里已有别的记忆插件注册 `memory_*` 类工具；PowerDSH 应采用 `power_dsh_memory` 这类带前缀的名字，避免与用户已装插件撞名导致装载失败。

### 7.5 消息 source 扩展性（备选注入路线）

如果不想用 `context()`，也可以走 `agent/pre-step` 追加自定义 `source.kind` 的 user 消息：

- `MessageSourceMap` 是可声明合并的纯类型，**运行时没有 kind 白名单**；`Session.append` 对 `user/message` 只校验 JSON 与 surface 元数据，不校验 source 形状；V4 格式读取只拒绝退役的 `kind: 'plugin'` 与非空字符串要求。未知 kind 会被原样保留（官方 `session-format-v3-to-v4` 测试覆盖 `acme`／`plugin:acme`／`__proto__` 等）。
- 但有三个条件：`kind` 必须是非空字符串、source 必须是纯 JSON（append 不校验但重载会校验，写坏了会导致会话读不回来）；不能复用保留 kind（`user`／`runtime-context`／`system-prompt` 等）；**去重与重载恢复要自己做**（`time-context` 用 `sessionProjections`，`agent-instructions` 回扫 surface 节点）。
- 结论：`context()` 有官方去重、持久化快照与日志回放，优先用它；自定义 source 只在「需要和 runtime-context 区分归属」时才值得。

### 7.6 `profileContext` 的两个路径

`profileContext.home` = `resolveDshHome()`（默认 `~/.dsh`，可被 `DSH_HOME` 覆盖）；`profileContext.dir` = 当前 profile 目录（`~/.dsh/profiles/<name>`）。PowerDSH 既有功能（壁纸、全局指令、技能用户目录）都用 `home` + `power-dsh/` 子目录；记忆库应保持一致，不写进 profile 目录（避免随 profile 重装或换 profile 丢失）。

## 八、社区 DSH 记忆插件对照（四份实测源码）

> 按仓库流程检索 dsh-market 记忆类目并浅克隆四份实现，只读核验接线方式，未复制代码、样式或依赖。四份均为 MIT。

| 仓库（提交） | 注入 API | 存储 | 捕获 | 检索 | 管理入口 |
| --- | --- | --- | --- | --- | --- |
| `baosfeng/my-dsh-plugins`（`6d1b28f`，`plugins/dsh-my-memory`） | `section()` ×3（-95／-85／-80，均 `interpolate: false`） | `$DSH_HOME/memory.json` + `$DSH_HOME/memory/projects/<sha256-12>.json`（git 根 + 路径哈希） | 3+5 个自定义工具；`tools/pre-execute` 写确认门 | 关键词 AND substring，注入 top-5 摘要 + agent 记忆目录 | `settings.plugins.tab`；自建 HTTP `prefix` 路由（带信任围栏） |
| `littleblacktong/dsh-plugin-memory`（`5a3f94c`） | `context()` ×2（-200／900；后者放易变日志尾部） | `~/.memory`（可配 `memoryDir`），单库不分工作区 | **prompt 驱动**模型直接写文件 + skill + digest 提醒兜底 | 无工具；CLI substring | `settings.section`；8 条 HTTP `exact` 路由（无鉴权） |
| `ruqinhu/dsh-memory`（`486270d`） | `context()` ×1（order 130，注释列出宿主既有段位） | `~/.dsh/memory`（可配，不读 `DSH_HOME`） | 8 个自定义工具 | CJK 二元组 + ASCII 打分，≤6000 全文、超限转索引 + `memory_search` | 无 UI |
| `2424830124/dsh-memory`（`5611d2a`） | 改写 `system-prompt/assemble` 瀑布（preset 已占用 persona 段，再注册会撞重名） | `$DSH_HOME/dsh-memory/.memory` + `<workspace>/.memory` | 3 个自定义工具，写前必读 + 磁盘 hash 乐观锁 | 无检索，全文注入 + `inject_ignore` 逐标题 | `conversation.view` tab；1 条 HTTP `exact` 路由（无鉴权） |

共同事实与踩坑（均已逐条核对源码）：

1. **四家全部 `inject: ['systemPrompt']` 成功注入**，且 `section()` 与 `context()` 都能收 provider 函数；`context()` 的 provider 能拿到 `context.agent`，可按会话门控（`littleblacktong` 用它做了 `bootSnapshot: 'session'` 的会话冻结）。
2. **`interpolate: false` 是硬需求**：`baosfeng` 的 CHANGELOG 明确记录「一条含双花括号占位符的记忆会让整个 prompt 组装抛错、所有回合连败」；`2424830124` 用测试钉死 `sections[i].interpolate === false`。用 `context()` 的两家都没设，是本轮发现的最大隐患。
3. **存储都在工作区外，全部 Host 侧 `node:fs` 直写**，没有一家用 `profileContext.dir`，也没有一家用 `ctx.fs`（会触发沙箱与写前审批、并产生工作区观察事件）。
4. **捕获以自定义工具为主（3/4）**；唯一 prompt 驱动的一家依赖 `~/.memory` 可写——在默认 `workspace-write` 下不可行，只能在 `danger-full-access` 使用（与本轮 7.3 一致）。
5. **没有一家使用 owner-only RPC**：全部自建 `webServer.register` 路由，两家完全没有鉴权。PowerDSH 已有自己的 Typert owner-only RPC 体系，不应照搬这条。
6. **没有一家做向量检索或后台提取子代理**；检索都是确定性匹配（substring／CJK 二元组），印证 `P3「架构重」` 的成本判断应下调。
7. 其他可迁移的工程点：`2424830124` 按会话冻结注入文本（避免逐轮重算打掉 provider 前缀缓存）、`ruqinhu` 用正文派生 ID（避免位置编号在压缩后漂移）、`littleblacktong` 的 CJK 字节／字符预算 bug（`statSync().size` 按字节、`slice()` 按字符，中文被系统性低估 3 倍）。

## 九、证据与参考清单

官方文档：

- Codex Memories：https://developers.openai.com/codex/memories （另见 openai/codex Discussion #12567）
- Qoder Memory：https://docs.qoder.com/qoder/memory
- Trae Memories：https://docs.trae.ai/ide/memories?_lang=zh
- WorkBuddy：腾讯云开发者社区《WorkBuddy记忆功能深度解析》（developer.cloud.tencent.com/article/2701574）、《WorkBuddy记忆管理全景指南》（cnblogs.com/xiaobaiysf/p/21866387）
- ZCode Memory：ZCode 官方文档 Memory 页

源码与安装包（本机，2026-11-14 核验）：

- ZCode 源码仓 v3.17.2：`apps/zcode-cli/packages/core/src/memory/`、`packages/services/src/memory/`；运行数据 `~/.zcode/cli/memories/projects/`
- Qwen Code `6f754be`：`reference/QwenLM/qwen-code/packages/core/src/memory/`
- WorkBuddy AI（app.asar，MemoryCollector 与 memory_system 提示词）
- Trae CN（workbench.desktop.main.js 的 icubeMemoryService／PROJECT_MEMENTO.md、libai_agent.dylib 的 core_memory 域）
- DSH 官方源码 `fcc0ad46`：`packages/core/system-prompt/src/index.ts`、`packages/context/agent-instructions/`、`packages/sandbox/sandbox/src/roots.ts`、`packages/fs/fs-sandbox/src/index.ts`、`packages/core/agent-loop/src/runtime-context.ts`、`packages/core/agent/src/runtime-types.ts`
- DSH 历史发行版安装包（本机 `.references/compatibility-tests/`，13 个版本）：`dsh-system-prompt`、`dsh-tools`、`dsh-agent`、`dsh-session`、`dsh-sandbox-policy` 的公开类型与实现逐版对照
- 社区记忆插件（本机 `reference/`，均为 MIT）：`baosfeng/my-dsh-plugins` `6d1b28f`、`littleblacktong/dsh-plugin-memory` `5a3f94c`、`ruqinhu/dsh-memory` `486270d`、`2424830124/dsh-memory` `5611d2a`

---

*本报告为 2026-11-14 两轮调研记录（第二轮追加 DSH 宿主接线核验与社区插件对照）；P 级取舍与立项结论以主 Spec 为准。*
