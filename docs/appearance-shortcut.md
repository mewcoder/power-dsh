# 外观快捷切换

入口：**设置 → PowerDSH → 外观快捷切换**，默认关闭。说明：「在侧栏底部快捷切换外观。」开启后显示当前外观图标，点击按「浅色 → 深色 → 跟随系统」循环；title 与可访问名称说明当前和下一个模式。

## 原生状态与图标

使用 Client `theme.getTheme()`、`theme.setTheme(id)` 和 `theme/change`，主题偏好由原生服务持久化。Mod 只保存按钮显隐，不另存主题状态或轮询。根据 preference 显示图标，跟随系统始终显示显示器；原生设置、外部更改与系统变化通过服务同步。

SVG `use` 引用原生 Medium sprite：`dsw-icon-light-outline-medium`、`dsw-icon-dark-outline-medium`、`dsw-icon-followsystem-outline-medium`，16px 显示。安装包 AppearanceRow 已核对采用这三个图标；不导入内部 UI primitives，也不复制近似图形。来源见[原生图标组件](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-primitives/src/icons/index.tsx)。

## 独立定位

采用独立追加的按钮，挂载结构见[侧栏接入](architecture.md#侧栏接入)。展开侧栏时，外观按钮保持在设置行右侧，不新增一行；收起、关闭时隐藏，不注册 `settings.launcher` 或替换原生设置、头像与菜单。官方账号精简状态不影响其显隐。

32px 方形命中区固定于窗口底部 16px，左边为自身容器右边减 40px。仅测量自身容器，通过 ResizeObserver、窗口与 visualViewport resize 更新横坐标，隐藏时释放观察器与监听。点击停止传播，样式和事件只作用于插件元素，hover、焦点与颜色使用宿主 token。

原生状态提示优先使用右侧空间：连接状态订阅在独立声明 `connection` 依赖的子 context 中读取 `connection.state`，不让连接服务暂不可用阻断 Mod 设置入口、版本标记或刷新按钮。断线、重连时隐藏外观按钮；恢复 connected 后继续隐藏 3000ms，覆盖当前原生最长 800ms 重连驻留、2000ms 成功提示及 150ms 淡出。再次断线取消恢复计时，卸载清除计时和订阅。桌面协议 v1 通过 `updates.status()`、`updates.subscribe()` 获取更新展示状态；非 idle、初始读取中或读取失败时隐藏按钮，防止遮挡更新与重试提示，较晚返回的初始状态不能覆盖订阅的新值。

当前会话未提供 Inspect 工具，接口与时间依据已核对的 DSH 0.2.2-rc.1 设置外壳安装包实现。此处不是原生提示的公开可见性接口，宿主更改展示时序或底部布局后需重新核对并实际页面验收。

## 验证重点

检查三模式循环、原生设置同步、账号状态独立、收起与关闭隐藏、点击隔离、宽度变化和卸载清理。[Client 装配测试](../scripts/client-wiring.test.mjs)使用真实 Cordis 依赖检查，分别验证连接服务可用与暂不可用时设置入口持续注册，以及卸载时释放入口和监听。Client 测试与实际槽位注册不能替代浏览器点击及视觉验收，分层方法见[开发指南](development.md#验证方法与限制)。
