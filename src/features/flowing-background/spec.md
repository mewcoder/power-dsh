# 退役流动背景配置兼容与公共挂载授权

## 模块状态与范围

模块 id `flowing-background` 保留为无 UI 的旧配置兼容模块。它不提供独立功能开关、设置主行、主页调节面板、侧栏快捷按钮、slot 注册、配置监听、动画或其他副作用。官网流动图案已经统一为 [原生设置左侧「壁纸」专页](../wallpaper/spec.md) 中的 `flow` 预制选项，只由 `wallpaperEnabled` 与 `wallpaperSelection` 控制；主开关位于 PowerDSH 界面页第一行，开启后注册壁纸原生侧栏入口及图标，关闭移除入口和效果。

模块继续拥有五个隐藏的旧键，保留原保存值，不因升级自动删除或覆盖：

| 旧键 | 兼容用途 |
| --- | --- |
| `flowingBackgroundEnabled` | 在新版启用值未明确时，由壁纸功能兼容读取旧启用状态 |
| `flowingBackgroundKind` | 在选择未明确时，将旧 `wallpaper` 映射为 `custom`，旧图案映射为 `flow` |
| `flowingBackgroundOpacity` | 在新版可见度未明确时兼容旧值 |
| `flowingBackgroundBlur` | 在新版模糊未明确时兼容旧值，限制到新版 0–20px |
| `showBackgroundShortcut` | 已弃用并忽略，不展示 UI、不注册入口、不创建监听 |

旧值只提供兼容读取，不再启动独立流动效果；显式保存的壁纸开关、选择和调节值优先。新用户首次启用明确保存 `none`。完整读取顺序及用户行为由[壁纸配置与兼容](../wallpaper/spec.md#配置与兼容)拥有，本模块不维护第二份运行状态。

本文件继续承载既有 AppFrame 结构适配授权及流动图案算法来源。功能 UI 与生命周期已经归属壁纸模块；保留下述结构边界不代表允许扩大宿主 DOM 或主题修改范围。

## 全局底层挂载与授权边界

本节保留已确认的公共结构挂载授权边界，供壁纸功能的预制与自定义媒体共同使用；退役的 `flowing-background` 模块不再执行这些副作用。当前宿主没有公共背景插槽，由壁纸功能在 `shell.overlay` 注册返回 null 的生命周期控制组件，不在全窗口浮层中绘画，也不订阅 `usePanelInfo`、`useSessions` 或会话消息。

用户本次已直接授权全局预览及必要的原生结构表面适配。适配器只寻找唯一、可见且结构符合已安装宿主的 AppFrame。必需框架类名映射只读自当前页面两个确切的官方 `style[data-plugin-css]` 标签：`@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css` 和 `@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css`；前者提取唯一、简单且分别以 `_frame`、`_sidebarCol`、`_centerCol` 结尾的类名，后者提取唯一以 `_root` 结尾的必需类名，并尝试读取以 `_scrollFade` 结尾的可选类名。`_scrollFade` 缺失或歧义仅跳过渐隐层适配，不阻断背景；每个标签及必需类名都必须唯一，再结合真实框架的语义直接子元素、`position:relative` 和 `display:grid` 核对目标；不采用 npm 固定哈希、模糊类名或猜测性后代选择器。画布直接挂在该 AppFrame 内，使用自有 `position:absolute; inset:0; z-index:-1` 绘图层，框架建立 `isolation:isolate` 并保留原生 `--dsw-alias-bg-base` 底色。全框架使用一张连续 Canvas，跨越侧边栏与主内容区；画布位于结构表面及内容下方，不给文字、按钮或卡片叠加前景颜色。中心列存在宿主全局面板标记 `[data-global-panel]` 时，仅对该列临时设置 `background-color:var(--dsw-alias-bg-base)` 与 `background-image:none`，使 Web／Linux 原本透明的中心列也显示原生不透明主题底色；该覆盖同样保存原值与优先级、按所有权恢复。侧边栏、绘图层与帧链均不受影响，标记移除后中心列恢复透明化。宿主弹层自带不透明面板与遮罩，不触发任何撤下或恢复。

为让底层画布透出，仅允许对已核对的 AppFrame `sidebarCol`、`centerCol`、原生 SidebarRoot、任意 phase 的主 ConversationRoot，以及该主内容内通过 `[data-composer-seat][data-conversation-region="composer"]` 核对的输入区外层，临时设置内联 `background-color:transparent` 和 `background-image:none`。主 ConversationRoot 通过原生 `[data-conversation-content]` 的直接父元素及 `[data-phase]` 关系核对，不限制为 hero。不得扩大到输入卡片、编辑器、文件卡片、菜单、弹窗、任意后代或全局主题 token；不替换宿主根节点、不注入宿主全局 CSS、不改原生布局尺寸。窄窗口下 AppFrame 带有 `data-sidebar-drawer` 时，不透明化 sidebarCol 或 SidebarRoot，保留模态侧栏抽屉的原生底色；离开抽屉模式后重新适配这些明确目标。按用户要求，Windows 顶部操作栏尽量透明：只为已核对 AppFrame 且直接拥有自有背景层的元素添加局部 `::before` 背景透明规则，受 `html[data-windows-titlebar]` 限制，规则与自有样式节点一并释放。仅改绘制底色，保留原生高度、拖动区域、菜单、悬浮反馈和按钮交互；不修改全局主题 token。右上角原生窗口按钮由 Electron `titleBarOverlay` 绘制，桌面 preload 从独立主题探针同步颜色；当前插件无公共接口修改该底色，因此不承诺该部分透明，不操作内部 IPC 或探针。其他全局面板若拥有独立的不透明内容表面，可继续保留其原生底色，不承诺让所有内容表面透明；操作系统原生标题栏不在本次适配范围。

开启时同时隐藏原生 SidebarRoot 内、由同一官方样式模块唯一 `_scrollFade` 类名及 `aria-hidden="true"` 核对的底部滚动渐隐层，临时设置内联 `display:none !important`，避免 Windows 等平台在设置按钮上方留下侧栏底色阴影；抽屉模式同样隐藏。仅处理这个明确的装饰层，不修改列表滚动、设置按钮或其他渐变。此装饰层在部分发行构建中不存在；类名缺失或不唯一时保留该层原生效果，背景仍正常挂载，元数据变为唯一后可更新适配，失去唯一性时恢复原样且不重启动画。

用户实屏反馈的 `_fade` 来自另一官方模块 `@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css`，本功能额外只读该精确标签中唯一的 `_root`、`_treeBody`、`_fade` 简单类名。仅在已核对原生 SidebarRoot 内的工作区 root → treeBody 结构中，对 treeBody 的直接 span.fade 临时设置 `display:none !important`；已安装构建的该 span 没有 `aria-hidden`，不以此属性过滤。分组、平铺和搜索结果均复用这一结构，抽屉模式同样隐藏。该模块及三项类名全部为可选适配，缺失、歧义或样式未加载时不阻断背景、不猜测替代节点；加载、替换、关闭与第三方后写值遵循现有恢复规则，不重启动画。不按固定哈希或全局后缀匹配其他 fade。

按用户要求，Windows 非抽屉侧栏在开启背景期间补回右侧分割线，使用原生同款 `0.5px solid var(--dsw-alias-border-l3)`。规则仅匹配已核对、直接拥有自有背景层的 AppFrame 的直接 sidebarCol，受 `html[data-windows-titlebar]` 与 `:not([data-sidebar-drawer])` 限制，浅深主题跟随原生边框 token；关闭或卸载时随自有样式节点移除，恢复 Windows 原生无分割线样式，抽屉与其他平台保持原生。

对每项临时样式保存原值与优先级，恢复时仅处理仍等于本功能写入值和优先级的属性，保留第三方后写值。进入或离开全局面板时，只更新仍由本功能持有的中心列底色，不重新写入已被覆盖的底色或背景图。原生 SidebarRoot、ConversationRoot 或目标列动态替换时，更新这些明确目标的背景适配，不重启动画或新建第二张画布。AppFrame 替换、关闭开关、卸载或 slot 撤销时，释放旧画布、GPU、动画、观察器和自有节点，并按所有权恢复原有样式。

必需的官方样式元数据缺失、标签或必需类名歧义、框架缺失或定位结构不受支持时不绘画，不回退到 `shell.overlay` 前景。设置页复用共享错误反馈说明全局布局无法适配，保留用户开关与其他偏好，不输出样式正文、DOM 内容、机器路径或原始异常。官方样式延迟加载或替换后重新核对映射，正确元数据与目标恢复可挂载时移除过期反馈。绘图层与 Canvas 均为 `pointer-events:none`、`aria-hidden`，没有焦点或交互。

## 官网流动图案参数来源

图案为蓝白色块旋涡扭曲形成柔和流动图案，底部渐隐。市场来源为 [Tim5613/dsh-homepage-glass](https://github.com/Tim5613/dsh-homepage-glass/tree/a9bb39e7a9ceb1a83b1467312076f786d6e30fa0)，已核对其参数及当前官网：三色 `#8AA3D6 / #FFFFFF / #FFFFFF`、scale `.5`、rotation `-5°`、offset `(0,65)`、distortion `20`、swirl `12`、八次迭代、checks/shapeScale `10`、softness `100`。柔和来自蓝→白→白的两级宽范围混色，不额外给文字添加 CSS blur。绘图代码独立实现这些数值与数学关系，不复制参考插件逐字提取的官网 shader。实际像素一致性仍需实屏对照，不由参数核对推定。

## 官网流动预制的既有渲染依据

「官网流动」保留原有 shader 的柔和蓝白 RGB 图案、官网 `linear-gradient(#000000fc 0%, #000000e8 8.98%, transparent 100%)` 遮罩与 `#9cc1e7` 到透明的底色渐变，合成为透明蓝色层；相位分别以 420、460、90 秒为周期，起始漂移约 `.07` 单位/秒。

动画使用 AppFrame `clientWidth`、`clientHeight` 确定 CSS 绘图尺寸，通过 `ResizeObserver` 响应尺寸变化，只调整自有 Canvas。DPR 与 GPU 像素预算只影响清晰度，不改变图案缩放；最多每秒 24 帧，像素比上限 1.5、像素总数上限约 200 万。`prefers-reduced-motion:reduce` 下保留静态图案且偏好变化即时生效；页面隐藏时取消帧回调，显示后恢复，不追赶隐藏时间。已适配框架内 WebGL 不可用或 shader 编译／链接失败时使用自有静态 CSS 渐变；上下文丢失停止帧并释放旧 GPU，恢复后重建单条绘制链。布局不受支持时连静态背景也不挂载。样式值相同时不重复写入，避免自身 MutationObserver 持续触发。

## 生命周期与诊断归属

媒体层、结构表面样式快照、MutationObserver、ResizeObserver、GPU 和帧链由壁纸功能的控制组件持有，随 `none`、关闭、框架替换或卸载释放。本兼容模块没有 slot、配置订阅或运行错误 UI；只读配置字段也不产生媒体。

既有适配器的安全失败阶段、检查标识、预期／实际值、样式所有权恢复与可选装饰处理继续适用，错误呈现归壁纸专页并遵循[错误处理规范](../../../docs/error-handling.md)。历史 [diagnostics.ts](diagnostics.ts)及其[测试](tests/diagnostics.test.mjs)保留诊断策略证据，不表示兼容模块运行时会注册原先的流动故障设置行。

接口依据为已核对的 DSH `0.2.2-rc.1`：`shell.overlay` 的只读 slot 发现、官方安装包 AppFrame／SidebarRoot／WorkspaceBrowser 模块映射及上节语义结构核对。CSS Modules 哈希按当前官方样式元数据发现，同版本不同构建不硬编码；没有据此扩展跨版本兼容承诺。

## 验收条件与实现定位

- 五个旧配置键保持归属和隐藏，读取后不自动写盘；模块本身无设置行、主行调节按钮、面板、sidebar footer、slot 或监听。
- 旧启用的流动图案和自定义图片由壁纸功能分别兼容为 `flow`／`custom`；显式新选择优先，`none` 不启动任何旧流动效果。
- 官网流动只通过壁纸预制选择渲染，采用统一可见度与 0–20px 模糊，不保留旧 0–40px 调节面板。
- 公共挂载只处理上述明确目标、官方样式映射和可选装饰；失败保留原生布局、关闭按所有权恢复，第三方后写值不被覆盖。
- 页面隐藏、减少动效、WebGL 降级与卸载清理保持既有行为；只在 `flow` 选择生效期间启动动画链。

配置兼容入口见 [client.ts](client.ts)与[配置](config.ts)；共享渲染见 [attachment.ts](../../shared/client/background/attachment.ts)、[pattern.ts](../../shared/client/background/pattern.ts)、[animation.ts](../../shared/client/background/animation.ts)和[样式](../../shared/client/background/styles.ts)。行为验证位置为[背景测试](tests/background.test.mjs)、[挂载测试](tests/attachment.test.mjs)与[壁纸测试](../wallpaper/tests/client.test.mjs)。本轮退役兼容及统一预制的实现、测试、产物和实际页面结果待整合者记录，不能沿用下节历史结果宣称已验收。

## 历史验证与已替代方案

以下为既有结构适配及前序 UI 的历史证据，不证明本轮预制选择已经实现或通过验收。原「自定义背景」合并面板、后续官网流动独立开关、主页调节面板、快捷按钮及双功能优先级方案均已退役；现行用户行为统一以壁纸 Spec 为准。

用户此前反馈“样式好像对了”，仅表明较早图案视觉得到初步认可；其后全局预览实际报告布局适配错误，不能把旧测试或注册 active 当作画面验收。保留本地链接安装与原开关，不因静态检查推定新 Client 代际和画面已生效。浏览器面板仍未连接，当前样式元数据映射修复后的浅深主题、侧栏连续性、窄窗口、文字可读性、输入与点击、弹窗层级、结构表面恢复及官网实屏对照均待实际页面确认。

本次补充侧栏底部渐隐层适配，依据已核对的原生 SidebarRoot 源码和官方样式模块，沿用动态类名与样式所有权恢复机制。新增回归覆盖两套构建哈希、抽屉模式、节点替换、原值与优先级恢复、第三方后写保留及初始化失败回滚。已重建产物，通过严格类型、构建新鲜度、346 项全仓测试、实际 tarball、独立生产安装及 diff 空白检查；实际 Windows 页面仍待验收。

Windows 顶栏适配依据参考源码 AppFrame 的 `data-windows-titlebar` / `::before` 绘制规则，以及桌面 preload 的菜单透明样式与 `titleBarOverlay` 颜色同步实现；当前浏览器面板未连接，尚未完成 Windows 实屏验收。

已直接核对本机 `0.2.2-rc.1` 打包桌面版的 SidebarRoot 编译样式、类名映射与渲染代码：该构建包含 `_root`，但不存在 `_scrollFade`。此前错误地把参考源码中的新增装饰类名设为必需项，导致背景校验失败。现将其改为可选项，并补充缺失、歧义、延迟出现及再次失去唯一性时背景持续运行与装饰层恢复的回归；用户所报 Windows 构建仍待实屏复测。

本轮诊断优化及阶段策略拆分已通过严格类型、构建新鲜度、356 项全仓测试、实际打包、独立生产安装与 diff 空白检查；编译产物已更新。覆盖保存/运行故障区分、诊断字段选择与脱敏、失败检查预期/实际值、中英文原因及恢复建议、时间与复制状态的更新、可选渐隐层兼容和资源清理。尚未执行本轮实际页面验收。

本轮已直接核对本机 `0.2.2-rc.1` 工作区编译包：精确样式标签为 `@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css`，本机构建映射为 `Kjh-qa_root/treeBody/fade`；用户 Windows 构建反馈 `Gakraw_fade`。底部 span 在分组、平铺和搜索结果渲染中存在，样式为 24px 底色渐变，macOS 原生隐藏。本次适配使用运行时模块映射，测试覆盖上述两套及另一套哈希、无 aria-hidden 的真实节点结构、可选元数据恢复及列表替换；实际 Windows 页面仍待复测。

工作区 fade 补全已重建产物，通过严格类型、构建新鲜度、358 项全仓测试、实际打包、独立生产安装与 diff 空白检查；真实 Windows 展示尚待用户更新后复测。

历史上曾把流动图案与自定义壁纸合入单一「自定义背景」开关，增加 `flowingBackgroundKind`，并以 `WallpaperStore` 和三个 owner-only RPC 保存 profile 内图片；当时缺图回退图案。该合并入口及回退策略现已撤销，旧配置和文件仅按独立壁纸 Spec 兼容。曾尝试的「流体」预置及其 shader、`flowingBackgroundStyle` 与测试已移除，不重新引入。历史图片存储证据现见[壁纸测试](../wallpaper/tests/wallpaper.test.mjs)，本轮实际浅深主题、滑块观感与选图验收另行记录。
