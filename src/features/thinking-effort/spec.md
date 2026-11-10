# 推理等级选择器

模块 id：`thinking-effort`；主开关 `showThinkingEffortSwitcher` 默认 `false`，图形样式偏好 `thinkingEffortGlyph` 默认 `arc`。模块的[定义](definition.ts)、[配置](config.ts)、[档位计算](levels.ts)、[样式](styles.ts)、[Client](client.ts)与[行为测试](tests/)在本目录维护。

## 标识、入口与范围

在 **设置 → PowerDSH → 界面** 提供「快捷推理等级切换」，说明为「在模型选择旁显示推理等级切换按钮」。开启后在输入框工具行的 `conversation.input.right` 原生 slot 注册一枚紧凑按钮：注册位不变，但按钮以自身 `order:1` 在同一个 `standardControls` flex 容器内视觉排在官方模型座位**右侧**；按钮默认用仪表盘显示当前推理等级，也可选择信号格；点击一次切换到下一档，到顶回到序列开头循环。

**位置稳定性**：宿主 `trailing` 组（`margin-left:auto`）靠右对齐，官方模型座位的文字宽度随模型名和档位名变化，会把同组最左侧的控件推着左右移动。`SlotOutlet` 的 anchor 使用 `display:contents`，slot 条目直接成为 `standardControls` 的 flex item，因此本按钮可以用只作用于自身的 `order` 排到模型座位之后，由右侧固定宽度的发送按钮锚定；模型座位变宽时改为向左扩展，按钮位置不再漂移。这不修改宿主 DOM 或 CSS、不替换任何座位、不跨出宿主分配的 slot 容器，是主 Spec 已记录的有限视觉例外；若宿主日后提供模型座位右侧的 list slot，应迁移到该注册位。

目标是给宿主已有的「模型 · 推理等级」补一个可关掉的快捷入口，减少每次切换都要打开官方模型菜单的操作。保留官方模型座位、官方档位表与 `/model` 入口，不替换、不覆盖、不隐藏任何原生控件。不包含：档位声明补齐、模型或供应商配置写入、请求参数改写、按任务自动升降档、跨模型记忆档位、滑块/粒子/WebGL 特效、独立设置页。

## 配置与行为

`showThinkingEffortSwitcher` 是独立的 boolean 偏好，默认 `false`，通过宿主 `configForms` 在 `power-dsh` 命名空间持久化，仅由本开关读写；`power_dsh_settings` 不暴露该键。设置行的保存成功、保存中、失败回到已保存值的行为由共享设置外壳处理。

`thinkingEffortGlyph` 是独立的字符串偏好，默认 `arc`，取值 `signal`（信号格）或 `arc`（仪表盘），非法值回退 `arc`，同样通过 `configForms` 持久化，仅由本功能读写。

**档位与格数**：按钮读取当前会话模型目录（`ctx.modelDirectories.directoryFor(sessionId)`）的快照。档位序列完全复用官方 `effortChoices` 的规则：按当前模型 `reasoning.efforts` 的声明顺序；仅当模型未声明 `reasoning.defaultEffort` 时，序列开头才有「默认」（`reasoningEffort` 省略）。格数 `N` 等于该模型声明的档位数，**1 格 = 1 档**，只随模型变化，不随当前档位变化；「默认」不计格，显示为 0 格全空；第 i 档点亮前 i 格。高度按档位数 `N` 等分：第 i 格高度为 `13 × i / N` px（i 从 1 开始），所有格子底部对齐；两档为 6.5 / 13px，四档为 3.25 / 6.5 / 9.75 / 13px，最后一格总是最高，不固定最低格为 4px；按钮只显示图形：28 × 28 的紧凑按钮（与官方模型座位同高）内居中放 20 × 14 的信号格，格宽 3px、间距 2px，每根线条的 `rx` 与 `ry` 均为实际格宽的一半，呈两端全圆角；档位多时按图形区等比收窄、不截断，圆角同步缩放；不显示文字标签。档位名与下一档由公共 `Tooltip` 和按钮 `aria-label` 提供，视觉状态由点亮的格数表达，不只靠颜色。

**图形样式**：`arc` 为默认的仪表盘，参照宿主内置 `gauge-outline` 产品图标（16 × 16，半径 6.5、底部开口 270°）复刻成固定仪表：浅色圆弧、含首尾的 5 条较亮内刻度（0、25%、50%、75%、100%，把整段 270° 圆弧四等分）、强调色指针与中心圆点；内刻度从半径 5 延伸到 6.25，比 0.42 透明度的圆弧略亮（0.55 透明度、0.95 线宽），清晰但不抢眼；真实档位均匀铺满整段刻度，指针按当前档位从低（左）转到高（右）。「默认」不是档位，不占任何刻度，指针停在底部缺口并变灰（自动态），`aria-label` 与 Tooltip 仍写「默认」。灰色与强调色共用同一指针和圆心几何：16 × 16 坐标内线宽 1.2、圆心半径 1，圆心仅填充、不描边；两种状态仅切换颜色，不额外叠加透明度。`signal` 为可选的竖直信号格，按档位数等分高度。两种样式共用档位数、当前档与 `aria-label`，只改变图形；`arc` 显示为 24 × 24 并垂直居中，刻度轻、指针重；指针以中心为轴用 180ms 过渡平滑转到新档位；多档模型的最高档回默认、默认进最低档均沿底部缺口走相邻的 45°，用连续累计角度避免跨周期倒转，真实档位之间仍沿完整刻度移动；`prefers-reduced-motion` 下关闭动画。

**Max 档颜色**：仪表盘仅在宿主读回的有效档位 id 为 `max` 时，将指针与中心圆点改为橙色，使用已核对的主题 token `--dsw-alias-state-warn-primary` 跟随浅深主题。其他明确档位继续使用主题强调色，「默认」仍为灰色；模型最高档若为 `high`、`xhigh` 等其他 id，不套用 Max 颜色。提交中保留已确认档位的颜色，成功读回后更新；圆弧、刻度、信号格、几何及动画保持原有规则。

**推理等级切换按钮样式设置**：主开关开启时，设置页「快捷推理等级切换」下显示一行「推理等级切换按钮样式」，说明为「设置模型选择旁的快捷切换按钮外观。」，用公共 `Menu` 在「信号格」与「仪表盘」间选择，默认「仪表盘」；选择后保存偏好，按钮按新样式即时重绘。主开关关闭、配置未就绪、设置不可写或卸载时隐藏该行。

**样式与间距**：按钮材质对齐 `dsh-client-ui-model-selection` 的 `.trigger`——无边框、透明底、`--dsw-radius-sm` 圆角、默认与 hover 均保持透明、`box-shadow:none`；键盘 `focus-visible` 使用 2px 的主题色 outline、外偏移 2px，不使用阴影；菜单浮层的 `--dsw-elevation-prominent` 不属于按钮。提交中仍禁用按钮、防止连点，但保持图形颜色、透明度和几何不变，避免与左侧模型选择共享忙碌状态时闪灰；「默认」灰色仅表示自动态。点亮格用宿主主题强调色 `--dsw-alias-state-business-primary`（官方发送按钮与 focus 环同色；官方源码注明 `--dsw-alias-brand-primary` 在 composer 主题里解析为墨色，故不用于此处），未点亮格继承 `--dsw-alias-label-secondary` 并降低透明度，全部通过主题 token 跟随浅深色。宿主 `.standardControls` 的固定 gap 为 12px，本按钮以自身 `margin-left:-8px` 与 `margin-right:-8px` 把与**两侧**官方模型座位、发送按钮的视觉间距都收到约 4px；这是作用于模块自身元素的局部调整，不修改宿主布局、不注入全局 CSS、不覆盖宿主类名。

**已知限制**：CSS `order` 只改变视觉顺序，DOM 顺序不变，因此键盘 Tab 的焦点顺序仍是本按钮先于官方模型座位，与视觉左右顺序相反。两个控件相邻、均可正常聚焦与操作，不阻断使用；这是为换取位置稳定而接受的代价，不能用隐藏焦点或强制正数 `tabindex` 掩饰。

**点击**：直接切换、不打开菜单或确认框；一次点击向模型目录提交 `select({ provider, model, reasoningEffort? })`，目标为序列中的下一项；「默认」提交时不带 `reasoningEffort`。**不乐观更新**：显示值始终来自宿主目录快照，宿主确认后由订阅刷新。提交中按钮 `aria-busy` 并禁用，防止连点；失败时保持已保存档位、在悬浮提示显示「无法切换推理等级，请重试」及原因，下一次点击即可重试。并发时最后一次提交由宿主目录自己的代际规则裁决，模块不补发旧请求。

**会话范围**：指针读取、点击提交均绑定当前 slot 的 `sessionId`，不遍历或批量修改其他会话。沿用的官方 `selectModel` 除更新目标会话外，还会异步将完整模型与推理档位选择保存到 `agentDefaultModel`，作为后续新建会话的默认选择；这属于宿主行为，本模块不额外实现全局同步或会话独立保存机制。其他已有独立选择的会话保留自己的设置，尚未形成独立选择的默认显示由宿主决定。默认保存失败不撤销已成功的会话选择。

**不可用**：模型目录服务缺席、`sessionId` 缺失、目录解析抛错、`current` 为空、当前模型不在已加载目录、模型未声明任何档位时，组件返回 `null`（隐藏按钮），不伪造档位、不显示假状态。开关关闭、配置未就绪、设置不可写或卸载 Client 时移除 slot 注册。

推理等级切换按钮样式偏好保存失败使用[统一错误反馈](../../../docs/error-handling.md)，在设置行提供错误信息与复制并关联控件。输入框图形按钮继续沿用既有 Tooltip 错误承载，不在输入工具行插入展开式诊断控件。

## 生命周期、权限与兼容

注册、订阅和按钮状态都挂在 Client context 的 effect 与组件内：关闭开关或卸载时注销 slot、释放模型目录快照订阅与加载副作用；持久偏好保留，重新开启后重新注册。不安装全局事件监听、不查询其他插件 DOM、不注入覆盖宿主的全局 CSS（仅使用带 `power-dsh-effort-` 前缀的局部样式标签）、不运行时导入宿主内部 UI 组件；公共 `Tooltip` 来自 shell baseline 模块表。

只读取当前会话的模型目录快照，并通过官方 `select` 更新会话选择及由宿主保存的默认选择；本模块不直接读写 profile、凭据、文件、网络请求或其他 Host 状态，不新增 RPC、Host 方法、依赖或工具贡献。Host 侧只有配置字段。

接口依据为本机 DSH `0.2.2-rc.1` 安装包只读源码：`dsh-client-ui-conversation` 的 `conversation.input.right`（list / session scope，`standardProps` 含 `sessionId`，当前无官方占用者）与 `dsh-client-ui-model-selection` 的 `ctx.modelDirectories.directoryFor(sessionId)`（`store` / `load()` / `select()`）、`ModelReasoning.efforts` 与 `defaultEffort`。2026-11-09 通过运行时 Inspect 核对了该 slot 的注册选项、`sessionId` 标准 props 与当前单个 active 注册项；`modelDirectories` 未被 Service Inspect 编目，目录接口仍以上述确切安装包源码为依据；`dsh.client.inject` 显式声明模型选择与会话 UI 模块，服务缺席时功能静默隐藏而不是报错。宿主若改动 slot 名称、目录服务或档位字段，按钮会隐藏，须重新核对目标发行版。

## 验收条件与验证

- 默认关闭时 `conversation.input.right` 没有本模块注册项；开启后有且只有一个注册项，关闭或卸载后消失，重复配置通知不重复注册。
- 4 档模型画 4 格、7 档模型画 7 格、无档位模型不渲染按钮；「默认」0 格，点击后依次点亮 1…N 格，第 N 档后回到「默认」，`aria-label` 与 Tooltip 中的档位名和点亮数同步；按钮内不渲染文字节点。
- 每次点击只提交一次 `select`，目标档位为序列下一项；提交中禁用按钮，成功显示宿主读回的档位，失败保持原档位并给出可重试的错误提示。
- 默认 `arc` 画仪表盘，`thinkingEffortGlyph` 设为 `signal` 后改画信号格；仪表盘真实档位均匀铺满刻度、强调色指针随档位从低（左）转到高（右），「默认」不算档位，指针停在底部缺口并变灰；非法值回退 `arc`。
- 宿主有效档位为 `max`（含模型默认档为 `max`）时，仪表盘指针与圆心显示主题橙色；其他档位不套用该色，切回「默认」恢复灰色，提交中保留已确认档位的颜色，信号格配色不受影响。
- 「推理等级切换按钮样式」行仅在 `showThinkingEffortSwitcher` 开启时出现，主开关关闭、只读或不可写时隐藏；选择后保存到 `thinkingEffortGlyph`，按钮即时切换，刷新后保持。
- 每根信号线两端全圆角，默认与 hover 保持透明且无阴影，键盘 focus-visible 显示主题 outline；点亮格使用主题强调色并随浅深色主题变化；与模型座位和发送按钮的视觉间距均约 4px。切换不同长度的模型名时按钮位置保持不动；若目标宿主的 slot 包裹层不再是 `display:contents` 或 `order` 被覆盖，按钮会退回模型座位左侧并重新出现漂移，须重新核对发行版。此项只能在实际页面验收，静态检查与夹具不能证明。
- 模型目录服务缺席、会话 id 缺失、模型不在目录时按钮隐藏且不抛错；开关与其他功能偏好互不影响。
- 纯档位计算测试见 [levels.test.mjs](tests/levels.test.mjs)，Client 行为测试见 [client.test.mjs](tests/client.test.mjs)；功能组合与偏好排除由 `tests/integration/composition.test.mjs` 自动覆盖新增装配。

2026-11-09 本次修改通过构建、严格类型检查、仓库静态检查、274 项行为测试、产物新鲜度、实际 tarball 与独立生产安装检查。运行时 Inspect 已核对 slot 与唯一 active 注册项，但同名注册项不能证明新 Client 代际已加载。原生管理器确认当前安装为指向本工作区的链接，重新安装返回 `already-installed`，未卸载或重装；构建产物已更新。浏览器面板未连接，尚未验收真实页面点击、圆角与悬浮效果、语言/主题/焦点，也未复测历史版本矩阵或跨平台行为。刷新现有页面后再核对新样式，不能把静态检查或已有注册当作实际页面验收。

2026-11-10 Max 指针配色已完成构建、严格类型与仓库静态检查，推理等级 16 项测试全部通过；对编译后 Client 另核对默认、low、max、high、xhigh、提交中 max、模型默认 max 与信号格 8 个场景。实际 tarball 与独立生产安装检查通过。全仓 400 项行为测试中 399 项通过，鲸鱼动效的动画节点数量断言因该模块当前实现与测试不一致而失败；未修改该模块。当前未提供运行时 Inspect 工具，颜色 token 核对自本地 DSH `0.2.2-rc.1` 主题包；浏览器面板未连接，未执行实际 DSH 安装、激活或浅深主题页面验收。

## 参考与验证

按[开发指南](../../../docs/development.md#源码与接口发现)检索了 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 市场目录（2026-11-09 快照 `e190236`），并浅克隆对照了 `ChimeSky/dsh-effort-keeper`（`afc2a68`，Host 侧装饰 `selectModel` 记忆档位）、`Ayowait/dsh-official-reasoning-effort`（`7872985`，复用官方组件并注入档位）、`zszz3/dsh-model-provider-prefix`（`bc89f42`，替换 `conversation.input.model` 座位）。三者均为 MIT，只用于理解市场做法与接口，**没有复制或改编任何代码**；本模块独立实现格数计算与点击循环，并刻意不接管官方模型座位。仪表盘样式的圆弧几何复刻宿主内置 `gauge-outline` 产品图标（`@deepseek-ai/dsh-client-ui-primitives`，16 × 16），仅用于视觉对齐，指针角度由本模块按档位计算，不运行时导入或修改该包。
