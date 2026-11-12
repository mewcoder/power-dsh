# 任务通知

模块 id：`notifications`；主开关 `notificationsEnabled` 默认 `false`。模块的[定义](definition.ts)、[配置](config.ts)、[Client](client.ts)与[行为测试](tests/)在本目录维护。

## 入口与范围

在 **设置 → PowerDSH → 通用** 开启「任务通知」。主开关 `notificationsEnabled` 默认 `false`；其下「通知声音」使用独立的 `notificationSoundEnabled`，默认 `true`，声音开关单独一行，开启后下方展开「提示音」选择与小播放图标，关闭时只保留开关行；提示音使用 `notificationSound`，默认 `'default'`。选中后先保存再自动试听，重复选择当前声音也可重听，小播放图标提供单独试听。三项均由宿主设置持久化。任务通知说明固定为「任务完成、失败或需要确认时发送桌面通知」；「通知声音」只保留一句说明「开启任务通知提示音」；「提示音」行说明为「选择系统提示音」，操作错误按对应行显示。关闭任务通知后，隐藏通知声音开关、提示音选择和试听控件，保留声音偏好；关闭声音后隐藏下拉和播放图标，仅保留声音开关。不开独立设置页或常驻按钮。

| 触发 | 通知 | 前台行为 |
| --- | --- | --- |
| 一轮正常完成 | 任务已完成 | 对应会话正在眼前时不提醒 |
| 一轮出错 | 任务出错 | 对应会话正在眼前时不提醒 |
| 等待输入或方案确认 | 等待输入 | 始终提醒 |
| 请求人工审批 | 请求审批 | 始终提醒 |

「正在眼前」同时要求对应会话由原生 `mainView` 保留、页面可见且文档有焦点。切到其他会话、其他窗口或后台后，完成与出错仍可提醒。子代理结束不单独通知；中止、达到 Token 上限、恢复中断和分叉结束不视为正常完成。提问或审批已有提醒时，同轮阻塞结束不重复提示；只读问题回顾不触发提醒。

## 权限与显示

权限、声音目录及播放失败复用[统一错误反馈](../../../docs/error-handling.md)，在相关设置行提供错误信息与复制，并关联控件。只对声音目录读取提供重试，不通过错误详情重复发送系统通知或自动重放试听。

本机 Windows 桌面端使用 Host 的 PowerShell 5.1 / WinRT Toast，不依赖 renderer 的 Web Notification 权限。其他环境点击开启开关时申请浏览器 `Notification` 权限，获得授权后保存开启状态；拒绝授权或环境不支持时保留关闭状态并显示行内错误。已有开启状态遇到权限失效时显示恢复提示；重新授权需使用浏览器站点权限或系统通知设置。

浏览器路径的四类任务通知均设置 `renotify: true`，与声音偏好独立，请求支持该参数的浏览器重新提醒。声音开启且选择「系统默认」时，通知省略 `silent`，声音由操作系统通知设置决定；试听也发送一条真实浏览器通知。选择其他本机提示音时，通知同时设置 `renotify: true` 与 `silent: true`，Host 单独播放所选系统声音，避免双响。关闭声音时同样保留 `renotify: true` 并设置 `silent: true`。声音偏好只决定声音，不应取消横幅的重新提醒；偏好即时生效，不补发通知。通知 API 语义见 [Notification 构造参数](https://developer.mozilla.org/en-US/docs/Web/API/Notification/Notification#parameters)。标题区分上述四类状态，正文显示有界会话标题；点击通知只尝试聚焦窗口并关闭该通知，不承诺跳转到对应轮次。

浏览器路径的每条任务通知及系统默认声音试听生成独立短 tag，按会话跟踪通知对象并清理。0.0.4 的独立 tag 与 `renotify` 处理仍不足以解决 Win11 24H2 / DSH `0.2.2-rc.2` 的实测横幅抑制，不能再将 tag 重名解释为全部根因。

本机 Windows 桌面端由 Client 保持原有触发与去重，经 owner-only RPC 交给 Host，使用宿主 subprocess 托管 PowerShell 5.1，通过 WinRT `CreateToastNotifier(appId).Show()` 显示。应用标识优先取 Host 的 `DSH_APP_USER_MODEL_ID`，缺失时采用已核对官方 Windows 打包配置的 `com.deepseek.dsh`；不注册系统身份、不改通知权限或注册表。每个 Client 使用独立的短 group，同一会话复用该 group 内的短 tag；显式设置原生 `SuppressPopup = false`。移除会话时仅清除对应 tag，关闭、重连及卸载时清理所属 group，不清空整个 DSH 的通知历史。操作按顺序执行，过期请求不补发；Host 停用时取消当前进程，并尽力清理已登记的 group。启动进程不使用 `detached: true`，不安装模块或现场编译程序。

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
