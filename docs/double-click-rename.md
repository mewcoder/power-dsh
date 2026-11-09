# 屏蔽双击重命名

## 入口与范围

在 **设置 → PowerDSH → 精简** 提供「屏蔽双击重命名」，说明为「屏蔽侧栏会话标题的双击重命名操作」。`blockDoubleClickRename` 默认 `false`，通过宿主 `configForms` 独立持久化；`power_dsh_settings` 也可读写同一偏好。

开启后拦截侧栏会话行的鼠标左键双击事件，使标题不再因双击打开重命名弹窗。单击打开会话、右键菜单、菜单重命名及键盘重命名保留；按钮、链接、输入框、可编辑内容及其他交互控件保留自身双击行为。不取消浏览器默认选词行为，不修改标题、权限或会话数据。关闭、配置不可用或卸载 Client 时移除捕获监听；持久偏好在再次加载 Client 后重新应用。

## 接入与例外

本机 `0.2.2-rc.1` 安装包的 `dsh-client-ui-workspace/lib/client.js` 中，`SessionNodeItem` 在内部标题 span 的 `onDoubleClick` 直接调用重命名请求；其 Host 入口没有 Config，公开 service 和 slot 未提供独立关闭双击的能力。禁用重命名权限也会影响菜单等入口，且 owner 不受非 owner 策略控制。当前运行时没有可用于包装会话行的 hoc slot。

用户已明确允许此功能读取双击事件路径中的会话行标记，作为「不查询其他插件 DOM」的唯一相关例外。Client 只遍历当前 `dblclick` 的 `composedPath()`，以 `role="treeitem"` 且 `data-row-key` 以 `session:` 开头识别会话行，再停止事件传播。监听仅在已保存的开关为开启时安装，订阅和监听随 context 释放。不扫描文档、不读取 React fiber、不依赖生成类名、不修改宿主节点或注册项，不扩大到其他事件或页面查询。将来宿主提供专用公开接口时优先迁移。

## 参考与验证

已按[开发指南](development.md#源码与接口发现)检索 [dsh-market](https://dshmarket.com/browse/)，核对 [duanyunlun/dsh-session-actions](https://github.com/duanyunlun/dsh-session-actions) 提交 `754a0f9` 的 Client 双击实现和 MIT 许可证，克隆无本地改动。该参考通过 DOM 与 React fiber 增加会话操作，不符合本项目范围；本功能独立实现事件路径识别，不复制其代码。

接口依据为 DSH `0.2.2-rc.1` 安装包的只读源码核对，未以运行时 Inspect 验证。仓库测试覆盖默认关闭、开关保存、保存失败、会话行匹配、其他行与交互控件放行、配置就绪状态切换、重复通知不重复注册、关闭和卸载释放，以及工具通过实际管理命名空间保存偏好。

实际页面、刷新后持久化、菜单与键盘交互尚未验收。旧版矩阵不包含本功能，不能由原有测试数字推定兼容。宿主若移除或改变上述会话行标记，事件不再匹配，屏蔽可能失效，需重新核对目标发行版。
