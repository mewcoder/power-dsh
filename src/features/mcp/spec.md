# MCP 管理

模块 id：`mcp`；主开关 `mcpManagerEnabled` 默认 `false`。模块的[定义](definition.ts)、[配置](config.ts)、[Client](client.ts)与[行为测试](tests/)在本目录维护。

## 入口与范围

在 **设置 → PowerDSH → 管理** 打开「MCP 管理」，原生设置侧栏新增独立「MCP」页。入口默认关闭并独立持久化；关闭入口只移除页面。页面说明为「管理可用的 MCP」，只管理全局 MCP，读取原生配置与已有提供插件的全局实例，不提供工作区范围、工作区文件扫描或工作区实例展示；列表与刷新不建立连接或接管服务器生命周期，只有用户主动点击「测试连接」时才进行一次临时连接并在结束后关闭。

列表按「用户／内置」分组：用户配置的 profile 条目及原生管理器配置项归用户；Bundle 声明、插件注册及模式提供的条目归内置，说明为「由插件或模式提供」。内置表示随提供方带入，不代表官方。原生用户自定义模式通过真实的 preset 配置 ID 对应 Loader 条目，不凭模式名称或 entryId 前缀推断归属。同一 Bundle 重复声明相同条目时合并来源；多个启用 Bundle 声明同一 MCP 或模式条目时，保留单个实际条目及内置分类，省略无法唯一确认的 Bundle 来源，不因来源歧义取消整个目录。启停权限仍只依据原生清单的唯一 patchId、状态和只读原因，不从来源标签推导写入目标。

`dsh-mcp-resources` 是共享服务，不作为 MCP 服务器条目展示。没有可确认全局作用域的动态实例不加入列表；页面不声称穷尽第三方自建协议桥或所有运行中连接。不增加服务器新增、编辑、删除、导入、单个工具开关或会话覆盖。提供真实连接状态展示与只读「测试连接」：均复用原生 `@deepseek-ai/dsh-mcp-client` 的公开能力，不新建连接、不修改配置、不注册工具、不接管服务器生命周期。

## 原生目录与启停

[MCP 策略](mcp-policy.ts)使用 `pluginManager.listPlugins()`、`listBundles()` 和 `agentPresets.compositionInventory()` 取得原生配置清单。只有状态明确、有唯一 patchId 且没有 readOnlyReason 的 profile 条目可调用 `setPluginEnabled(entryId, enabled)`。模式组合中的相对 ID 和页面生成的 ID 都不能作为 profile 写入目标。

[提供方目录](mcp-providers.ts)从宿主 Loader 导入同一份 MCP 与 scope 模块，以 `registry.get(nativeMcp).fibers` 的真实回调身份取得已加载的全局实例。只读取必要的名称、生命周期标识、传输类型标量、作用域元数据与原生连接状态句柄的只读快照，不按插件名包含关系或 `mcp__` 工具名称合成服务器，不枚举工作区或 Agent 以判断工作区归属，不重新挂载或释放提供方实例。

静态配置与运行实例按 Loader 条目的实际 Fiber uid 对应，同一实例仅显示一次；不能依赖 Fiber 继承的 `entry` 或对象引用来去重，否则 Include 节点会造成重复条目。显示名称优先使用已解析配置中的 `serverName`；首次解析尚未完成时，只从公开 `rawConfig.serverName` 取字面量身份，不执行表达式，也不据此判断连接成功。模式归属 id 可从已验证配置回退读取。旧 Cordis 在等待依赖时没有公开的未解析配置入口：profile 声明仍可显示名称和 pending 状态，缺少公开身份的纯动态实例等到配置解析后再列出，不读取内部 `_config`。持久化操作仍使用原生 entryId。来源只显示可确认的 Bundle、提供插件或模式身份，排除 `cordis:include` 等结构节点，不编造配置路径或服务器简介。

若运行时提供 `mcpManager`，必须先由唯一匹配的 active `@deepseek-ai/dsh-mcp-manager` Loader 条目确认原生归属，再读取其 `list()` 与公开 `config.servers`：配置项归用户，插件注册项归内置，移除后的清理残留不作为新配置展示。第三方可能使用同名服务但提供不同协议（已核对 `dsh-skill-mcp-panel@2.3.7`）；没有可确认的原生归属时不读取其配置或调用其方法，继续按原生 profile、模式和动态 MCP 客户端实例列目录，不将同名第三方网关误认作原生管理器。已确认的原生管理器读取失败仍报错，不吞为空列表。配置项通过原生 Settings 的 descriptor namespace、revision 和单路径 `mutate` 修改 `servers.<name>.enabled`，不重写整份服务器配置。服务的 `ctx` 会被 Cordis 绑定为调用位置，因此真实管理器归属以原生 Loader 条目确定，不能用 `service.ctx.fiber` 推断。

动态插件没有通用的持久化启停接口时显示「由提供插件管理」并保持只读，不通过直接 dispose Fiber 假装保存了启停。原生管理器缺少可确认的 Settings 控制入口时同样只读。条件状态不显示为确定的开或关。

每次 profile 变更后重新读取原生状态：只有 application=applied、无警告且实际 enabled 与请求相同才算完成。需要重启、被覆盖、应用失败或读回不确定分别显示固定说明。原生调用抛错也会读回事实，不假设已回滚。同值请求不重复写入。管理器配置写入使用原生 revision 检查并核对实际 enabled，不重述其他字段或凭据。

开关表示配置启用意图，状态分两层展示：**真实连接状态**优先，**装载生命周期**作为回退。真实连接状态来自原生 `@deepseek-ai/dsh-mcp-client` 导出的 `connectionStatusOf(fiber)` 句柄的 `current()`，只投影白名单字段 `{ state, toolCount?, connectedAt?, attempt?, maxAttempts?, reason? }`：`connected` 显示绿色 `done` 圆点与「已连接」；`connecting`／`reconnecting` 显示 `ongoing` 加载指示并保留双语无障碍名称，`reconnecting` 显示「重连中 {attempt}/{max}」；`waiting-credentials` 显示 `warning` 圆点与「等待凭据」；`failed` 使用错误 token 与「连接失败」；`closed` 显示灰色 `idle` 与「未连接」。开关明确关闭时，第二行状态位置统一显示灰色 `idle` 圆点与「已关闭」／`Disabled`，优先于缓存连接状态。连接句柄缺失、读取抛错或 `state` 不在枚举内时不伪造连接态，回退到生命周期标签。`runtimeState` 仍在无连接句柄时使用 `pending`、`loading`、`active`、`failed`、`unloading`、`inactive`、`disabled`、`unknown`：`active/failed/inactive` 显示「运行中」「加载失败」「未运行」三种稳定状态；`pending/loading/unloading` 只显示 `StateDot` 的 `ongoing` 加载指示并保留双语无障碍名称，不常驻过渡文字；`disabled` 显示「已关闭」；`unknown` 不伪造状态。生命周期来自可确认的 Loader/Fiber 或原生管理器归属，不按工具数量、保存成功或开关值猜测。Fiber active 不等于网络连接成功，页面只用连接句柄报告「已连接」；原始 `lastError`、`nextRetryAtMs` 等诊断文本不跨 RPC。全局停用可能影响同配置下的会话和在途调用；关闭 stdio 客户端可能结束子进程，关闭 HTTP 客户端不代表停止远端服务。已发生的外部操作不会撤回。

## 界面与数据

页面首次无目录时通过共享 `loadingFeedback({ label: t('loading') })` 显示公共 `StateDot` 的 `ongoing` 加载反馈；同一上下文重新加载时保留旧列表，使用 `compact: true` 的紧凑反馈。页面加载错误放在标题之后、搜索之前，卡片操作错误留在对应控件旁；复用[统一错误反馈](../../../docs/error-handling.md)，提供安全错误信息与复制，既有分环节代码继续保留，不自动重放启停操作。

页面沿用技能页的 760px 最大宽度、18px／600 标题、13px 说明、36px 搜索框和双列卡片，小于等于 520px 容器时单列。搜索框通栏，不显示范围 Tab 或工作区下拉。用户组默认展开、内置组默认收起；搜索自动展开命中组，清空后恢复手动状态。卡片第一行仅显示带原生 Tooltip 的名称 span 与独立紧凑开关，名称允许键盘聚焦。第二行状态文字前显示原生 `StateDot`（点与文字相隔 6px）：已连接为绿色 `done`、连接失败为红色 `error`、未连接为灰色 `idle`、等待凭据为 `warning`；连接中／重连中只显示 `ongoing` 加载指示并保留无障碍名称，不仅依靠颜色；回退到生命周期时沿用其标签与圆点（`active` 绿色、`failed` 错误色、`inactive`/`disabled` 灰色）。稳定状态使用次要文字，失败使用错误 token。标题下的第二行并排显示类型标签和状态，间距 8px，窄卡允许自然换行：原生 `stdio` 显示「本地」／`Local`，`streamable-http` 显示 `HTTP`；未知类型只省略标签，不默认推断本地。只要类型或状态可显示就保留信息行，两者均无内容时省略整行。标签沿用原生 outline 胶囊规格。「已关闭」与连接／生命周期状态共用第二行类型标签旁的状态位置，关闭使用灰色 `idle` 圆点。

卡片最后一行左侧是工具数量的纯文本（「{count} 个工具」／`{count} tools`，英文单数为 `1 tool`），右侧依次是「测试连接」与「详情」两个次要文字按钮。该行使用 `margin-top:auto` 贴住卡片底部，同一排卡片按行拉伸到等高，因此内容多少不影响按钮位置。行按 `justify-content:flex-end` 右对齐、数量文本以 `margin-right:auto` 靠左，因此没有数量文本时两个按钮仍在最右，不使用会在单子元素时把按钮顶到行首的 `space-between`。**卡片不提供展开箭头、工具展开区或可点击的头部**：工具名只在详情弹窗中查看，卡片头部没有 `onClick`、`aria-expanded` 或 `data-expandable`。开关明确关闭或该服务器没有工具时不显示数量文本，只留两个按钮；已关闭的服务器即使仍有缓存工具也不显示数量或工具名。名称长时继续用原生 Tooltip 显示全名。「测试连接」按[列表行内操作按钮](../../../docs/ui.md#列表行内操作按钮)规格实现，可访问名称包含服务器名；点击后该按钮进入 `aria-busy` 与「测试中…」状态并禁止重复点击，结果就地显示在卡片底部：成功以 `role="status"` 的次要文字显示「已连接 · {count} 个工具 · {ms} ms」，并按需附加服务器自报身份、工具列表已截断与清理未确认提示；失败复用共享错误反馈（代码 `PD-MCP-PROBE`），摘要固定为连接阶段或列工具阶段的产品文案，脱敏后的原生诊断只进入可复制详情，可就地重试同一服务器。测试不改变目录、开关或服务器状态。

owner-only RPC 为 `listMcpServers()`、`readMcpServer(id)`、`setMcpServerEnabled(id, enabled)` 与 `probeMcpServer(id)`，共用 Mod 操作队列。目录响应为 `{ complete, servers }`，不含 scope、cwd 或 workspaces。服务器只返回白名单字段：id、名称、真实来源、用户／内置分组、enabled、配置状态是否明确、`runtimeState`、可选 `connection`（仅上文列出的连接白名单字段）、`transport`（仅 `stdio/streamable-http/unknown`）、能否操作、安全原因代码及 `tools: string[]`。类型只读取原生配置中已确认的传输标量，未知时省略标签，不从名称、工具、命令或 URL 推断；配置内容仍不进入响应。`probeMcpServer(id)` 只在目录中该条目仍然存在时，用原生 `@deepseek-ai/dsh-mcp-client` 导出的 `probeServer(ctx, config, { timeoutMs })` 真实连接一次并关闭：成功返回 `{ ok:true, serverInfo?, toolNames[], truncated, durationMs, cleanupFailed }`，失败返回 `{ ok:false, stage:'connect'|'list', message, durationMs, cleanupFailed }`；`message` 经共享脱敏与长度限制，不含凭据、URL 或机器绝对路径，不返回原始配置、异常对象或堆栈；无法开始探测（模板非法、缺少凭据提供方、服务缺席）统一映射为 `mcpProbeFailed`，不暴露原生诊断。工具名优先读取原生 `tools.definitions(scope)`；旧版没有该接口时，从公开 `tools.schemas(scope)` 只提取名称，再通过 `tools.get(name, scope)` 与父作用域真实定义的对象身份比较，排除继承工具并保留当前作用域的同名覆盖。两条路径均遵守宿主作用域与限制，只对应已确认服务器的 MCP 命名空间，不额外调用 MCP 的 `listTools`。旧宿主投影 schema 时会读取当前作用域所有可见工具的描述与参数，Mod 不保存或返回这些字段；执行回调不读取、不调用。投影抛错时报告加载失败，不吞为零工具。响应仅传显示所需的注册短名，不传完整工具定义、描述、参数或回调。来源元数据继续用于分类和搜索，不作为卡片底部标签。不传 command/args、env、headers、URL、原始配置或原始诊断。Host 与 Client 均校验白名单；过期响应不得覆盖新结果，写入期间拒绝重复操作，失败后重新读取实际状态。

`readMcpServer(id)` 只服务详情弹窗，返回 `{ server, config }`，其中 `server` 与目录同一份白名单字段，`config` 为 `null` 或该条目的只读配置投影：`transport`、`envKeys`、`headerKeys`、`expressions`、`urlQueryHidden`，以及仅在条目声明时出现的 `serverName`、`command`、`args`、`cwd`、`url` 与 `reconnect`。`env`／`headers` 只传键名，永不传值；`args` 保留普通参数及顺序，只把已识别敏感字段的值替换为 `[REDACTED]`：支持 Token、API Key、密码等名称的独立值与等号形式、环境赋值、认证头和 URL 凭据。任意脚本或未命名的位置参数不做语义推断；规则不保证识别所有自定义凭据。Host 投影和 Client 解码共用同一规则。参数行始终展示，有参数时显示内容；Host 对确认未声明参数的条目返回空数组，Client 仅对明确空数组显示「无」。配置无法读取、参数内容缺失或由表达式提供时显示「不可用」，不把未知当成不存在。旧后端仍返回 `argsHidden: true` 而没有参数数组时，详情读取失败并提示重启 DSH；插件启停操作返回 `applied` 不等于已验证后端代码更新；仍收到旧格式时需重启 DSH 加载当前产物。`url` 按 HTTP／HTTPS URL 解析后仅返回 origin（协议、主机及端口），去掉用户名、密码、路径、查询串与片段；隐藏这些部分时把 `urlQueryHidden` 置为 true；地址无法解析或协议不受支持时省略地址并保留隐藏提示；写成 Loader `!!js` 表达式的字段不求值、不返回原文，只把字段名放进 `expressions`。profile 与模式条目从 Loader 条目声明读取，管理器与动态实例只读已解析配置；找不到唯一来源时 `config` 为 `null`，不猜配置。id 为空或非法时抛 `mcpUnavailable`，目录中已不存在该条目时返回 `null`。读取不写入、不启停、不连接服务器，也不改变目录快照。

加载失败按初始化、插件清单、Bundle 清单、模式清单、运行实例/工具、条目元数据六个环节返回固定错误键，页面提供双语说明和对应的 `MCP-INIT/PLUGINS/BUNDLES/PRESETS/PROVIDERS/METADATA` 标识及重试入口。卸载或代际失效仍报告不可用。未知 RPC、网络及响应校验错误保留通用加载失败提示；所有提示不包含原始异常、路径、配置或凭据，失败不表示未配置或零工具。

页面挂载、窗口重新获得焦点及写入后读回时刷新列表。页面打开期间，每 2 秒在页面可见且没有读取或写入进行时刷新运行状态；隐藏时跳过轮询，卸载时释放定时器和监听。状态刷新不重置搜索与分组状态，也不关闭已打开的详情弹窗。

## 详情弹窗

每张卡片的「详情」文字按钮按[列表行内操作按钮](../../../docs/ui.md#列表行内操作按钮)的次要操作规格实现，可访问名称包含服务器名，并关联该条目的只读原因。点击打开宿主公共 `Modal`（宽 `min(420px,100%)`）：标题「MCP 详情」，说明为服务器名，底部只有一个「关闭」按钮并默认聚焦。弹窗只读，不含新增、编辑、删除或连接测试入口。

正文是一张只读两列 `dl`，保留调用方式与运行状态，不重复来源和开关；配置项**只列该条目实际声明的字段**，不补宿主默认值：

| 字段 | 条件 | 展示 |
| --- | --- | --- |
| 调用方式 | 总是 | 「本地」／`Local` 或 `HTTP`，目录类型未知时回退显式配置，仍未知时显示「不可用」 |
| 运行状态 | 总是 | 有连接句柄时显示真实连接状态（已连接／连接中／重连中 n/max／等待凭据／连接失败／未连接），否则回退到本地化生命周期状态；均未知时显示「不可用」；明确关闭时显示「已关闭」 |
| 命令 | 条目声明 `command` 时 | 等宽字体，只显示可执行命令 |
| 命令参数 | 总是 | 有参数时等宽显示，敏感值为 `[REDACTED]`；含空格等字符的参数加引号区分边界；确认空数组显示「无」，未知显示「不可用」 |
| 工作目录 | 条目声明 `cwd` 时 | 等宽字体，允许换行 |
| 地址 | 条目声明可解析的 HTTP／HTTPS `url` 时 | 等宽字体，只显示协议、主机和端口 |
| 地址详情 | 地址有未展示部分或无法安全解析时 | 说明只展示协议、主机和端口；无法安全解析的地址不显示 |
| 环境变量 | 条目声明 `env` 时 | 只显示键名胶囊，永不显示值 |
| 请求头 | 条目声明 `headers` 时 | 只显示键名胶囊，永不显示值 |
| 自动重连 | `reconnect` 有可展示的显式子字段时 | 只显示已声明的开关、首次延迟、最大延迟与最多尝试次数，各项用本地化标签区分；缺省字段不显示，不补宿主默认值或零值 |
| 由表达式设置 | 有 Loader `!!js` 字段时 | 只列出这些字段名，不显示表达式原文 |

详情只展示上表字段；`toolCallTimeoutMs`、`failOnStartupError`、`maxInstructionBytes` 不纳入当前详情投影，`startupTimeoutMs`、`closeTimeoutMs`、`expandTemplates` 不属于目标宿主 `0.2.2-rc.1` 的 `dsh-mcp-client` 配置，本页不展示。**空值不产生空行**：Host 在应用启动时加载、页面刷新只更新 Client，因此旧 Host 可能对未声明字段返回空字符串；Client 对可选字段同时判断「存在且非空」，只有字段名没有值的行不会渲染。弹窗底部以 `0.5px` 主题分隔线隔开工具区，逐项列出该服务器当前的工具名；没有工具时显示「暂无已加载工具」。**字段集合与开关状态无关**：打开和关闭的服务器显示完全相同的行，只有取值不同，避免「同一个弹窗换个服务器就换一套字段」。关闭时「运行状态」显示「已关闭」，不采用缓存实例可能仍报告的「运行中」；工具区保留标题，但不列出缓存中的工具名，改为显示「暂无可用工具」（开启但没有工具时仍是「暂无已加载工具」）。卡片遵循同一规则：关闭的服务器不显示工具数量。

打开时才调用 `readMcpServer`，读取中使用共享 `loadingFeedback({ label: t('mcpDetailLoading') })` 显示加载反馈，读取失败在弹窗内复用[统一错误反馈](../../../docs/error-handling.md)（代码 `PD-MCP-DETAIL`）并可就地重试同一条目，失败摘要以共享反馈的 modal 横幅形态展示；条目已从目录消失时显示固定说明，不显示陈旧配置、状态或缓存工具名；读取中与失败时也不展示尚未确认的工具列表。关闭、Escape、遮罩点击或关闭按钮只收起弹窗并把焦点还给触发按钮。关闭后到达的响应、以及被后续请求取代的响应都不再更新弹窗；关闭弹窗不刷新目录、不改动服务器、不重放读取。

## 接口依据与验证

接口依据为 DSH `0.2.2-rc.1` 安装包及[历史标签核对](../../../docs/compatibility-audit.md#官方发行标签的接口证据)，覆盖 MCP 客户端、Scope、Cordis Registry／Fiber、Loader、Plugin Manager、Settings 及模式清单。`@deepseek-ai/dsh-mcp-client` 的公开导出 `connectionStatusOf(fiber)`（句柄 `current()`／`onChange()`）与 `probeServer(ctx, config, options)`（独立超时与取消、只读连接、读取身份与工具名后关闭、不注册工具）按安装包核对；`probeServer` 不依赖 `mcpManager`，因此对 profile／preset／manager／运行时实例均可探测。上游源码的 `mcpManager` 与目标发行包是否实际提供该服务分别判断，不把新版字段或导出套到旧发行包。市场参考的确切提交、MIT 许可与边界见[来源研究](../../../docs/third-party-notices.md#技能与-mcp-来源研究)及[运行状态参考](../../../docs/third-party-notices.md#mcp-运行状态参考)，未复制第三方目录扫描器、独立连接器或 profile 接管逻辑。

[策略测试](tests/mcp-policy.test.mjs)、[提供方测试](tests/mcp-providers.test.mjs)和 [Host 装配测试](../../../tests/integration/host-wiring.test.mjs)覆盖真实 Cordis 作用域、模块身份、静态／动态去重、原生 Settings 更新、失败读回、白名单和卸载边界；原生 MCP 传输在测试中替换为不连接的插件。提供方测试另覆盖连接状态白名单投影、未知或抛错的连接句柄不伪造状态，以及 `probeServer` 的只读调用、失败诊断脱敏与陈旧 id 拒绝。Client 测试覆盖仅全局的分组与搜索、卡片不提供展开、工具数量文本与双语空态、开关与详情入口相互独立、真实连接状态各态圆点与双语标签（开关关闭优先）、测试连接的成功／失败／进行中与只读语义、可见时空闲轮询与卸载清理、慢请求、过期响应、只读和错误恢复；wire 测试校验 `connection` 与 `probeMcpServer` 的字段白名单与非法值拒绝。详情弹窗另覆盖按需读取、凭据键名与地址脱敏、表达式字段隐藏、读取失败重试、条目消失、关闭后丢弃迟到响应以及后发请求取代先发请求；Host 侧校验详情响应只含白名单字段。仓库检查不代表实际远端连接或 GUI 已验收，不为测试而擅自启停用户真实 MCP。

## 验收条件

- 卡片与详情的第二行在原生连接句柄存在时显示真实连接状态（已连接／连接中／重连中 n/max／等待凭据／连接失败／未连接），圆点与双语标签符合状态；句柄缺失、读取失败或状态非法时回退到生命周期或「不可用」，不显示「已连接」。
- 开关明确关闭的服务器始终显示「已关闭」，即使缓存句柄仍报告已连接；它不显示工具数量。
- 「测试连接」按钮对每张卡片可用，点击后显示「测试中…」并禁止重复点击；成功就地显示「已连接 · N 个工具 · X ms」，失败以产品摘要加共享错误反馈呈现，脱敏诊断只进入可复制详情；测试不改变目录、开关或服务器状态。
- 目录响应只含白名单字段；`connection` 只含 `state/toolCount/connectedAt/attempt/maxAttempts/reason`，不传 `lastError`、`nextRetryAtMs`、命令、URL、凭据或原始配置；探测失败文本不含凭据、URL 或机器路径。
- 关闭入口或卸载后移除页面、释放刷新定时器与监听，不留下探测连接或后台轮询。
