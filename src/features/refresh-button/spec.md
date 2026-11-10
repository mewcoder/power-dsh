# 刷新界面

模块 id：`refresh-button`；主开关 `showRefreshButton` 默认 `false`。模块的[定义](definition.ts)、[配置](config.ts)、[Client](client.ts)与[行为测试](tests/)在本目录维护。

入口：**设置 → PowerDSH → 其他 → 显示刷新按钮**，默认关闭，说明：「重新加载当前界面。」开关只决定按钮显隐，不触发刷新。侧栏展开时，顶部显示横向三点「更多操作」菜单；开启本项后，菜单中显示「刷新界面」。收起或隐藏侧栏时菜单隐藏，两项入口均关闭或不可用时不显示空菜单。

## 行为

点击直接调用浏览器 `window.location.reload()`，重新加载当前地址。Mod 不调用插件 HMR、不停止任务、不退出应用，也不重新启动 Host。前端重新建立连接，后台任务继续由现有 Host 管理；前端插件独自拥有、随页面销毁的工作不保证保留。

草稿恢复完全沿用 DSH 原有机制，不额外保存、读取或清空输入内容，不额外判断发送状态、附件和弹窗。浏览器原生的 `beforeunload` 导航确认照常生效；未保存内容、未发送附件及尚未得到 Host 接受的消息可能受页面重载影响，请先完成发送或保存。会话选择和滚动位置沿用宿主自身的恢复行为，不保证精确恢复。

刷新不会主动应用 Host 插件代码更新，也不包装或改写宿主资源路由。插件安装、停用、升级后存在旧启动清单或资源修订不匹配时，按宿主提示处理；本功能不承诺代替应用重启。调用重载失败时在按钮旁显示错误，可再次点击。

刷新失败沿用菜单旁的紧凑位置，内部复用[统一错误反馈](../../../docs/error-handling.md)，提供错误信息与复制；不自动刷新。

## 接入与定位

按钮与其他侧栏增强共用原生 `sidebar.footer.action` 追加容器，不替换已有控件。当前宿主没有对应的顶部按钮 slot。macOS 只测量 Mod 自身容器，水平位置为其右边减 60px，28px 命中区，与非全屏收起按钮的命中区间距约 4px，顶部为 11px；普通 Web 顶部为 12px。

Windows 桌面的收起按钮位于标题栏左侧 12px、宽 28px，三点入口放在其右侧 4px，即 `left:44px`，顶部为 `(原生标题栏高度 − 28px) / 2`。位置不依赖原生“应用／编辑”菜单的宽度、挂载时机或侧栏宽度，不再读取 `[data-windows-menu]` 边界。为避免与原生菜单重叠，仅在 `html[data-windows-titlebar]:has(.power-dsh-header-menu)` 上设置宿主已有变量 `--dsh-windows-menu-start:80px`，让原生菜单接在三点入口后并留 8px 间距；这是本次位置修正所需的局部布局例外，不访问 Shadow DOM 或修改原生节点。侧栏收起、入口关闭或组件卸载后移除入口与样式，恢复原生菜单位置。错误提示放在标题栏下方。

刷新和[重启应用](../restart-button/spec.md)共用一个横向三点菜单入口，位置沿用原有单按钮坐标，不再为两项入口额外占宽。菜单按「刷新界面」「重启应用」排序，两个开关仍独立持久化；打开或关闭菜单不触发任何操作。菜单使用宿主公共 `Menu`，保留原生键盘导航、Escape 和点击外部关闭行为。只展示已开启且当前可用的项；当前重启实现的能力范围见专项文档。

样式限定在 Mod 拥有的元素，设置 `no-drag`，点击停止传播。

菜单触发按钮引用宿主横向 `ellipsis-outline` Medium sprite，沿用主题颜色与焦点 token。观察器、resize 监听与样式在隐藏或卸载时释放。定位是当前布局适配值，平台、缩放、全屏和宿主布局变化仍需实际页面验收。

## 参考与验证

参考 [dsh-page-refresh](https://github.com/day-day-dream/dsh-page-refresh)（`251fbbd`）与 [dsh-refresh-restart](https://github.com/hulibuld/dsh-refresh-restart)（`3228af3`）的原生页面重载行为；对照 [dsh-unlag](https://github.com/regrevia/dsh-unlag)（`f013115`）后，不引入它的插件热重载、输入状态拦截和资源路由包装。

实现依据包括已安装 DSH 0.2.2-rc.1 的侧栏 slot、`wide` owner props 和 Desktop preload 原生菜单。本次 Windows 位置修正另核对官方参考源码 `fcc0ad46`（合并 0.2.2-rc.1 发布分支）的 `SidebarRoot.module.css` 中按钮 `left:12px`、宽 28px，以及 `preload-menu.ts` 对 `--dsh-windows-menu-start` 的使用。本次未提供可调用的 Cordis Inspect 工具，采用上述源码依据；不代表运行时 Inspect 或实际页面验收。仓库检查覆盖设置、显隐、点击调用、Windows 原生菜单延迟挂载、宽度扩大、移除、重新挂载时入口仍紧邻侧栏按钮，以及隐藏与卸载清理；真实 Windows 窗口的缩放、标题栏遮挡与视觉位置，以及刷新后后台任务继续、草稿恢复和原生导航确认尚需实际页面验证。
