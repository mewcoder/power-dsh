# 自定义背景

## 标识、入口与范围

功能 id 为 `flowing-background`，入口为 **设置 → PowerDSH → 界面 → 自定义背景**。背景有两种类型：内置的**官网流动**图案（参考 [DeepSeek 首页](https://www.deepseek.com/)蓝色渐变与流场图案的独立 WebGL 绘制，呈现同类氛围，不复制官网脚本、DOM 或资源，不宣称完全复刻），以及用户自己的**自定义壁纸**。

用户明确要求“搞个全局的时候 我看看”，范围是覆盖侧边栏与主内容区的全局背景；已有对话、任务运行、设置页及其他全局面板均不触发隐藏，不使用会话或面板状态门控。开关 `flowingBackgroundEnabled` 控制是否显示；开启后主行右侧出现调节图标，打开的面板先选背景类型（`flowingBackgroundKind`，`pattern` 或 `wallpaper`），再调背景不透明度与背景模糊。用户明确要求支持自定义壁纸，并选择由 Host 把图片存到 profile 文件、在同一个功能内切换类型；不引入第二个开关。

图案为蓝白色块旋涡扭曲形成柔和流动图案，底部渐隐。市场来源为 [Tim5613/dsh-homepage-glass](https://github.com/Tim5613/dsh-homepage-glass/tree/a9bb39e7a9ceb1a83b1467312076f786d6e30fa0)，已核对其参数及当前官网：三色 `#8AA3D6 / #FFFFFF / #FFFFFF`、scale `.5`、rotation `-5°`、offset `(0,65)`、distortion `20`、swirl `12`、八次迭代、checks/shapeScale `10`、softness `100`。柔和来自蓝→白→白的两级宽范围混色，不额外给文字或背景添加 CSS blur。绘图代码独立实现这些数值与数学关系，不复制参考插件逐字提取的官网 shader。实际像素一致性仍需实屏对照，不由参数核对推定。

## 全局底层挂载与授权边界

当前宿主没有公共背景插槽。`shell.overlay` 仅注册 id 为 `power-dsh-flowing-background`、返回 null 的生命周期控制组件，不在全窗口浮层中绘画，也不订阅 `usePanelInfo`、`useSessions` 或会话消息。

用户本次已直接授权全局预览及必要的原生结构表面适配。适配器只寻找唯一、可见且结构符合已安装宿主的 AppFrame。必需框架类名映射只读自当前页面两个确切的官方 `style[data-plugin-css]` 标签：`@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css` 和 `@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css`；前者提取唯一、简单且分别以 `_frame`、`_sidebarCol`、`_centerCol` 结尾的类名，后者提取唯一以 `_root` 结尾的必需类名，并尝试读取以 `_scrollFade` 结尾的可选类名。`_scrollFade` 缺失或歧义仅跳过渐隐层适配，不阻断背景；每个标签及必需类名都必须唯一，再结合真实框架的语义直接子元素、`position:relative` 和 `display:grid` 核对目标；不采用 npm 固定哈希、模糊类名或猜测性后代选择器。画布直接挂在该 AppFrame 内，使用自有 `position:absolute; inset:0; z-index:-1` 绘图层，框架建立 `isolation:isolate` 并保留原生 `--dsw-alias-bg-base` 底色。全框架使用一张连续 Canvas，跨越侧边栏与主内容区；画布位于结构表面及内容下方，不给文字、按钮或卡片叠加前景颜色。

为让底层画布透出，仅允许对已核对的 AppFrame `sidebarCol`、`centerCol`、原生 SidebarRoot、任意 phase 的主 ConversationRoot，以及该主内容内通过 `[data-composer-seat][data-conversation-region="composer"]` 核对的输入区外层，临时设置内联 `background-color:transparent` 和 `background-image:none`。主 ConversationRoot 通过原生 `[data-conversation-content]` 的直接父元素及 `[data-phase]` 关系核对，不限制为 hero。不得扩大到输入卡片、编辑器、文件卡片、菜单、弹窗、任意后代或全局主题 token；不替换宿主根节点、不注入宿主全局 CSS、不改原生布局尺寸。窄窗口下 AppFrame 带有 `data-sidebar-drawer` 时，不透明化 sidebarCol 或 SidebarRoot，保留模态侧栏抽屉的原生底色；离开抽屉模式后重新适配这些明确目标。按用户要求，Windows 顶部操作栏尽量透明：只为已核对 AppFrame 且直接拥有自有背景层的元素添加局部 `::before` 背景透明规则，受 `html[data-windows-titlebar]` 限制，规则与自有样式节点一并释放。仅改绘制底色，保留原生高度、拖动区域、菜单、悬浮反馈和按钮交互；不修改全局主题 token。右上角原生窗口按钮由 Electron `titleBarOverlay` 绘制，桌面 preload 从独立主题探针同步颜色；当前插件无公共接口修改该底色，因此不承诺该部分透明，不操作内部 IPC 或探针。其他全局面板若拥有独立的不透明内容表面，可继续保留其原生底色，不承诺让所有内容表面透明；操作系统原生标题栏不在本次适配范围。

开启时同时隐藏原生 SidebarRoot 内、由同一官方样式模块唯一 `_scrollFade` 类名及 `aria-hidden="true"` 核对的底部滚动渐隐层，临时设置内联 `display:none !important`，避免 Windows 等平台在设置按钮上方留下侧栏底色阴影；抽屉模式同样隐藏。仅处理这个明确的装饰层，不修改列表滚动、设置按钮或其他渐变。此装饰层在部分发行构建中不存在；类名缺失或不唯一时保留该层原生效果，背景仍正常挂载，元数据变为唯一后可更新适配，失去唯一性时恢复原样且不重启动画。

用户实屏反馈的 `_fade` 来自另一官方模块 `@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css`，本功能额外只读该精确标签中唯一的 `_root`、`_treeBody`、`_fade` 简单类名。仅在已核对原生 SidebarRoot 内的工作区 root → treeBody 结构中，对 treeBody 的直接 span.fade 临时设置 `display:none !important`；已安装构建的该 span 没有 `aria-hidden`，不以此属性过滤。分组、平铺和搜索结果均复用这一结构，抽屉模式同样隐藏。该模块及三项类名全部为可选适配，缺失、歧义或样式未加载时不阻断背景、不猜测替代节点；加载、替换、关闭与第三方后写值遵循现有恢复规则，不重启动画。不按固定哈希或全局后缀匹配其他 fade。

按用户要求，Windows 非抽屉侧栏在开启背景期间补回右侧分割线，使用原生同款 `0.5px solid var(--dsw-alias-border-l3)`。规则仅匹配已核对、直接拥有自有背景层的 AppFrame 的直接 sidebarCol，受 `html[data-windows-titlebar]` 与 `:not([data-sidebar-drawer])` 限制，浅深主题跟随原生边框 token；关闭或卸载时随自有样式节点移除，恢复 Windows 原生无分割线样式，抽屉与其他平台保持原生。

对每项临时样式保存原值与优先级，恢复时仅处理仍等于本功能写入值和优先级的属性，保留第三方后写值。原生 SidebarRoot、ConversationRoot 或目标列动态替换时，更新这些明确目标的背景适配，不重启动画或新建第二张画布。AppFrame 替换、关闭开关、卸载或 slot 撤销时，释放旧画布、GPU、动画、观察器和自有节点，并按所有权恢复原有样式。

必需的官方样式元数据缺失、标签或必需类名歧义、框架缺失或定位结构不受支持时不绘画，不回退到 `shell.overlay` 前景。设置页复用共享错误反馈说明全局布局无法适配，保留用户开关与其他偏好，不输出样式正文、DOM 内容、机器路径或原始异常。官方样式延迟加载或替换后重新核对映射，正确元数据与目标恢复可挂载时移除过期反馈。绘图层与 Canvas 均为 `pointer-events:none`、`aria-hidden`，没有焦点或交互。

## 配置与行为

界面术语以作用对象和实际效果为准：「背景不透明度」（Background opacity）0% 隐藏背景，100% 完全显示；「背景模糊」（Background blur）0px 保持清晰，越大越模糊。名称与数值方向一致，滑块显示值与持久化值相同，不再取反。二者均只作用自有背景，不控制原生聊天卡片、输入框或调节面板自身材质。按用户要求参考多个插件的实现而保持官方组件样式：dsh-ui-appearance 区分媒体滤镜与表面玻璃，dsh-homepage-glass 对照动效节流、减少动效与 GPU 清理，dsh-mpkg-wallpaper 对照零值不隐式附加模糊、表面与媒体归属及弹层定位边界。配置键与值语义保持不变：`flowingBackgroundOpacity` 一直是 CSS 不透明度，界面现在直接显示这个数值，因此名称改为「背景不透明度」。

`flowingBackgroundEnabled` 为独立布尔配置，默认 `false`；`flowingBackgroundKind` 为字符串配置，默认 `pattern`，取值 `pattern`（官网流动）或 `wallpaper`（自定义壁纸），未知值回退 `pattern`；`flowingBackgroundOpacity` 为数值配置，默认 `100`（CSS 不透明度语义；界面直接以 0–100% 显示「背景不透明度」，0% 完全隐藏、100% 完整显示，不做取反）；`flowingBackgroundBlur` 为数值配置，默认 `0`（0–40 像素）。四者均由原生 `configForms` 持久化到 PowerDSH 配置。复用设置行的保存、读回、忙碌、失败回滚及错误提示，保留其他偏好。只在配置 ready 且 `flowingBackgroundEnabled` 严格为 true 时注册背景；关闭或配置不可用时立即撤销注册。只读时展示已保存效果，禁止写入。主开关标题中文“自定义背景”、英文“Custom background”，说明中文“为界面选择柔和的动态背景”、英文“Choose a soft animated background for the interface”。开启后不再有独立的「背景类型」设置行：主行本身保留开关，右侧增加一个 ghost/sm 的调节图标，提供「调节背景」悬浮提示和无障碍名称。背景类型改为在调节面板内用原生 radio 组选择（`fieldset` + `legend` + 两个 `input[type=radio]`，同名成组），位于面板最上方，两个选项在同一行横向排列（间距 18px，窄窗口自动换行），标签为「官网流动」「自定义壁纸」；方向键可在两项间切换，与原生单选组行为一致。类型、不透明度与模糊统一在面板内预览、在关闭或释放时保存；选择类型本身不写盘。官网流动同样可调不透明度与模糊，切换类型不再重置外观。类型与两个数值的保存共用设置行的忙碌及错误反馈；失败以 Host 实际读回值为准，可再次操作完成恢复，已保存壁纸文件保留。壁纸行仅在当前类型为「自定义壁纸」时显示于调节面板内：44×30 缩略图、文件名（13px）与格式说明（11px 辅助色）在左，右侧是两个 26×26 的 ghost 图标按钮——更换图片与移除，均带悬浮提示与无障碍名称，移除按钮悬浮时转为错误色；未设置时文件名显示「未设置壁纸」。选择图片只更新当前壁纸，不自动改动背景类型。格式说明使用 11px 辅助色小字，不占标题层级，窄窗口下隐藏；文件名省略时可通过原生 title 查看完整名称。操作使用图标按钮而非文字按钮，组内 2px 间距。

## 主页调节面板

点击调节图标通过 `settings.section` 的 `close` 回调关闭原生设置窗口，在 `shell.overlay` 的独立条目 `power-dsh-background-tune`（order `-99`）中显示屏幕正中央的半透明磨砂面板。关闭面板或按 Escape 后留在主页，不自动重开设置窗口。原生关闭路径负责解除模态状态，主页可正常交互；本功能不占用 `settings.launcher`，侧边栏设置按钮始终保留。面板独立携带样式，设置页卸载不会使它失去定位。面板按官方 `Modal.module.css` 的 380px 宽度、`--dsw-radius-panel` 圆角、16px 标题、标题栏 22/14/12/24px 内边距与 24px 内容列排版；关闭与壁纸操作复用宿主公共 `Button`，关闭使用 14px 线条图标。参考 `MenuSurface.module.css` 将背景材质放入独立层，使用主题次级表面 32% 不透明度与 8px 背景模糊，文字和控件保持原生清晰度，不对整块面板设置 opacity。标题与已保存的背景类型同步，分别为「官网流动调节」和「自定义壁纸调节」。两者均显示关闭按钮、两个分组滑块与实时数值；仅自定义壁纸类型显示图片选择、更换和移除控件。官网流动调节不触发壁纸读取，也不显示缓存图片或壁纸读取错误；切换类型立即更新面板，旧文件选择或移除回调失效，不写入壁纸或把类型改回。无全屏遮罩，仅面板容器恢复 `pointer-events:auto`；窄窗口限制宽高并允许内部滚动。接口依据为本机 DSH `0.2.2-rc.1` 的 `Slots.listSubTree({root:'settings.section'})` 对 owner `close` 回调的查询。

拖动过程中只更新面板状态并立即重绘自有图层，不写配置；释放、键盘调整或失焦时通过共享 `savePreference` 以 `number` 类型提交。关闭时也提交最后尚未保存的拖动值，等待进行中的保存完成后关闭面板并留在主页；保存中禁用滑块，避免重叠写入。失败时回到 Host 读回值、在面板显示共享错误反馈并保持面板可恢复。主开关关闭、配置不可用、失去写权限或特性卸载时自动退出预览，不打开设置窗口；面板状态不持久化。

背景使用同一套 AppFrame 底层挂载、结构表面透明化、Windows 顶栏、侧栏渐隐与 GPU 生命周期；调整类型、背景不透明度或背景模糊只更新自有图层样式，不重复挂载或叠加画布。选择壁纸类型但尚未加载到图片时，仍显示官网流动图案，不显示破图。

## 自定义壁纸存储与安全

壁纸由 Host 保存到 profile 目录下本功能专属的 `power-dsh/wallpaper.bin` 与 `power-dsh/wallpaper.json`，不写入 `AGENTS.md` 等其他文件，也不改宿主设置。`saveWallpaper(dataUrl, name)` 只接受 `data:image/(png|jpeg|webp);base64,...`，拒绝其他 MIME、空载荷、非 data URL 与超过 25 MiB 的图片；文件名只保留 basename，去掉目录分隔，限制 1–200 字符，因此无法借名称穿越目录。写入使用 0600 权限的临时文件后原子重命名，失败或卸载时清理临时文件；`readWallpaper` 在文件缺失时返回 `null`（视为未设置），元数据损坏或 MIME 不在允许集合时报错而不是猜测类型；`clearWallpaper` 幂等删除两个文件。三个方法都经共享 owner-only 操作队列，非 profile owner 调用被拒绝，插件卸载后调用被拒绝。

Client 只通过 RPC 读取 Host 已存的图片，以 `data:` URL 交给自有 `<img>`，不拼接远端地址、不写 profile、不读取其他文件。选择图片时先在 Client 校验 MIME 与 25 MiB 上限，再用 `FileReader` 读出 data URL 交给 Host；失败时显示共享错误反馈并保留已保存的壁纸，不进入半完成状态。壁纸资产在开启且类型为壁纸时自动加载，不只依赖设置页是否打开，因此重新加载界面后仍能恢复。

界面「背景不透明度」以 0–100% 显示，数值即持久化的 `flowingBackgroundOpacity`，绘图层 CSS `opacity = flowingBackgroundOpacity / 100`；不做取反，打开面板不会改变既有效果，旧保存值无须迁移。数值为 100 时移除 opacity 内联值，其余与原生 `bg-base` 混合。背景模糊对自有画布或壁纸图片施加 `filter: blur(Npx)`（`0` 时移除），柔化图案形成磨砂观感。模糊只改变清晰度，不改变 canvas／图片的尺寸、位置、cover 铺图比例或构图；不通过外扩画面、缩放或放大 cover 容器消除边缘，以免模糊越大图片越被放大裁切。应用时清除此前扩展方案的几何覆盖，归零时移除 filter；两者只作用于自有图层，不改宿主结构表面、全局主题 token 或文字，`prefers-reduced-motion` 只影响帧循环而不影响这两个静态样式。外观变更通过共用的 `applyAppearance` 原地写入，不重建图层、不重启 GPU 帧链；只有壁纸或图案本身变化才重新挂载。

壁纸以 `<img>` 铺满绘图层（`object-fit: cover`），不带 `alt`、`draggable="false"`、`aria-hidden`，与图案共用同一层 `opacity` 与模糊；壁纸类型不创建 WebGL 上下文，也不启动帧链，因此不消耗 GPU 动画资源。

「官网流动」保留原有 shader 的柔和蓝白 RGB 图案、官网 `linear-gradient(#000000fc 0%, #000000e8 8.98%, transparent 100%)` 遮罩与 `#9cc1e7` 到透明的底色渐变，合成为透明蓝色层；相位分别以 420、460、90 秒为周期，起始漂移约 `.07` 单位/秒。

动画使用 AppFrame `clientWidth`、`clientHeight` 确定 CSS 绘图尺寸，通过 `ResizeObserver` 响应框架尺寸变化，只调整自有 Canvas。GPU 像素预算及 DPR 只影响清晰度，不改变图案缩放。动画最多每秒绘制 24 帧，Canvas 像素比上限 1.5、像素总数上限约 200 万。系统 `prefers-reduced-motion:reduce` 下保留静态图案，偏好变化即时生效；页面隐藏时取消帧回调，重新显示后恢复，不追赶隐藏期间时间。在布局适配成功的框架内，WebGL 不可用或 shader 编译/链接失败时保留自有静态 CSS 渐变；上下文丢失取消帧并释放旧 GPU 资源，恢复后重建单条绘制链，不阻断其他功能。布局无法适配时连静态背景也不挂载。背景不透明度和背景模糊的配置与面板状态订阅只更新同一图层，不重建帧链；样式值相同时不重复写入，避免自身 MutationObserver 持续触发。

## 生命周期、权限与兼容

Client 通过 `preferenceSlot` 将控制组件注册和配置订阅绑定到 slot/context 生命周期。适配器的 `MutationObserver` 在 body 跟踪目标框架和已批准结构表面的生命周期，在 head 通过 `childList`、`characterData` 变化跟踪官方样式模块加载或替换，只读取上述两个必需样式标签及一个可选工作区样式标签中的类名元数据，不读取消息内容或扫描业务事件。React effect 拥有结构表面样式快照、局部节点、尺寸观察、动画、visibilitychange、WebGL 上下文及媒体偏好监听。切换会话、运行状态或全局面板不重启动画；同一框架的类名映射或已批准结构表面变化只刷新目标适配，不重启动画。

上述框架挂载、结构表面背景处理及三个确切官方样式标签的只读类名元数据映射，属于现有用户授权结构适配的有限范围，不能扩大为任意样式扫描、宿主 DOM 读取或布局改写。没有 Host 业务方法、额外 RPC、网络请求、外部字体、视频、文件、凭据或进程操作，不读取会话正文、鼠标位置、侧栏条目内容或其他插件业务内容。设置控件继续使用宿主主题 token。

接口依据为本机 DSH `0.2.2-rc.1` 的 Client Inspect：`Slots.listSubTree({root:'shell.overlay'})` 确认 root/list、独立 id、无 owner props；`Service.listService({service:'slots'})` 核对注册及依赖释放语义。本次直接读取已安装桌面包核实：`@deepseek-ai/dsh-client-ui-layout` 的 `lib/client.js` 第 74 行样式及 83–93 行类映射使用 `PIRFFq_frame`、`PIRFFq_sidebarCol`、`PIRFFq_centerCol`；`@deepseek-ai/dsh-client-ui-sidebar` 第 116–125 行使用 `kB3qhq_root`。同为 `0.2.2-rc.1` 的 npm 包却使用 `pI_x6G_*`、`hHd-Xa_root`，说明 CSS Modules 哈希会因构建而异，不能按版本号硬编码。实际适配因此以当前页面官方样式模块元数据和语义父子关系为准；主 ConversationRoot 仍通过 `[data-conversation-content]` 的直接父元素及 `[data-phase]` 核对。样式标签、必需简单类名或真实结构无法唯一确认时停止背景适配，不猜测替代目标。桌面与浏览器采用同一 Canvas 路径，未扩大跨版本实测承诺。

## 故障诊断

[diagnostics.ts](diagnostics.ts)按失败阶段选择独立的诊断呈现策略，集中拥有错误码、阶段标签、原因与恢复建议；策略的结果类型随阶段约束，拒绝不成立的阶段/结果组合。Client 只订阅故障状态、维护观察时间并装配设置行，不包含诊断业务分支。策略行为覆盖见[tests/diagnostics.test.mjs](tests/diagnostics.test.mjs)。

背景运行故障使用 `PD-BACKGROUND-LAYOUT`、`PD-BACKGROUND-INIT` 或 `PD-BACKGROUND-ENVIRONMENT`，操作固定为 `flowing-background.attach`，不再归入设置保存错误。适配器只返回结构化的安全失败阶段、语义检查项、结果及预期/实际值；必需样式缺失与歧义、框架缺失/隐藏/歧义/布局不支持/挂载后样式变化、初始化失败及环境能力缺失分别定位。侧栏 `scrollFade` 与工作区列表 `fade` 均为可选适配，不产生布局错误。

行内摘要显示失败原因与适用恢复建议，详情及复制报告包含稳定阶段/结果标识、检查项（如 `layout.frame`、`frame.display`）、预期与实际数量或允许的状态枚举、已保存开关未变与背景隐藏状态、首次观察时间、已确认的 DSH 版本和平台。只保存同一故障的首次观察时间，原因变化更新诊断，成功或关闭后撤去展示；不记录原始异常、机器路径、样式正文或消息内容。缺失项随原有观察器自动复查，布局不支持/歧义提示更新插件及重新加载，初始化失败或隔离样式变化才建议切换开关重试；持续失败引导复制诊断。主规则见[错误处理规范](../../../docs/error-handling.md)。

## 验收条件与验证

- 默认不注册控制组件；开启只注册一个独立项，重复配置通知不会产生重复项；关闭、配置不可用和卸载均撤销。
- 保存失败回到已保存值，不启动新效果，其他功能偏好保留；运行故障使用背景专属错误码，实际保存失败优先且不混入运行失败的原因。
- 「背景类型」及其旁边的调节图标仅在开启时展开；类型默认 `pattern`，可切到 `wallpaper`，未知值回退 `pattern`；保存中禁用，失败回滚并显示行内提示。
- 点击调节先关闭原生设置窗口，在主页正中央显示带独立样式的半透明磨砂面板：最上方是背景类型单选，其次（仅壁纸类型）是图片选择、更换与移除，最后是「外观」分组里的两个滑块。关闭或 Escape 保存最后的值并留在主页，不打开设置；从不占用原生设置入口。拖动即时预览，指针释放、键盘方向键／Home／End／PageUp／PageDown 或失焦时以数值提交；**滑块保存中不禁用**，因此键盘焦点与连续调整不会被打断，只阻止新的并发写入。保存失败撤下预览并在面板显示可恢复的错误。主开关关闭、配置不可用或卸载时自动收起并留在主页。面板不持久化、不阻塞其他区域；不透明度 `100`、模糊 `0` 时移除内联覆盖，其余值分别写入图层 `opacity` 与画布/图片的 `filter: blur()`；外观订阅随背景释放，只更新同一图层，不重启帧链。
- 主行开关在背景关闭时仍显示（调节图标隐藏），因此用户始终能重新开启。
- 在自定义壁纸类型的面板中可选择 PNG/JPEG/WebP 图片，保持当前类型，经 Host 写入 profile 的 `power-dsh/` 文件并读回显示；已保存时显示文件名与缩略图，可更换或移除；未设置或读取失败时回退官网流动图案，不显示破图，读取失败提供共享错误反馈与重试。
- 非图片、超过 25 MiB 的图片在 Client 侧即被拒绝且不产生 Host 写入；Host 侧再次校验 MIME、大小与文件名，只保留 basename，拒绝目录穿越、空载荷与非 data URL；损坏元数据报错而不猜测类型；写入使用 0600 临时文件后原子重命名并清理临时文件；清除幂等；卸载后调用被拒绝。
- 壁纸类型不创建 WebGL 上下文、不启动帧链；图片为 `object-fit: cover`、无 `alt`、不进入无障碍树与 Tab 顺序，与图案共用同一 `opacity` 与模糊。
- 各失败分支报告稳定阶段、检查项、结果和安全的预期/实际值；可选装饰缺失不报错，原因变化更新详情与复制状态，同一原因重复检查保持观察时间；中英文恢复建议与原因匹配，成功清理反馈。
- 不以会话、消息、运行状态或全局面板门控；已有对话、运行和设置页保持同一全局画布。
- 仅两个必需的确切官方样式标签及其所需简单类名唯一、且真实 AppFrame 可见并通过语义直接子元素与定位核对时可挂载；缺失、歧义或不支持时不绘画、不回退前景，设置页提供共享错误反馈。
- 同版本不同构建哈希均以当前已加载样式模块为准；正确样式延迟到达可恢复挂载，同一框架的哈希或结构表面替换不重启动画，观察器随关闭和卸载释放。
- 一张 Canvas 连续覆盖框架、侧边栏和主内容区；背景只从已批准结构表面透出，输入卡片、编辑器、文件卡片、菜单和弹窗保留原生表面与交互。窄窗口 `data-sidebar-drawer` 模式保留侧栏抽屉原生底色，退出该模式后再恢复侧栏透明适配。
- 已有对话的输入区外层不再用原生 bg-base 渐变覆盖自定义背景，浅深主题均能透出背景；输入卡片的底色、圆角、阴影、sticky 定位和层级保持原生。输入区外层的原始内联值与优先级随关闭、替换或卸载恢复；菜单本体、阴影与 macOS 模糊垫层保持原生，外围色块仍待实屏确认。
- 开启时在装饰类名可唯一识别的构建中隐藏侧栏设置按钮上方的原生底部滚动渐隐层，包括抽屉模式；缺失或歧义时不阻断背景；关闭、卸载、初始化失败或节点替换后按所有权恢复原始 display 值与优先级。动态替换只更新该装饰层，不重启动画，不影响其他位置的渐隐层。
- 工作区列表的底部 fade 只依据精确官方模块的唯一 root/treeBody/fade 映射及 span 直接子结构隐藏，兼容不同构建哈希；模块缺失、错误来源、标签/类名歧义均不阻断背景，恢复元数据后可适配，列表替换及关闭按所有权恢复，其他位置同名类不受影响。
- Windows 顶部操作栏的 AppFrame `::before` 底色在开启期间透明，规则绑定当前唯一核对框架及其自有直接子层；关闭或卸载移除规则，拖动和菜单交互保持原生。两套构建哈希均使用动态映射；右上角原生窗口按钮底色保留。
- Windows 非抽屉侧栏开启背景时显示主题色 0.5px 右侧分割线，关闭或卸载后移除规则；两套构建哈希均动态映射，抽屉模式及其他平台不受该规则影响。
- 原始内联值与优先级能按所有权恢复；第三方后写值不被覆盖；结构表面替换不重启动画，框架替换后旧资源完整释放。
- Canvas 与绘图层不接收点击、不进入无障碍树与 Tab 顺序，不作为文字与控件之上的前景层。
- 减少动态效果时无连续帧；隐藏页面后无待执行帧，显示后最多恢复一条帧链；卸载后无观察器、监听、节点或帧残留。
- 使用框架尺寸响应缩放；大窗口与高像素比设备遵守像素预算，零尺寸不会造成异常。
- WebGL 编译/链接失败不启动帧且释放已分配资源；上下文丢失停止绘制，恢复后最多存在一条帧链；静态降级也仅位于已适配框架底层。

实现见 [client.ts](client.ts)、[attachment.ts](attachment.ts)、[pattern.ts](pattern.ts)、[animation.ts](animation.ts)、[wallpaper.ts](wallpaper.ts)、[host.ts](host.ts)、[rpc.ts](rpc.ts)与 [styles.ts](styles.ts)；行为覆盖见 [tests/background.test.mjs](tests/background.test.mjs)、[tests/wallpaper.test.mjs](tests/wallpaper.test.mjs)和 [tests/attachment.test.mjs](tests/attachment.test.mjs)。

用户此前反馈“样式好像对了”，仅表明较早图案视觉得到初步认可；其后全局预览实际报告布局适配错误，不能把旧测试或注册 active 当作画面验收。保留本地链接安装与原开关，不因静态检查推定新 Client 代际和画面已生效。浏览器面板仍未连接，当前样式元数据映射修复后的浅深主题、侧栏连续性、窄窗口、文字可读性、输入与点击、弹窗层级、结构表面恢复及官网实屏对照均待实际页面确认。

本次补充侧栏底部渐隐层适配，依据已核对的原生 SidebarRoot 源码和官方样式模块，沿用动态类名与样式所有权恢复机制。新增回归覆盖两套构建哈希、抽屉模式、节点替换、原值与优先级恢复、第三方后写保留及初始化失败回滚。已重建产物，通过严格类型、构建新鲜度、346 项全仓测试、实际 tarball、独立生产安装及 diff 空白检查；实际 Windows 页面仍待验收。

Windows 顶栏适配依据参考源码 AppFrame 的 `data-windows-titlebar` / `::before` 绘制规则，以及桌面 preload 的菜单透明样式与 `titleBarOverlay` 颜色同步实现；当前浏览器面板未连接，尚未完成 Windows 实屏验收。

已直接核对本机 `0.2.2-rc.1` 打包桌面版的 SidebarRoot 编译样式、类名映射与渲染代码：该构建包含 `_root`，但不存在 `_scrollFade`。此前错误地把参考源码中的新增装饰类名设为必需项，导致背景校验失败。现将其改为可选项，并补充缺失、歧义、延迟出现及再次失去唯一性时背景持续运行与装饰层恢复的回归；用户所报 Windows 构建仍待实屏复测。

本轮诊断优化及阶段策略拆分已通过严格类型、构建新鲜度、356 项全仓测试、实际打包、独立生产安装与 diff 空白检查；编译产物已更新。覆盖保存/运行故障区分、诊断字段选择与脱敏、失败检查预期/实际值、中英文原因及恢复建议、时间与复制状态的更新、可选渐隐层兼容和资源清理。尚未执行本轮实际页面验收。

本轮已直接核对本机 `0.2.2-rc.1` 工作区编译包：精确样式标签为 `@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css`，本机构建映射为 `Kjh-qa_root/treeBody/fade`；用户 Windows 构建反馈 `Gakraw_fade`。底部 span 在分组、平铺和搜索结果渲染中存在，样式为 24px 底色渐变，macOS 原生隐藏。本次适配使用运行时模块映射，测试覆盖上述两套及另一套哈希、无 aria-hidden 的真实节点结构、可选元数据恢复及列表替换；实际 Windows 页面仍待复测。

工作区 fade 补全已重建产物，通过严格类型、构建新鲜度、358 项全仓测试、实际打包、独立生产安装与 diff 空白检查；真实 Windows 展示尚待用户更新后复测。

本轮按用户要求把背景命名为「自定义背景」，保留单一 `flowingBackgroundEnabled` 开关与官网流动图案，并补充 `flowingBackgroundOpacity`（0–100%，默认 100）与 `flowingBackgroundBlur`（0–40px，默认 0）两行滑块，分别控制画布不透明度与磨砂模糊，参考 wallpaper 的整屏磨砂与 homepage-glass 的界面毛玻璃作为功能边界对照，但只作用于自有背景图层，不改宿主表面。曾尝试的内置「流体」预置已按用户要求删除，相关 shader、`flowingBackgroundStyle` 配置与测试一并移除。本轮按用户要求新增自定义壁纸：新增 `flowingBackgroundKind` 类型配置与「壁纸图片」行，Host 以 `WallpaperStore` 把图片存到 profile 的 `power-dsh/wallpaper.{bin,json}`，并提供 `readWallpaper`／`saveWallpaper`／`clearWallpaper` 三个 owner-only RPC；Client 侧校验 MIME 与 25 MiB、经 `FileReader` 读 data URL、失败回退图案并复用共享错误反馈。壁纸类型不启动 WebGL 帧链。行为覆盖见 [tests/background.test.mjs](tests/background.test.mjs)、[tests/wallpaper.test.mjs](tests/wallpaper.test.mjs)与 [tests/attachment.test.mjs](tests/attachment.test.mjs)。实际页面（含浅深主题、滑块观感与真实图片选择）仍需实屏验收。
