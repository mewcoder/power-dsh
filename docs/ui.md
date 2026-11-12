# UI 规范

## 页面与原生参照

以目标 DSH 的同类界面为参照：偏好设置对照通用设置页，管理列表对照插件管理页。先核对当前页面或安装包实现，再选择布局；本文尺寸是项目维护基线，不是官方设计 token。

Mod 设置入口与页面标题中英文均为「PowerDSH」，技术包名与设置命名空间为 `power-dsh`。导航、外层面板和关闭行为交给宿主；内部按标题、简短说明、分类 Tab 和设置行组织。全局指令是用户确认的独立设置 Tab：Mod「管理」分类只显示开关，开启后由原生设置侧栏展示「全局指令」入口，编辑页采用大文本框与取消、保存按钮，不显示字符计数或常驻上限说明，详见[全局指令](../src/features/personalization/spec.md)。减少装饰、卡片嵌套和重复入口，不展示未实现的控件或“即将上线”操作。

## 设置页 Title 与描述

所有 Mod 设置页的页面级 Title 与描述，统一对齐原生「模型」设置页。此规则指页面顶部标题和描述，不用于设置行的名称、说明或编辑器字段。每页顶部仅保留一组 Title 与描述，不额外堆叠功能标签、操作提示或示例文案。设置行、页面和弹窗的固定描述文案，中英文均省略末尾句号；多句说明保留中间的句号。

| 元素 | 统一样式 |
| --- | --- |
| Title | 语义 `h2`；16px / 24px；字重 500；`--dsw-alias-label-primary`；margin 0 |
| 描述 | 语义 `p`；14px / 22px；字重 400；`--dsw-alias-label-tertiary`；margin 0 |
| Title 与描述间距 | 垂直 12px，通过标题组的 `gap` 控制 |
| 对齐与换行 | 同一左边界；字体继承宿主；描述自然换行，长路径不撑破面板 |

本机 DSH 0.2.2-rc.1 的 `@deepseek-ai/dsh-client-ui-settings-models` 已核对上述尺寸、颜色、行高与间距，对应 [ModelsSection 及样式源码](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-settings-models/src/client)。后续新增页面遵循此标准，不根据截图缩放或临时选择字号。

全局指令页 Title 固定为「全局指令」，英文为「Global instructions」；描述固定为全局 `AGENTS.md` 的实际文件路径，由 Host 返回，不重复 Title 中的「全局指令」，也不重复展示「全局指令」字段标题；输入框 placeholder 固定为「添加自定义指令」。文件定位遵循 `$DSH_HOME/AGENTS.md`，默认 `~/.dsh/AGENTS.md`，不写死机器路径，不显示 profile 配置文件的位置。

## Logo 与图标

宿主产品图标通过 ui-theme 的 SVG sprite 引用 `dsw-icon-<glyph>-<weight>`，继承 `currentColor`。已核对的图标基线为常见 16 × 16 画布、Regular 描边 1、Medium 描边 1.3；部分图形有独立尺寸或混合填充，使用前核对目标版本。

设置导航使用宿主传入的 `size`，当前为 16px。Mod 标识使用 Lucide Puzzle，技能入口使用 Lucide Sparkles，MCP 入口使用 Lucide Cable；保留各自原始 24 × 24 画布、路径和 2 单位描边，16px 下实际线宽约 1.33px。图形来源和完整许可统一保留在[第三方资源声明](third-party-notices.md)，[独立 SVG](../assets/icon.svg)与内联导航图标保持相同几何。内联导航图标继承 `currentColor`；插件管理页用图片显示独立 SVG，不能继承页面文字色，因此 SVG 通过 `prefers-color-scheme` 和系统色 `CanvasText` 适配明暗背景。

- 选择清晰、可与同组入口区分的轮廓图形；不把大尺寸品牌 Logo 直接缩成导航图标。
- 保留来源几何、端点和转角，描边随画布缩放；不加 `non-scaling-stroke` 或用 CSS 补偿图形。
- 继承宿主颜色与选中状态，不添加彩色底板、渐变、阴影、emoji 或品牌外框。
- 装饰性 SVG 使用 `aria-hidden` 与 `focusable="false"`，名称交给按钮。
- 在实际 16px 下与账号、通用设置等图标并排检查线宽、留白与细节密度；第三方市场图标不作为标准。

原生依据：[图标组件](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/icons/index.tsx)、[图形与权重](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/icons/artwork.ts)。外观按钮的原生 sprite 用法见[外观快捷切换](../src/features/appearance-shortcut/spec.md#原生状态与图标)。不运行时导入宿主内部 UI 包。


## 主题与基础样式

使用已确认的宿主 token，使用前通过 `Theme.listTokens` 核对运行时；不硬编码浅深配色或依赖私有变量。状态同时提供文字或语义，不能只靠颜色。

| 用途 | Token |
| --- | --- |
| 基础与分层背景 | `--dsw-alias-bg-base`、`--dsw-alias-bg-layer-1`、`--dsw-alias-bg-layer-2` |
| 浮层 | `--dsw-alias-bg-overlay` |
| 边框 | `--dsw-alias-border-l1`、`--dsw-alias-border-l2` |
| 主要与次要文字 | `--dsw-alias-label-primary`、`--dsw-alias-label-secondary` |
| 品牌强调 | `--dsw-alias-brand-primary` |
| 错误、警告与成功 | `--dsw-alias-state-error-primary`、`--dsw-alias-state-warn-primary`、`--dsw-alias-state-success-primary` |

字体与控件继承宿主，不加载外部字体。常用间距为 4、8、12、16、24px，优先对齐同类组件；分组使用留白和细线，不默认加阴影。不改变宿主全局字体、圆角或密度。

## 任务通知

「通用」只显示一个「任务通知」设置行：右侧原生 Menu 选择从不提醒、仅在未聚焦时提醒、始终提醒，选择框紧邻左侧放 16px 铃铛测试图标，26px 命中区；图标和选择框组成同一操作组，不重复主开关、提醒时机或独立测试行。图标具有「发送测试通知」的悬停说明和无障碍名称；等待时禁用，确认交给系统后显示勾号及对应提示，不能将其写成横幅已显示。从不提醒时禁用测试，隐藏声音子项并保留偏好。行为和兼容存储见[任务通知 Spec](../src/features/notifications/spec.md)。

## 壁纸

「开启自定义壁纸」（英文 `Enable custom wallpaper`）位于 **设置 → PowerDSH → 界面**的第一设置行，在快捷推理等级切换之前，分类 `interface`、排序 -1。`wallpaperEnabled` 默认关闭、独立持久化。PowerDSH 保留通用、界面、管理、精简、其他五个内部 Tab，默认通用，没有内部壁纸 Tab；主开关只在界面首行出现，「通用」与壁纸专页均不重复。

开启后在原生设置左侧注册独立「壁纸」／`Wallpaper` 入口及图标，排序为 50.5，位于 PowerDSH（50）之后、全局指令（51）之前。进入 **设置 → 壁纸**后，专页展示自己的「壁纸」Title 和「选择壁纸并调整显示效果」／`Choose a wallpaper and adjust its appearance` 描述，遵循[设置页 Title 与描述](#设置页-title-与描述)的原生基线。Title／描述下方直接放置四项缩略图单选，再显示可见度和模糊两个滑块，不再添加同名字段标题。关闭界面主开关移除原生入口、图标和媒体效果，保留选择、图片及调节值。没有官网流动背景独立开关、主页调节面板或背景侧栏底部快捷入口。旧五个流动背景键只作隐藏兼容，`showBackgroundShortcut` 的保存值被忽略，详细读取规则见[壁纸 Spec](../src/features/wallpaper/spec.md)。

缩略图 radio 组按固定顺序提供「无壁纸」「官网流动」「大肥鱼」「自定义」，分别对应 `none`、`flow`、`seaside`、`custom`。选择立即保存、失败回滚，选中状态使用贴合完整卡片外缘的 1.5px 中性轮廓与主要文字色，将缩略图、名称及操作区一起框住，选中及其悬停状态均不添加整卡底色或阴影，也不添加勾选角标，卡片按钮显式清除原生外观与阴影；焦点环仅在键盘聚焦时出现，卡片尺寸不因选中而变化。仅一个选项进入 Tab 顺序，方向键循环、Home/End 移到首尾并选择；无图片的自定义选项在键盘导航时只获得焦点，Enter／Space 或点击明确激活才打开文件选择器，避免方向键浏览时弹出系统窗口。只参考 Cindy 的选择与调节交互，「大肥鱼」仅采用用户明确指定的现用图片，不复制 Cindy 图片资产。

「无壁纸」及未上传图片的「自定义」卡片使用主题分层底色与 0.5px 内描边，让空白预览区在浅深主题下均有清晰边界；已有图片与流动缩略图保持原样。选择「无壁纸」保留专页且不挂载媒体；官网流动只作为预制选项，仍可响应减少动效与隐藏暂停。选择已有自定义图片可直接生效；选择空自定义打开系统文件选择器，取消保持原选择。成功导入自动选自定义；移除当前自定义图片切回无壁纸，移除非当前的自定义图片保留所选预制。自定义图片的替换与移除操作收在卡片底部名称右侧，常显并预留名称空间，不遮挡图片；按钮与 radio 互为同级，避免交互控件嵌套。按钮点击不同时触发预制选择。缩略图组下方以 12px 三级文字色的说明行显示「PNG / JPEG / WebP · 最大 25 MB」；自定义图片的 Tooltip 只显示 Host 返回的本地副本完整路径，空图片或未提供路径时不显示，不猜测原图路径；不重复文件行或操作行。操作复用宿主公共按钮、Tooltip 与焦点样式；更换图片使用双向切换箭头，移除使用宿主垃圾桶图标，图标统一为 14px、按钮命中区为 28px。按钮自身使用三级文字色，hover 或键盘聚焦时使用次级文字色；更换操作的提示和无障碍名称为「更换图片」。文件输入为视觉隐藏的原生 `input[type=file]`，不增加拖放区或自建文件浏览器。Client／Host 均验证类型与大小，失败保留确认状态并显示共享错误反馈，读取失败可重试。Host 沿用 profile 的 `power-dsh/` 图片文件及 owner-only RPC。

所有预制与自定义共用「壁纸可见度」0–100%、步进 1%，以及「壁纸模糊」0–20px、步进 1px，切换不重置数值。两个控件保留原生 range 语义，形态参考 Cindy：36px 高命中区、6px 轨道、16px 默认滑块，hover 为 18px，按下为 22×16px；颜色、禁用与焦点使用 DSH token，不添加滑块依赖。媒体与主题基础底色混合，静态图片使用主题色遮罩，模糊只作用媒体并外扩三个半径后裁切，允许 cover 构图轻微扩大。可见度 0 时暂停实际模糊、禁用模糊滑块但保留数值。按住滑块至少 200ms 且横向移动至少 4px 后才隐藏设置弹窗其余内容与遮罩；单击、短按、快速拖动或长按不移动时保持完整设置可见，数值仍正常调整与保存。进入隐藏预览后，保留当前滑块、名称和数值在原位可见，配以紧凑主题底板；原页面挂载、焦点、滑块几何位置与指针捕获不变；松手立即恢复当前壁纸页，再异步保存最终值。取消、失焦、关闭、失权或离页均恢复并丢弃未提交预览；取消后的迟到输入与松手不保存。乐观选择和选择保存失败回滚都立即取消原手势，即使配置源未重新通知；当前选择成功确认且未改变时保留手势。仅核对自有滑块的原生设置祖先与滑块行标记后，对 overlay 临时设置 visibility:hidden，并将自有滑块行设为 visibility:visible，保存并按所有权恢复，不关闭设置或修改全局 CSS。结构不支持时保持设置可见，沿用可调节状态并提供共享错误反馈。键盘支持方向键、Home/End、PageUp/PageDown，键盘调节时保持设置可见。指针取消、丢失捕获、控件或窗口失焦、离开设置丢弃未提交预览并跟随最新保存值，拖回起点不写入。写入串行但滑块保持可用，旧回执不覆盖新提交，失败回到最近确认值并显示共享错误反馈；不沿用已撤销主页面板的关闭即保存行为。

全部媒体复用一套 AppFrame 底层挂载，最多一个实际背景层。自定义图片不创建 WebGL 或帧链，仅官网流动选择使用既有独立 WebGL 图案与降级机制。对话与任务运行显示媒体；中心列带宿主 `data-global-panel` 标记的全局页面恢复原生不透明底色，侧边栏继续透出，离开后中心列重新透出，不读取面板 id。选择无壁纸或关闭时释放挂载及结构表面覆盖。完整边界保留在[公共挂载授权](../src/features/flowing-background/spec.md#全局底层挂载与授权边界)。

`shell.overlay` 只保留返回 null 的生命周期控制组件，不在全窗口浮层绘画。框架适配只从当前已加载的两个必需官方样式标签读取唯一简单类名映射，再核对真实 AppFrame 的语义直接子元素、relative 定位和 grid 布局；同版本不同构建的 CSS Modules 哈希不会被视为固定值。画布直接挂在唯一、可见且已核对结构的 AppFrame 内，使用 absolute、inset 0、负 z-index，框架建立 `isolation:isolate` 并保留原生 bg-base 底色，文字与控件绘制在其上方。

按用户本次授权，仅临时把已核对的 sidebarCol、centerCol、原生 SidebarRoot、任意 phase 的主 ConversationRoot，以及其主内容内已核对的 composerSeat 外层的内联 background-color 设为 transparent、background-image 设为 none，让底层动画透出。输入卡片、编辑器、文件卡片、菜单和弹窗保留原生表面与交互；不修改全局主题 token 或任意后代。窄窗口中 AppFrame 出现 `data-sidebar-drawer` 时，sidebarCol 和 SidebarRoot 保留原生底色，不把模态侧栏抽屉透明化；退出抽屉模式后恢复目标适配。中心列出现宿主全局面板标记 `[data-global-panel]` 时，只将中心列设为不透明的主题基础底色，兼容原本透明的 Web/Linux 中心列；侧边栏、绘图层与帧链不受影响，标记移除后中心列重新透明化。宿主弹层自带不透明面板与遮罩，不触发撤下或恢复。操作系统原生标题栏不作适配。

Windows 非抽屉侧栏开启背景时补上原生同款 0.5px 右侧分割线，颜色跟随浅深主题的 border-l3 token，关闭后恢复原生无分割线样式。

Windows 顶部操作栏在开启背景时去掉已核对 AppFrame 拖动层的底色，尽量透出连续背景，关闭后恢复；保留菜单与拖动交互。右上角 Electron 原生窗口按钮底色暂无法通过现有插件接口透明化。

挂载任一背景时，同时隐藏原生侧栏设置按钮上方的底部滚动渐隐层，避免 Windows 等平台残留侧栏底色阴影；抽屉模式同样隐藏，关闭后恢复原生效果。兼容侧栏 shell 的 scrollFade 与工作区会话列表的 fade 两种原生结构，工作区类名只从其精确官方样式标签读取。部分发行构建不含某种装饰层，类名缺失或歧义时只跳过此项适配，背景继续运行。目标核对与恢复规则以[功能 Spec](../src/features/flowing-background/spec.md)为准。

保存所有临时样式原值和优先级，清理时只恢复仍属于本功能的写入，保留第三方后写值。原生目标表面或同一框架的类名映射动态替换时只刷新背景适配，不重启动画。官方样式元数据缺失、标签或类名歧义，或 AppFrame 缺失、不支持时不绘画，不回退前景；设置页复用共享错误反馈说明全局布局无法适配，不输出样式正文、DOM、机器路径或原始异常。正确官方样式延迟到达后可恢复挂载并移除过期反馈。

动画按框架尺寸绘制，`ResizeObserver` 仅调整自有 Canvas；`MutationObserver` 在 body 跟踪已批准结构表面，在 head 观察官方样式模块加载、替换及文本变化，类名读取限于主 Spec 列明的两个必需标签和一个可选工作区标签。关闭、框架替换或卸载时移除节点、释放观察器、动画和 GPU，并恢复所属样式；`prefers-reduced-motion` 下保持静态，页面隐藏时暂停。WebGL 不可用或上下文丢失时，仅在适配成功的框架底层回退自有 CSS 渐变。用户报告的全局布局错误已定位为 npm 固定哈希与已安装桌面构建不一致；浏览器面板未连接，修复后的实际页面仍待验收，结构授权以[退役兼容与公共挂载 Spec](../src/features/flowing-background/spec.md)为准，现行行为和本轮验证以[壁纸 Spec](../src/features/wallpaper/spec.md)为准。

## 分类 Tab

Mod 内按「通用」「界面」「管理」「精简」「其他」五个 Tab 顺序组织功能，默认选择「通用」。内部 Tab id 依次为 `general`、`interface`、`enhancements`、`simplify`、`other`，其中 `enhancements` 对应「管理」。任务通知下方的「通知声音」开关单独一行，保留一句说明「开启任务通知提示音」。声音开启时下方展开第二行「提示音」，右侧为宿主 Menu 下拉和小播放图标，默认「系统默认」；关闭时收起第二行、保留声音偏好，只显示开关行。任务通知关闭时隐藏通知声音和提示音设置，保留声音开关与提示音选择；重新开启时恢复显示。选中后保存并自动试听；重复选择当前声音或点击播放图标可重听。播放图标使用 20px 圆圈三角形、36px 按钮命中区域，提供「试听」可访问名称、提示和忙碌状态，不显示大文字按钮。目录不可用、保存或试听进行中禁止选择和重复试听。「提示音」行只显示一句说明「选择系统提示音」；远程连接时下拉显示「系统默认」并禁用，不额外显示本机限制文案或重试按钮；目录或播放错误仍保留行内提示，目录加载失败可重试。设置按使用频率和功能关联性排序。通用包含任务通知及其联动声音设置。界面依次包含开启自定义壁纸、快捷推理等级切换、外观快捷切换、显示版本号；「推理等级切换按钮样式」紧随快捷推理等级切换主开关联动显示。重启开关 `showRestartButton` 默认关闭且独立持久化，说明固定为「重新启动应用」。顶部使用原生横向 `ellipsis-outline` 图标的「更多操作」菜单，复用公共 `Menu`；刷新在上、重启在下，两个开关独立控制入口，只占原有单按钮位置。侧栏收起关闭菜单与重启确认，所有入口关闭或不可用时不显示空菜单。重启设置行仅在 macOS 打包桌面端显示，菜单项仍需 Host 能力确认；Windows、Linux、普通 Web 隐藏重启设置行与菜单入口，隐藏时保留已有偏好，不清除状态，不增加平台警告常驻文案。点击先以宿主公共确认弹窗告知任务停止与未保存内容风险，再保留宿主退出确认，取消或退出超时不强杀、不重开，完整边界见[重启应用](../src/features/restart-button/spec.md)。管理依次包含技能管理、MCP 管理、全局指令、工作区管理、归档、使用统计；「归档」页内自带「自动归档」卡片（单行原生 Menu 下拉，选项「永不」与 7／14／30／60／90 天，默认「永不」），不在主设置页重复一行；精简包含官方登录与模型接入、官方搜索、官方反馈与遥测、Todo、Plan 模式和 Goal 模式；其他依次包含界面刷新、重启应用和屏蔽双击重命名，刷新与重启相邻。壁纸、全局指令、技能与 MCP 的内容页属于原生设置侧栏的独立入口；壁纸主开关在 Mod「通用」首行，其余入口开关在「管理」。Tab 选择仅为当前页面状态，不持久化，也不改任何功能开关。

采用内置插件页的文字下划线样式：13px / 20px 文字、`7px 1px 9px` 内边距、0.5px 底部分隔线，选中项下方为 2px 短线。颜色使用原生 label 与 border token，提供键盘焦点和 `tablist`、`tab`、`tabpanel` 及关联 id。仅当前 Tab 进入键盘顺序，左右方向键循环切换，Home/End 跳到首尾并移动焦点；保存中仍可聚焦 Tab 并保留其选中状态，只是切换被忽略（`aria-disabled` 提示），保证操作反馈与错误留在当前分类。参考 [PluginsSettingsSection](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-settings-plugins/src/client/PluginsSettingsSection.tsx) 与其样式，已对照本机安装包核对。五个分类保持固定声明；公共外壳只负责分类切换与设置行渲染，不判断壁纸业务。

## 状态提示与错误反馈

全部功能遵循[错误处理规范](error-handling.md)，复用[共享错误反馈](../src/shared/client/error-feedback.ts)的摘要、错误信息展开与复制交互，不各自创建孤立样式或只显示「请重试」。详情的选字段、脱敏、恢复与生命周期由主规范统一维护；设置保存与功能运行故障使用不同代码，功能诊断可附稳定检查标识、预期/实际结果、当前状态和适用恢复建议，复制报告便于 AI 与维护者定位；侧栏等紧凑入口保留自身容器，内部使用同一反馈组件。

错误反馈参照 DSH `0.2.2-rc.1` 插件安装对话框的摘要／操作／展开详情层级与插件更新输出区域。页面错误采用单层设置卡片：`12px 14px` 内边距、`--dsw-radius-lg` 圆角、`--dsw-alias-settings-card-fill/stroke` 底色与 0.5px 描边；行内错误不额外套卡，紧凑侧栏反馈保留有界容器。摘要使用错误色，8px 下方同一操作行左侧为「错误信息」，右侧为可选「重试」；使用公共 `Button` 的 sm（28px、12px／18px），详情为 ghost、重试与复制为 outline，不覆盖原生按钮材质。详情按钮使用 `aria-expanded/aria-controls`、14px 原生 Regular 下箭头，展开旋转 180°，减弱动态效果时关闭过渡。诊断默认收起，展开后以无描边的 `--dsw-alias-bg-module-platform` 中性区域承载，12px 圆角与 `10px 12px` 内边距，正文 12px／18px 等宽、次要文字色、最大高度 200px 并可滚动和选择；长行换行，底部细线分隔的操作区右对齐复制，复制结果在其左侧显示。避免浏览器默认 summary 标记与卡片套卡片。参照 [InstallDialog](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/src/client/PluginManagerPage.tsx)、[updateOutput 样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/src/client/PluginManagerPage.module.css)及公共 [Button](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/Button.tsx)，均已核对当前桌面安装包；不导入官方功能插件内部组件。

页面级状态提示紧跟标题与说明，位于分类 Tab、设置行或编辑器之前。沿用原生插件设置页的状态文字规格：13px／20px，与标题组间距 12px。所有设置、管理页与详情的读取提示统一通过共享 `loadingFeedback`：宿主公共 `StateDot` 的 14px `ongoing` 小转圈配简短文字，间距 8px，使用次要文字色与 `role="status"`，不加卡片或色块。首次无内容时在 96px 高的区域居中显示；已有内容刷新时保留原内容，改用左对齐的 12px 紧凑提示。使用统计有独立刷新按钮，已有数据时只在按钮内显示加载指示，不重复显示页级加载提示。通用文案为「正在加载…」，详情可使用对应读取文案。只读和版本信息缺失仍使用 `--dsw-alias-label-tertiary` 与 `role="status"`；配置不可用、文件读取失败使用 `--dsw-alias-state-error-primary` 与 `role="alert"`。颜色随宿主浅深主题变化，文案与控件禁用状态反映实际结果；状态恢复后移除提示。

保存或校验失败留在相关控件旁：设置行的说明下方、编辑器输入框下方。采用原生配置字段的错误色，设置行错误为 12px／18px、上间距 4px，并通过错误 id、`aria-describedby` 与 `aria-invalid` 关联控件。原生依据为 [PluginInventorySettingsTab 样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.module.css)及[配置字段样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/settings-form/fields.module.css)。

## 控件与交互

偏好入口原则见[产品规范](product.md#入口与状态)。表单采用原生左侧名称与说明、右侧控件的行式布局，不另造大卡片。参照安装包 `DeveloperToolsRow` 与原生 `Switch`：

| 项目 | 基线 |
| --- | --- |
| 标题 | 14px / 20px，400，主要文字 token |
| 说明 | 12px / 18px，400，次要文字 token；上间距 4px |
| 设置行 | 上下内边距 16px，左右内容间距 24px，控件垂直居中 |
| 分隔线 | `0.5px solid var(--dsw-alias-border-l2)`；无额外顶线，末行无底线 |
| 错误提示 | 对应行左侧说明下方，12px／18px，原生错误色与 `role="alert"`；遵循[状态反馈](#状态提示与错误反馈) |
| 开关几何 | 36 × 20px 轨道、16 × 16px 滑块、2px 内边距，开启后平移 16px |
| 轨道关闭 / 开启 | `--dsw-alias-border-l3` / `--dsw-alias-brand-primary` |
| 滑块关闭 / 开启 | `--dsw-alias-switch-thumb` / `--dsw-alias-label-primary-foreground` |
| 键盘焦点 | `--dsw-focus-ring-width` 实线，`--dsw-focus-ring-color`，缺省回退 `--dsw-alias-state-business-primary`，外偏移 2px |
| 禁用 | opacity 0.5，cursor default |
| 过渡 | 滑块、轨道颜色与透明度 120ms ease；保存中仅轻微淡化开关，`prefers-reduced-motion` 下关闭动画 |

原生来源：[设置行样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-settings-general/src/client/DeveloperToolsRow.module.css)、[Switch 实现](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/Switch.tsx)与[样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/Switch.module.css)。宿主升级后重新核对，不用截图物理像素或 `0.9em` 近似推算字号。

推理等级按钮是纯图形控件，默认用仪表盘，也可在设置「推理等级切换按钮样式」里切换为信号格。两种样式都在 28 × 28 命中区内居中显示：信号格为 20 × 14，仪表盘为 24 × 24，不显示文字标签；档位名与下一档由公共 `Tooltip` 和按钮 `aria-label` 提供，视觉状态由点亮的格数表达，不只靠颜色。信号格按档位数等分高度，每根线条两端全圆角；仪表盘复刻宿主 `gauge-outline` 产品图标（16 × 16），浅色圆弧与 5 条较亮、含首尾的内刻度（把整段圆弧四等分）加一枚强调色指针和中心圆点（内刻度比圆弧略亮，清晰但不抢眼），真实档位均匀铺满刻度、指针按档位从低（左）转到高（右）；「默认」不是档位，指针停在底部缺口并变灰，有效档位 id 为 `max` 时，指针与圆心使用主题橙色 `--dsw-alias-state-warn-primary`；灰色、强调色与 Max 橙色共用相同指针和圆心尺寸，仅切换颜色，圆心不描边；显示为 24 × 24 并垂直居中，切换时以中心为轴 180ms 平滑过渡，减弱动态效果时关闭动画。按钮材质对齐官方模型座位触发按钮：`--dsw-radius-sm` 圆角、无边框透明底、默认与 hover 均保持透明且无阴影，键盘 `focus-visible` 用 2px 主题色 outline、外偏移 2px；点亮格/刻度用宿主主题强调色 `--dsw-alias-state-business-primary`，未点亮部分继承次要文字色并降低透明度，随浅深色主题变化。工具行 `.standardControls` 的 12px gap 由本按钮自身的 `margin-left:-8px` 与 `margin-right:-8px` 在左右两侧各抵消为约 4px。按钮注册在 `conversation.input.right`，但以自身 `order:1` 视觉排在官方模型座位右侧，由右对齐的发送按钮锚定，避免模型座位文字变宽时推动按钮；这不改宿主 DOM/CSS，代价是 Tab 焦点顺序仍按 DOM 顺序（按钮先于模型座位），已在主 Spec 记录。它同样遵循下列语义与键盘要求。

使用语义 HTML：按钮有名称、焦点与禁用态；开关使用 `role="switch"`、`aria-checked` 和关联标签，支持键盘。点击后滑块立即过渡到目标位置，**只有正在保存的那一行**轻微淡化、设置 `aria-busy` 并禁止重复提交；其余开关与分类保持可操作，页面不因单次写入进入整体禁用态。成功采用已保存的值，失败回到已保存的值并显示原因；全局指令开关按用户要求不显示行内提示文字，失败仍回到已保存的值。不添加后台状态提示或人为等待。输入错误关联字段，支持中文输入法；若新增对话框，管理初始焦点、圈定、Escape 和关闭后的焦点恢复。

## 下拉选择

技能页的工作区选择统一复用宿主共享模块 `@deepseek-ai/dsh-client-ui-primitives` 的公开 `Menu`，与内置插件页的模式下拉使用同一组件。该模块已经由当前 Web shell 的 baseline 模块表提供，在 Client factory 中通过模块表的 `require` 获取；不新增依赖、`dsh.client.external`、另一份 React，不导入功能插件的内部组件或源码路径。其他下拉需要一致交互时使用同一模式，不再各自编写菜单、系统 `<select>` 或自建浮层。

触发按钮规格沿用原生模式选择器：高 36px、左右内边距 14px、内部间距 12px、`--dsw-radius-md` 圆角、`--dsw-alias-bg-module-platform` 背景、`--dsw-alias-label-primary` 文字，字体 14px／22px。技能页的工作区触发按钮固定为 200px 宽（含内边距），不超过容器宽度，避免切换工作区时带动搜索框移动。名称左对齐、占满剩余空间并单行省略，右侧固定为 16px 原生向下箭头；hover 与 active 分别使用原生 interactive 背景，键盘焦点使用 focus-ring token。禁用时禁止打开，保持名称或明确空状态。

菜单直接使用 `Menu` 默认的选中勾、菜单项几何、圆角、背景透明度、模糊和 elevation，不在 Mod CSS 中覆盖菜单的内部类名。当前原生基线为菜单内边距 4px、行最小高度 34px、行内边距 `6px 8px`、文字 13px／20px、选中勾 14px；选中与 hover 使用组件自身的 interactive 颜色。菜单材质使用 `--dsw-menu-surface-fill`、`--dsw-menu-backdrop-filter` 及 `--dsw-elevation-prominent`，不另设纯色背景或阴影。通过 `items`、`selectedId`、`onSelect` 和 `onClose` 传递数据与操作，使用 portal，菜单宽度至少匹配触发按钮且遵守视口边距。方向键、Enter、Escape、点击外部、滚动及选择后的焦点恢复由原生组件负责，不另加全局事件监听或手写定位。

工作区选项显示 DSH 已导入的工作区名称，用路径作为 id；同名选项才追加路径区分，触发按钮悬停显示实际路径。当前工作区显示原生选中勾；选择同一项只关闭菜单，不重复加载。请求中和无工作区时禁用；切换范围时关闭菜单，无工作区文案固定为「暂无已导入工作区」。选择发生时重新核对当前工作区列表，过期选项不能用于写入。

参照原生[模式选择按钮](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.module.css)、[Menu](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/Menu.tsx)与[菜单样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/Menu.module.css)。这是公共基础组件的明确复用点，不是通用放开宿主内部 UI 导入。

## 悬浮提示（Tooltip）

直接复用宿主共享模块 `@deepseek-ai/dsh-client-ui-primitives` 的公开 `Tooltip`，与 `Menu` 一样从 shell baseline 模块表获取，不新增依赖或手写浮层。技能简介和来源标签使用该组件；不以浏览器 `title` 代替要求明确显示的悬浮提示，也不叠加两套提示。

使用单个原有元素作为 children 锚点，组件保持锚点布局；技能简介和来源标签设置 `tabIndex=0`，允许键盘聚焦查看。传入完整 `label`，设置 `portal:true`、`side:'top'`、`delayMs:0` 和 `maxWidth:400`。原生组件负责 hover、focus、位置翻转、视口边界、移出关闭与生命周期清理；portal 让提示逃离卡片和设置滚动区的溢出裁剪，使用原生 tooltip 主题及层级，不覆盖其内部类名。

简介在卡片中最多两行，提示显示完整原文；目录标签保留简称，提示显示 DSH 返回的完整路径；内置来源提示显示完整包名。没有真实路径时不猜路径。组件源码与样式参照 [Tooltip](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/Tooltip.tsx) 和 [Tooltip 样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/Tooltip.module.css)。

## 确认弹窗

重启确认复用宿主共享模块 `@deepseek-ai/dsh-client-ui-primitives` 的公共 `Modal` 与 `Button`，由 shell baseline 模块表获取，与原生插件卸载确认使用相同组合，不新增依赖或覆盖组件内部样式。标题「重启应用」，说明「运行中的任务会停止，未保存的内容可能丢失。」；footer 中依次为 outline「取消」和 primary「重启应用」，使用默认 md 尺寸。取消按钮通过 `data-modal-autofocus` 获得初始焦点；遮罩、关闭图标、Escape、Tab 约束与焦点恢复由 `Modal` 处理。按钮隐藏、开关关闭或其他重启已开始时撤销尚未确认的弹窗，旧回调不得提交操作。行为边界见[重启应用](../src/features/restart-button/spec.md)。

## 多行文本输入框

大段正文输入先核对当前宿主已有多行控件。全局指令编辑器以安装包 0.2.2-rc.1 的 `FeedbackDialog` 正文输入框为样式参照；对照上游 [FeedbackDialog 样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-message-feedback/src/client/FeedbackDialog.module.css) 的 `.detail`，同时核对安装包实际 Client CSS。不因自行编写语义 `textarea` 而另选背景、边框或焦点方案。

| 项目 | 原生参照 |
| --- | --- |
| 边框 | `0.5px solid var(--dsw-alias-border-l4)` |
| 背景 | `--dsw-alias-bg-layer-1` |
| 圆角 | `--dsw-radius-lg` |
| 文字 | 继承字体；14px / 22px；`--dsw-alias-label-primary` |
| 内边距 | 上下 12px、左右 14px |
| 焦点 | `:focus` 取消浏览器 outline；边框改为 `--dsw-alias-border-l3`；`0 0 0 1px var(--dsw-alias-state-business-primary)` 描边，键盘与指针一致 |
| 过渡 | border-color 和 box-shadow 120ms ease；减弱动态效果偏好下关闭 |

全局指令页保留独立编辑页所需的最小高度 260px 和垂直缩放，宽度限制在容器内；不照搬反馈对话框的高度上限和内容自适应行为。禁用时 opacity 0.5、cursor default；字段错误沿用原生 `ConfigField` 的 `aria-invalid` 错误边框 token。placeholder 为用户确认的「添加自定义指令」，颜色沿用原生 `--dsw-alias-label-caption`。样式仅作用于 Mod 自己的元素，不导入宿主内部组件或覆盖其类名。

## 取消与保存按钮

编辑页的操作区位于文本框下方、整体右对齐；顺序固定为左侧「取消」、右侧「保存」，间距 8px，键盘 Tab 顺序与视觉一致。按用户提供的原生按钮参照，使用 `Button` 的 md 尺寸、outline 取消按钮和 primary 保存按钮；已核对 DSH 0.2.2-rc.1 安装包 Web shell 的实际 CSS，对应 [Button 样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/Button.module.css)。

| 项目 | 规范 |
| --- | --- |
| 尺寸与文字 | 高 36px，左右内边距 14px；14px / 22px；继承字体；文本垂直、水平居中 |
| 圆角 | `--dsw-radius-md`，与原生 md 控件一致 |
| 取消 | 透明背景、主要文字色；透明 0.5px 边框占位，内描边使用 `--dsh-hairline-width` 和 `--dsh-button-outline-color`，缺省回退 0.5px 与 `--dsw-alias-border-l3` |
| 保存 | `--dsw-alias-button-primary-fill` 实底与 `--dsw-alias-label-primary-foreground` 文字；无描边，不用品牌色替代按钮 token |
| Hover | 仅在支持 hover 的设备且未禁用时：取消使用 `--dsw-alias-interactive-bg-hover`，保存使用 `--dsw-alias-button-primary-hover` |
| 键盘焦点 | 宿主 focus-ring token 的实线 outline，外偏移 2px |
| 禁用 | opacity 0.4，cursor not-allowed，禁止提交；无 hover 变化 |

无更改时保存禁用；保存过程中两按钮禁用，保存按钮显示「正在保存…」并设置 `aria-busy`，防止重复提交。保存失败保留草稿，取消恢复当前文件内容。遵循主题 token，不将截图中的白色按钮硬编码为固定颜色。全局指令编辑页不显示字符计数或常驻字数上限，长度校验仍在超限时反馈。

## 列表行内操作按钮

归档页的「取消归档」参照原生「设置 → 模型」的行内次要操作，使用安装包 `0.2.2-rc.1` 的 `secondaryButton` 在 `.rowActions` 中的缩小规格（`ModelsSection.module.css`）。

| 项目 | 规范 |
| --- | --- |
| 尺寸与文字 | 高 28px，左右内边距 10px；12px / 18px；继承字体，文字与图标水平垂直居中 |
| 圆角 | `--dsw-radius-sm` |
| 次要操作 | 透明背景、主要文字色、`0.5px solid var(--dsw-alias-border-l3)` 描边；hover 使用 `--dsw-alias-interactive-bg-hover-solid` |
| 危险操作 | 无描边、透明背景、`--dsw-alias-state-error-primary` 文字；hover 使用 `--dsw-alias-interactive-bg-hover-danger` |
| 键盘焦点 | `0 0 0 2px` 宿主 focus-ring token 的 `box-shadow`，不使用外扩 outline |
| 禁用 | opacity 0.4，cursor default，无 hover 变化 |

操作行间距 4px，位于行尾，顺序固定为左「删除」（危险）右「取消归档」；按钮使用文字而非纯图标，可访问名称包含会话标题（例如「删除 会话名」），忙碌时切换为「正在取消归档…」「正在删除…」并设置 `aria-busy`。删除确认框的确认按钮复用公共 `Button` 的 outline 变体，仅把描边与文字改为错误色并加上危险 hover，不使用 primary 实底，避免把破坏性操作表现为主操作。

## 文案与样式边界

PowerDSH 设置页标题下只显示「DSH 增强插件」，英文为「A DSH enhancement plugin」，不叠加品牌口号。市场描述与包元数据按各自用途独立维护。

| 设置 | 固定说明 |
| --- | --- |
| 显示版本号 | 在左上角显示版本号，点击检查更新 |
| 外观快捷切换 | 在侧栏底部快捷切换外观 |
| 官网流动背景 | 为界面选择柔和的动态背景 |
| 壁纸 | 使用自己的图片作为界面背景 |
| 壁纸图片 | PNG / JPEG / WebP · 最大 25 MB |
| 调节背景（图标） | 打开居中的背景调节面板 |
| 显示刷新按钮 | 重新加载当前界面 |
| 显示重启按钮 | 重新启动应用 |
| 任务通知 | 任务完成、失败或需要确认时发送桌面通知 |
| 通知声音 | 开启任务通知提示音 |
| 提示音 | 选择系统提示音 |
| 全局指令 | 在设置中编辑全局指令 |
| 技能管理 | 在设置中管理技能 |
| MCP 管理 | 在设置中管理 MCP |
| 停用官方登录与模型接入 | 停用官方登录、账号界面及内置模型接入 |
| 停用官方搜索 | 关闭内置 WebSearch，保留 WebFetch |
| 停用官方反馈与遥测 | 停用使用统计、环境信息采集、会话日志及插件清单上报 |
| 停用 Todo 工具 | 新对话中不再生成待办列表 |
| 停用 Plan 模式 | 停用新对话的内置计划模式 |
| 停用 Goal 模式 | 停用新对话的内置目标模式 |
| 屏蔽双击重命名 | 屏蔽侧栏会话标题的双击重命名操作 |
| 使用统计 | 查看 Token 用量 |
| 工作区管理 | 查看和移除工作区 |
| 归档管理 | 管理已归档会话 |

- 「精简」保留为分类名称，停用能力的三项开关使用「停用…」，英文动作为 `Disable`；「其他」中的「屏蔽双击重命名」属于拦截操作，英文使用 `Block`。名称不改变配置键、启停语义和生效范围。
- 可见文案通过 Client locale 服务，插件管理元数据放在 locale JSON；中英文语义一致，英文用 sentence case。切换语言同步更新标题、导航和内容。
- 保留用户已确认的简洁中文文案，描述可理解的状态，不向用户暴露 service、fiber、slot 等实现名词。社区身份在项目介绍说明即可。
- 不擅自添加多余的文字说明。已有标题、说明和控件足以表达用途时，不再补充操作指导、限制说明、实现细节或重复提示；用户已确认的文案不自行扩写。确有操作失败时，只在对应位置显示必要、简短且可处理的错误信息，技术限制与背景说明放入功能文档，不作为界面常驻文案。
- placeholder 少用、少写，只在必要时给出简短提示，不堆叠说明或长示例；已有标题和描述足以说明用途时留空。全局指令文本框按用户确认的文案使用「添加自定义指令」。
- 选择器使用 `power-dsh-` 前缀，限定插件拥有的元素；不覆盖 body、宿主私有类、面板布局或其他插件，不查询其 DOM 推断位置。[屏蔽双击重命名](../src/features/double-click-rename/spec.md)已有用户明确批准的局部例外，仅允许读取当前双击事件路径中的会话行标记，不扫描文档或修改宿主节点。技能与 MCP 卡片页为避免滚动宽度跳动，允许唯一的宿主样式例外：仅给包含 `.power-dsh-skills-page` 或 `.power-dsh-mcp-page` 的设置内容滚动容器设置 `scrollbar-gutter:stable`，用 `[data-shortcut-modal="settings"] > div:has(.power-dsh-skills-page,.power-dsh-mcp-page)` 限定；不改面板尺寸、overflow、导航或其他页面，两页卸载后不再匹配。Windows 顶栏三点入口固定在侧栏按钮右侧 4px；仅当入口存在时，通过带自有元素 `:has()` 限定的根元素规则设置宿主 `--dsh-windows-menu-start` 变量，为原生菜单预留空间，入口隐藏或卸载即恢复；不再测量原生菜单，范围见[刷新定位](../src/features/refresh-button/spec.md#接入与定位)。
- 长文案可换行、容器可缩放，不撑破面板；不要另加偏离原生参照行的窄屏密度。
- 样式随组件卸载，其他副作用归属 context；不往 `document.body` 挂第二个应用。侧栏定位边界见[架构规范](architecture.md#侧栏接入)。

## 标签（Tag）

常规 Tag 沿用原生模式卡片的 outline 样式，采用胶囊标识的内容遵循这一规格，不自行设计颜色或方形底块。使用 `inline-flex`、居中对齐、`1px 8px` 内边距、`999px` 胶囊圆角及 `corner-shape: round`；文字 `11px / 17px`、字重 500、单行不换行。描边为 `0.5px solid var(--dsw-alias-border-l4)`，文字为 `var(--dsw-alias-label-tertiary)`，背景透明。标签不被 flex 压缩，与名称保持 8px 间距。

技能统一使用「全局／工作区」表示范围、按「用户」「内置」分组，不混用「预置／个人」。卡片不重复显示用户或内置标签，只显示 `.dsh`、`.agents`、`.codex` 等实际目录简称，或已核实的提供插件包名。目录标签悬浮时显示完整技能路径；路径不常驻展开，无法从公开元数据确认时不猜测。技能卡片底部使用原生内置插件页的字段标签：`--ds-font-family-code` 等宽字体、12px／18px、`1px 6px` 内边距、`--dsw-radius-xs` 小圆角、`--dsw-alias-bg-module-platform` 灰底及 `--dsw-alias-label-secondary` 文字，无描边；长包名单行省略，悬停显示全文。它沿用原生卡片底部的代码字段样式，不套用胶囊 Tag。颜色跟随主题，不给来源分配额外彩色语义。仅在真实状态需要时采用原生 solid、neutral 等其他 tone，不把来源标签画成可操作按钮。插件内使用 scoped CSS 对齐上述原生规格，不运行时导入宿主内部组件或引用生成的 CSS 类名。

## 归档列表

「归档管理」同样作为「管理」分类的独立入口开关，开启后注册原生设置侧栏「归档」页与图标（页面标题为「归档」）。页面沿用本规范 Title、描述、搜索框与下拉菜单，列表按工作区分组。排序与工作区筛选下拉采用原生设置选择器样式：36px 高、`--dsw-alias-bg-module-platform` 底、无描边、`--dsw-radius-md` 圆角、左右 14px 内边距、14px／22px 文字、名称与 16px 下箭头间距 12px、hover 为 `--dsw-alias-interactive-bg-hover`。行内第二行显示该会话的最近活动时间，与原生侧栏行时间同源（原生 `sessionController.list()` 的 `updatedAt`，缺失时回退标题事件时间）。每个分组标题行是 36px 高的可聚焦折叠按钮：Lucide Folder 图标、14px／22px 分组名，随后是紧邻分组名右侧的 14px 箭头（收起时旋转 -90°，展开时不旋转，减弱动态效果时关闭过渡），随后为不参与折叠的会话数量；不提供工作区级批量取消归档。工作区实际目录不占标题行版面，只在悬浮或键盘聚焦标题按钮时经原生 `Tooltip`（`delayMs: 0`、`maxWidth: 520`）显示完整路径；「未分组」或宿主未提供路径时不挂 Tooltip，也不补占位。分组默认折叠，手动展开只影响本页状态、不持久化；搜索有内容时命中分组强制展开并忽略折叠按钮，清空搜索后恢复折叠。行内「取消归档」使用上文[列表行内操作按钮](#列表行内操作按钮)规格。行内删除、工作区菜单与全局删除都用原生确认框，确认范围不受搜索影响。页面顶部保留自动归档下拉。具体行为见[归档](../src/features/archive/spec.md)。

## 使用统计列表

「使用统计」页面按范围统计与全部历史保留两组结构及无障碍名称，不显示「所选范围」「全部历史」的额外标题行；时间选择器下方 10px 直接接三张统计卡片，组间距 24px。顶部为「今天｜本周｜本月｜全部｜自定义」中性分段控件，默认今天。控件靠左排列，自定义日期摘要接在右侧；2px 内边距、2px 项间距、24px 按钮、12px／18px 文字，整体高 28px，整条使用 `--dsw-alias-bg-module-platform` 底与 `--dsw-radius-md`，选中项使用 `--dsw-alias-bg-layer-1` 与主要文字色，不加业务色独立边框；窄容器自然换行。「自定义」带日历图标，点击打开贴着按钮的 280px 原生 Popover，复用公共 `MenuSurface` 材质；没有居中标题或页面遮罩，点外部或 Escape 关闭，空间不足向上翻转，大小受视口约束。顶部是起止日期摘要，下方是周一开头的单月月历；近 7／30 天快捷范围放在浮层底栏左侧，取消／应用放在右侧，窄视口自然换行。月历：固定 6 行，日期格 28px 高，左右箭头翻月；首击选开始、次击选结束，允许反向及同日，悬浮预览连续区间。端点用业务强调色底及前景字，中间用模块底色，今天有小点；上下月日期弱化。键盘方向键、Home／End、PageUp／Down 可跨月移动，只保留一个日期 Tab 焦点。未选完两端时禁用应用，取消丢弃草稿并保留原选择，不再使用原生 date 输入。应用自定义后控件旁以 12px 次要色显示 `YYYY-MM-DD → YYYY-MM-DD`，长日期省略并保留 title。全部范围按本地 0 点切分自然日。范围影响摘要和模型列表；「Token 趋势图」在标题右侧固定放置近 7／30 日切换，模型图例独占下一行；热力图以报告时区的今天为准显示最近 53 个自然周。它同样作为「管理」分类的独立入口开关，开启后注册原生设置侧栏「使用统计」页与 Lucide ChartColumn 图标。页面沿用本规范 Title、描述、设置卡片与原生 `Button`，不引入图表库或新依赖。顶部为三张等高卡片：总 Token 数（输入、输出）、缓存 Token（缓存率）、会话（主数字仅会话数，小字仅显示累计运行时长）。固定同一行三列 `minmax(0,1fr)`、8px 间距、每卡 12px 内边距，使用设置卡片同款描边、底色与圆角；名称 11px／18px 次要色，主数字 18px／26px 字重 500，小字 11px／18px 辅助色并贴底。窄容器也保持三列，不自动变成两行；长数字与辅助文字在卡内省略，避免撑破相邻卡片。不添加图标或独立组成条。Token 数量统一使用万／亿单位，不足一万保留完整数字；卡片和截断数字保留准确值 title，缓存率、会话与时长口径由可键盘聚焦的公共 Tooltip 说明。「Token 热力图」卡片标题右侧没有分段控件，标题右侧不加范围说明；下方是 53 列等分自适应的方格网格，不带星期列；格子为 padding 撑出的正方形、2px 圆角、2px 间距，空格子与未来日期都铺 16% 中性底，整块网格始终铺满、不留透明缺口，今天以外侧 42% 次要色 1px 描边标出，未来日期不带提示且不可聚焦，键盘只保留一个 Tab 停靠点并用方向键移动；月份行在网格下方、10px／14px 次要色，锚定在包含该月 1 号的那一周，开头残月不标注，标签只写月份，五级色阶以范围内单日最大 Token 为基准，由宿主业务强调色按 34／56／80／100% 叠在透明底上，主题切换自动跟随；不另放色阶图例。不提供每周／累计切换；窗口内没有用量记录时只显示空提示。每格经公共 `Tooltip` 只显示日期与当日 Token 用量，月标签独占一行并按月份跨列。趋势卡片标题右侧是原生胶囊分段控件（近 7 天／近 30 天），横轴以报告日为末端逐日补零，不受页面范围裁剪，避免窄范围退化为单点。「Token 趋势图」用内联 SVG `path` 按模型画平滑曲线（三次贝塞尔控制点受相邻数据范围约束，SVG 裁剪边界外笔画），最多 6 条，颜色为固定色板，图例与模型用量列表共用同一色块；横轴标签按可用宽度自动抽稀。趋势图图例可点击隐藏或恢复对应模型，取消选中时文字与色点置灰，曲线和数据点提示一起隐藏，其他模型的颜色与位置保持稳定。曲线默认不显示圆点，悬停每日模型数据点时才显示同色圆点，并就近提示该日期、该模型及当天用量，空白区域不触发提示；提示使用公共 portal Tooltip，Token 沿用万／亿单位。模型用量列表与三卡同口径，按顶部时间范围统计；每项为两行网格——第一行 8px 色点、12px 模型名、11px 次要色右对齐 Token 数与固定 40px 右对齐占比，第二行为模型名下方整宽 3px 占比条，Token 与占比列定宽以保证多行右边缘对齐；项间 0.5px 分隔线，占比以该范围合计为分母，请求次数放在该行悬浮标题里。加载中显示 `role="status"` 提示，读取失败复用共享错误反馈并提供重试，部分会话不可读时在页面顶部提示统计不完整。具体行为见[使用统计](../src/features/usage-stats/spec.md)。

## 工作区管理列表

「工作区管理」同样作为「管理」分类的独立入口开关，开启后注册原生设置侧栏「工作区」页与 Lucide Folders 图标。页面复用[归档](#归档列表)的列表外壳：760px 最大宽度、18px／600 标题、13px 说明、通栏 36px 搜索框与公共 `Menu` 下拉，并同样预留稳定滚动槽。标题下的说明固定为「查看工作区」。搜索框与「排序」下拉同行，下拉复用公共 `Menu`，选项为「最近活动」「手动排序」，默认「最近活动」；不提供工作区筛选或设备筛选。

列表为一张设置卡片内的表格式列表：表头行使用 `--dsw-alias-bg-module-platform` 底色与 12px／18px 次要色文字，列依次为「工作区」「会话」「最近活动」与行尾操作占位。列宽为工作区列 `minmax(0,1fr)` 自适应、会话列 64px、最近活动列 96px、操作列 76px，列间距 12px，把宽度让给工作区名称与目录。工作区列内左侧为 Lucide Folder 图标，右侧上行 14px／20px 名称、下行 12px／18px 次要色目录，名称与目录均单行省略，经公共 `Tooltip` 查看全文并允许键盘聚焦。会话列与最近活动列使用 12px／18px 次要色，最近活动按原生会话行的时间分桶（刚刚／N 分钟前／N 小时前／N 天前／N 个月前／N 年前），无活动时显示「未使用」。行高与分隔线沿用设置卡片；容器宽度不大于 520px 时隐藏表头与会话列，最近活动移到工作区名下方，操作列固定右侧。

行尾「移除」按[列表行内操作按钮](#列表行内操作按钮)的危险操作规格实现，并使用工作区名称作为可访问名称的一部分；点击经原生 `Modal` 二次确认，确认按钮沿用同一危险样式。具体行为见[工作区管理](../src/features/projects/spec.md)。

## 技能与 MCP 管理列表

技能详情使用公共 `Modal` 与 `MarkdownText`：路径在前、完整描述随后、正文按宿主紧凑文档排版。简介不截断，正文不放进整块原文代码框，三段共用一个可键盘滚动的内容区，标题与关闭按钮固定在区外；细节见[技能规格](../src/features/skills/spec.md#详情弹窗)。

「技能管理」「MCP 管理」分别作为 Mod「管理」分类的独立持久化入口开关，开启后注册对应原生设置侧栏页面与图标。两页继续使用本规范的 Title、描述、设置行、搜索框和 Switch，不覆盖宿主插件页，不另建全屏面板。

技能与 MCP 页共用原生「内置插件」页的搜索、折叠分组和卡片布局，分别使用自身数据，不运行时导入原生页面组件。两页最大宽度均为 760px，专用标题采用该页面的 18px／600，说明 13px；其他 Mod 页面继续遵守前文标题规格，不全局覆盖。技能页顶部仅保留功能说明「管理可用的技能」，用户分组说明为「从本机技能目录加载」，内置分组说明为「由插件提供」；不显示目录提示或感叹号图标。功能说明单行省略；技能简介按原生卡片最多显示两行，悬停显示全文。

技能页的「全局／工作区」Tab 使用上文原生文字、22px 间距、焦点和选中下划线。全局搜索在 Tab 下方通栏；工作区范围在 Tab 下方同一行左侧显示工作区下拉、右侧显示搜索，窄容器允许换行。MCP 页仅有全局列表，搜索框通栏，不显示范围 Tab 或工作区下拉。两页搜索均复用内置插件目录的 36px 高输入框、左侧图标、主题 token、13px 文字、圆角和焦点反馈。

技能页的全局范围按「用户」「内置」顺序显示两个可折叠分组，标题左侧箭头、36px 标题行、说明缩进、组间细线与留白沿用内置插件页。用户默认展开，两类并存时内置默认收起，目录只有内置分类时默认展开；手动展开或折叠优先且刷新不覆盖。搜索期间自动展开命中分组，清空搜索恢复手动展开状态。运行时及 bundled 技能归内置，用户和自定义目录归用户；不显示全局来源筛选下拉。

技能与 MCP 共用原生双列卡片布局：两列 `minmax(0,1fr)`、间距 10px，页面容器宽度不大于 520px 时单列。卡片使用 `0.5px` 的 `--dsw-alias-settings-card-stroke` 描边、`--dsw-radius-xl` 和 `--dsw-alias-settings-card-fill` 背景。主体内边距 `12px 14px`，名称与右上角启停开关同一行；简介使用 `display:-webkit-box`、`-webkit-box-orient:vertical`、`-webkit-line-clamp:2`、`text-wrap:pretty`，最多两行。技能底部借助 `margin-top:auto` 对齐并显示具体来源标签，同一网格行内的技能卡片自然拉伸到等高，不固定所有行的高度。MCP 卡片与技能卡片一样按行拉伸到等高，最后一行借助 `margin-top:auto` 贴住卡片底部。两页所在的原生内容滚动区预留稳定滚动槽，出现或消失滚动条时不改变卡片宽度。技能卡片保持静态容器，不提供展开箭头或展开区，底部来源标签右侧有「详情」按钮；MCP 第一行仅显示名称与独立启停开关，名称 span 通过原生 Tooltip 展示全名并允许键盘聚焦。运行状态采用可确认的插件生命周期：`active/failed/inactive` 显示「运行中／加载失败／未运行」三种稳定状态；`pending/loading/unloading` 只使用公共原生 `StateDot` 的 `ongoing` 小加载指示，保留对应双语无障碍状态名称，不显示过渡文字。开关明确关闭时，状态位置显示灰色 `idle` 圆点与「已关闭」／`Disabled`，优先于尚未完成卸载的运行状态；原生 `disabled` 同样显示「已关闭」，`unknown` 不伪造状态。稳定状态的文字前放置原生 `StateDot` 小圆点，间距 6px：运行中使用绿色 `done`、加载失败使用红色 `error`、未运行使用灰色 `idle`。文字使用次要颜色，失败使用错误 token，同时提供文字或无障碍名称而非仅用颜色。标题下的第二行并排显示原生传输类型标签与运行状态，间距 8px，窄卡允许自然换行：`stdio` 为「本地」／`Local`，`streamable-http` 为 `HTTP`，未知类型仅省略标签；类型与状态均无可显示内容时省略整行。类型标签采用上文常规 outline Tag 胶囊规格。技能与 MCP 卡片都是静态容器：没有可点击的头部、展开箭头或工具展开区，头部没有悬浮与按下反馈，分组折叠仍然保留。MCP 最后一行左侧是工具数量纯文本「{count} 个工具」／`{count} tools`（英文单数为 `1 tool`），右侧是「详情」按钮；该行使用 `margin-top:auto` 与 6px 上内边距贴住卡片底部，因此同一排的卡片无论内容多少，「详情」按钮都落在同一水平线上。行使用 `justify-content:flex-end`，数量文本以 `margin-right:auto` 靠左，因此没有数量文本时按钮仍然靠右，不会因为行内只剩一个子元素被 `space-between` 顶到行首。开关关闭或没有工具时不显示数量，只留右对齐的详情按钮。技能停用状态直接由开关表达；MCP 的「已关闭」与「运行中」共用第二行状态位置，不另加分类或标签。「详情」按钮按[列表行内操作按钮](#列表行内操作按钮)的次要操作规格实现（28px 高、10px 内边距、12px／18px、`--dsw-radius-sm` 圆角、`0.5px` 描边、hover 用 `--dsw-alias-interactive-bg-hover-solid`），可访问名称包含服务器名，并关联该条目的只读原因。详情使用宿主公共 `Modal`，宽 `min(420px,100%)`，标题「MCP 详情」、说明为服务器名，正文为只读两列 `dl`：左列 12px／18px 次要色字段名，右列 12px／18px 主要色值，命令、目录、地址用等宽字体并允许换行；环境变量与请求头只显示键名胶囊，不显示值。**只列该条目实际声明的字段**，不补宿主默认值。底部工具名列表用 12px／18px 次要色逐项换行显示，工具区前加 `0.5px` 主题分隔线。字段集合与开关状态无关：打开与关闭的服务器显示相同的行。关闭时「运行状态」显示「已关闭」（不采用缓存实例可能仍报的「运行中」），工具区保留标题但不列出缓存工具名，显示「暂无可用工具」。弹窗底部只有「关闭」按钮并默认聚焦；加载中显示 `role="status"` 提示，读取失败复用共享错误反馈（`PD-MCP-DETAIL`）并可重试。原因与操作错误留在对应卡片内并关联控件。技能与 MCP 卡片专用小开关为 28×16px，2px 内边距、12px 滑块和 12px 平移；保留原生主题色、焦点与保存反馈，扩大透明点击区域。其他页面开关保持标准 36×20px。技能卡片底部只保留右对齐的「详情」按钮（与 MCP 详情同规格：28px 高、10px 内边距、12px／18px、`--dsw-radius-sm`、0.5px 描边、hover `interactive-bg-hover-solid`），不再常驻显示来源标签。技能详情使用同一套 `Modal`（宽 `min(560px,100%)`），顺序固定为路径（只读 `dl` 中唯一一行，为空时整块省略）、简介（最多两行省略、悬停读全文）与 `SKILL.md` 正文；不重复显示来源、开关与调用链；正文不加标题，直接显示 Markdown 原文（仅去掉 HTML 注释、折叠连续空行），等宽字体保留换行，最大高度 `min(48vh,420px)` 内部滚动并可键盘聚焦选中复制；底部只有「关闭」按钮；弹窗内工具名使用 12px／18px、次要文字颜色和普通字体，逐项显示完整名称并允许换行。

技能页的工作区范围始终下拉选择已经导入的工作区，显示原生工作区名称，路径只作为选择值、悬停提示和同名区分。只有一个工作区也保留下拉，无工作区禁用并显示「暂无已导入工作区」，不追加未导入的启动目录。全局隐藏工作区选择；工作区名称下拉与搜索同行，两个范围都不显示「全部来源」下拉，技能继续用同一套卡片。不展示模式选择，不把文件全路径常驻堆在卡面。

技能开关读原生实际调用策略，仅对相应 DSH 范围生效，不修改共享文件。MCP 顶部说明为「管理可用的 MCP」，只提供全局列表，按「用户／内置」分组，说明分别为「用户配置的 MCP」「由插件或模式提供」。MCP 页不提供工作区范围、工作区文件扫描或工作区实例展示。同一个全局原生实例在配置清单和运行目录中出现时合为一张卡片。名称使用实际 serverName，可管理项操作仍用原生标识；移除「当前配置」等来源标签，第二行并排显示已确认的本地／HTTP 类型标签与运行状态。**卡片不提供工具展开**：最后一行左侧是工具数量的纯文本，右侧是「详情」按钮，工具名只在详情弹窗中查看；卡片头部没有点击、`aria-expanded` 或展开区，搜索工具名或本地／HTTP 类型文案可找到对应服务器，不会展开任何内容。「已关闭」与「运行中」统一显示在第二行类型标签旁的状态位置，关闭使用灰色 `idle` 圆点。开关关闭或没有工具时不显示数量文本，只保留详情按钮；已关闭的服务器即使仍有缓存工具也不显示数量。没有简介时不补空白占位或编造文本。服务器长名称继续使用原生 Tooltip，保留只读原因、未知状态与行内错误。无原生持久化控制入口的条目显示「由提供插件管理」并保持只读。未知配置状态不可操作；运行状态不等于网络连接状态，不显示「在线」或「已连接」。页面挂载、窗口 focus 和写后读回时刷新，页面可见且无读取或写入进行时每 2 秒刷新运行状态，卸载释放定时器与监听；刷新保留搜索与分组状态，也不关闭已打开的详情弹窗；详情弹窗只读，不提供新增、编辑、删除或连接测试。实现依据及许可见[第三方资源声明](third-party-notices.md)，行为范围见[技能管理](../src/features/skills/spec.md)、[MCP 管理](../src/features/mcp/spec.md)。

行开关即时保存、不增加页级保存取消；操作中禁止重复提交和切换写入上下文，完成后以原生读回结果更新。加载失败显示可重试错误，不显示假空列表；目录不完整禁止写入。搜索仅使用「搜索技能」「搜索 MCP」。首版只做查看与启停，不出现未实现的安装、添加或编辑按钮。

## 验收清单

- [ ] 实际页面与宿主参照并排检查，字体、层级、间距和图标重量协调。
- [ ] 浅深主题、中英文、窄面板、长文案与字体放大均可读，无横向溢出或翻译 key。
- [ ] 键盘、焦点、保存、禁用、错误和不可用状态完整且符合实际结果。
- [ ] 侧栏收起与展开、原生底部控件和系统标题栏的空间正确。
- [ ] 无 slot 崩溃、全局样式污染或卸载残留。

源码与 token 匹配不等于页面视觉验收；无法访问实际页面时明确记录未完成项。
