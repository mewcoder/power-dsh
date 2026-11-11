# 全局指令

功能名称为「全局指令」，模块 id 与配置键保留 `personalization`，中英文页面标题与设置行均使用「全局指令」/「Global instructions」。

模块 id：`personalization`；主开关 `personalizationEnabled` 默认 `false`。模块的[定义](definition.ts)、[配置](config.ts)、[Client](client.ts)与[行为测试](tests/)在本目录维护。

## 功能与入口

在 **设置 → PowerDSH → 管理** 打开「全局指令」开关，设置侧栏新增独立的 **全局指令** Tab。开关默认关闭，通过宿主 settings 持久化，只控制 Mod 编辑入口。关闭或卸载 Mod 保留全局指令文件；DSH 原生读取仍可继续生效。暂停全局指令需编辑文件内容，不能用删除、清空或重命名用户文件实现功能开关。

**正文的唯一事实源是 `$DSH_HOME/AGENTS.md`，默认 `~/.dsh/AGENTS.md`**，大小写遵循原生文件名。Host 使用宿主 `profileContext.home` 定位同一个 DSH 数据根目录；不使用 profile 设置文件所在目录。页面顶部遵循[Title 与描述规范](../../../docs/ui.md#设置页-title-与描述)，只显示「全局指令」及全局 `AGENTS.md` 的实际文件路径描述，描述不重复 Title。文本框 placeholder 为「添加自定义指令」，不重复字段标题、不预填默认指令。外观遵循[多行文本输入框规范](../../../docs/ui.md#多行文本输入框)，对齐当前原生反馈页正文输入框的背景、边框、圆角、内边距、字号与焦点样式。

打开页面只读，不创建文件，不用空配置覆盖已有内容。不存在时显示空文本框，用户填写并保存时才创建；清空已有文件并保存会写入空正文。保留原文换行与 `{{…}}` 等字符。不显示字符计数和常驻上限文字；最多写入 20,000 个 UTF-16 代码单元，超限时提示并禁止保存，不截断草稿；现有超过编辑上限但不超过 1 MiB 的文件仍可完整读取，需缩短后保存。读取失败时禁止写入，不能把失败当作空文件。符号链接和非常规文件拒绝编辑，避免原子替换破坏链接指向。

操作区遵循[取消与保存按钮规范](../../../docs/ui.md#取消与保存按钮)，左取消、右保存，右对齐；取消用原生描边样式，保存用原生主按钮样式。页面级加载、读取失败和只读提示位于标题组之后、编辑器之前，颜色与语义遵循[状态反馈](../../../docs/ui.md#状态提示与错误反馈)；真正加载且尚无正文时使用共享 `loadingFeedback({ label: t('loading') })`，已有正文时的加载反馈使用 `compact: true` 并保留正文与草稿，只读、不可用和错误继续使用各自提示；输入校验与保存错误留在文本框下方。

保存、取消与切页行为：编辑不立即写盘；成功后以 Host 返回的文件内容为准；失败保留草稿。取消丢弃草稿并重新读取磁盘。进入页面及窗口重新获得焦点时读取最新文件。外部修改出现后保留草稿、提示冲突，取消可载入最新内容。关闭设置、切换设置页或刷新会丢弃未保存草稿。Mod 的全局指令开关不显示行内错误提示，失败仍恢复已保存状态；编辑器读写失败显示错误。

读取、保存及校验错误复用[统一错误反馈](../../../docs/error-handling.md)，提供安全错误信息与复制；读取失败可显式重试，保存失败继续保留草稿，不自动重放保存。

## 文件与原生接入

[文件模块](personalization.ts)直接读写固定的全局指令文件。读取返回绝对路径、原文与磁盘内容衍生的 SHA-256 revision，区分不存在与空文件。保存必须携带读取时的 revision；在同一个 Host 操作队列中执行，校验类型与长度、检查磁盘版本，写同目录临时文件，再检查版本并原子替换目标。临时文件使用独占创建及 0600 权限，成功和失败都清理临时文件。卸载会阻止后续操作。外部程序不参与 Mod 队列，最后一次版本检查与原子替换之间仍存在很短的竞争窗口，不承诺跨进程强事务。

[Host](../../index.ts)仅声明 `personalizationEnabled` 开关，通过 `configForms` 保存。文件正文使用 owner-only `readPersonalization` / `savePersonalization` RPC，复用严格 Typert 合约与 `OperationQueue`，不经 settings 保存正文，不接受客户端传入任意文件路径。移除旧的 `getSettingsPath` 和 Mod 自行注册的 `systemPrompt.context`，避免同一份文件重复注入。

旧版 `globalPrompt` 配置不再读取、展示或写入；既有原始字段在其他功能保存配置时保留，不自动迁移或覆盖用户的全局文件。磁盘是新编辑器的事实源；旧内容需要用户主动复制并保存至全局文件。

当前 DSH 0.2.2-rc.1 的 standard、ptc、cordis 预设独立启用 `dsh-agent-instructions`。根级同名插件被 Web bundle 禁用不代表预设内也禁用；原生实现发现全局文件，在 `agent/pre-step` 对已有 baseline 做版本对账，因此已有会话的后续步骤也可读取外部保存的新内容；已经发送的请求不追溯修改。默认 standard 的指令预算为 65,536 字节，与其他项目指令共享，实际进入上下文的内容可能受原生预算裁剪。

全局文件由同一 DSH home 下启用原生指令机制的会话读取，可跨 profile 共用；minimal 或其他未启用原生指令读取的预设不会自动获得它。Mod 不擅自启停原生插件、不改预设、不额外追加回退上下文。远程设备使用各自的数据根目录，不能仅保存本机文件就同步过去。

## 参考源码与接口依据

从 [dsh-market](https://dshmarket.com/browse/) 查找同类插件并浅克隆源码，只借鉴思路，没有复制或改编代码：

| 仓库 | 阅读提交 | 相关模块与借鉴点 |
| --- | --- | --- |
| [huanghai-lab/dsh-custom-instructions](https://github.com/huanghai-lab/dsh-custom-instructions) | `53bf72514f25dcf400d382499662c3f94cbc0dc3` | `src/index.ts`、`src/host/store.ts`：原生全局文件编辑、revision 冲突校验、原子写入；Apache-2.0，目标 DSH 0.1.2-alpha.1 |
| [sryimnoob123/dsh-global-prompt](https://github.com/sryimnoob123/dsh-global-prompt) | `de3c329a28e8e611dcdbfc477a3599f258cea77a` | `index.js`：`resolveDshHome()/AGENTS.md`、启动时磁盘优先；MIT，声明 DSH >= 0.1.1-rc.1 |
| [ZZJQ678/dsh-global-context](https://github.com/ZZJQ678/dsh-global-context) | `9e9875b5836c1f68910bf9551a55f4cac7f418d8` | `lib/index.js`、`lib/client.js`：独立文件编辑和保存交互；MIT，声明 DSH 0.1.2-rc.1。本项目采用原生 AGENTS 文件，不采用其自定义文件和 section 注入 |

接口依据为 DSH `0.2.2-rc.1` 安装包的 `dsh-home-paths`、`dsh-agent-instructions`、`dsh-fs-local`、`dsh-agent-preset-registry`、`dsh-agent-loop` 以及 Web bundle 的各预设 patch。原生 README 对刷新时机描述偏保守；实现的 `agent/pre-step → compose → reconcile` 会探测全局文件版本，以实现与运行测试为准。参考插件对旧版 DSH 的声明不代表本项目兼容保证。

## 验证

[文件测试](tests/personalization.test.mjs)仅在临时目录操作，覆盖缺失时只读、显式创建、中文与字面变量、清空、已有内容、外部修改冲突、队列中的两个过期窗口、卸载阻止写入、长度与类型校验、符号链接保护和临时文件清理。

[Client 测试](tests/client.test.mjs)覆盖独立原生 Tab 和图标的注册清理、真实文件路径描述、简短 placeholder、文件 RPC 保存取消、慢请求防重复、失败保留草稿、磁盘 revision 冲突、不可读时禁止空写、长度与只读。

额外在安装包导出的真实 `dsh-agent-instructions.apply` 上，用内存 fs/session 验证首次 baseline、外部版本变化后下一次 pre-step 替换、未变化时跳过正文重读、删除后移除；没有写入真实用户文件，没有发送模型请求。以上不等于 Inspect、具体已有会话的预设绑定或实际页面视觉验收；按[分层验证](../../../docs/development.md#验证方法与限制)分别说明。
