# AI 编码产品功能调研（2026-11-16）

> 研究材料，不是功能 Spec。用于判断 PowerDSH 下一轮功能该补什么，不构成实现授权。
>
> 数据口径：竞品功能取自各产品**官方文档、官方 changelog、官方仓库 README**，抓取于 2026-11-16。市场热度取自 [awesome-dsh-plugin](https://awesome-dsh-plugin.com/) 的 30 天下载快照（窗口约 2026-10-16 ~ 11-14），并用 npm downloads API 交叉核对；下载量只当量级看，不当精确排名。无法从官方源确认的写「未确认」，不做推断补全。
>
> 上一轮[市场插件调研](market-research-2026-11-12.md)只覆盖 dsh 插件市场与 Qoder/ZCode；本轮补上终端 Agent、IDE/工作台、VS Code 系扩展与国内产品四条线。

## 一、结论摘要

1. **检查点与文件回滚是当前最大的功能缺口。** 25 个产品中 17 个内置，实现路径分四类（影子 git 仓库、独立 object DB、会话内文件快照、真实 commit）。DSH 原生**完全没有**用户级回滚：`session-checkpoint-policy` 是崩溃恢复用的持久化屏障，`workspace-changes` 只读展示改动，没有 restore。PowerDSH 也没有。
2. **「回滚 + 编辑重发」是联动形态，不是两个功能。** Cline 与 GitHub Copilot 都明确做成「回滚文件到该轮 → 用改后的消息重发」；OpenCode 的 `/undo` 会把被撤下的 prompt 放回输入框。DSH 只有「分支到新会话」，不能原地改。
3. **DSH 原生已经覆盖了大半「共性能力」。** MCP、Skills、子智能体、定时任务、消息队列/Steer、worktree、Goal、Plan、压缩、Hooks（Claude Code / Codex 桥）、会话导出、会话搜索、语音输入、用量统计都有对应包，其中多项是随发行版关闭的可选 bundle。**这些不该重做。**
4. **dsh 插件市场里桌面集成是最大空位。** 托盘/菜单栏/全局快捷键/自启动相关插件名字命中仅 62 个、合计约 3.1 万次下载，不到单个头部插件的 1/10，且多为 Windows-only、单人维护、零星标。
5. **仓库 Wiki 与统一收件箱是两个「原生缺 + 市场弱 + 契合 PowerDSH 独立页框架」的方向**，但 Wiki 工程量最大。

## 二、覆盖范围

| 组别 | 产品 | 状态提醒 |
| --- | --- | --- |
| 终端 Agent | Claude Code、OpenAI Codex CLI、Gemini CLI、OpenCode、Aider、Crush、Amp、Goose | — |
| IDE / 工作台 | Cursor、Windsurf、Trae、Kiro、GitHub Copilot、Devin、Warp、Zed | Windsurf 已并入 Devin Desktop，Cascade 标 legacy |
| VS Code 系扩展 | Cline、Roo Code、Kilo Code、Continue、Copilot Chat、Augment Code、Factory Droid、OpenHands、Junie、Antigravity | Roo Code 2026-05-15 停服；Continue 仓库只读、终版 2.0.0；Kilo 新扩展代码索引暂时下线 |
| 国内产品 | Qoder CN（原通义灵码）、Trae CN、CodeBuddy、Comate、Qwen Code、CodeArts 码道、MarsCode、iFlow、ZCode | MarsCode 已并入 Trae；iFlow CLI 2026-04-17 关闭；Quest 视窗 2026-10-15 下线 |

## 三、功能共性矩阵

统计口径：只计「官方内置」且文档可查的能力，同族能力算一项。样本 25 个产品。

| 能力 | 出现家数 | 代表产品 | DSH 原生现状 |
| --- | --- | --- | --- |
| MCP | 全部 | 全部 | 有（`mcp-manager` + PowerDSH MCP 管理页） |
| 规则 / 指令文件（`AGENTS.md` 系） | 全部 | 全部 | 有（`agent-instructions` + PowerDSH 全局指令） |
| Skills（`SKILL.md` + 渐进披露） | 21+ | Cursor、Kiro、Copilot、Qoder、Trae、Qwen Code | 有（`skill` / `skill-filesystem` + PowerDSH 技能管理） |
| 自定义斜杠命令 / 提示词文件 | 约 18 | Cline、Kilo、Augment、Gemini CLI、OpenCode、Qoder、Windsurf | **缺**：只有插件注册的命令，无用户文件式命令 |
| 子智能体 | 约 19 | 全部主流 | 有（`subagent` + `tool-subagent` + team） |
| Hooks | 约 13 | Claude Code、Cursor、Kiro、Trae、CodeBuddy、Crush、Goose | 有（`hooks-claude-code` / `hooks-codex`，实验包） |
| **检查点 / 文件回滚** | **17** | Claude Code `/rewind`、Gemini `/restore`、OpenCode `/undo`、Cline、Kilo、Copilot、Cursor、Augment、CodeBuddy、Comate、Qwen Code、码道、Trae、Kiro | **缺**（无用户级回滚） |
| **编辑历史消息并重发** | 约 10 | Cursor、Zed、Trae、Devin、Cline、Copilot、Qoder IDE、CodeBuddy | **缺**（只有 fork 到新会话） |
| 消息队列 / 运行中插话 | 约 8 | Cursor、Warp、Zed、Augment、Copilot、Devin | 有（QueueDock + Steer + busy Enter 设置） |
| 定时 / 事件驱动自动化 | 约 12 | Copilot Automations、Cursor、Kiro、Trae、Qoder、Comate、Goose、Claude Code | 有（`schedule` + `ui-schedule` Automation 页） |
| 长期记忆 | 约 11 | Cursor、Kiro、Copilot、Kilo、Devin、Qoder、Comate、码道、Trae | 有（PowerDSH 记忆，含手动整理） |
| 仓库 Wiki / 代码地图 | 6 | Qoder Repo Wiki、码道 CodebaseWiki、Comate Deepwiki、Devin DeepWiki、ZCode Wiki、Aider repo map | **缺** |
| 后台 / 并行任务 + worktree | 约 11 | Kilo Agent Manager、Copilot Agents window、Factory Workstreams、OpenHands | 有（`jobs` + `worktree` + `ui-jobs`） |
| **统一收件箱 / 任务面板** | 3 | Qoder「需要我」、Comate Mission Mode、Warp 通知邮箱 | **缺** |
| 权限模式 + 沙箱 | 约 14 | 全部主流 | 有（`sandbox` + `permission-presets` + `auto-review`） |
| 用量 / 成本 | 约 14 | 全部主流 | 有（PowerDSH 使用统计） |
| 语音输入 | 约 11 | Cursor、Warp、Devin、Kilo、OpenHands、Antigravity、Qoder、码道 | 有（`voice-input-bundle`，实验可选包） |
| 会话分享 / 导出 | 约 10 | Kilo、OpenHands、Trae、Warp、Amp、CodeBuddy | 部分（`session-log-export` 有 Markdown + ZIP，无 HTML/链接） |
| 桌面集成（快捷键 / 托盘 / 自启动 / 保持唤醒） | 约 10 | Trae（Alt+Shift+Space）、Qoder（应用快照）、Zed（防休眠）、Warp | **缺**（Windows 有托盘，macOS 无菜单栏；无全局快捷键、自启动、保持唤醒） |

## 四、值得注意的实现差异与反例

### 4.1 回滚的四条实现路径

| 路径 | 代表 | 特点 |
| --- | --- | --- |
| 影子 git 仓库（项目外） | Cline、Gemini CLI、Kilo、Qwen Code、Roo | 不动项目 `.git`，默认开启；Cline 支持 Compare / Restore Files / Restore Task Only / Restore Files & Task |
| 会话内文件快照 | Claude Code `/rewind` | 保留最近 100 个文件快照，可选「恢复代码+对话 / 仅对话 / 仅代码」 |
| 独立 object DB | OpenCode | 每步前后各拍一次；`/undo` 把被撤下的 prompt 放回输入框供改写 |
| 真实 git commit | Aider | 每次编辑自动 commit，`/undo` 撤销最后一个提交 |

**反例（必须记住）**：Zed 在 1.27.0 **主动移除**了 agent checkpoints，理由是「每条消息前建检查点让 agent 在大仓库里变慢甚至挂起」，官方建议改用拒绝编辑或 Git 回退。这说明回滚不能做成「每轮全量快照」，应只捕获 agent 实际编辑过的文件。

### 4.2 回滚与重发是同一个交互

- **Cline**：编辑旧消息时选 Restore All，先把文件恢复到该检查点再重发。
- **GitHub Copilot**：三种粒度——编辑历史请求（回滚该请求及之后的文件改动后重发）、Restore Checkpoint（回文件并删除后续对话轮次）、Undo pending edits（只撤改动不动对话）。
- **Trae**：回退消息会移除该消息及之后所有消息，**并同步回退其文件变更**。
- **Kiro**：Checkpoint 连带回退对话上下文；Rewind 不动文件、只分叉对话。

### 4.3 DSH 已有的相邻能力（可复用，不必重造）

- `workspace-changes`：turn 起止的 git 工作树快照 + 文件工具编辑前的整文件捕获，已能列出每轮改动与逐文件对比。**它只读，不恢复**；但「捕获编辑前内容」的思路正是回滚所需。
- `session-controller.fork({ atSeq })`：按精确事件序号复制前缀，可作「编辑重发」的底层原语。
- `ui-chat` 的 `conversation.chat.assistant-actions` 与 `conversation.chat.turnTail` 是现成 slot，可在消息行加按钮。
- `ctx.commands.register()`：可在 Host 注册 `/` 命令，是用户自定义命令的接入点。

## 五、dsh 插件市场空位（2026-11-16 快照）

| 赛道 | 条目量级 | 头部量级 | 判断 |
| --- | --- | --- | --- |
| 主题 / 壁纸 / 宠物 / 侧边栏 | 各 150–420 | 单插件 9 万–56 万 | 饱和，不碰 |
| 上下文压缩 | 149 | billion-context 325 万、dsh-context 48 万 | 双寡头，不碰 |
| 记忆 | 485 | 11 万–12 万 | 饱和 |
| 用量 / 计费 | 611 | 42 万 | 饱和 |
| IM 通道 | 236 | dsh-im 13 万 | 饱和，九渠道已覆盖 |
| 技能 / MCP 管理 | 234 / 153 | 16 万 / 4 万 | 红海，PowerDSH 已在其中 |
| 自动化 / 定时 | 41 | dsh-task-board 12.5 万（看板借力） | 相对空 |
| 会话导出 / 分享 | 约 100 | 最高 2,859 | 空但需求小 |
| 仓库 / 代码索引 | 94（描述命中） | GraphFlow 1.5 万 | 半空位，工程成本高 |
| **桌面集成（托盘/快捷键/自启动/置顶窗）** | 62 | 最高 4,362 | **最大空位** |
| **通知（原生 + 免打扰 + 点击跳回 + 角标）** | 106 | 最高 23,365 | 有空位，但都是单点 |

补充事实：dsh 没有独立官方市场站，官方机制是「自定义插件索引源」，DSH 默认不内置任何索引源；awesome-dsh-plugin 事实上承担了公共市场角色。目录内 5,643 个 npm 条目中只有 5,601 个有下载数，前 10 占全部下载的 31.6%，中位数仅 1,297——典型长尾市场，排名噪声大。

## 六、取舍判断

### 6.1 插件层能补、且原生确实没有

| 优先级 | 方向 | 依据 | 成本 |
| --- | --- | --- | --- |
| **P0** | **检查点回滚 + 编辑历史消息并重发**（联动） | 17/25 家内置，DSH 零；市场只有 `dsh-rewind` 4.2 万，实现弱；可复用 `workspace-changes` 的捕获思路与 `fork(atSeq)` | M-L |
| **P1** | **统一收件箱 / 任务面板** | 只有 Qoder、Comate、Warp 三家做；PowerDSH 已有独立页面框架，落地成本低 | M |
| **P1** | **用户自定义命令 / 提示词库** | 约 18 家内置；市场分散无赢家（1 万级）；`ctx.commands.register()` 现成 | S-M |
| **P2** | **仓库 Wiki / 代码地图** | 6 家做，DSH 无；但需索引管线 + 模型调用 + 存储，工程量大 | L |
| **P2** | 桌面集成（全局快捷键 / 自启动 / 保持唤醒） | 市场最大空位 | M，但需旁路 OS 命令，违背克制定位 |
| **P3** | 会话 HTML / 分享链接 | 原生已有 Markdown + ZIP，增量小 | S |
| **不做** | IM 渠道 | 市场已饱和，原生有实验 webhook | — |
| **不做** | MCP / Skills / 子智能体 / 定时任务 / 队列 / worktree / 压缩 / 用量 | DSH 原生已覆盖 | — |

### 6.2 关键约束

1. **回滚不能每轮全量快照**（Zed 的教训）。只捕获 agent 实际编辑过的文件，其余交给 git。
2. **回滚必须与消息编辑联动**，否则用户得到的是「文件回去了但对话没回去」的半截状态。
3. **不可恢复的情形要显式说明**：无改动前内容的文件、用户期间手改过的文件、终端命令造成的改动（ZCode、Copilot 都明确排除第三类）。
4. **桌面集成若要碰 Electron 主进程就超出插件层**。PowerDSH 的 `restart-button` 已经用 `node:child_process` + AppleScript 旁路实现，同类手法可行但不优雅，需要单独评估。

## 七、证据边界

- 本轮五个方向均为文档级调研，**没有安装、运行或反编译任何竞品**；没有复制代码、提示词或资源。
- 明确标为「未确认」的项：Codex CLI 的文件回滚命令、Aider 的 skills/hooks/MCP、Amp 的 hooks、Continue/OpenHands/Junie/Antigravity 的检查点、Trae 国际版与国内版逐项差异、Qoder CN 桌面端是否有会话分支。
- 文档级结论不等于可用性验证；任何方向进入实现前，仍需按[开发指南](development.md#源码与接口发现)核对目标宿主版本的实际接口。
- 市场下载量是 30 天滚动快照，只代表关注度，不代表质量、兼容性或安全性。

## 八、主要来源

- 终端：`code.claude.com/docs`、`learn.chatgpt.com/docs`、`github.com/google-gemini/gemini-cli`、`opencode.ai/docs`、`aider.chat/docs`、`github.com/charmbracelet/crush`、`ampcode.com/docs`、`goose-docs.ai/docs`
- IDE：`cursor.com/docs`、`docs.devin.ai/desktop`、`docs.trae.cn`、`kiro.dev/docs`、`docs.github.com/copilot`、`docs.warp.dev`、`zed.dev/docs`
- 扩展：`docs.cline.bot`、`roocodeinc.github.io/Roo-Code`、`kilo.ai/docs`、`docs.continue.dev`、`code.visualstudio.com/docs/agents`、`docs.augmentcode.com`、`docs.factory.com`、`docs.openhands.dev`、`junie.jetbrains.com/docs`、`antigravity.google/docs`
- 国内：`docs.qoder.cn`、`changelog.qoder.cn`、`docs.trae.cn`、`www.codebuddy.cn/docs`、`cloud.baidu.com/doc/COMATE`、`qwenlm.github.io/qwen-code-docs`、`codearts.huaweicloud.com/changelog.html`、`zcode.z.ai/cn/docs`
- dsh 市场：`awesome-dsh-plugin.com/catalog.json`、`cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json`、`registry.npmjs.org`
- 宿主原生能力：本机固定源码 `fcc0ad46`（`packages/`）与 `docs/config-catalog.md`

---

*本报告是 2026-11-16 的调研记录；结论以第六节「取舍判断」为准。*
