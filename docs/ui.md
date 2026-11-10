# UI 规范

## 页面与原生参照

以目标 DSH 的同类界面为参照：偏好设置对照通用设置页，管理列表对照插件管理页。先核对当前页面或安装包实现，再选择布局；本文尺寸是项目维护基线，不是官方设计 token。

Mod 设置入口与页面标题中英文均为「PowerDSH」，技术包名与设置命名空间为 `power-dsh`。导航、外层面板和关闭行为交给宿主；内部按标题、简短说明、分类 Tab 和设置行组织。个性化是用户确认的独立设置 Tab：Mod「管理」分类只显示开关，开启后由原生设置侧栏展示「个性化」入口，编辑页采用大文本框与取消、保存按钮，不显示字符计数或常驻上限说明，详见[个性化](../src/features/personalization/spec.md)。减少装饰、卡片嵌套和重复入口，不展示未实现的控件或“即将上线”操作。

## 设置页 Title 与描述

所有 Mod 设置页的页面级 Title 与描述，统一对齐原生「模型」设置页。此规则指页面顶部标题和描述，不用于设置行的名称、说明或编辑器字段。每页顶部仅保留一组 Title 与描述，不额外堆叠功能标签、操作提示或示例文案。

| 元素 | 统一样式 |
| --- | --- |
| Title | 语义 `h2`；16px / 24px；字重 500；`--dsw-alias-label-primary`；margin 0 |
| 描述 | 语义 `p`；14px / 22px；字重 400；`--dsw-alias-label-tertiary`；margin 0 |
| Title 与描述间距 | 垂直 12px，通过标题组的 `gap` 控制 |
| 对齐与换行 | 同一左边界；字体继承宿主；描述自然换行，长路径不撑破面板 |

本机 DSH 0.2.2-rc.1 的 `@deepseek-ai/dsh-client-ui-settings-models` 已核对上述尺寸、颜色、行高与间距，对应 [ModelsSection 及样式源码](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/client/ui-settings-models/src/client)。后续新增页面遵循此标准，不根据截图缩放或临时选择字号。

个性化页 Title 固定为「个性化」；描述固定为「全局指令（实际文件路径）」，括号内由 Host 返回全局 `AGENTS.md` 实际路径，不重复展示「全局提示词」字段标题；输入框 placeholder 固定为「添加自定义指令」。文件定位遵循 `$DSH_HOME/AGENTS.md`，默认 `~/.dsh/AGENTS.md`，不写死机器路径，不显示 profile 配置文件的位置。

## Logo 与图标

宿主产品图标通过 ui-theme 的 SVG sprite 引用 `dsw-icon-<glyph>-<weight>`，继承 `currentColor`。已核对的图标基线为常见 16 × 16 画布、Regular 描边 1、Medium 描边 1.3；部分图形有独立尺寸或混合填充，使用前核对目标版本。

设置导航使用宿主传入的 `size`，当前为 16px。Mod 标识使用 Lucide Puzzle，技能入口使用 Lucide Sparkles，MCP 入口使用 Lucide Cable；保留各自原始 24 × 24 画布、路径和 2 单位描边，16px 下实际线宽约 1.33px。图形来源和完整许可统一保留在[第三方资源声明](third-party-notices.md)，[独立 SVG](../assets/icon.svg)与内联导航图标保持相同几何。内联导航图标继承 `currentColor`；插件管理页用图片显示独立 SVG，不能继承页面文字色，因此 SVG 通过 `prefers-color-scheme` 和系统色 `CanvasText` 适配明暗背景。

- 选择清晰、可与同组入口区分的轮廓图形；不把大尺寸品牌 Logo 直接缩成导航图标。
- 保留来源几何、端点和转角，描边随画布缩放；不加 `non-scaling-stroke` 或用 CSS 补偿图形。
- 继承宿主颜色与选中状态，不添加彩色底板、渐变、阴影、emoji 或品牌外框。
- 装饰性 SVG 使用 `aria-hidden` 与 `focusable="false"`，名称交给按钮。
- 在实际 16px 下与账号、通用设置等图标并排检查线宽、留白与细节密度；第三方市场图标不作为标准。

原生依据：[图标组件](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/icons/index.tsx)、[图形与权重](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/icons/artwork.ts)。外观按钮的原生 sprite 用法见[外观快捷切换](../src/features/appearance-shortcut/spec.md#原生状态与图标)。不运行时导入宿主内部 UI 包。

「鲸鱼动效」通过官方 `sidebar.brand.mark` single slot 仅覆盖鱼，使用官方 24px 宽度与 `23.16:17.04` 比例、继承 `currentColor`；字标、HARNESS、版本号与宿主布局保持原样。开启后自动循环播放「尾巴打个招呼」的简化版：只有尾巴轻挥两次、稍停再重复，身体与眼睛保持原位；每轮 5.2 秒，被动图形不依赖鼠标操作；关闭恢复官方项，减少动态效果时静态。入口位于「界面」的自定义背景与显示版本号之间，默认关闭。接入、优先级与验证范围见[鲸鱼动效 Spec](../src/features/whale-motion/spec.md)。

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

## 自定义背景

「设置 → PowerDSH → 界面」提供「自定义背景」开关，`flowingBackgroundEnabled` 默认 `false`、独立持久化，通过原生 `configForms` 保存。设置说明中文固定为「为界面选择柔和的动态背景」，英文为「Choose a soft animated background for the interface」。开启后只展开「背景类型」（`flowingBackgroundKind`，默认官网流动）：右侧按「调节图标／背景类型下拉」排列；图标位于左侧，使用 ghost/sm 公共 `Button`，下拉使用宿主 `Menu` 与 ghost/md 公共 `Button` 选择「官网流动」或「自定义壁纸」，提供「调节背景」悬浮提示与无障碍名称。「背景淡化」越大背景图像越淡（0% 保留原图、100% 完全淡出），背景模糊越大越模糊（0 为清晰）。旧不透明度按 `100 - 原值` 显示，既有效果不变。从下拉选择「官网流动」时恢复背景淡化 0%、背景模糊 0，随后可继续调节，单独重开面板不重置。不再单独显示「在页面上调节」说明行；下拉对齐上方推理等级样式选择器的填充底色、36px 高度、14px/22px 字体、md 圆角及无描边外观；使用自有类名，不覆盖菜单内部样式。按用户要求，两个度数不在设置页内联拖动，而是点击按钮后先关闭原生设置窗口，在屏幕正中央显示半透明磨砂的「背景调节」面板（32% 次级表面底色、8px 背景模糊，材质层独立于文字），直接拖动预览；关闭或按 Escape 后留在主页，不自动打开设置窗口。拖动只预览，释放、键盘调整或失焦时保存；关闭也会提交最后的拖动值并等待保存完成。保存中禁用滑块，失败回滚并在面板显示共享错误反馈。面板的 380px 宽度、面板圆角、16px 标题、标题栏与 24px 内容边距对照宿主 `Modal`；关闭与壁纸操作使用公共 `Button`。面板独立携带样式，设置页卸载后仍保持定位；它是 `shell.overlay` 的独立条目，容器 `pointer-events:auto`，其余区域保持点击穿透。

调节面板标题随当前背景类型显示「官网流动调节」或「自定义壁纸调节」。官网流动仅显示两个滑块，不读取或展示壁纸；自定义壁纸面板才包含「壁纸图片」控件：说明缩为「PNG / JPEG / WebP · 最大 25 MB」，64 × 42 缩略图与文件名在左，`选择图片`／`更换` 和已保存时的 `移除` 在右，操作统一使用官方 outline/sm 公共按钮并组成 8px 间距按钮组；文件名截断时原生 title 可查看全名，窄窗口操作组另起一行；未设置时显示「未设置壁纸」。文件输入为视觉隐藏的原生 `input[type=file]`，`accept` 仅允许 PNG／JPEG／WebP；按钮通过它打开系统选择器，不使用拖放区或自建文件浏览器。选择非图片或超过 25 MB 的文件在 Client 侧直接以行内错误拒绝；保存失败保留已保存壁纸并显示共享错误反馈，读取失败提供重试。选图保持当前类型，保留背景淡化与背景模糊的调整。切换回官网流动时立即隐藏图片控件，缓存壁纸和旧操作不会覆盖类型选择。预览期间侧边栏原生设置按钮保持可见，不注册或占用该入口。只新增这一个开关及其附属行。

全局使用一张跨越 AppFrame、侧边栏与主内容区的连续画布。已有对话、任务运行、设置页及其他全局面板均不触发隐藏，不再使用会话或面板门控。「官网流动」按 softness 100 做蓝→白→白两级宽范围混色、底部渐隐，采用独立 WebGL shader，无外部网络资源或新依赖，不复制官网源码，也不承诺像素级复刻。「自定义壁纸」由 Host 存到 profile 的 `power-dsh/` 目录，以 `object-fit: cover` 的图片铺满同一图层，不创建 WebGL 上下文，也不启动帧链。背景模糊只改变清晰度，保持图片原来的 cover 比例和构图，不随模糊强度放大或移动画面。背景淡化与背景模糊只作用于自有背景图层（图层 `opacity` 与画布/图片的 `filter: blur()`），参考 wallpaper 的整屏磨砂与 homepage-glass 的界面毛玻璃作为功能边界对照，不改宿主结构表面、卡片或主题 token。

`shell.overlay` 只保留返回 null 的生命周期控制组件，不在全窗口浮层绘画。框架适配只从当前已加载的两个必需官方样式标签读取唯一简单类名映射，再核对真实 AppFrame 的语义直接子元素、relative 定位和 grid 布局；同版本不同构建的 CSS Modules 哈希不会被视为固定值。画布直接挂在唯一、可见且已核对结构的 AppFrame 内，使用 absolute、inset 0、负 z-index，框架建立 `isolation:isolate` 并保留原生 bg-base 底色，文字与控件绘制在其上方。

按用户本次授权，仅临时把已核对的 sidebarCol、centerCol、原生 SidebarRoot、任意 phase 的主 ConversationRoot，以及其主内容内已核对的 composerSeat 外层的内联 background-color 设为 transparent、background-image 设为 none，让底层动画透出。输入卡片、编辑器、文件卡片、菜单和弹窗保留原生表面与交互；不修改全局主题 token 或任意后代。窄窗口中 AppFrame 出现 `data-sidebar-drawer` 时，sidebarCol 和 SidebarRoot 保留原生底色，不把模态侧栏抽屉透明化；退出抽屉模式后恢复目标适配。全局面板若另有独立的不透明内容表面，仍可保留其原生底色，不承诺每个内容区都透出动画；操作系统原生标题栏不作适配。

Windows 非抽屉侧栏开启背景时补上原生同款 0.5px 右侧分割线，颜色跟随浅深主题的 border-l3 token，关闭后恢复原生无分割线样式。

Windows 顶部操作栏在开启背景时去掉已核对 AppFrame 拖动层的底色，尽量透出连续背景，关闭后恢复；保留菜单与拖动交互。右上角 Electron 原生窗口按钮底色暂无法通过现有插件接口透明化。

开启自定义背景时，同时隐藏原生侧栏设置按钮上方的底部滚动渐隐层，避免 Windows 等平台残留侧栏底色阴影；抽屉模式同样隐藏，关闭后恢复原生效果。兼容侧栏 shell 的 scrollFade 与工作区会话列表的 fade 两种原生结构，工作区类名只从其精确官方样式标签读取。部分发行构建不含某种装饰层，类名缺失或歧义时只跳过此项适配，背景继续运行。目标核对与恢复规则以[功能 Spec](../src/features/flowing-background/spec.md)为准。

保存所有临时样式原值和优先级，清理时只恢复仍属于本功能的写入，保留第三方后写值。原生目标表面或同一框架的类名映射动态替换时只刷新背景适配，不重启动画。官方样式元数据缺失、标签或类名歧义，或 AppFrame 缺失、不支持时不绘画，不回退前景；设置页复用共享错误反馈说明全局布局无法适配，不输出样式正文、DOM、机器路径或原始异常。正确官方样式延迟到达后可恢复挂载并移除过期反馈。

动画按框架尺寸绘制，`ResizeObserver` 仅调整自有 Canvas；`MutationObserver` 在 body 跟踪已批准结构表面，在 head 观察官方样式模块加载、替换及文本变化，类名读取限于主 Spec 列明的两个必需标签和一个可选工作区标签。关闭、框架替换或卸载时移除节点、释放观察器、动画和 GPU，并恢复所属样式；`prefers-reduced-motion` 下保持静态，页面隐藏时暂停。WebGL 不可用或上下文丢失时，仅在适配成功的框架底层回退自有 CSS 渐变。用户报告的全局布局错误已定位为 npm 固定哈希与已安装桌面构建不一致；浏览器面板未连接，修复后的实际页面仍待验收，行为和本次检查状态以[自定义背景 Spec](../src/features/flowing-background/spec.md)为准。

## 分类 Tab

Mod 内按「通用」「界面」「管理」「精简」「其他」五个 Tab 顺序组织十七个功能主开关和一个通知声音选项，默认选择「通用」。分类 id 依次为 `general`、`interface`、`enhance`、`simplify`、`other`；客户端「管理」分类沿用 `enhancements`。任务通知下方的「通知声音」开关单独一行，保留一句说明「开启任务通知提示音。」。声音开启时下方展开第二行「提示音」，右侧为宿主 Menu 下拉和小播放图标，默认「系统默认」；关闭时收起第二行、保留声音偏好，只显示开关行。任务通知关闭时隐藏通知声音和提示音设置，保留声音开关与提示音选择；重新开启时恢复显示。选中后保存并自动试听；重复选择当前声音或点击播放图标可重听。播放图标使用 20px 圆圈三角形、36px 按钮命中区域，提供「试听」可访问名称、提示和忙碌状态，不显示大文字按钮。目录不可用、保存或试听进行中禁止选择和重复试听。「提示音」行只显示一句说明「选择系统提示音。」；远程连接时下拉显示「系统默认」并禁用，不额外显示本机限制文案或重试按钮；目录或播放错误仍保留行内提示，目录加载失败可重试。设置按使用频率和功能关联性排序。通用仅包含任务通知，声音设置紧随任务通知联动显示。界面依次包含快捷推理等级切换、外观快捷切换、自定义背景、显示版本号；「推理等级切换按钮样式」紧随快捷推理等级切换主开关联动显示。重启开关 `showRestartButton` 默认关闭且独立持久化，说明固定为「重新启动应用」。顶部使用原生横向 `ellipsis-outline` 图标的「更多操作」菜单，复用公共 `Menu`；刷新在上、重启在下，两个开关独立控制入口，只占原有单按钮位置。侧栏收起关闭菜单与重启确认，所有入口关闭或不可用时不显示空菜单。重启设置行仅在 macOS 打包桌面端显示，菜单项仍需 Host 能力确认；Windows、Linux、普通 Web 隐藏重启设置行与菜单入口，隐藏时保留已有偏好，不清除状态，不增加平台警告常驻文案。点击先以宿主公共确认弹窗告知任务停止与未保存内容风险，再保留宿主退出确认，取消或退出超时不强杀、不重开，完整边界见[重启应用](../src/features/restart-button/spec.md)。管理依次包含技能管理、MCP 管理、个性化；精简包含官方登录与模型接入、官方搜索、官方反馈与遥测、Todo、Plan 模式和 Goal 模式；其他依次包含界面刷新、重启应用和屏蔽双击重命名，刷新与重启相邻。个性化、技能和 MCP 的内容页仍属于原生设置侧栏的独立入口，Mod「管理」只放入口开关。Tab 选择仅为当前页面状态，不持久化，也不改任何功能开关。

采用内置插件页的文字下划线样式：13px / 20px 文字、`7px 1px 9px` 内边距、0.5px 底部分隔线，选中项下方为 2px 短线。颜色使用原生 label 与 border token，提供键盘焦点和 `tablist`、`tab`、`tabpanel` 及关联 id。仅当前 Tab 进入键盘顺序，左右方向键循环切换，Home/End 跳到首尾并移动焦点；保存中禁止切换，保证操作反馈与错误留在当前分类。参考 [PluginsSettingsSection](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-settings-plugins/src/client/PluginsSettingsSection.tsx) 与其样式，已对照本机安装包核对。五个分类固定声明，不增加通用分类注册框架。

## 状态提示与错误反馈

全部功能遵循[错误处理规范](error-handling.md)，复用[共享错误反馈](../src/shared/client/error-feedback.ts)的摘要、错误信息展开与复制交互，不各自创建孤立样式或只显示「请重试」。详情的选字段、脱敏、恢复与生命周期由主规范统一维护；设置保存与功能运行故障使用不同代码，功能诊断可附稳定检查标识、预期/实际结果、当前状态和适用恢复建议，复制报告便于 AI 与维护者定位；侧栏等紧凑入口保留自身容器，内部使用同一反馈组件。

错误反馈参照 DSH `0.2.2-rc.1` 插件安装对话框的摘要／操作／展开详情层级与插件更新输出区域。页面错误采用单层设置卡片：`12px 14px` 内边距、`--dsw-radius-lg` 圆角、`--dsw-alias-settings-card-fill/stroke` 底色与 0.5px 描边；行内错误不额外套卡，紧凑侧栏反馈保留有界容器。摘要使用错误色，8px 下方同一操作行左侧为「错误信息」，右侧为可选「重试」；使用公共 `Button` 的 sm（28px、12px／18px），详情为 ghost、重试与复制为 outline，不覆盖原生按钮材质。详情按钮使用 `aria-expanded/aria-controls`、14px 原生 Regular 下箭头，展开旋转 180°，减弱动态效果时关闭过渡。诊断默认收起，展开后以无描边的 `--dsw-alias-bg-module-platform` 中性区域承载，12px 圆角与 `10px 12px` 内边距，正文 12px／18px 等宽、次要文字色、最大高度 200px 并可滚动和选择；长行换行，底部细线分隔的操作区右对齐复制，复制结果在其左侧显示。避免浏览器默认 summary 标记与卡片套卡片。参照 [InstallDialog](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/src/client/PluginManagerPage.tsx)、[updateOutput 样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/src/client/PluginManagerPage.module.css)及公共 [Button](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/Button.tsx)，均已核对当前桌面安装包；不导入官方功能插件内部组件。

页面级状态提示紧跟标题与说明，位于分类 Tab、设置行或编辑器之前。沿用原生插件设置页的状态文字规格：13px／20px，与标题组间距 12px。加载、只读和版本信息缺失使用 `--dsw-alias-label-tertiary` 与 `role="status"`；配置不可用、文件读取失败使用 `--dsw-alias-state-error-primary` 与 `role="alert"`。颜色随宿主浅深主题变化，文案与控件禁用状态反映实际结果；状态恢复后移除提示。

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

使用语义 HTML：按钮有名称、焦点与禁用态；开关使用 `role="switch"`、`aria-checked` 和关联标签，支持键盘。点击后滑块立即过渡到目标位置，保存中轻微淡化开关、设置 `aria-busy` 并禁止重复提交；成功采用已保存的值，失败回到已保存的值并显示原因；个性化开关按用户要求不显示行内提示文字，失败仍回到已保存的值。不添加后台状态提示或人为等待。输入错误关联字段，支持中文输入法；若新增对话框，管理初始焦点、圈定、Escape 和关闭后的焦点恢复。

## 下拉选择

技能页的项目选择统一复用宿主共享模块 `@deepseek-ai/dsh-client-ui-primitives` 的公开 `Menu`，与内置插件页的模式下拉使用同一组件。该模块已经由当前 Web shell 的 baseline 模块表提供，在 Client factory 中通过模块表的 `require` 获取；不新增依赖、`dsh.client.external`、另一份 React，不导入功能插件的内部组件或源码路径。其他下拉需要一致交互时使用同一模式，不再各自编写菜单、系统 `<select>` 或自建浮层。

触发按钮规格沿用原生模式选择器：高 36px、左右内边距 14px、内部间距 12px、`--dsw-radius-md` 圆角、`--dsw-alias-bg-module-platform` 背景、`--dsw-alias-label-primary` 文字，字体 14px／22px。技能页的项目触发按钮固定为 200px 宽（含内边距），不超过容器宽度，避免切换项目时带动搜索框移动。名称左对齐、占满剩余空间并单行省略，右侧固定为 16px 原生向下箭头；hover 与 active 分别使用原生 interactive 背景，键盘焦点使用 focus-ring token。禁用时禁止打开，保持名称或明确空状态。

菜单直接使用 `Menu` 默认的选中勾、菜单项几何、圆角、背景透明度、模糊和 elevation，不在 Mod CSS 中覆盖菜单的内部类名。当前原生基线为菜单内边距 4px、行最小高度 34px、行内边距 `6px 8px`、文字 13px／20px、选中勾 14px；选中与 hover 使用组件自身的 interactive 颜色。菜单材质使用 `--dsw-menu-surface-fill`、`--dsw-menu-backdrop-filter` 及 `--dsw-elevation-prominent`，不另设纯色背景或阴影。通过 `items`、`selectedId`、`onSelect` 和 `onClose` 传递数据与操作，使用 portal，菜单宽度至少匹配触发按钮且遵守视口边距。方向键、Enter、Escape、点击外部、滚动及选择后的焦点恢复由原生组件负责，不另加全局事件监听或手写定位。

项目选项显示 DSH 已导入的项目名称，用路径作为 id；同名选项才追加路径区分，触发按钮悬停显示实际路径。当前项目显示原生选中勾；选择同一项只关闭菜单，不重复加载。请求中和无项目时禁用；切换范围时关闭菜单，无项目文案固定为「暂无已导入项目」。选择发生时重新核对当前项目列表，过期选项不能用于写入。

参照原生[模式选择按钮](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.module.css)、[Menu](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/Menu.tsx)与[菜单样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/Menu.module.css)。这是公共基础组件的明确复用点，不是通用放开宿主内部 UI 导入。

## 悬浮提示（Tooltip）

直接复用宿主共享模块 `@deepseek-ai/dsh-client-ui-primitives` 的公开 `Tooltip`，与 `Menu` 一样从 shell baseline 模块表获取，不新增依赖或手写浮层。技能简介和来源标签使用该组件；不以浏览器 `title` 代替要求明确显示的悬浮提示，也不叠加两套提示。

使用单个原有元素作为 children 锚点，组件保持锚点布局；技能简介和来源标签设置 `tabIndex=0`，允许键盘聚焦查看。传入完整 `label`，设置 `portal:true`、`side:'top'`、`delayMs:0` 和 `maxWidth:400`。原生组件负责 hover、focus、位置翻转、视口边界、移出关闭与生命周期清理；portal 让提示逃离卡片和设置滚动区的溢出裁剪，使用原生 tooltip 主题及层级，不覆盖其内部类名。

简介在卡片中最多两行，提示显示完整原文；目录标签保留简称，提示显示 DSH 返回的完整路径；内置来源提示显示完整包名。没有真实路径时不猜路径。组件源码与样式参照 [Tooltip](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/Tooltip.tsx) 和 [Tooltip 样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/Tooltip.module.css)。

## 确认弹窗

重启确认复用宿主共享模块 `@deepseek-ai/dsh-client-ui-primitives` 的公共 `Modal` 与 `Button`，由 shell baseline 模块表获取，与原生插件卸载确认使用相同组合，不新增依赖或覆盖组件内部样式。标题「重启应用」，说明「运行中的任务会停止，未保存的内容可能丢失。」；footer 中依次为 outline「取消」和 primary「重启应用」，使用默认 md 尺寸。取消按钮通过 `data-modal-autofocus` 获得初始焦点；遮罩、关闭图标、Escape、Tab 约束与焦点恢复由 `Modal` 处理。按钮隐藏、开关关闭或其他重启已开始时撤销尚未确认的弹窗，旧回调不得提交操作。行为边界见[重启应用](../src/features/restart-button/spec.md)。

## 多行文本输入框

大段正文输入先核对当前宿主已有多行控件。个性化编辑器以安装包 0.2.2-rc.1 的 `FeedbackDialog` 正文输入框为样式参照；对照上游 [FeedbackDialog 样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-message-feedback/src/client/FeedbackDialog.module.css) 的 `.detail`，同时核对安装包实际 Client CSS。不因自行编写语义 `textarea` 而另选背景、边框或焦点方案。

| 项目 | 原生参照 |
| --- | --- |
| 边框 | `0.5px solid var(--dsw-alias-border-l4)` |
| 背景 | `--dsw-alias-bg-layer-1` |
| 圆角 | `--dsw-radius-lg` |
| 文字 | 继承字体；14px / 22px；`--dsw-alias-label-primary` |
| 内边距 | 上下 12px、左右 14px |
| 焦点 | `:focus` 取消浏览器 outline；边框改为 `--dsw-alias-border-l3`；`0 0 0 1px var(--dsw-alias-state-business-primary)` 描边，键盘与指针一致 |
| 过渡 | border-color 和 box-shadow 120ms ease；减弱动态效果偏好下关闭 |

个性化保留独立编辑页所需的最小高度 260px 和垂直缩放，宽度限制在容器内；不照搬反馈对话框的高度上限和内容自适应行为。禁用时 opacity 0.5、cursor default；字段错误沿用原生 `ConfigField` 的 `aria-invalid` 错误边框 token。placeholder 为用户确认的「添加自定义指令」，颜色沿用原生 `--dsw-alias-label-caption`。样式仅作用于 Mod 自己的元素，不导入宿主内部组件或覆盖其类名。

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

无更改时保存禁用；保存过程中两按钮禁用，保存按钮显示「正在保存…」并设置 `aria-busy`，防止重复提交。保存失败保留草稿，取消恢复当前文件内容。遵循主题 token，不将截图中的白色按钮硬编码为固定颜色。个性化编辑页不显示字符计数或常驻字数上限，长度校验仍在超限时反馈。

## 文案与样式边界

PowerDSH 设置页标题下只显示「DSH 增强插件」，英文为「A DSH enhancement plugin」，不叠加品牌口号。市场描述与包元数据按各自用途独立维护。

| 设置 | 固定说明 |
| --- | --- |
| 显示版本号 | 在左上角显示版本号，点击检查更新 |
| 外观快捷切换 | 在侧栏底部快捷切换外观 |
| 自定义背景 | 为界面选择柔和的动态背景 |
| 背景类型 | 选择官网流动图案或自己的壁纸 |
| 壁纸图片 | PNG / JPEG / WebP · 最大 25 MB |
| 调节背景（图标） | 打开居中的背景调节面板 |
| 显示刷新按钮 | 重新加载当前界面 |
| 显示重启按钮 | 重新启动应用 |
| 任务通知 | 任务完成、失败或需要确认时发送桌面通知。 |
| 通知声音 | 开启任务通知提示音。 |
| 提示音 | 选择系统提示音。 |
| 个性化 | 管理全局提示词 |
| 技能管理 | 在设置中管理技能 |
| MCP 管理 | 在设置中管理 MCP |
| 停用官方登录与模型接入 | 停用官方登录、账号界面及内置模型接入。 |
| 停用官方搜索 | 关闭内置 WebSearch，保留 WebFetch。 |
| 停用官方反馈与遥测 | 停用使用统计、环境信息采集、会话日志及插件清单上报 |
| 停用 Todo 工具 | 新对话中不再生成待办列表 |
| 停用 Plan 模式 | 停用新对话的内置计划模式 |
| 停用 Goal 模式 | 停用新对话的内置目标模式 |
| 屏蔽双击重命名 | 屏蔽侧栏会话标题的双击重命名操作 |

- 「精简」保留为分类名称，停用能力的六项开关使用「停用…」，英文动作为 `Disable`；「其他」中的「屏蔽双击重命名」属于拦截操作，英文使用 `Block`。名称不改变配置键、启停语义和生效范围。
- 可见文案通过 Client locale 服务，插件管理元数据放在 locale JSON；中英文语义一致，英文用 sentence case。切换语言同步更新标题、导航和内容。
- 保留用户已确认的简洁中文文案，描述可理解的状态，不向用户暴露 service、fiber、slot 等实现名词。社区身份在项目介绍说明即可。
- 不擅自添加多余的文字说明。已有标题、说明和控件足以表达用途时，不再补充操作指导、限制说明、实现细节或重复提示；用户已确认的文案不自行扩写。确有操作失败时，只在对应位置显示必要、简短且可处理的错误信息，技术限制与背景说明放入功能文档，不作为界面常驻文案。
- placeholder 少用、少写，只在必要时给出简短提示，不堆叠说明或长示例；已有标题和描述足以说明用途时留空。个性化文本框按用户确认的文案使用「添加自定义指令」。
- 选择器使用 `power-dsh-` 前缀，限定插件拥有的元素；不覆盖 body、宿主私有类、面板布局或其他插件，不查询其 DOM 推断位置。[屏蔽双击重命名](../src/features/double-click-rename/spec.md)已有用户明确批准的局部例外，仅允许读取当前双击事件路径中的会话行标记，不扫描文档或修改宿主节点。技能与 MCP 卡片页为避免滚动宽度跳动，允许唯一的宿主样式例外：仅给包含 `.power-dsh-skills-page` 或 `.power-dsh-mcp-page` 的设置内容滚动容器设置 `scrollbar-gutter:stable`，用 `[data-shortcut-modal="settings"] > div:has(.power-dsh-skills-page,.power-dsh-mcp-page)` 限定；不改面板尺寸、overflow、导航或其他页面，两页卸载后不再匹配。Windows 顶栏三点入口固定在侧栏按钮右侧 4px；仅当入口存在时，通过带自有元素 `:has()` 限定的根元素规则设置宿主 `--dsh-windows-menu-start` 变量，为原生菜单预留空间，入口隐藏或卸载即恢复；不再测量原生菜单，范围见[刷新定位](../src/features/refresh-button/spec.md#接入与定位)。
- 长文案可换行、容器可缩放，不撑破面板；不要另加偏离原生参照行的窄屏密度。
- 样式随组件卸载，其他副作用归属 context；不往 `document.body` 挂第二个应用。侧栏定位边界见[架构规范](architecture.md#侧栏接入)。

## 标签（Tag）

常规 Tag 沿用原生模式卡片的 outline 样式，采用胶囊标识的内容遵循这一规格，不自行设计颜色或方形底块。使用 `inline-flex`、居中对齐、`1px 8px` 内边距、`999px` 胶囊圆角及 `corner-shape: round`；文字 `11px / 17px`、字重 500、单行不换行。描边为 `0.5px solid var(--dsw-alias-border-l4)`，文字为 `var(--dsw-alias-label-tertiary)`，背景透明。标签不被 flex 压缩，与名称保持 8px 间距。

技能统一使用「全局／项目」表示范围、按「用户」「内置」分组，不混用「预置／个人」。卡片不重复显示用户或内置标签，只显示 `.dsh`、`.agents`、`.codex` 等实际目录简称，或已核实的提供插件包名。目录标签悬浮时显示完整技能路径；路径不常驻展开，无法从公开元数据确认时不猜测。技能卡片底部使用原生内置插件页的字段标签：`--ds-font-family-code` 等宽字体、12px／18px、`1px 6px` 内边距、`--dsw-radius-xs` 小圆角、`--dsw-alias-bg-module-platform` 灰底及 `--dsw-alias-label-secondary` 文字，无描边；长包名单行省略，悬停显示全文。它沿用原生卡片底部的代码字段样式，不套用胶囊 Tag。颜色跟随主题，不给来源分配额外彩色语义。仅在真实状态需要时采用原生 solid、neutral 等其他 tone，不把来源标签画成可操作按钮。插件内使用 scoped CSS 对齐上述原生规格，不运行时导入宿主内部组件或引用生成的 CSS 类名。

## 技能与 MCP 管理列表

「技能管理」「MCP 管理」分别作为 Mod「管理」分类的独立持久化入口开关，开启后注册对应原生设置侧栏页面与图标。两页继续使用本规范的 Title、描述、设置行、搜索框和 Switch，不覆盖宿主插件页，不另建全屏面板。

技能与 MCP 页共用原生「内置插件」页的搜索、折叠分组和卡片布局，分别使用自身数据，不运行时导入原生页面组件。两页最大宽度均为 760px，专用标题采用该页面的 18px／600，说明 13px；其他 Mod 页面继续遵守前文标题规格，不全局覆盖。技能页顶部仅保留功能说明「管理 DSH 中可用的技能」，用户分组说明为「从本机技能目录加载」，内置分组说明为「随 DSH 或插件提供」；不显示目录提示或感叹号图标。功能说明单行省略；技能简介按原生卡片最多显示两行，悬停显示全文。

技能页的「全局／项目」Tab 使用上文原生文字、22px 间距、焦点和选中下划线。全局搜索在 Tab 下方通栏；项目范围在 Tab 下方同一行左侧显示项目下拉、右侧显示搜索，窄容器允许换行。MCP 页仅有全局列表，搜索框通栏，不显示范围 Tab 或项目下拉。两页搜索均复用内置插件目录的 36px 高输入框、左侧图标、主题 token、13px 文字、圆角和焦点反馈。

技能页的全局范围按「用户」「内置」顺序显示两个可折叠分组，标题左侧箭头、36px 标题行、说明缩进、组间细线与留白沿用内置插件页。用户默认展开，内置默认收起；搜索期间自动展开命中分组，清空搜索恢复手动展开状态。运行时及 bundled 技能归内置，用户和自定义目录归用户；不显示全局来源筛选下拉。

技能与 MCP 共用原生双列卡片布局：两列 `minmax(0,1fr)`、间距 10px，页面容器宽度不大于 520px 时单列。卡片使用 `0.5px` 的 `--dsw-alias-settings-card-stroke` 描边、`--dsw-radius-xl` 和 `--dsw-alias-settings-card-fill` 背景。主体内边距 `12px 14px`，名称与右上角启停开关同一行；简介使用 `display:-webkit-box`、`-webkit-box-orient:vertical`、`-webkit-line-clamp:2`、`text-wrap:pretty`，最多两行。技能底部借助 `margin-top:auto` 对齐并显示具体来源标签，同一网格行内的技能卡片自然拉伸到等高，不固定所有行的高度。MCP 卡片网格使用 `align-items:start`，展开某张卡片不会拉高同排其他卡片。两页所在的原生内容滚动区预留稳定滚动槽，出现或消失滚动条时不改变卡片宽度。技能卡片保持静态容器，不提供展开箭头或展开区；MCP 第一行仅显示名称与独立启停开关，名称 span 通过原生 Tooltip 展示全名并允许键盘聚焦。运行状态采用可确认的插件生命周期：`active/failed/inactive` 显示「运行中／加载失败／未运行」三种稳定状态；`pending/loading/unloading` 只使用公共原生 `StateDot` 的 `ongoing` 小加载指示，保留对应双语无障碍状态名称，不显示过渡文字。开关明确关闭时，状态位置显示灰色 `idle` 圆点与「已关闭」／`Disabled`，优先于尚未完成卸载的运行状态；原生 `disabled` 同样显示「已关闭」，`unknown` 不伪造状态。稳定状态的文字前放置原生 `StateDot` 小圆点，间距 6px：运行中使用绿色 `done`、加载失败使用红色 `error`、未运行使用灰色 `idle`。文字使用次要颜色，失败使用错误 token，同时提供文字或无障碍名称而非仅用颜色。标题下的第二行并排显示原生传输类型标签与运行状态，间距 8px，窄卡允许自然换行：`stdio` 为「本地」／`Local`，`streamable-http` 为 `HTTP`，未知类型仅省略标签；类型与状态均无可显示内容时省略整行。类型标签采用上文常规 outline Tag 胶囊规格，信息行作为整个卡片头部的一部分，点击也可展开或收起工具列表。有工具且未关闭时，第三行是独立展开按钮，左侧摘要使用「{count} 个工具」／`{count} tools`（英文单数为 `1 tool`），右侧为箭头，数量不加括号；默认收起。悬浮时整个卡片头部使用原生 hover 背景，展开后保持该高亮并使用原生展开描边；工具行自身保持透明，不出现独立灰底条。头部按下反馈与工具按钮的键盘焦点覆盖整个头部，焦点框内偏移 2px；触屏不锁存 hover。展开工具区使用原生主题分隔线、`--dsw-alias-bg-module-platform` 背景与 `10px 14px 12px` 内边距。技能卡片保持静态；MCP 三行头部的非交互区域都可点击展开或收起，独立工具按钮保留原生 Enter／空格操作。头部忽略开关及其他交互控件冒泡的点击，防止双重展开或改变开关；不在开关外包按钮。展开后的工具区独立于头部，点击或选择工具文本不收起卡片，可正常复制。分组仍保留折叠功能。技能停用状态直接由开关表达；MCP 的「已关闭」与「运行中」共用第二行状态位置，不另加分类或标签。原因与操作错误留在对应卡片内并关联控件。技能与 MCP 卡片专用小开关为 28×16px，2px 内边距、12px 滑块和 12px 平移；保留原生主题色、焦点与保存反馈，扩大透明点击区域。其他页面开关保持标准 36×20px。技能底部来源遵守上文卡片字段标签样式；MCP 工具区使用 12px／18px、次要文字颜色和普通字体，无标签底色及圆角；展开后按列表逐项显示完整工具名，长名称换行，不使用单行截断或工具列表 Tooltip。

技能页的项目范围始终下拉选择已经导入的项目，显示原生项目名称，路径只作为选择值、悬停提示和同名区分。只有一个项目也保留下拉，无项目禁用并显示「暂无已导入项目」，不追加未导入的启动目录。全局隐藏项目选择；项目名称下拉与搜索同行，两个范围都不显示「全部来源」下拉，技能继续用同一套卡片。不展示模式选择，不把文件全路径常驻堆在卡面。

技能开关读原生实际调用策略，仅对相应 DSH 范围生效，不修改共享文件。MCP 顶部说明为「管理 DSH 中可用的 MCP」，只提供全局列表，按「用户／内置」分组，说明分别为「用户配置的 MCP」「随模式或插件提供」。MCP 页不提供项目范围、项目文件扫描或项目实例展示。同一个全局原生实例在配置清单和运行目录中出现时合为一张卡片。名称使用实际 serverName，可管理项操作仍用原生标识；移除「当前配置」等来源标签，第二行并排显示已确认的本地／HTTP 类型标签与运行状态，下面的展开按钮显示该服务器的实际工具数量，展开后逐项显示完整工具名。展开按钮提供 `aria-expanded`、`aria-controls` 和关联名称、摘要；底部工具区为关联名称的 region，收起时隐藏且不渲染工具项。每张卡片按实例 id 独立保留本页手动状态，搜索、刷新及分组折叠不重置，不持久化；搜索工具名或本地／HTTP 类型文案可找到对应服务器，不自动展开卡片。「已关闭」与「运行中」统一显示在第二行类型标签旁的状态位置，关闭使用灰色 `idle` 圆点。第三行保留工具缺省文字：配置状态明确且开关关闭时显示静态「暂无可用工具」／`No available tools`；开启但没有已加载工具时显示静态「暂无已加载工具」／`No loaded tools`。两种缺省行均沿用工具入口的最小高度和间距。这两种状态不显示展开箭头和工具区，头部不可展开，取消可点击的悬浮与按下反馈；已展开的卡片在关闭或工具列表变空后立即收起，即使关闭后仍有缓存工具或运行状态尚未停用也不展示工具。重新开启且有工具后恢复本页原有展开偏好。没有简介时不补空白占位或编造文本。服务器长名称继续使用原生 Tooltip，保留只读原因、未知状态与行内错误。无原生持久化控制入口的条目显示「由提供插件管理」并保持只读。未知配置状态不可操作；运行状态不等于网络连接状态，不显示「在线」或「已连接」。页面挂载、窗口 focus 和写后读回时刷新，页面可见且无读取或写入进行时每 2 秒刷新运行状态，卸载释放定时器与监听；刷新保留搜索、分组与卡片展开状态。实现依据及许可见[第三方资源声明](third-party-notices.md)，行为范围见[技能管理](../src/features/skills/spec.md)、[MCP 管理](../src/features/mcp/spec.md)。

行开关即时保存、不增加页级保存取消；操作中禁止重复提交和切换写入上下文，完成后以原生读回结果更新。加载失败显示可重试错误，不显示假空列表；目录不完整禁止写入。搜索仅使用「搜索技能」「搜索 MCP」。首版只做查看与启停，不出现未实现的安装、添加或编辑按钮。

## 验收清单

- [ ] 实际页面与宿主参照并排检查，字体、层级、间距和图标重量协调。
- [ ] 浅深主题、中英文、窄面板、长文案与字体放大均可读，无横向溢出或翻译 key。
- [ ] 键盘、焦点、保存、禁用、错误和不可用状态完整且符合实际结果。
- [ ] 侧栏收起与展开、原生底部控件和系统标题栏的空间正确。
- [ ] 无 slot 崩溃、全局样式污染或卸载残留。

源码与 token 匹配不等于页面视觉验收；无法访问实际页面时明确记录未完成项。
