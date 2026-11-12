# 任务通知

模块 id：`notifications`；界面使用单个「任务通知」三档选项，默认「从不提醒」。原有 `notificationsEnabled`／`notificationMode` 保留兼容存储，不再显示两个独立控件。模块的[定义](definition.ts)、[配置](config.ts)、[Client](client.ts)与[行为测试](tests/)在本目录维护。

## 入口与范围

在 **设置 → PowerDSH → 通用** 通过「任务通知」三档选项开启提醒，选择框左侧提供图标测试按钮。「通知声音」使用独立的 `notificationSoundEnabled`，默认 `true`，声音开关单独一行，开启后下方展开「提示音」选择与小播放图标，关闭时只保留开关行；提示音使用 `notificationSound`，默认 `'default'`。选中后先保存再自动试听，重复选择当前声音也可重听，小播放图标提供单独试听。各项由宿主设置持久化。任务通知说明固定为「任务完成、失败或需要确认时发送桌面通知」；「通知声音」只保留一句说明「开启任务通知提示音」；「提示音」行说明为「选择系统提示音」，操作错误按对应行显示。选择从不提醒后隐藏通知声音、提示音选择和试听控件，保留声音偏好；关闭声音后隐藏下拉和播放图标。不开独立设置页或侧栏常驻按钮。

| 触发 | 通知 | 前台行为 |
| --- | --- | --- |
| 一轮正常完成 | 任务已完成 | 由提醒时机决定 |
| 一轮出错 | 任务出错 | 由提醒时机决定 |
| 等待输入或方案确认 | 等待输入 | 由提醒时机决定 |
| 请求人工审批 | 请求审批 | 由提醒时机决定 |

「正在眼前」同时要求对应会话由原生 `mainView` 保留、页面可见且文档有焦点。切到其他会话、其他窗口或后台后，完成与出错仍可提醒。子代理结束不单独通知；中止、达到 Token 上限、恢复中断和分叉结束不视为正常完成。提问或审批已有提醒时，同轮阻塞结束不重复提示；只读问题回顾不触发提醒。

「任务通知」单个原生 Menu 提供「从不提醒／仅在未聚焦时提醒／始终提醒」。关闭状态显示「从不提醒」，选择该项关闭 `notificationsEnabled`、停止四类提醒并清理当前通知；选择另外两项先验证权限，再保存 `notificationMode` 并按需开启 `notificationsEnabled`。开启失败保持有效的关闭状态，不因只保存了策略而误启用。原有启用且 `notificationMode=never` 也读为从不提醒。默认不提醒，已有偏好按实际状态读回。规则适用于四类触发，切换不补发历史消息。保存失败显示在同一行。

## 权限与显示

权限、声音目录及播放失败复用[统一错误反馈](../../../docs/error-handling.md)，在相关设置行提供错误信息与复制，并关联控件。只对声音目录读取提供重试，不通过错误详情重复发送系统通知或自动重放试听。

本机 Windows 桌面端使用 Host 的 PowerShell 5.1 / WinRT Toast，不依赖 renderer 的 Web Notification 权限。其他环境点击开启开关时申请浏览器 `Notification` 权限，获得授权后保存开启状态；拒绝授权或环境不支持时保留关闭状态并显示行内错误。已有开启状态遇到权限失效时显示恢复提示；重新授权需使用浏览器站点权限或系统通知设置。

浏览器路径移除 `tag` 和 `renotify`，按会话保存通知对象并在替换时关闭旧对象，避免继续使用反馈指出的组合。声音开启且选择系统默认时省略 `silent`；关闭声音或选本机声音时设置 `silent: true`，本机声音单独播放。浏览器路径不再承诺按 tag 管理系统历史；点击只尝试聚焦窗口和关闭通知。标题区分四类状态，正文显示有界会话标题。

0.0.4 的独立 tag 与 `renotify` 处理仍不足以解决 Win11 24H2 / DSH `0.2.2-rc.2` 的实测横幅抑制。0.0.5 的新反馈仍描述浏览器参数和点击聚焦行为，与其新增的原生路径不同；这属于实际运行通道待确认，不能直接断言 WinRT 本身失败或用户没有更新。

本轮新增 owner-only `notificationTransport` 握手，由 Host 读真实 `process.platform`、subprocess 可用性及构建时包版本。Client 只在同机连接且 Host 确认为 Windows 时选择原生 Toast，不再依赖 `window.dshDesktop` 或 DOM 平台标记；Windows 原生能力缺失、握手失败或 Host/Client 版本不一致时明确报错，不能静默落回 renderer。连接变化重做握手、重建事件基线，不在未知通道时补发。远程连接继续使用访问者的浏览器，不向远端 Host 请求本机通知。

设置页在右侧提醒选择框的紧邻左侧提供一个图标测试按钮，与选择框组成同一操作组，不另加同名设置行或常驻通道文字；悬停与无障碍名称为「发送测试通知」。测试走真实任务发送逻辑，使用固定的无会话数据正文，允许前台手动测试，声音遵循偏好；浏览器等待 `show` 事件，五秒内未确认则显示可处理错误，关闭或卸载释放等待。收到浏览器 `show` 或原生请求成功后图标变为勾号，提示「已交给系统」，不显示“横幅已弹出”的声明；从不提醒时禁用测试。实际通道与版本保留在失败的共享诊断中，均为明确选取字段，不包含标题、路径、原始配置或命令。

本机 Windows 桌面端由 Client 保持原有触发与去重，经 owner-only RPC 交给 Host，使用宿主 subprocess 托管 PowerShell 5.1，通过 WinRT `CreateToastNotifier(appId).Show()` 显示。应用标识优先取 Host 的非空 `DSH_APP_USER_MODEL_ID`，允许真实标识中的空格；缺失时只读发现开始菜单中名称精确为 `DeepSeek Harness` 的标识及注册表中已存在的官方／Electron DSH 标识，唯一时才采用。打包配置的 `com.deepseek.dsh` 不等于当前机器已注册的通知身份，不能将它或 Electron 默认标识当作无条件回退。缺失、歧义、显式标识格式无效或通知器为空分别归为应用身份不可用，提示核对 DSH 安装／重启或由启动器提供真实标识；系统禁用通知单独提示权限，不再统一引导检查浏览器。只跨 RPC 返回固定失败原因，不传递原始进程输出。不注册系统身份、不改通知权限或注册表，也不借用 PowerShell 的通知身份。每个 Client 使用独立的短 group，同一会话复用该 group 内的短 tag；显式设置原生 `SuppressPopup = false`。移除会话时仅清除对应 tag，关闭、重连及卸载时清理所属 group，不清空整个 DSH 的通知历史。操作按顺序执行，过期请求不补发；Host 停用时取消当前进程，并尽力清理已登记的 group。启动进程不使用 `detached: true`，不安装模块或现场编译程序。

Windows 的静音设置由 Host 读实时偏好生成 Toast XML：关闭声音或选择本机提示音时使用 `<audio silent="true"/>`；本机提示音仅在 Toast 成功交接后播放，默认声音交给 Windows。默认声音试听走同一原生通道，不经 renderer。等待输入与审批请求 `scenario="reminder"`、长显示及系统关闭按钮，完成、出错和试听采用系统默认时长。浏览器路径的待交互通知继续设置 `requireInteraction: true`。浏览器通知点击只尝试聚焦窗口；原生 Toast 暂不提供点击聚焦或会话跳转。横幅、声音与驻留是否生效仍由操作系统、通知权限及专注设置决定；进程成功退出不证明用户看到了横幅。原生发送失败显示通知错误，不静默改用已知存在问题的 renderer 通道。

页面需要保持打开。首次加载、启用和重连仅建立当前基线，不补发过去的完成或待交互提醒，不提供离线重放。关闭开关或卸载 Client 后停止提醒并清理当前通知；没有独立后台推送服务。

## 本机系统提示音

macOS 从 `/System/Library/Sounds` 枚举真实常规音频文件，显示去扩展名的原名，例如 Ping、Glass；Host 只接受本次目录枚举得到的标识，重验常规文件及实际路径后由 `/usr/bin/afplay` 播放，不接受任意路径。Windows 提供固定的 `SystemDefault`、`SystemAsterisk`、`SystemExclamation`、`SystemHand`、`SystemQuestion` 五个系统声音事件，由 PowerShell 调用 WinMM `PlaySoundW`，使用同步的 `SND_ALIAS | SND_NODEFAULT | SND_SYSTEM`，声音跟随 Windows 对应事件的设置；参数依据见 [PlaySound 文档](https://learn.microsoft.com/en-us/previous-versions/dd743680(v=vs.85))。不提供用户文件上传，不附带音频资源或新增依赖。

提示音选择与原生试听仅在 Client 的 `connection.isLoopback` 为真时可用，避免普通远程访问界面让服务器播放声音；远程访问继续使用浏览器的系统默认通知声音，下拉显示「系统默认」并禁用，不显示额外限制文案或重试按钮。声音目录独立等待 connection 服务就绪，不依赖会话通知模块的初始化，也不将尚未就绪误报为远程访问。该连接标记是界面的路由判断，不代替 Host RPC 的 owner 权限限制。没有原生进程服务或平台不支持时仅提供系统默认。已保存但当前系统没有的声音显示「所选提示音不可用」，保留偏好并允许重新选择，不将失败假报为成功。

具体提示音在本机单独播放，可能不遵循通知静音或专注模式；该行为在本文说明，不作为设置行的常驻文案。下拉采用宿主公共 Menu，选择保存与试听期间禁止重复操作；保存失败不试听，播放失败保留已保存选择并显示行内错误。播放只接受固定程序与白名单参数，使用宿主 subprocess 管理执行、取消与退出，最长 10 秒，重叠请求跳过；卸载时终止当前托管进程。播放器正常退出只表示播放请求完成，是否实际听到声音仍取决于输出设备、音量与系统配置。

## 数据与生命周期

Host 的 `powerDshNotifications` 投影只将 `turn/end` 折叠为最近一轮的 `{seq, turn, reason}`，不保存历史数组、回复正文、错误详情或工具参数。结束原因接受宿主未来新增的字符串，Client 只处理已支持的触发。摘要经原生会话控制通道进入 `sessions.list`，无需打开或保留所有会话的历史。

Client 观察原生 `uiSession.sessionStatus` 的 `pendingInteraction`，以交互 key 去重并排除只读回顾；不注册审批答案、不调用提问或审批的修改方法，不改变审批结果。投影注册、订阅和显示中的通知均归属 Cordis context，卸载时释放。此功能不新增模型工具、系统提示词、会话事件或远端数据上传。

## 接口依据与验证

已核对 DSH `0.2.2-rc.1` 安装包中的会话投影、列表与控制流、原生交互状态、桌面 preload、连接 `isLoopback` 及 subprocess 的 `spawn`、取消和托管范围退出接口。原生 `turnOutline` 和 `turnBoundary` 不保存结束原因，故使用上述最小摘要；桌面公开桥未提供通用通知方法。Windows 原生通道复用已使用的 subprocess 接口，核对同版 `subprocess-local/src/spawn.ts` 的 Windows 非 detached / 隐藏窗口行为和官方 `apps/desktop/config/windows-packaging/production.env.example` 的应用标识。会话触发仍在 Client，本机 Windows 才调用 Host；其他环境继续使用浏览器 `Notification`。Inspect 本轮不可用；接口判断属于确切安装包及参考源码核对证据，不能代替实际通知验收。

[摘要测试](tests/notifications.test.mjs)覆盖已知及未来结束原因、无关事件引用稳定性、输入校验和真实 Cordis 投影的注册释放。[原生声音测试](tests/system-sounds.test.mjs)覆盖 macOS 目录枚举、跨平台 POSIX 路径、目录与参数白名单、Windows 固定脚本、配置变更、重叠请求、超时和卸载取消，不代表 Windows 实机播放已验证。[Client 测试](tests/client.test.mjs)覆盖四类触发、前台抑制、去重、浏览器通知与 Windows 原生路由、默认声音试听、会话/group 隔离、远程访问及迟到响应。[Windows Toast 测试](tests/windows-toasts.test.mjs)覆盖编码命令、XML 转义、实时声音偏好、原生参数、定向清理、停用、超时与卸载；Windows runner 另解析实际 PowerShell 脚本及 XML，但不发送通知。实际系统通知权限、横幅、关闭、声音与点击行为仍需 Windows DSH 实机验收；脚本解析及进程正常退出不等于用户看到了横幅或听到声音。验证层次见[开发指南](../../../docs/development.md#验证方法与限制)，市场参考与提交见[第三方资源声明](../../../docs/third-party-notices.md#通知插件参考)。
