# 记忆功能设计草案（2026-11-14）

> **状态更新**：用户已于本轮对话授权实现，已确认行为与实现约定以[记忆主 Spec](../src/features/memory/spec.md)为唯一依据。下文保留研究阶段草案，入口、开关、四动作工具及一致性细节由主 Spec 取代；记忆开启后始终自动记录，不再单设自动记录开关。

> 设计提案，未立项。本文按[功能 Spec 规范](feature-spec.md)的最小模板组织，确认后迁移为 `src/features/memory/spec.md` 并随实现维护；在此之前不视为已批准范围。机制依据见[记忆功能研究](memory-research-2026-11-14.md)；第二轮宿主核验（该文第七、八节）修正了写入路径与注入细节。
>
> **决策摘要**：建议一期按「Host 独占写入 + `power_dsh_memory` 工具 + section 策略／context 索引双通道注入 + 设置页管理」实施；两条硬约束见下。立项状态仍为未立项，需用户确认后转 `src/features/memory/spec.md`。
>
> 设计原则：**干净利落、简单高效、先进不落后**——文件制零后台进程，机制取五家已验证的最新实践（Host 重建索引、注入自愈、置顶保护、信任边界），一期不做提取子代理与检索。第二轮核验后的两条硬约束：**记忆文件只能由 Host 写**（agent 原生 Write/Edit 的可写根不含 profile，见研究 7.3），**注入文本必须自行中和 `{{`**（旧宿主 `context()` 无条件严格插值，见研究 7.2）。

## 标识、入口与范围

- 功能 id `memory`，用户可见名「记忆」。
- 入口：原生设置左侧独立「记忆」入口（排序位于壁纸之后，复用壁纸的 `settings.section` 独立入口先例），页内承载全部设置与条目管理，不在设置页重复主开关。不并入侧边栏独立页面的六功能页范围。
- 已确认目标：给 DSH 提供跨会话的长期记忆——agent 在会话中沉淀可复用的偏好与事实，后续会话自动带回；用户可查看、置顶、删除、清空。
- 一期明确不包含：会话后提取子代理、自动整理（Dream）、关键词/语义检索、团队共享、导入导出、跨设备同步、每工作区设置覆盖。以上列为二期候选，不因写入本文获得实现授权。

## 数据模型与存储

文件制，位于 DSH 数据根 `profileContext.home`（默认 `~/.dsh`，本机与壁纸／全局指令一致）下的 `power-dsh/memory/`。**所有文件由 Host 的 `MemoryStore` 写入**（Host 进程 `node:fs`；不经 `ctx.fs`，避免沙箱判定与工作区观察事件）：

```text
memory/
  MEMORY.md 与 <slug>.md
  <hash>/MEMORY.md 与 <slug>.md
```

- 两层作用域：`global`（跨工作区，文件直接位于 `memory/` 根目录）与每工作区（目录键 = 工作区路径 realpath 的 SHA-256；工作区路径取 `session.header.cwd`，不做工作区登记表依赖）。每组索引与条目直接平铺，不另设全局、条目或类型目录。
- 类型沿用五家共识四分类：`user` / `feedback` / `project` / `reference`。不引入更多分类树。
- 条目 frontmatter：`name`（kebab-case slug）、`description`（一行摘要，召回相关性依据）、`type`、`pinned`（布尔）、`created`/`updated`（ISO 日期）、`originSessionId`。正文 ≤ 1,200 字符。frontmatter 含 `schemaVersion: 1`，为将来加字段（keywords、category）留升级位。
- `MEMORY.md` 为 **Host 机器重建的索引**，每条一行，格式为「标题 + 条目相对路径 + description」（与 ZCode/Qwen 的 `- 标题 → 路径 — 摘要` 一行式一致），置顶排前。模型只写条目文件，不手编索引——这是相对 ZCode（模型手编 + 截断警告）的关键改进，避免索引漂移。
- 索引硬上限 200 行 / 25,000 个 UTF-16 码元（与 ZCode 对齐）。**上限与截断一律按字符口径统计**，不混用 `statSync().size` 字节数，避免 CJK 内容被系统性低估（社区 `littleblacktong` 踩过 3 倍偏差）。
- 写入校验与加固：frontmatter 不合法的条目不进索引，管理页标「格式异常」；路径段校验、拒绝 symlink、realpath 包含性检查（ZCode/Qwen 同款最小集）；写入为 0600 临时文件 + 原子重命名，先写条目再重建索引。
- 索引重建时机：Host 每次写入／删除／置顶／清空后同步重建；Host 启动时重建；管理页打开时对账一次。不支持用户手编后的实时热更新（无 `fs.watch`），手编内容在下次 Host 写入或重启后生效——这是为「零后台进程」做的明确取舍，写入 Spec。

## 配置与行为

设置集中在「记忆」专页（原生 `configForms` 持久化，均默认关闭或保守值）：

| 设置 | 键（`memory` 前缀） | 默认 | 说明 |
| --- | --- | --- | --- |
| 启用记忆 | `memoryEnabled` | `false` | 总开关；关闭移除注入、模型工具与管理入口、保留文件 |
| 全局记忆 | `globalScopeEnabled` | `true` | 总开关下生效；关闭停用 global 作用域读写 |
| 工作区记忆 | `workspaceScopeEnabled` | `true` | 同上，作用于工作区作用域 |
| 自动沉淀 | `autoCaptureEnabled` | `false` | 开启后常驻指令授权 agent 在发现值得记住的内容时调用记忆工具；关闭仅在用户显式要求时写 |
| 注入预算 | `injectBudget` | `standard` | 三档：`compact` 8K / `standard` 16K / `full` 25K，控制每轮注入的索引字符预算（UTF-16 码元） |

行为：

- **注入（两层）**：`systemPrompt.section()` 注册**常驻策略**（name `power-dsh:memory-policy`，`interpolate: false`，order 用字面量 700，位于 `TEAM_POLICY` 600 与 `PTC_ONLY` 800 之间；文本由 live 配置在每个装配求值，含目录位置、四类型一表、写入方式、不存清单、信任边界；`autoCaptureEnabled` 只改变「何时主动写」的授权句，不改其余内容）；`systemPrompt.context()` 注册**动态索引**（name `power-dsh:memory-index`，order 字面量 130，位于工作目录 100／沙箱 110／审批 115／子代理 120／团队身份 125 之后、harness 源码 200 之前）。context 文本以 `<memory_index>` 目录数据块呈现，开头标注 data-not-instructions；索引文本不变时宿主按文本去重、不追加新快照，变化时才在下一步追加一条 supersede 快照；超预算截断并附加 WARNING 行与**自愈指令**（要求模型先合并去重、缩短 description 或删除条目——索引由 Host 重建，不能靠手编 MEMORY.md）。
- **插值安全**：渲染索引时把文本中的 `{{` 中和为 `{` + U+200B + `{`（社区 `dsh-global-context` 同款），并同时传 `interpolate: false`（新宿主生效，旧宿主忽略该字段但已被中和保护）。策略 section 文本不含用户数据，仍显式 `interpolate: false` 防未来漂移。
- **捕获（模型侧）**：注册一个名为 `power_dsh_memory` 的原生工具（`ctx.tools.register` + `defineTool`），动作 `save` / `forget`：参数含 `scope`（`global` / `workspace`）、`type`、`name`、`description`、`content`；`execute` 内按 `exec.agent?.session.header.cwd` 解析工作区、调用 `MemoryStore` 写入/删除并同步重建索引。工具只在 `memoryEnabled` 时注册、关闭即 dispose（最低基线没有 `ToolRegistrationOptions.when`，不用 `when` 实现显隐）。工具必须声明 `output { schema, render }`（宿主硬校验），输出只含 `{ ok, scope, name, path }`，不返回正文。模型不用原生 Write/Edit 写记忆，避免沙箱拒绝与路径猜测。
- **索引重建**：`MemoryStore` 从 entries 目录扫描 frontmatter 重建，置顶前、`updated` 倒序；原子写 `MEMORY.md`；内存缓存供同步 provider 读取（provider 不 await、不阻塞、不抛错）。
- **置顶**：`pinned: true` 的条目排在索引前，且不计入自愈清理候选。
- **管理页**：作用域分组（全局 + 已登记工作区，复用技能页分组模式）、类型筛选、搜索（名称/描述/正文）；条目卡片显示类型徽标、描述、更新时间、置顶标；操作为查看详情（Modal 内 Markdown 渲染 + 元信息 + 来源会话 id 复制，照 MCP 详情模式）、置顶/取消、删除（二次确认）。作用域级操作：打开记忆目录、清空作用域（二次确认）。
- **失败行为**按[错误处理规范](error-handling.md)：注入 provider 读取失败当轮空注入并记 `memoryUnavailable` 类业务键；工具执行失败返回结构化错误、不写半成品；管理操作失败展示共享错误反馈与详情复制，不伪装成功；`systemPrompt` 服务缺席时页面显示错误反馈，不阻断其他功能入口。

## 生命周期、权限与兼容

- Host 拥有 `MemoryStore`（目录管理、frontmatter 解析、索引重建、路径加固）与 owner-only RPC：`listMemoryEntries(scope)`（快照不含正文）、`readMemoryEntry(scope, path)`、`deleteMemoryEntry(scope, path, mtime)`、`setPinned(scope, path, pinned, mtime)`、`clearMemoryScope(scope)`、`reloadMemoryIndex(scope)`。删除/置顶带 mtime 确认指纹，写前重查。
- 数据全部本地：仅读写 `power-dsh/memory/` 与上述配置键；无网络、无进程、无 DOM 接入；不读取会话正文（`originSessionId` 仅作引用记录）。记忆工具的调用与结果按宿主常规工具事件进入会话日志，符合「模型可见即已记录」约束。
- 生命周期：工具、section/context 注册与记忆页入口归属特性 context，关闭开关或卸载时释放；卸载不删除记忆文件。关闭总开关 = 移除注入、工具与管理入口，文件保留。
- **宿主接口依据（第二轮已核对）**：`systemPrompt` 自 `0.2.0-rc.1` 起存在且第三方插件可 `inject`；`section()`／`context()` 可用；`AssembleContext.agent` 自 `0.1.7-rc.2` 起存在（provider 内同步取 `context.agent.session.header.cwd`）；`context()` 的 provider 在新宿主上每步装配与请求准入重算、首请求已覆盖（旧宿主只在装配时求值，见下条）；`tools.register(definition)` 最低基线可用且强制 `output { schema, render }`；`ToolRegistrationOptions.when` 自 `0.2.2-alpha.2` 起才有，本设计不使用。
- **版本差异与降级**（详见研究 7.2）：`PromptContext.interpolate`／`required` 与 `refreshContext()` 自 `0.2.1-alpha.2` 起才有。旧版上 `interpolate` 被忽略但 `{{` 已中和；`required` 被忽略意味着部署设 `includeRuntimeContext: false`（如 `minimal` preset）时记忆索引会被整体抑制，需在 Spec 记录为已知限制；旧版无 `refreshContext`，工具写入后的索引最迟下一步生效。
- `getContextOrder` 对未知名字返回 `undefined`，而 `context()` 要求 `order` 有限；索引固定用字面量 130，不调用该函数（`0.2.0-rc.1` 的 `CONTEXT_ORDERS` 只有沙箱/审批/子代理三项）。

## 实现蓝图（立项后参考）

不新增依赖，全部落在 `src/features/memory/`：

- `definition.ts`（id、5 个配置键、分类与顺序）、`config.ts`（键 schema 与设置工具贡献）
- `memory-store.ts`：目录初始化、frontmatter 解析／校验、索引重建（200 行／25K 字符）、原子写、路径加固与 mtime 指纹
- `memory-tool.ts`：`defineTool` 的 `power_dsh_memory` 工具（`save`／`forget`），`execute` 内经 `exec.agent?.session.header.cwd` 解析工作区
- `injection.ts`：`systemPrompt.section()` 策略段与 `systemPrompt.context()` 索引段，`{{` 中和、预算截断与 WARNING
- `host.ts`：`MemoryStore` 实例、工具与注入的注册／释放（跟随 `memoryEnabled` 与 `settings/document-updated`）
- `rpc.ts`：6 个 owner-only 方法（list／read／delete／setPinned／clear／reload）
- `client.ts`／`locales.ts`／`styles.ts`：`settings.section` 记忆页、条目列表与详情
- `tests/`：store、tool、injection、rpc 行为测试；立项后新增 `spec.md`

## 验收条件与验证

仓库层（`npm run check` 覆盖）：

- MemoryStore 行为测试：frontmatter 解析（合法/非法/缺字段）、索引重建排序（置顶前、更新时间序）、200 行/25K 字符截断与 WARNING 生成（含 CJK 字符边界）、路径加固（symlink、越界路径、大小写别名拒绝）、原子写失败不破坏旧索引、`{{` 中和（`{` + U+200B + `{`）。
- 工具契约测试：`defineTool` 声明的 `output { schema, render }` 通过最低基线校验；`save`／`forget` 参数解析与错误；`memoryEnabled` 为 false 时不注册工具、切换后注册/释放配对；工具写入后索引立即可读。
- 注入测试：section/context 的 name、order、`interpolate: false`、`{{` 中和；provider 只读内存缓存不抛错；context 文本含 `<memory_index>` 与 data-not-instructions 标注；预算三档截断。
- 组合测试（内存夹具）：总开关与两个作用域开关、自动沉淀开关组合下的 section/context/工具注册与释放；`systemPrompt` 缺席时其余功能不受影响。
- 协议测试：owner-only RPC 清单、mtime 指纹不匹配拒绝、清空确认。

实际验收（安装后另行执行，不在静态检查范围）：

- 开启后新会话出现记忆策略与空索引；agent 调用记忆工具写入条目后，下一步请求的索引中出现该条目；跨会话重启后记忆仍注入。
- 管理页增删改置顶与索引一致；清空后文件删除且索引为空；关闭总开关后新会话无注入、无 `power_dsh_memory` 工具且管理入口消失。
- 删除/清空等破坏性操作均有二次确认；格式异常条目不进索引且页面可见。
- 在 `workspace-write`（默认）与 `danger-full-access` 两种文件策略下，写入都只经 Host（不出现沙箱拒绝提示）；`minimal` preset（`includeRuntimeContext: false`）下确认索引是否被抑制，并按 Spec 记录的表现对照。

---

*设计依据：[记忆功能研究](memory-research-2026-11-14.md)（2026-11-14）；范围确认后按规范建立 `src/features/memory/spec.md`。*
