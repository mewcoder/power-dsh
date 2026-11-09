# 官网流动背景

## 标识、入口与范围

功能 id 为 `flowing-background`，入口为 **设置 → PowerDSH → 界面 → 官网流动背景**。参考 [DeepSeek 首页](https://www.deepseek.com/)的蓝色渐变与流场动画，用独立绘制的 WebGL 图案呈现同类氛围，不复制官网脚本或资源，不宣称完全复刻。

用户明确要求“搞个全局的时候 我看看”，本次范围改为整个 Web 界面的全局背景，包括侧边栏与主内容区，覆盖先前“仅新建聊天”的显示限制。原有 `flowingBackgroundEnabled` 开关现在控制全局效果；已有对话、任务运行、设置页及其他全局面板均不触发隐藏，不再使用会话或面板状态门控。没有新增模式、透明度或背景强度控件。

蓝白色块旋涡扭曲形成柔和流动图案，底部渐隐。官网主体为 WebGL pattern 图案，细线只是另一层细节。市场来源为 [Tim5613/dsh-homepage-glass](https://github.com/Tim5613/dsh-homepage-glass/tree/a9bb39e7a9ceb1a83b1467312076f786d6e30fa0)，已核对其参数及当前官网：三色 `#8AA3D6 / #FFFFFF / #FFFFFF`、scale `.5`、rotation `-5°`、offset `(0,65)`、distortion `20`、swirl `12`、八次迭代、checks/shapeScale `10`、softness `100`。柔和来自蓝→白→白的两级宽范围混色，不额外给文字或背景添加 CSS blur。绘图代码独立实现这些数值与数学关系，不复制参考插件逐字提取的官网 shader。实际像素一致性仍需实屏对照，不由参数核对推定。

## 全局底层挂载与授权边界

当前宿主没有公共背景插槽。`shell.overlay` 仅注册 id 为 `power-dsh-flowing-background`、返回 null 的生命周期控制组件，不在全窗口浮层中绘画，也不订阅 `usePanelInfo`、`useSessions` 或会话消息。

用户本次已直接授权全局预览及必要的原生结构表面适配。适配器只寻找唯一、可见且结构符合已安装宿主的 AppFrame。类名映射只读自当前页面两个确切的官方 `style[data-plugin-css]` 标签：`@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css` 和 `@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css`；前者提取唯一、简单且分别以 `_frame`、`_sidebarCol`、`_centerCol` 结尾的类名，后者提取唯一以 `_root` 结尾的必需类名，并尝试读取以 `_scrollFade` 结尾的可选类名。`_scrollFade` 缺失或歧义仅跳过渐隐层适配，不阻断背景；每个标签及必需类名都必须唯一，再结合真实框架的语义直接子元素、`position:relative` 和 `display:grid` 核对目标；不采用 npm 固定哈希、模糊类名或猜测性后代选择器。画布直接挂在该 AppFrame 内，使用自有 `position:absolute; inset:0; z-index:-1` 绘图层，框架建立 `isolation:isolate` 并保留原生 `--dsw-alias-bg-base` 底色。全框架使用一张连续 Canvas，跨越侧边栏与主内容区；画布位于结构表面及内容下方，不给文字、按钮或卡片叠加前景颜色。

为让底层画布透出，仅允许对已核对的 AppFrame `sidebarCol`、`centerCol`、原生 SidebarRoot、任意 phase 的主 ConversationRoot，以及该主内容内通过 `[data-composer-seat][data-conversation-region="composer"]` 核对的输入区外层，临时设置内联 `background-color:transparent` 和 `background-image:none`。主 ConversationRoot 通过原生 `[data-conversation-content]` 的直接父元素及 `[data-phase]` 关系核对，不限制为 hero。不得扩大到输入卡片、编辑器、文件卡片、菜单、弹窗、任意后代或全局主题 token；不替换宿主根节点、不注入宿主全局 CSS、不改原生布局尺寸。窄窗口下 AppFrame 带有 `data-sidebar-drawer` 时，不透明化 sidebarCol 或 SidebarRoot，保留模态侧栏抽屉的原生底色；离开抽屉模式后重新适配这些明确目标。按用户要求，Windows 顶部操作栏尽量透明：只为已核对 AppFrame 且直接拥有自有背景层的元素添加局部 `::before` 背景透明规则，受 `html[data-windows-titlebar]` 限制，规则与自有样式节点一并释放。仅改绘制底色，保留原生高度、拖动区域、菜单、悬浮反馈和按钮交互；不修改全局主题 token。右上角原生窗口按钮由 Electron `titleBarOverlay` 绘制，桌面 preload 从独立主题探针同步颜色；当前插件无公共接口修改该底色，因此不承诺该部分透明，不操作内部 IPC 或探针。其他全局面板若拥有独立的不透明内容表面，可继续保留其原生底色，不承诺让所有内容表面透明；操作系统原生标题栏不在本次适配范围。

开启时同时隐藏原生 SidebarRoot 内、由同一官方样式模块唯一 `_scrollFade` 类名及 `aria-hidden="true"` 核对的底部滚动渐隐层，临时设置内联 `display:none !important`，避免 Windows 等平台在设置按钮上方留下侧栏底色阴影；抽屉模式同样隐藏。仅处理这个明确的装饰层，不修改列表滚动、设置按钮或其他渐变。此装饰层在部分发行构建中不存在；类名缺失或不唯一时保留该层原生效果，背景仍正常挂载，元数据变为唯一后可更新适配，失去唯一性时恢复原样且不重启动画。

按用户要求，Windows 非抽屉侧栏在开启背景期间补回右侧分割线，使用原生同款 `0.5px solid var(--dsw-alias-border-l3)`。规则仅匹配已核对、直接拥有自有背景层的 AppFrame 的直接 sidebarCol，受 `html[data-windows-titlebar]` 与 `:not([data-sidebar-drawer])` 限制，浅深主题跟随原生边框 token；关闭或卸载时随自有样式节点移除，恢复 Windows 原生无分割线样式，抽屉与其他平台保持原生。

对每项临时样式保存原值与优先级，恢复时仅处理仍等于本功能写入值和优先级的属性，保留第三方后写值。原生 SidebarRoot、ConversationRoot 或目标列动态替换时，更新这些明确目标的背景适配，不重启动画或新建第二张画布。AppFrame 替换、关闭开关、卸载或 slot 撤销时，释放旧画布、GPU、动画、观察器和自有节点，并按所有权恢复原有样式。

必需的官方样式元数据缺失、标签或必需类名歧义、框架缺失或定位结构不受支持时不绘画，不回退到 `shell.overlay` 前景。设置页复用共享错误反馈说明全局布局无法适配，保留用户开关与其他偏好，不输出样式正文、DOM 内容、机器路径或原始异常。官方样式延迟加载或替换后重新核对映射，正确元数据与目标恢复可挂载时移除过期反馈。绘图层与 Canvas 均为 `pointer-events:none`、`aria-hidden`，没有焦点或交互。

## 配置与行为

`flowingBackgroundEnabled` 为独立布尔配置，默认 `false`，由原生 `configForms` 持久化到 PowerDSH 配置。复用设置行的保存、读回、忙碌、失败回滚及错误提示，保留其他偏好。只在配置 ready 且该字段严格为 true 时注册；关闭或配置不可用时立即撤销注册。只读时展示已保存效果，禁止写入。设置标题中文为“官网流动背景”，英文为“Homepage flowing background”；说明中文为“为界面添加柔和流动的蓝色渐变”，英文为“Add a softly flowing blue gradient to the interface”。

保留原有 shader 的柔和蓝白 RGB 图案、官网 `linear-gradient(#000000fc 0%, #000000e8 8.98%, transparent 100%)` 遮罩与 `#9cc1e7` 到透明的底色渐变，继续合成为透明蓝色层，在 AppFrame 底层绘制。浅色底下保留参考混色关系，深色主题保留宿主原生底色；本次不新增主题或卡片玻璃效果。不绘制成组线条。当前官网相位分别以 420、460、90 秒为周期，起始漂移约 `.07` 单位/秒；按这些周期独立实现相位，避免长期运行产生无界坐标。

动画使用 AppFrame `clientWidth`、`clientHeight` 确定 CSS 绘图尺寸，通过 `ResizeObserver` 响应框架尺寸变化，只调整自有 Canvas。GPU 像素预算及 DPR 只影响清晰度，不改变图案缩放。动画最多每秒绘制 24 帧，Canvas 像素比上限 1.5、像素总数上限约 200 万。系统 `prefers-reduced-motion:reduce` 下保留静态图案，偏好变化即时生效；页面隐藏时取消帧回调，重新显示后恢复，不追赶隐藏期间时间。在布局适配成功的框架内，WebGL 不可用或 shader 编译/链接失败时保留自有静态 CSS 渐变；上下文丢失取消帧并释放旧 GPU 资源，恢复后重建单条绘制链，不阻断其他功能。布局无法适配时连静态背景也不挂载。

## 生命周期、权限与兼容

Client 通过 `preferenceSlot` 将控制组件注册和配置订阅绑定到 slot/context 生命周期。适配器的 `MutationObserver` 在 body 跟踪目标框架和已批准结构表面的生命周期，在 head 通过 `childList`、`characterData` 变化跟踪官方样式模块加载或替换，只读取上述两个确切样式标签中的类名元数据，不读取消息内容或扫描业务事件。React effect 拥有结构表面样式快照、局部节点、尺寸观察、动画、visibilitychange、WebGL 上下文及媒体偏好监听。切换会话、运行状态或全局面板不重启动画；同一框架的类名映射或已批准结构表面变化只刷新目标适配，不重启动画。

上述框架挂载、结构表面背景处理及两个确切官方样式标签的只读类名元数据映射，属于现有用户授权结构适配的有限范围，不能扩大为任意样式扫描、宿主 DOM 读取或布局改写。没有 Host 业务方法、额外 RPC、网络请求、外部字体、视频、文件、凭据或进程操作，不读取会话正文、鼠标位置、侧栏条目内容或其他插件业务内容。设置控件继续使用宿主主题 token。

接口依据为本机 DSH `0.2.2-rc.1` 的 Client Inspect：`Slots.listSubTree({root:'shell.overlay'})` 确认 root/list、独立 id、无 owner props；`Service.listService({service:'slots'})` 核对注册及依赖释放语义。本次直接读取已安装桌面包核实：`@deepseek-ai/dsh-client-ui-layout` 的 `lib/client.js` 第 74 行样式及 83–93 行类映射使用 `PIRFFq_frame`、`PIRFFq_sidebarCol`、`PIRFFq_centerCol`；`@deepseek-ai/dsh-client-ui-sidebar` 第 116–125 行使用 `kB3qhq_root`。同为 `0.2.2-rc.1` 的 npm 包却使用 `pI_x6G_*`、`hHd-Xa_root`，说明 CSS Modules 哈希会因构建而异，不能按版本号硬编码。实际适配因此以当前页面官方样式模块元数据和语义父子关系为准；主 ConversationRoot 仍通过 `[data-conversation-content]` 的直接父元素及 `[data-phase]` 核对。样式标签、必需简单类名或真实结构无法唯一确认时停止背景适配，不猜测替代目标。桌面与浏览器采用同一 Canvas 路径，未扩大跨版本实测承诺。

## 验收条件与验证

- 默认不注册控制组件；开启只注册一个独立项，重复配置通知不会产生重复项；关闭、配置不可用和卸载均撤销。
- 保存失败回到已保存值，不启动新效果，其他功能偏好保留。
- 不以会话、消息、运行状态或全局面板门控；已有对话、运行和设置页保持同一全局画布。
- 仅两个确切官方样式标签及其所需简单类名唯一、且真实 AppFrame 可见并通过语义直接子元素与定位核对时可挂载；缺失、歧义或不支持时不绘画、不回退前景，设置页提供共享错误反馈。
- 同版本不同构建哈希均以当前已加载样式模块为准；正确样式延迟到达可恢复挂载，同一框架的哈希或结构表面替换不重启动画，观察器随关闭和卸载释放。
- 一张 Canvas 连续覆盖框架、侧边栏和主内容区；背景只从已批准结构表面透出，输入卡片、编辑器、文件卡片、菜单和弹窗保留原生表面与交互。窄窗口 `data-sidebar-drawer` 模式保留侧栏抽屉原生底色，退出该模式后再恢复侧栏透明适配。
- 已有对话的输入区外层不再用原生 bg-base 渐变覆盖官网流动背景，浅深主题均能透出背景；输入卡片的底色、圆角、阴影、sticky 定位和层级保持原生。输入区外层的原始内联值与优先级随关闭、替换或卸载恢复；菜单本体、阴影与 macOS 模糊垫层保持原生，外围色块仍待实屏确认。
- 开启时在装饰类名可唯一识别的构建中隐藏侧栏设置按钮上方的原生底部滚动渐隐层，包括抽屉模式；缺失或歧义时不阻断背景；关闭、卸载、初始化失败或节点替换后按所有权恢复原始 display 值与优先级。动态替换只更新该装饰层，不重启动画，不影响其他位置的渐隐层。
- Windows 顶部操作栏的 AppFrame `::before` 底色在开启期间透明，规则绑定当前唯一核对框架及其自有直接子层；关闭或卸载移除规则，拖动和菜单交互保持原生。两套构建哈希均使用动态映射；右上角原生窗口按钮底色保留。
- Windows 非抽屉侧栏开启背景时显示主题色 0.5px 右侧分割线，关闭或卸载后移除规则；两套构建哈希均动态映射，抽屉模式及其他平台不受该规则影响。
- 原始内联值与优先级能按所有权恢复；第三方后写值不被覆盖；结构表面替换不重启动画，框架替换后旧资源完整释放。
- Canvas 与绘图层不接收点击、不进入无障碍树与 Tab 顺序，不作为文字与控件之上的前景层。
- 减少动态效果时无连续帧；隐藏页面后无待执行帧，显示后最多恢复一条帧链；卸载后无观察器、监听、节点或帧残留。
- 使用框架尺寸响应缩放；大窗口与高像素比设备遵守像素预算，零尺寸不会造成异常。
- WebGL 编译/链接失败不启动帧且释放已分配资源；上下文丢失停止绘制，恢复后最多存在一条帧链；静态降级也仅位于已适配框架底层。

实现见 [client.ts](client.ts)、[attachment.ts](attachment.ts)、[pattern.ts](pattern.ts)、[animation.ts](animation.ts)与 [styles.ts](styles.ts)；行为覆盖见 [tests/background.test.mjs](tests/background.test.mjs)和 [tests/attachment.test.mjs](tests/attachment.test.mjs)。本次确认 npm 固定类名与实际桌面构建类名不一致会导致全局布局校验失败，已改为读取当前官方样式元数据。修复后通过严格类型、构建新鲜度、306 项全仓测试（本功能 20 项）、实际 tarball、独立生产安装及 diff 空白检查，并重建本地链接使用的三个产物。新增回归覆盖实际桌面与 npm 两套不同哈希、官方样式元数据缺失/错误来源/重复标签/类名歧义以及延迟加载恢复；原有层级、样式恢复和 GPU 生命周期检查仍通过。

用户此前反馈“样式好像对了”，仅表明较早图案视觉得到初步认可；其后全局预览实际报告布局适配错误，不能把旧测试或注册 active 当作画面验收。保留本地链接安装与原开关，不因静态检查推定新 Client 代际和画面已生效。浏览器面板仍未连接，当前样式元数据映射修复后的浅深主题、侧栏连续性、窄窗口、文字可读性、输入与点击、弹窗层级、结构表面恢复及官网实屏对照均待实际页面确认。

本次补充侧栏底部渐隐层适配，依据已核对的原生 SidebarRoot 源码和官方样式模块，沿用动态类名与样式所有权恢复机制。新增回归覆盖两套构建哈希、抽屉模式、节点替换、原值与优先级恢复、第三方后写保留及初始化失败回滚。已重建产物，通过严格类型、构建新鲜度、346 项全仓测试、实际 tarball、独立生产安装及 diff 空白检查；实际 Windows 页面仍待验收。

Windows 顶栏适配依据参考源码 AppFrame 的 `data-windows-titlebar` / `::before` 绘制规则，以及桌面 preload 的菜单透明样式与 `titleBarOverlay` 颜色同步实现；当前浏览器面板未连接，尚未完成 Windows 实屏验收。

已直接核对本机 `0.2.2-rc.1` 打包桌面版的 SidebarRoot 编译样式、类名映射与渲染代码：该构建包含 `_root`，但不存在 `_scrollFade`。此前错误地把参考源码中的新增装饰类名设为必需项，导致背景校验失败。现将其改为可选项，并补充缺失、歧义、延迟出现及再次失去唯一性时背景持续运行与装饰层恢复的回归；用户所报 Windows 构建仍待实屏复测。
