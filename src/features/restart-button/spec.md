# 重启应用

模块 id：`restart-button`；主开关 `showRestartButton` 默认 `false`。模块的[定义](definition.ts)、[配置](config.ts)、[Client](client.ts)与[行为测试](tests/)在本目录维护。

本文是重启按钮的行为规格。源码已实现，实际页面与完整应用重启尚未验收；已有历史版本矩阵不覆盖本功能。

## 入口与显隐

入口：**设置 → PowerDSH → 其他 → 显示重启按钮**，固定说明：「重新启动应用」。新增独立布尔配置 `showRestartButton`，默认 `false`，通过宿主 settings 持久化，与刷新按钮及其他开关互不联动。保存开关只改变偏好，不触发重启。

重启设置行在 macOS、Windows 打包桌面端显示，位于其他分类的界面刷新之后；菜单入口仍须由 Host 确认平台及当前应用身份。Linux、普通 Web、CLI 不显示重启设置行与菜单入口；无法校验当前应用身份时不显示菜单入口。隐藏只影响入口，不清除 `showRestartButton` 等已保存偏好或状态，也不增加平台警告常驻文案。普通浏览器即使连接本机桌面 Host，也不显示重启设置行与菜单入口；桌面页面还须确认 `connection.isLoopback`，不重启远端 Host。

侧栏展开且开关开启、能力确认可用时，顶部横向三点「更多操作」菜单中显示「重启应用」。菜单按刷新、重启排序，两项原有开关独立控制各自入口；只开启一项时仍用同一个三点入口。侧栏收起或隐藏时菜单和确认弹窗一起关闭，不触发操作。

插件更新成功且需要完整重启时，更新行另提供独立的「重启应用」入口，行为由[插件更新 Spec](../plugin-updates/spec.md)维护。该入口通过单独 owner-only `restartAfterUpdate` 请求复用同一个重启服务，绕过的仅是侧栏按钮显隐偏好；不修改该偏好、不放宽平台、应用身份、单次交接、超时或卸载校验。普通菜单 `restartApp` 继续在交接前核对开关。

## 确认与操作

1. 在菜单选择「重启应用」后，先打开宿主共享模块的 `Modal`，标题为「重启应用」，说明为「运行中的任务会停止，未保存的内容可能丢失。」；底部复用 `Button`，左侧 outline「取消」、右侧 primary「重启应用」。默认聚焦取消，关闭图标、遮罩和 Escape 交给原生 `Modal`，关闭后由其恢复焦点。取消时不发送重启请求、不启动助手；只有点击重启才确认，重复或已失效的弹窗回调不能触发操作。
2. 用户确认后才向 Host 请求重启。macOS 保留 DSH 宿主原有退出确认。Windows 确认文案明确说明「将强制关闭当前 DSH 及其子进程后重新打开，运行中的任务会停止，未保存的内容可能丢失。」；Windows 不再承诺另有宿主退出确认。
3. Host 重新核对平台、打包应用身份与当前操作状态，再启动外部助手。请求进行中禁止重复点击，取消或失败后允许重试。
4. macOS 助手请求应用正常退出，取消或超时不强杀、不重开。Windows 仅在明确确认且助手交接完成后结束已校验的当前应用进程树；退出失败或等待超时停止，不重开，不自动重复请求。

状态 RPC 向 Client 提供 `supported`、`running` 和 `error`，不把已受理当作重启完成。按钮每 2 秒查询助手状态；当前 Host 仍存活时，通过状态读回反馈助手退出失败、取消或超时，并在按钮旁显示必要的行内提示；页面断连本身不能证明重启成功。应用已退出后的重开失败无法通过已关闭的页面反馈；当前未提供跨重启持久化诊断，不能保证自动恢复或宣称重启成功。

失败反馈沿用菜单旁的紧凑位置，内部复用[统一错误反馈](../../../docs/error-handling.md)，提供错误信息与复制；不会自动再次启动助手。普通 Host 日志不补足跨重启持久化诊断。

## macOS 退出与重开

本机 DSH `0.2.2-rc.1` 的原生故障恢复窗口通过桌面主进程停止后端，再调用 Electron `app.relaunch()` 与正常退出流程，属于跨平台的整应用重启。安装包公开 preload 与 Host IPC 均未提供插件可调用的 restart bridge，不能把内部原生动作当作已公开的插件接口，也不通过伪造启动失败来触发恢复窗口。用户确认继续保留独立于 Host 生命周期的 detached `/usr/bin/osascript` 助手方案，不修改 DSH 宿主。

Host 从当前打包进程定位真实 `.app` 路径，并核对 bundle 标识为 `com.deepseek.dsh`；不能只凭 `.app` 后缀、应用名称或 Client 提供的路径认定目标。退出与重开始终绑定本次校验的同一路径，不接受用户传入任意命令或应用路径，也不按 bundle ID 回退打开另一份安装。

助手对该应用发起 graceful quit，保留宿主退出确认；退出 Apple event 最多等待 120 秒，调用返回后最多再等待 30 秒确认实际退出。用户取消、系统拒绝或退出等待超时即停止，不发送 SIGTERM/SIGKILL，不暴露强杀选项。只有确认该应用退出后，才使用固定 `/usr/bin/open` 重开已校验的同一路径；不能以请求发送成功或等待了一段时间代替退出确认。外部助手须能在 Host 正常退出后继续完成这一次重开，并在操作结束时自行退出。

重启目标是整个 DSH 桌面应用，不能用页面 reload、插件 HMR 或单独结束 Host 代替。任务恢复、草稿和会话恢复沿用宿主行为，不承诺恢复未保存内容。

## Windows 退出与重开

Windows 路径使用系统 Windows PowerShell 5.1 与 Explorer，不新增依赖、不修改 DSH 安装包、不注册计划任务。Host 使用 `DSH_CLIENT_VERSION`、当前 executable、可执行文件产品名 `DeepSeek Harness` 和 CIM 进程祖先链核对当前桌面主进程；要求当前 Host 与主进程的可执行路径一致，主进程不能是 renderer／utility 子进程。绑定主进程及 Host 的 PID、路径、创建时间，拒绝同名不同路径、PID 复用、异常祖先链、普通 Node 和未打包环境。能力探测仅只读查询，最长 10 秒，结果缓存 30 秒；实际重启始终重新探测。

确认后 Host 在随机临时目录写入一次性请求和固定 PowerShell 助手，通过临时快捷方式交给 Explorer 启动。助手检查自身不属于目标进程树，再写入带随机标识的 ready 状态；Host 最多等待 8 秒，并再次核对开关与生命周期后原子写入本次授权。助手最多等待授权 12 秒，未得到匹配授权自行结束；交接失败、取消或交接前卸载不结束任何 DSH 进程，不退回不可靠的普通 detached 子进程。

授权后助手重新核对当前主进程和 Host 身份，枚举当前主进程树，使用系统 `taskkill /PID <本次主进程> /T /F` 结束这一实例；不按进程名全局结束，也不对其他安装或独立实例执行操作。先持有旧主进程句柄确认其退出（最多 20 秒），再核对原进程树中带创建时间的进程已经结束（最多 10 秒），失败不打开第二份应用。随后创建指向已验证同一路径、安装目录及普通窗口状态的临时应用快捷方式，交给 Explorer 重开；不从 PowerShell 直接启动应用，避免新实例继承助手控制台。助手移除 Electron Node 模式及 Node 注入环境，不等待新应用退出；最多 25 秒只读核对新主进程是否出现，随后结束并清理本次临时目录。新进程出现不等于页面、任务恢复或完整启动验收。

请求的绝对有效期为 90 秒，助手在结束进程和重新打开前都核对有效期，不在过期后补执行。运行结果只保留固定阶段及随机标识，不写原始进程输出、配置、会话内容或诊断日志。临时目录在助手结束时清理，未交接的失败由 Host 清理。已提交的单次助手保留跨 Host 退出生命周期；旧 Host 若仍存活且发现助手失败、结束或过期，显示固定失败并允许再次确认，不能把投递受理称为重启成功。应用已经退出而重新打开失败时仍可能需要手动启动，插件不自动无限重试。

该流程依据宿主 `0.2.2-rc.2` 的关窗隐藏行为及同类插件的 Explorer 外部交接思路设计。Windows 桌面真实关闭、重开与偏好恢复仍需 Windows 实机验收；macOS 上的脚本解析、模拟进程查询和 Client 测试不替代此结果。

2026-11-13 用户反馈 Windows 重开后出现命令行窗口，窗口内有更新检查连接被拒绝及本地 Web 服务启动日志，且窗口未自动关闭。重开路径已改为上述 Explorer 应用快捷方式；这些日志不作为插件重启失败的判据，宿主更新网络错误不通过关闭更新功能或吞掉错误处理。本次尚未取得修正后 Windows 实机结果。

## 接入与生命周期

Client 的 `HeaderActions` 延续现有 `sidebar.footer.action` 的 Mod 自有追加容器及侧栏展开状态，不查询其他插件 DOM、替换顶部控件或覆盖宿主布局。触发按钮引用原生横向 `ellipsis-outline` Medium sprite，提供「更多操作」可访问名称与展开状态，设置 `no-drag` 并停止点击传播；公共 `Menu` 负责菜单导航和关闭。刷新单开、重启单开或两者同开均使用同一个位置；助手运行时仅禁用重启项，刷新项仍可使用。

Host 操作采用 owner-only RPC，能力探测与执行均校验当前环境。配置保存与重启执行分开；普通设置写入不启动助手。状态订阅、定时器、监听与 Client 样式归属 context，卸载后停止新请求和页面观察；尚未交接的助手在清理时可取消，已明确点击并完成交接的单次助手独立完成或取消，不因 Host 正常退出而丢失重开步骤。

## 参考与验证

确认弹窗直接复用公共 `Modal` 与 `Button`，参照 DSH 原生 [插件卸载确认](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/src/client/PluginManagerPage.tsx)。本机 `0.2.2-rc.1` Web shell 安装产物已核对两者公共导出、Modal 的 `open/onClose/title/closeLabel/description/footer`、`data-modal-autofocus` 及 Button 的 `variant`，未使用仅在较新源码中出现的 `tone` 参数；这些源码核对不代表实际页面验收。

macOS 路径参考 [hulibuld/dsh-refresh-restart](https://github.com/hulibuld/dsh-refresh-restart/tree/3228af3fc3bcc27eb5b290831e43e5734d85901d)（提交 `3228af3`，MIT），借鉴外部助手、先退出再重开、取消退出不重开的思路。Windows 路径补读同仓库 `3acfc36373cc33d0b368a0fcfc248ddb54c4587b` 的 `lib/win.js` 与 `lib/win-helper.ps1`，以及 [CZY1326/dsh-restart-button](https://github.com/CZY1326/dsh-restart-button/tree/70cb30cf54c57bbce3126d3e8d0ff1ecfc73c672)、[SMPcosy/dsh-easy2restart](https://github.com/SMPcosy/dsh-easy2restart/tree/05da56a6c876b758ffdaaa1589ce65526c3f6ee5) 的 PowerShell 重开实现。只借鉴交接与进程生命周期思路，自行实现当前实例绑定、授权与超时；不复制代码，不采用修改安装包、按名称全局强杀、计划任务、DOM 接入或按 bundle ID 重开回退。

另外核对了同类插件源码：[anweat/dsh-restart](https://github.com/anweat/dsh-restart/tree/556e4b4f60702c505863e1533a96b2166932b33d) 重开 Host 进程；[Ray1270/dsh-restart](https://github.com/Ray1270/dsh-restart/tree/dfb4168f2b51f8890373e1ce4761f5de16e8b093) 使用 Windows WMI / PowerShell 助手；[hadesybil-hub/dsh-restart-button](https://github.com/hadesybil-hub/dsh-restart-button/tree/e97171e7db14f7c4bfcf04249450ba0f9eed1dac) 当前只退出、不重开；[7gzgn/dsh-restart-dock](https://github.com/7gzgn/dsh-restart-dock/tree/308cae353be22472e8af0b2c949e052afc86520a) 的重启操作仅支持 Windows。它们未提供可替代本次 macOS 助手的公开桌面重启接口，未安装或运行这些插件。

[Client 行为测试](tests/client.test.mjs)覆盖共享菜单、完整侧栏入口渲染、独立开关、确认与取消、重复及失效回调、隐藏后撤销和失败重试；[Host 重启测试](tests/restart.test.mjs)覆盖平台、应用身份、固定参数、取消、失败与卸载边界。原生组件的焦点约束与 Escape 行为仅核对过安装产物，尚未在实际页面验收。助手 AppleScript 已有 `osacompile` 编译检查证据，但未执行完整退出与重开；不能据此认定重启成功。旧版 SDK / Host 装配矩阵不包含本功能，不能沿用为重启兼容性结论。

后续验收应分别记录：

- 静态与隔离检查：默认值与独立持久化、能力判断、应用身份与路径校验、固定命令及参数、状态 RPC、重复请求抑制；macOS 取消与超时不强杀不重开，Windows 未确认／交接失败不结束进程，退出失败不重开。
- 实际 macOS 打包桌面页面：设置行可见且紧随界面刷新、设置文案、中英文与主题、键盘焦点、菜单按 Host 能力确认显隐、刷新/重启单开和同开顺序、侧栏收起隐藏、公共确认弹窗取消、宿主退出确认取消。
- 经另行授权的完整应用操作：graceful quit、真实退出后重开同一路径、退出超时与失败反馈、重新启动后偏好保留及助手终止；逐项区分请求受理、退出、重开和实际可用。
- Windows：设置行可见、菜单按本机 Host 能力显隐、确认明确强制关闭，交接／身份失败不结束进程；完整关闭、重开、偏好恢复与助手清理需另行实机记录。Linux 与普通 Web 继续隐藏；远程 Host 不提供重启动作。
