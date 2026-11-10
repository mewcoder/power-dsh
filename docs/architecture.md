# 架构规范

PowerDSH 按用户特性组织 Host、Client、配置、协议、文案与测试，交付一个 Cordis bundle。目录契约与新增功能步骤见[特性模块约定](feature-modules.md)；每项功能的唯一主 Spec 位于模块目录，遵循[功能 Spec 规范](feature-spec.md)。

## 包与文件职责

包名为 `power-dsh`，品牌与设置显示名为 **PowerDSH**；Loader 条目、设置命名空间、设置页 id、Host/Client 标识与 RPC 描述符保持原值。保留 `private: true`，未发布到 npm。

| 位置 | 职责 |
| --- | --- |
| [src/index.ts](../src/index.ts) | 稳定 Host 门面，导出 `inject`、`Config`、`apply` |
| [src/client.ts](../src/client.ts) | Client 源入口，从宿主 factory 获取 React 和公共组件并转交装配 |
| [dist/index.js](../dist/index.js)、[index.d.ts](../dist/index.d.ts) | 已生成并随源码提交的 Host ESM 及公开声明，作为主入口与类型入口 |
| [dist/client.js](../dist/client.js) | 已生成并随源码提交的单个 ModuleLoader factory，作为 `./client` 公开导出 |
| [src/app/host-features.ts](../src/app/host-features.ts)、[client-features.ts](../src/app/client-features.ts) | Host 与 Client 的显式特性选择 |
| [src/app/host.ts](../src/app/host.ts)、[client.ts](../src/app/client.ts) | 宿主接入、共享状态与贡献装配，不实现各功能业务 |
| [src/app/config.ts](../src/app/config.ts)、[settings-tool.ts](../src/app/settings-tool.ts)、[rpc.ts](../src/app/rpc.ts) | 聚合配置、具名设置工具和严格 RPC，拒绝重复与缺项 |
| [src/features/](../src/features/) | 十七项特性的定义、配置、实现、文案、主 Spec 和行为测试 |
| [src/shared/host/](../src/shared/host/)、[client/](../src/shared/client/)、[rpc/](../src/shared/rpc/) | 队列与原生启停、设置/目录/侧栏外壳、复用 codec |
| [tests/integration/](../tests/integration/)、[shared/](../tests/shared/)、[helpers/](../tests/helpers/) | 完整装配与组合、共享机制测试及内存夹具 |
| [assets/](../assets/)、[cordis.patch.yml](../cordis.patch.yml)、[screenshots.json](../screenshots.json) | 元数据、图标、Bundle 与市场截图入口 |
| [scripts/](../scripts/) | TypeScript/tsdown 构建、模块边界/文档/产物检查、递归测试与隔离 SDK 回归 |

运行源码使用 TypeScript。公开导出键仍为 `.`、`./client`、`./locale/*.json`、`./icon`，Host 入口改为预生成的 `dist/index.js`，并提供相邻的 `index.d.ts` 类型声明；Client 保留 `dist/client.js` 单 factory。开发时由 [tsdown 配置](../tsdown.config.ts)分别构建 Node ESM 与浏览器 IIFE，SDK 保持外部依赖，React 保持宿主 factory 注入。

源码或类型变更后执行 `npm run build`，源码与三个产物一起维护；`check:types` 执行严格 `tsc --noEmit`，`check:build` 在内存重新生成并核对三个产物。`npm run check` 组合类型、结构、构建与行为检查。Git 与 npm/tarball 安装使用已有 JS，没有 `prepare`、安装编译或新增生产依赖；运行时不需要 TypeScript 或 tsdown。构建与安装约束见[开发指南](development.md#环境与检查)。

旧 ID `dsh-mod`、`dsh-x-mod` 的设置回退用于兼容旧安装，不等于完整迁移。历史证据见[兼容性调查](compatibility-audit.md#安装与平台验证记录)。

## Host 与 Client

每个特性的 `definition.ts` 是纯元数据，`config.ts` 拥有本功能 schema 与具名工具贡献；有 Host 行为时由 `host.ts` 提供实例创建与具名方法。装配只组合这些声明，所有受控配置键、默认值、操作顺序、工具参数和输出保持兼容。具体行为由[十七项主 Spec](README.md#功能规格spec)维护。

Host 负责持久配置、文件、进程、策略与安全数据投影；Client 负责设置贡献、页面、观察与交互。普通偏好通过原生 `configForms` 保存；精简等操作由 UI 与工具共用 Host 方法，不监听布尔配置异步执行。可选服务在特性内部子 context 接入，缺少辅助服务不应阻断其他入口。

特性内部 `rpc.ts` 同时供 Host 与 Client 使用，保持严格 codec、具名方法和 owner 校验，不暴露任意字符串分发接口。装配从选择的特性过滤稳定协议清单；Client 先 `remote.$mount`，再在依赖 `remote.powerDsh` 的子 context 中注册页面。运行时拒绝重复 id、配置键、设置项和 RPC；仓库检查还核对两端清单、Spec、源码依赖与文案。

Client factory 从宿主模块表获取 React 与 `@deepseek-ai/dsh-client-ui-primitives` 的公共 `Menu`、`Tooltip`、`StateDot`、`Modal` 和 `Button`，不打包另一份 React，不从功能插件内部源码导入 UI。`dsh.client.inject` 是包元数据，实际服务激活由 Cordis `inject` 管理。构建检查禁止 Host、schema 配置、Node 和测试代码进入浏览器模块图。

类型契约位于[shared/types](../src/shared/types/)与两端贡献类型中：偏好逐键关联值，Host 方法统一声明参数与结果，Client 从同一方法表映射 RPC 包装。共享 wire 仅包含数据形状，codec 留在功能目录。原生异构配置和服务由有界结构适配进入；公开门面接受 Cordis 的基础 Context，内部实现按已注入的服务表面检查，不向全局 Context 伪造完整服务声明。类型擦除不替代运行时校验、owner 检查或生命周期管理。

## 共享错误与诊断

所有功能的错误行为由[错误处理规范](error-handling.md)统一维护。Client 使用[共享错误反馈](../src/shared/client/error-feedback.ts)展示页面、行内及紧凑入口的摘要、详情与复制状态；[诊断处理](../src/shared/types/diagnostics.ts)限定字段与文本。Host 直接装配原有方法，功能模块负责自身的失败传播、读回与恢复条件；关键意外故障可按需使用宿主 logger，不设置统一日志包装或独立日志分类层。

DSH `0.2.2-rc.1` 的原生 logger 提供内存缓冲与 exporter；插件安装对话框的 Host 日志和 Session 日志导出分别服务于包操作与会话历史，不是 PowerDSH 通用错误存储。普通捕获异常经 logger 记录不保证持久化；不另建日志查看器、不扫描个人日志，具体入口与验证限制依[主规范](error-handling.md#host-与日志)说明。

## 任务通知

[通知模块](../src/features/notifications/)拥有结束摘要投影、通知订阅和系统声音。Host 注册最小投影，Client 订阅原生列表与交互状态并调用浏览器通知；声音经 owner-only RPC 与托管 subprocess 播放。触发、权限、去重和声音边界由[任务通知 Spec](../src/features/notifications/spec.md)维护。

## 双击重命名屏蔽

[双击模块](../src/features/double-click-rename/)根据持久偏好安装和释放捕获监听。读取当前事件路径中的会话行标记是已获授权的有限 DOM 例外，范围与兼容依据见[对应 Spec](../src/features/double-click-rename/spec.md)。

## 背景设置

[背景设置](../src/features/flowing-background/spec.md)拥有 `flowingBackgroundEnabled`（默认 `false`）、`flowingBackgroundKind`（默认 `pattern`，可选 `wallpaper`）、`flowingBackgroundOpacity`（默认 `100`，0–100）与 `flowingBackgroundBlur`（默认 `0`，0–40）四个配置，均独立持久化，通过原生 `configForms` 保存。单一开关控制包括侧边栏在内的整个界面，类型、透明度与毛玻璃行只在开启时展开，不增加第二个开关。壁纸二进制不属于配置：Host 的 `WallpaperStore` 把图片与元数据写到 profile 的 `power-dsh/wallpaper.{bin,json}`，Client 经 `readWallpaper`／`saveWallpaper`／`clearWallpaper` 三个 owner-only RPC 读写，插件卸载后调用被拒绝；写入为 0600 临时文件加原子重命名，MIME、大小与文件名在两端校验。Client 在 `shell.overlay` additive slot 仅注册返回 null 的生命周期控制组件，不订阅会话或面板显示条件；已有对话、运行、设置及全局面板不停止动画。浮层不承担实际绘画，不读取消息正文或扫描业务事件。

适配器只在唯一、可见且符合已安装宿主结构的 AppFrame 内追加 absolute、inset 0、z-index -1 的单张连续 Canvas；框架使用 `isolation:isolate` 和原生 bg-base 底色。必需框架类名只读自两个确切官方 `style[data-plugin-css]` 标签：`@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css` 提供唯一简单类名 `_frame`、`_sidebarCol`、`_centerCol`，`@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css` 提供唯一简单类名 `_root`；标签和所需类名均须唯一，再用语义直接子元素、relative 定位和 grid 布局核对真实目标。用户明确授权的原生表面适配仅包括 AppFrame sidebarCol、centerCol、原生 SidebarRoot，以及任意 phase 的主 ConversationRoot，临时设置其内联 background-color:transparent 与 background-image:none。不硬编码 npm CSS Modules 哈希，不猜测替代选择器，不修改全局主题 token、输入卡片、编辑器、文件卡片、菜单、弹窗或任意后代，不替换宿主根节点。其他全局面板的独立不透明内容表面和操作系统原生标题栏继续保留。

按用户反馈的底部阴影，额外可选读取 `@deepseek-ai/dsh-client-ui-workspace/WorkspaceBrowser.module.css` 的唯一 root/treeBody/fade 映射，仅隐藏原生 SidebarRoot 内工作区 root 下 treeBody 的直接 span.fade，兼容分组、平铺与搜索结果；模块或类名缺失、歧义不阻断背景。原有侧栏 scrollFade 同样为可选适配，具体样式与恢复范围以主 Spec 为准。

样式快照保存原值和优先级，清理只恢复仍等于本功能写入值和优先级的属性，保留第三方后写值。目标原生表面或同一框架的类名映射替换时只刷新背景适配，不重启动画；框架替换、关闭和卸载释放旧资源并恢复所属样式。官方样式元数据缺失、标签或类名歧义、框架缺失或不受支持时不挂载、不回退前景，设置页使用共享错误反馈；正确官方样式延迟到达后可重新挂载并清理过期错误。

绘图组件保留独立 WebGL shader 的蓝白柔和流动主体，参考 [DeepSeek 官网](https://www.deepseek.com/)的 WebGL pattern，不复制官网源码或资源、不承诺像素级复刻，不引入网络资源或新依赖。框架 clientWidth/clientHeight 与 `ResizeObserver` 驱动自有画布尺寸；`MutationObserver` 在 body 跟踪已批准结构表面，在 head 观察官方样式模块的 childList/characterData 变化，类名读取限于上述两个必需标签和一个可选工作区标签。减少动态效果时静态，页面隐藏时暂停；WebGL 不可用或上下文丢失时，仅在适配成功的框架底层回退 CSS 渐变。直接读取已安装 `0.2.2-rc.1` 桌面包发现其 CSS Modules 哈希与同版 npm 包不同，因此版本号不能决定类名，实际映射以当前加载的官方样式为准；源码、检查、安装与实际页面验收分别记录，以对应 Spec 为准。

## 原生精简操作

账号与遥测模块使用[共享 PluginPolicy](../src/shared/host/plugin-policy.ts)，分别拥有目标匹配、顺序和偏好键。开启时停用匹配目标，关闭时启用，包括原先已停用的目标；不保存或恢复旧启用状态。Todo、Plan 与 Goal 只在全局条目复用此机制，模式条目与搜索配置保留各自策略。Todo、Plan 与 Goal 只修改原生声明，对使用当前模式代际的新对话生效，不给已打开 Agent 增加工具限制或命令拦截。Goal 仅启停目标命令和工具，保留全局目标领域服务、自动续跑驱动及历史界面，避免卸载驱动导致已有目标被解除运行。

Host 保持一个[操作队列](../src/shared/host/operation-queue.ts)，核对原生应用结果后通过 ConfigEditor 保存偏好。写入只更新所属字段、保留其他功能的当前配置，已废止恢复字段的清理范围固定。失败明确报错，可重新应用；卸载关闭队列并阻止后续写入，不等待正在申请热重载锁的操作。

配置事件只读，不在 apply、配置事件或外层 HMR 事务里嵌套写入。原生变更由 profile 持久化，卸载模块不自动启用目标，不手写 profile，不新增事务或恢复框架。目标范围、旧代际调用限制及恢复语义以[账号](../src/features/account-blocking/spec.md)、[遥测](../src/features/telemetry-blocking/spec.md)、[Todo](../src/features/todo-blocking/spec.md)、[Plan](../src/features/plan-blocking/spec.md)、[Goal](../src/features/goal-blocking/spec.md)和[搜索](../src/features/search-blocking/spec.md) Spec 为准。

## 侧栏接入

设置页与图标使用 `settings.section`、`settings.section.icon`。侧栏共用 `sidebar.footer.action` 中零高度满宽的自有容器 `power-dsh-footer`，不新增底部行、不替换宿主控件。设置外壳消费特性设置贡献；侧栏外壳消费特性展示和动作贡献，不维护逐功能保存分支。

刷新与重启共用[侧栏菜单外壳](../src/shared/client/sidebar-shell.ts)，两项功能独立贡献动作；移除其中一项不移除另一项，没有可用动作时不显示空菜单。版本和主题由各自模块控制展示及释放。定位、主题同步、Windows 顶栏入口与原生菜单间距变量的局部适配范围等分别见[版本](../src/features/version-display/spec.md)、[外观](../src/features/appearance-shortcut/spec.md)与[刷新](../src/features/refresh-button/spec.md) Spec。

## 重启应用

[重启模块](../src/features/restart-button/)拥有公共确认弹窗、状态轮询和 Host 助手；共享菜单只承载动作。配置保存与执行分开，owner-only RPC 重新校验平台和应用身份。

已确认交接的 detached 助手可在 Host 正常退出后完成单次同路径重开，随后结束；取消、超时和失败不强杀或延迟补开。该跨退出生命周期例外、平台范围和实际验收限制见[重启 Spec](../src/features/restart-button/spec.md)。

## 生命周期与扩展

各功能的监听、订阅、观察器、样式、投影、租约和进程归属其 context 或组件，卸载后释放。模块选择、功能开关及内部条目持久状态分别处理，不能把移除界面当作恢复所有配置。

特性只能依赖自身、共享代码和已核对的宿主能力，不直接导入其他特性实现或装配层。共享代码不反向导入特性，Host 与 Client 分开选择。功能组合测试仅用内存配置验证排除后的入口、协议、资源与状态保留，不修改真实 profile。

验证层次见[开发指南](development.md#验证方法与限制)。构建、测试和包解析通过不等于已安装 DSH、实际页面或完整重启验收；新增模块化后的结果须单独记录，不扩大历史兼容结论。
