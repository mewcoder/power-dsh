# 架构规范

当前实现结构见下文。下一步按用户特性拆分的目标、装配与策略边界、Client 产物约束及迁移顺序见[特性模块架构方案](feature-modules.md)；该方案尚未迁移运行代码。每项用户功能的行为由独立 Spec 维护，遵循[功能 Spec 规范](feature-spec.md)。

## 包与文件职责

一个仓库交付一个 Cordis bundle，使用无需构建的 JavaScript 入口。目录职责见[开发指南](development.md#目录职责)；运行源码集中在 `src/`，测试放在 `tests/`，静态资源放在 `assets/`。包的 `.`、`./client`、`./icon` 和 `./locale/*.json` 导出键不变，由清单映射到新的实际路径。技术包名为 `power-dsh`，品牌与设置显示名为 **PowerDSH**；新安装的 Loader 条目、设置命名空间、设置页 id、Host/Client 包标识与 RPC 描述符均使用 `power-dsh`，驼峰与下划线形式分别使用 `powerDsh`、`power_dsh`。保留 `private: true`，未发布到 npm。

旧 ID `dsh-mod`、`dsh-x-mod` 的设置回退用于兼容旧安装；它不等于完整配置迁移。安装与偏好读回的历史证据集中见[兼容性调查](compatibility-audit.md#安装与平台验证记录)，升级验证要求见[版本兼容性](compatibility.md#验证与记录)。

| 文件 | 职责 |
| --- | --- |
| [package.json](../package.json) | 依赖、导出、分发资源、Bundle 与 Client 声明 |
| [cordis.patch.yml](../cordis.patch.yml) | 只插入本插件条目 |
| [index.js](../src/index.js) | Config、`power_dsh_settings` 工具、owner-only 策略 RPC |
| [plugin-policy.js](../src/plugin-policy.js) | 共用目标匹配与原生启停 |
| [account-policy.js](../src/account-policy.js) | 账号目标与精简操作 |
| [telemetry-policy.js](../src/telemetry-policy.js) | 内联七个遥测、反馈界面与命令目标及精简操作 |
| [todo-policy.js](../src/todo-policy.js) | 全局与模式内 Todo 插件启停及旧代际 Agent 调用限制 |
| [search-policy.js](../src/search-policy.js) | 只切换内置网页搜索配置，保留抓取及第三方 MCP，并限制旧代际搜索调用 |
| [notifications.js](../src/notifications.js) | 最近结束轮次的有界只读摘要投影 |
| [system-sounds.js](../src/system-sounds.js) | 本机系统声音目录、播放白名单及托管进程生命周期 |
| [restart.js](../src/restart.js) | macOS 打包应用身份校验、重启状态与 detached 正常退出/同路径重开助手 |
| [operation-queue.js](../src/operation-queue.js) | 一个 Host 操作队列，串行执行设置请求并在卸载时取消后续操作 |
| [personalization.js](../src/personalization.js) | 原生全局 AGENTS.md 的读取、磁盘 revision 校验与原子保存 |
| [skill-policy.js](../src/skill-policy.js) | DSH 专用技能限制、完整目录、原生调用状态读回与作用域生命周期 |
| [skill-origin.js](../src/skill-origin.js) | 技能目录及真实提供插件的显示元数据，不读取技能正文 |
| [mcp-policy.js](../src/mcp-policy.js) | MCP 全局目录、配置归属与原生启停读回 |
| [mcp-providers.js](../src/mcp-providers.js) | 已有全局 MCP 插件实例与原生管理器的安全投影，不枚举项目或拥有连接 |
| [rpc.js](../src/rpc.js) | Host RPC 描述，测试核对 Client 协议 |
| [client.js](../src/client.js) | 设置行、版本标记、外观、刷新与重启按钮、Client 文案与图标 |
| [assets/locale/en.json](../assets/locale/en.json)、[assets/locale/zh.json](../assets/locale/zh.json) | 插件管理元数据 |
| [assets/icon.svg](../assets/icon.svg) | 含许可的 Lucide Puzzle 图标 |
| [scripts/check.mjs](../scripts/check.mjs)、[scripts/check-package.mjs](../scripts/check-package.mjs) | 仓库结构与文档资源检查，以及实际 tarball 的源码、导入、Client 登记和资源核对 |
| [tests/host-wiring.test.mjs](../tests/host-wiring.test.mjs)、[tests/client.test.mjs](../tests/client.test.mjs) 等 | Host/Client 装配与功能行为回归 |

新增运行资源时同步导出与分发清单。Patch 不覆盖宿主或其他插件；不添加安装脚本或隐式下载。当前没有独立数据库或网络客户端。

## Host 与 Client

Host 拥有持久化配置、文件访问、策略操作和安全数据投影；Client 负责设置入口、展示与交互。Config 由宿主 settings 持久化，普通偏好通过 `configForms` 保存；有副作用的精简操作由 UI 和工具共用 Host 方法，不靠监听布尔配置异步执行。各功能配置键、默认值和行为由[主 Spec](README.md#功能规格spec)维护。

个性化使用 owner-only 文件 RPC 编辑原生全局指令；技能策略通过原生 provider 和 Host / preset / Agent 作用域限制调用；MCP 只投影已有全局配置及实例的白名单元数据，不拥有连接。文件冲突、技能优先级和 MCP 可写条件分别见[个性化](personalization.md)、[技能管理](skills.md)、[MCP 管理](mcp.md)。私有 locator、命令、环境变量、请求头及原始配置不进入目录 RPC。

Client 由宿主模块加载器注册，factory id 与包名一致，React 取自宿主模块表。`dsh.client.inject` 是包依赖元数据，不保证服务激活顺序；服务依赖由 Cordis `inject` 声明。它不等同于 JavaScript 导入；不另装 React、加载 CDN 或运行时导入功能插件的内部 UI。技能页的项目下拉与页面悬浮提示明确复用 shell baseline 模块表中的公共 `@deepseek-ai/dsh-client-ui-primitives` 的 `Menu`、`Tooltip`，与原生组件同源；不声明额外 external 或从宿主源码路径导入，重启确认同样复用该共享模块的 `Modal` 与 `Button`，不调用浏览器原生确认框。具体约定见 [UI 下拉规范](ui.md#下拉选择)和[悬浮提示](ui.md#悬浮提示tooltip)。

严格 Typert 合约先通过 `remote.$mount` 挂载，再在依赖 `remote.powerDsh` 的子 context 中注册页面；不能把自身创建的命名空间放在挂载父级的硬依赖中。策略 RPC 校验布尔输入并限制 owner 操作。Client 收到结果后重载共享配置镜像。

## 任务通知

Host 在 `sessionProjections` 注册最小结束摘要，Client 订阅原生会话列表与交互状态并调用浏览器通知；本机声音经 owner-only RPC 和托管 subprocess 播放。投影、订阅与进程归属 context。摘要字段、触发去重、声音白名单和权限边界由[任务通知 Spec](notifications.md)维护。

## 双击重命名屏蔽

Client 根据持久化偏好安装和释放捕获监听。当前事件路径中会话行标记的读取是已获授权的有限 DOM 例外；范围、放行条件与兼容依据见[屏蔽双击重命名 Spec](double-click-rename.md)。

## 原生精简操作

账号与遥测共用 `PluginPolicy`，分别使用固定的目标匹配范围和独立偏好。开启精简时通过原生 Plugin Manager 停用匹配目标，关闭时启用匹配目标，包括操作前已停用的目标；不保存或恢复之前的启用状态。

Host 只保留一个 `OperationQueue`，串行执行 UI 与工具请求。操作核对原生应用结果，再通过宿主 ConfigEditor 保存偏好；失败明确返回原因，可再次执行以重新应用。卸载关闭队列并停止后续写入，不等待正在申请热重载锁的操作。配置事件只读，不在 apply、配置事件或外层 HMR 事务里嵌套写入配置。

配置与模块变更通过宿主服务完成，不手写 profile，也不建立事务、回滚框架或持久化恢复记录。原生启停由 profile 持久化，Mod 卸载不会自动启用目标。页面展示偏好与操作错误，工具按需读回状态；目标范围和配置保留规则见[精简官方登录与模型接入](account-blocking.md)与[反馈与遥测精简](telemetry-blocking.md)。

Todo 的全局条目复用 `PluginPolicy`，模式内条目通过 ConfigEditor 启停；搜索通过 `SearchPolicy` 编辑活动配置。两者使用原生 Tools 限制、执行 guard 和 Agent 生命周期覆盖旧代际。具体范围、恢复限制和卸载行为见[精简Todo工具](todo-blocking.md)与[精简官方搜索](search-blocking.md)。

## 侧栏接入

设置页与图标使用 `settings.section`、`settings.section.icon`。侧栏能力共用 `sidebar.footer.action` 中独立追加的零高度满宽容器 `power-dsh-footer`，固定定位且不新增底部行。状态来自原生连接服务和桌面桥；只测量自身容器，不读取其他插件 DOM，也不替换品牌、设置或账号 launcher。

版本来源、更新桥和标题栏适配见[显示版本号](version-display.md)；原生 theme service、sprite 与避让规则见[外观快捷切换](appearance-shortcut.md)；顶部菜单与页面重载边界见[刷新界面](refresh-button.md)。定位值须在宿主布局、窗口缩放或系统标题栏变化后重新验收，不能视为跨平台对齐保证。

## 重启应用

Client 的 `HeaderActions` 在 Mod 自有侧栏容器内通过公共 `Menu` 承载刷新与重启，并复用公共 `Modal`、`Button` 确认。设置保存与重启执行分开；owner-only Host RPC 负责能力探测、执行及状态读回。

Host 校验打包应用身份后交接 detached 助手，助手在 Host 正常退出后仍可完成单次重开，随后自行结束。平台限制、固定命令、取消与超时语义以及跨退出生命周期例外见[重启应用 Spec](restart-button.md)；接口与实际验证证据见[兼容性调查](compatibility-audit.md#安装与平台验证记录)。

## 生命周期与扩展

注册、监听和观察器归属 Cordis context，组件样式随卸载移除。只使用独立 id 追加扩展，不复用宿主 id 替换已有功能。

按真实用户能力拆模块；有多个实际场景再提取共享逻辑，不预建模块框架。涉及业务数据时以宿主事实和服务为准，凭据交给宿主凭据服务，操作由 Host 统一实现。错误、取消和不可用应显式返回。

依赖与兼容约束依据目标运行时验证，不为绕过版本检查移除必要限制或默认豁免。验证层次与当前限制见[开发指南](development.md#验证方法与限制)。
