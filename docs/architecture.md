# 架构规范

## 包与文件职责

一个仓库交付一个 Cordis bundle，使用无需构建的 JavaScript 入口。技术包名为 `power-dsh`，品牌与设置显示名为 **PowerDSH**；新安装的 Loader 条目、设置命名空间、设置页 id、Host/Client 包标识与 RPC 描述符均使用 `power-dsh`，驼峰与下划线形式分别使用 `powerDsh`、`power_dsh`。保留 `private: true`，未发布到 npm。

当前本地安装已按用户授权，通过原生管理器从旧 `@local/dsh-mod` 替换为 `power-dsh`，运行条目为 `include:power-dsh`。旧 ID `dsh-mod`、`dsh-x-mod` 的设置回退和两个旧目录符号链接继续保留作兼容，不自动迁移配置。六项原生设置偏好已恢复，其他偏好保留备份、未自动迁移；不手工编辑 profile manifest 或 patch。安装与升级边界见[发布与升级](releasing.md#名称与准备状态)。

| 文件 | 职责 |
| --- | --- |
| [package.json](../package.json) | 依赖、导出、分发资源、Bundle 与 Client 声明 |
| [cordis.patch.yml](../cordis.patch.yml) | 只插入本插件条目 |
| [index.js](../index.js) | Config、`power_dsh_settings` 工具、owner-only 策略 RPC |
| [plugin-policy.js](../plugin-policy.js) | 共用目标匹配与原生启停 |
| [account-policy.js](../account-policy.js) | 账号目标与精简操作 |
| [telemetry-policy.js](../telemetry-policy.js) | 内联七个遥测、反馈界面与命令目标及精简操作 |
| [todo-policy.js](../todo-policy.js) | 全局与模式内 Todo 插件启停及旧代际 Agent 调用限制 |
| [search-policy.js](../search-policy.js) | 只切换内置网页搜索配置，保留抓取及第三方 MCP，并限制旧代际搜索调用 |
| [notifications.js](../notifications.js) | 最近结束轮次的有界只读摘要投影 |
| [system-sounds.js](../system-sounds.js) | 本机系统声音目录、播放白名单及托管进程生命周期 |
| [restart.js](../restart.js) | macOS 打包应用身份校验、重启状态与 detached 正常退出/同路径重开助手 |
| [operation-queue.js](../operation-queue.js) | 一个 Host 操作队列，串行执行设置请求并在卸载时取消后续操作 |
| [personalization.js](../personalization.js) | 原生全局 AGENTS.md 的读取、磁盘 revision 校验与原子保存 |
| [skill-policy.js](../skill-policy.js) | DSH 专用技能限制、完整目录、原生调用状态读回与作用域生命周期 |
| [skill-origin.js](../skill-origin.js) | 技能目录及真实提供插件的显示元数据，不读取技能正文 |
| [mcp-policy.js](../mcp-policy.js) | MCP 全局目录、配置归属与原生启停读回 |
| [mcp-providers.js](../mcp-providers.js) | 已有全局 MCP 插件实例与原生管理器的安全投影，不枚举项目或拥有连接 |
| [rpc.js](../rpc.js) | Host RPC 描述，测试核对 Client 协议 |
| [client.js](../client.js) | 设置行、版本标记、外观、刷新与重启按钮、Client 文案与图标 |
| [locale/en.json](../locale/en.json)、[locale/zh.json](../locale/zh.json) | 插件管理元数据 |
| [icon.svg](../icon.svg) | 含许可的 Lucide Puzzle 图标 |
| [scripts/check.mjs](../scripts/check.mjs) | 语法、资源、文案、SVG 与文档链接检查 |

新增运行资源时同步导出与分发清单。Patch 不覆盖宿主或其他插件；不添加安装脚本或隐式下载。当前没有独立数据库或网络客户端。

## Host 与 Client

十二个功能主开关均为默认 false 的 volatile Config，通知声音子选项默认为 true，均由宿主 settings 持久化。版本、按钮显隐与个性化入口开关通过 `configForms` 保存；账号与遥测调用 Host 策略操作，不靠监听布尔配置异步执行副作用。精简功能的 UI 和工具共用同一操作。个性化的独立设置 Tab 随开关注册释放，正文通过 owner-only 文件 RPC 直接编辑 `$DSH_HOME/AGENTS.md`，由 DSH 原生 `dsh-agent-instructions` 读取，不再存入 Mod 配置或自行贡献提示词。关闭开关只移除编辑入口，详见[个性化](personalization.md)。技能管理通过独立 `skillManagerEnabled` 控制设置入口，`disabledSkills` 按用户或项目范围及项目根保存 DSH 专用限制；正文和原有技能文件不变。原生 provider 在 Host、preset 与 Agent 作用域执行双向调用限制，持久化后读回实际状态；详见[技能管理](skills.md)。MCP 管理通过 `mcpManagerEnabled` 控制独立入口，只合并全局原生配置与已有提供插件的全局实例，按用户与内置分组展示，不枚举工作区或 Agent 进行项目归属扫描，也不读取项目配置文件。Host 只向 Client 投影名称及安全元数据，不发送命令、参数、环境变量、请求头、URL 或原始配置；MCP RPC 响应只有 `{ complete, servers }`，不含范围、工作目录或工作区列表。可管理项通过原生 Plugin Manager 或 Settings 保存并读回，无对应持久化接口的条目只读。目录不建立连接，移除页面及卸载 Mod 不改变提供方实例。详见[MCP 管理](mcp.md)。

Client 由宿主模块加载器注册，factory id 与包名一致，React 取自宿主模块表。`dsh.client.inject` 是包依赖元数据，不保证服务激活顺序；服务依赖由 Cordis `inject` 声明。它不等同于 JavaScript 导入；不另装 React、加载 CDN 或运行时导入功能插件的内部 UI。技能页的项目下拉与页面悬浮提示明确复用 shell baseline 模块表中的公共 `@deepseek-ai/dsh-client-ui-primitives` 的 `Menu`、`Tooltip`，与原生组件同源；不声明额外 external 或从宿主源码路径导入，重启确认同样复用该共享模块的 `Modal` 与 `Button`，不调用浏览器原生确认框。具体约定见 [UI 下拉规范](ui.md#下拉选择)和[悬浮提示](ui.md#悬浮提示tooltip)。

严格 Typert 合约先通过 `remote.$mount` 挂载，再在依赖 `remote.powerDsh` 的子 context 中注册页面；不能把自身创建的命名空间放在挂载父级的硬依赖中。策略 RPC 校验布尔输入并限制 owner 操作。Client 收到结果后重载共享配置镜像。

## 任务通知

`notificationsEnabled`、`notificationSoundEnabled` 与默认 `'default'` 的 `notificationSound` 通过宿主 `configForms` 独立持久化。Host 在 `sessionProjections` 注册 `powerDshNotifications`，只折叠 `turn/end` 为最近一轮的 `{seq, turn, reason}`；不保留回复、错误正文或工具参数。Client 订阅原生 `sessions.list` 的摘要与 `uiSession.sessionStatus` 的待交互对象，按序号和交互 key 去重，再调用浏览器 `Notification`。系统默认声音交给原生通知；指定本机提示音时通知静音，owner-only RPC 通过 [SystemSounds](../system-sounds.js) 播放目录白名单或固定 Windows 系统事件。Client 用 `connection.isLoopback` 限制本机选择与试听，Host 使用原生 subprocess 管理固定 argv、超时和卸载取消；不接收任意命令、路径或上传资源。投影、订阅和已显示通知均随所属 context 释放；不接管提问或审批，不新增模型工具、提示词或会话事件。触发、声音与权限边界见[任务通知](notifications.md)。

## 原生精简操作

账号与遥测共用 `PluginPolicy`，分别使用固定的目标匹配范围和独立偏好。开启精简时通过原生 Plugin Manager 停用匹配目标，关闭时启用匹配目标，包括操作前已停用的目标；不保存或恢复之前的启用状态。

Host 只保留一个 `OperationQueue`，串行执行 UI 与工具请求。操作核对原生应用结果，再通过宿主 ConfigEditor 保存偏好；失败明确返回原因，可再次执行以重新应用。卸载关闭队列并停止后续写入，不等待正在申请热重载锁的操作。配置事件只读，不在 apply、配置事件或外层 HMR 事务里嵌套写入配置。

配置与模块变更都通过宿主服务完成，不手写 profile，也不建立事务、回滚框架或持久化恢复记录。原生启停由 profile 持久化，Mod 卸载不会自动启用目标；使用注意事项见[安装与使用](development.md#安装与使用)。目标范围见[精简官方登录与模型接入](account-blocking.md)与[反馈与遥测精简](telemetry-blocking.md)。页面只显示开关和操作错误，不订阅后台精简状态。工具调用时可按需读取遥测模块状态。

Todo 使用独立 `blockTodo`。全局条目复用 `PluginPolicy`，模式内条目通过 ConfigEditor 启停；旧代际 Agent 使用原生 Tools 限制与执行 guard。关闭释放限制，卸载不自动启用已停用条目；已有会话恢复、配置覆盖与界面边界见 [精简Todo工具](todo-blocking.md)。

搜索使用独立 `blockOfficialSearch`。`SearchPolicy` 只切换活动的全局与模式内 `tool-web.config.search`，保留抓取及启停标记，通过原生 guard 和 Agent 限制覆盖旧代际；范围与恢复说明见[精简官方搜索](search-blocking.md)。

## 侧栏接入

设置页与图标使用 `settings.section`、`settings.section.icon`。版本标记、外观与刷新按钮共用 `sidebar.footer.action` 中独立追加的零高度满宽容器 `power-dsh-footer`，固定定位且不新增底部行。外观按钮与设置同排，连接异常、重连、恢复提示及更新状态期间让位隐藏；状态来自原生连接服务和桌面更新桥，不读取其他插件 DOM，不替换品牌、设置或账号 launcher。刷新直接重载当前页面，具体边界见[刷新界面](refresh-button.md)。

版本从 Host `clientModules.graph().release.version` 或 Client `window.__DSH_BOOT__.release.version` 读取，不硬编码 Mod 版本或更新目标版本。标记只测量自身容器宽度，在展开侧栏品牌右下方固定定位；桌面点击调用 `window.dshDesktop.updates.open()`，缺少协议兼容的更新桥时只显示版本。点击语义见[安装与使用](development.md#安装与使用)。

版本定位包含 macOS 与 Windows 标题栏偏移，其他平台使用默认位置；这些值是当前布局适配，不是跨平台对齐保证。侧栏宽度、窗口缩放、系统标题栏和宿主布局变化后需实际验收。外观按钮的定位、原生 theme service 与 sprite 接入见[外观快捷切换](appearance-shortcut.md)。

## 重启应用

新增 `showRestartButton`，默认 `false`，由宿主 settings 独立持久化；Client 的设置保存只改变偏好，不执行重启。Client 的 `HeaderActions` 沿用 Mod 自有侧栏追加容器，在顶部使用原生横向 `ellipsis-outline` 图标与公共 `Menu` 统一承载刷新和重启；菜单只占一个位置，刷新在上、重启在下，两个开关独立控制入口，侧栏收起关闭菜单与确认。重启项沿用当前实现的环境能力限制，设置仍可保存，不加入平台常驻警告。

点击先使用宿主公共 `Modal` 与 `Button` 确认，提示停止任务和未保存内容风险，再由 owner-only Host RPC 校验能力并执行。状态 RPC 返回 `supported`、`running`、`error`，当前 Host 存活时读回助手取消、超时或错误；请求进行中禁止重复提交，页面断连不能作为重启成功依据。

本机 `0.2.2-rc.1` ASAR preload / main 源码未发现公开 restart bridge。确定由 Host 校验当前 `.app` 路径及 `com.deepseek.dsh` bundle 身份，再拉起 detached `/usr/bin/osascript` 外部助手，graceful quit 并保留宿主退出确认；确认当前应用退出后才由 `/usr/bin/open` 重开同一路径。取消、退出失败或等待超时不强杀、不重开；已启动的助手独立于 Host 正常退出，完成或取消后自行结束。当前源码已实现，尚未安装或验收实际页面、完整应用退出与重开，详见[重启应用](restart-button.md)。

## 生命周期与扩展

注册、监听和观察器归属 Cordis context，组件样式随卸载移除。只使用独立 id 追加扩展，不复用宿主 id 替换已有功能。

按真实用户能力拆模块；有多个实际场景再提取共享逻辑，不预建模块框架。涉及业务数据时以宿主事实和服务为准，凭据交给宿主凭据服务，操作由 Host 统一实现。错误、取消和不可用应显式返回。

依赖与兼容约束依据目标运行时验证，不为绕过版本检查移除必要限制或默认豁免。验证层次与当前限制见[开发指南](development.md#验证方法与限制)。
