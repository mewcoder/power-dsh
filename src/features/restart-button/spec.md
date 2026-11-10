# 重启应用

模块 id：`restart-button`；主开关 `showRestartButton` 默认 `false`。模块的[定义](definition.ts)、[配置](config.ts)、[Client](client.ts)与[行为测试](tests/)在本目录维护。

本文是重启按钮的行为规格。源码已实现，实际页面与完整应用重启尚未验收；已有历史版本矩阵不覆盖本功能。

## 入口与显隐

入口：**设置 → PowerDSH → 其他 → 显示重启按钮**，固定说明：「重新启动应用」。新增独立布尔配置 `showRestartButton`，默认 `false`，通过宿主 settings 持久化，与刷新按钮及其他开关互不联动。保存开关只改变偏好，不触发重启。

重启设置行仅在 macOS 打包桌面端显示，位于其他分类的界面刷新之后；菜单入口仍须由 Host 确认平台及当前应用身份。Windows、Linux、普通 Web、CLI 不显示重启设置行与菜单入口；macOS 打包桌面端无法校验当前应用身份时不显示菜单入口。隐藏只影响入口，不清除 `showRestartButton` 等已保存偏好或状态，也不增加平台警告常驻文案。普通浏览器即使连接本机 macOS Host，也不显示重启设置行与菜单入口。

侧栏展开且开关开启、能力确认可用时，顶部横向三点「更多操作」菜单中显示「重启应用」。菜单按刷新、重启排序，两项原有开关独立控制各自入口；只开启一项时仍用同一个三点入口。侧栏收起或隐藏时菜单和确认弹窗一起关闭，不触发操作。

## 确认与操作

1. 在菜单选择「重启应用」后，先打开宿主共享模块的 `Modal`，标题为「重启应用」，说明为「运行中的任务会停止，未保存的内容可能丢失。」；底部复用 `Button`，左侧 outline「取消」、右侧 primary「重启应用」。默认聚焦取消，关闭图标、遮罩和 Escape 交给原生 `Modal`，关闭后由其恢复焦点。取消时不发送重启请求、不启动助手；只有点击重启才确认，重复或已失效的弹窗回调不能触发操作。
2. 用户确认后才向 Host 请求重启。保留 DSH 宿主原有退出确认，不绕过、不自动接受；用户仍可取消退出。
3. Host 重新核对平台、打包应用身份与当前操作状态，再启动外部助手。请求进行中禁止重复点击，取消或失败后允许重试。
4. 助手只请求应用正常退出，等待当前已校验应用真正退出后才重新打开。同一次请求中任一确认取消、退出失败或等待超时，均结束本次操作，不强杀、不重开，也不在之后延迟补开。

状态 RPC 向 Client 提供 `supported`、`running` 和 `error`，不把已受理当作重启完成。按钮每 2 秒查询助手状态；当前 Host 仍存活时，通过状态读回反馈助手退出失败、取消或超时，并在按钮旁显示必要的行内提示；页面断连本身不能证明重启成功。应用已退出后的重开失败无法通过已关闭的页面反馈；当前未提供跨重启持久化诊断，不能保证自动恢复或宣称重启成功。

失败反馈沿用菜单旁的紧凑位置，内部复用[统一错误反馈](../../../docs/error-handling.md)，提供错误信息与复制；不会自动再次启动助手。普通 Host 日志不补足跨重启持久化诊断。

## macOS 退出与重开

本机 DSH `0.2.2-rc.1` 的原生故障恢复窗口通过桌面主进程停止后端，再调用 Electron `app.relaunch()` 与正常退出流程，属于跨平台的整应用重启。安装包公开 preload 与 Host IPC 均未提供插件可调用的 restart bridge，不能把内部原生动作当作已公开的插件接口，也不通过伪造启动失败来触发恢复窗口。用户确认继续保留独立于 Host 生命周期的 detached `/usr/bin/osascript` 助手方案，不修改 DSH 宿主。

Host 从当前打包进程定位真实 `.app` 路径，并核对 bundle 标识为 `com.deepseek.dsh`；不能只凭 `.app` 后缀、应用名称或 Client 提供的路径认定目标。退出与重开始终绑定本次校验的同一路径，不接受用户传入任意命令或应用路径，也不按 bundle ID 回退打开另一份安装。

助手对该应用发起 graceful quit，保留宿主退出确认；退出 Apple event 最多等待 120 秒，调用返回后最多再等待 30 秒确认实际退出。用户取消、系统拒绝或退出等待超时即停止，不发送 SIGTERM/SIGKILL，不暴露强杀选项。只有确认该应用退出后，才使用固定 `/usr/bin/open` 重开已校验的同一路径；不能以请求发送成功或等待了一段时间代替退出确认。外部助手须能在 Host 正常退出后继续完成这一次重开，并在操作结束时自行退出。

重启目标是整个 DSH 桌面应用，不能用页面 reload、插件 HMR 或单独结束 Host 代替。任务恢复、草稿和会话恢复沿用宿主行为，不承诺恢复未保存内容。

## 接入与生命周期

Client 的 `HeaderActions` 延续现有 `sidebar.footer.action` 的 Mod 自有追加容器及侧栏展开状态，不查询其他插件 DOM、替换顶部控件或覆盖宿主布局。触发按钮引用原生横向 `ellipsis-outline` Medium sprite，提供「更多操作」可访问名称与展开状态，设置 `no-drag` 并停止点击传播；公共 `Menu` 负责菜单导航和关闭。刷新单开、重启单开或两者同开均使用同一个位置；助手运行时仅禁用重启项，刷新项仍可使用。

Host 操作采用 owner-only RPC，能力探测与执行均校验当前环境。配置保存与重启执行分开；普通设置写入不启动助手。状态订阅、定时器、监听与 Client 样式归属 context，卸载后停止新请求和页面观察；尚未交接的助手在清理时可取消，已明确点击并完成交接的单次助手独立完成或取消，不因 Host 正常退出而丢失重开步骤。

## 参考与验证

确认弹窗直接复用公共 `Modal` 与 `Button`，参照 DSH 原生 [插件卸载确认](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-plugin-manager/src/client/PluginManagerPage.tsx)。本机 `0.2.2-rc.1` Web shell 安装产物已核对两者公共导出、Modal 的 `open/onClose/title/closeLabel/description/footer`、`data-modal-autofocus` 及 Button 的 `variant`，未使用仅在较新源码中出现的 `tone` 参数；这些源码核对不代表实际页面验收。

参考已有 [hulibuld/dsh-refresh-restart](https://github.com/hulibuld/dsh-refresh-restart/tree/3228af3fc3bcc27eb5b290831e43e5734d85901d)（本地 `reference/hulibuld/dsh-refresh-restart`，提交 `3228af3`，MIT），已阅读 `lib/restart.js`、`lib/platform.js`、Client 交互和许可证。仅借鉴外部助手、先退出再重开、取消退出不重开的思路，不复制代码；该参考的跨平台方案、强杀选项、DOM 接入和按 bundle ID 重开回退不属于本功能范围。

另外核对了同类插件源码：[anweat/dsh-restart](https://github.com/anweat/dsh-restart/tree/556e4b4f60702c505863e1533a96b2166932b33d) 重开 Host 进程；[Ray1270/dsh-restart](https://github.com/Ray1270/dsh-restart/tree/dfb4168f2b51f8890373e1ce4761f5de16e8b093) 使用 Windows WMI / PowerShell 助手；[hadesybil-hub/dsh-restart-button](https://github.com/hadesybil-hub/dsh-restart-button/tree/e97171e7db14f7c4bfcf04249450ba0f9eed1dac) 当前只退出、不重开；[7gzgn/dsh-restart-dock](https://github.com/7gzgn/dsh-restart-dock/tree/308cae353be22472e8af0b2c949e052afc86520a) 的重启操作仅支持 Windows。它们未提供可替代本次 macOS 助手的公开桌面重启接口，未安装或运行这些插件。

[Client 行为测试](tests/client.test.mjs)覆盖共享菜单、完整侧栏入口渲染、独立开关、确认与取消、重复及失效回调、隐藏后撤销和失败重试；[Host 重启测试](tests/restart.test.mjs)覆盖平台、应用身份、固定参数、取消、失败与卸载边界。原生组件的焦点约束与 Escape 行为仅核对过安装产物，尚未在实际页面验收。助手 AppleScript 已有 `osacompile` 编译检查证据，但未执行完整退出与重开；不能据此认定重启成功。旧版 SDK / Host 装配矩阵不包含本功能，不能沿用为重启兼容性结论。

后续验收应分别记录：

- 静态与隔离检查：默认值与独立持久化、能力判断、应用身份与路径校验、固定命令及参数、状态 RPC、重复请求抑制、取消与超时不强杀不重开。
- 实际 macOS 打包桌面页面：设置行可见且紧随界面刷新、设置文案、中英文与主题、键盘焦点、菜单按 Host 能力确认显隐、刷新/重启单开和同开顺序、侧栏收起隐藏、公共确认弹窗取消、宿主退出确认取消。
- 经另行授权的完整应用操作：graceful quit、真实退出后重开同一路径、退出超时与失败反馈、重新启动后偏好保留及助手终止；逐项区分请求受理、退出、重开和实际可用。
- Windows、Linux 与普通 Web：重启设置行与菜单入口均隐藏、已有偏好和状态保留、无平台警告常驻文案；普通浏览器连接 macOS Host 仍隐藏，不能用 macOS 结果外推其他环境。
