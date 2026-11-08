# AI 协作入口

先读 [README.md](README.md) 确认定位与使用入口，通过[更新日志](CHANGELOG.md)确认对应版本的功能，再检查已有文件与工作区改动，按任务读取所需文档：

| 任务 | 阅读 |
| --- | --- |
| 定位、功能取舍与范围 | [产品规范](docs/product.md) |
| 页面、组件、文案与交互 | [UI 规范](docs/ui.md) |
| Bundle、Host/Client、状态与资源 | [架构规范](docs/architecture.md) |
| 开发前市场检索、参考源码、接口发现、检查、安装与交付 | [开发指南](docs/development.md) |
| 宿主版本、接口依赖、兼容矩阵与升级验证 | [版本兼容性](docs/compatibility.md) |
| 版本发布、市场收录与后续更新 | [发布与升级](docs/releasing.md) |
| 具体功能边界 | [精简官方登录与模型接入](docs/account-blocking.md)、[精简官方搜索](docs/search-blocking.md)、[外观快捷切换](docs/appearance-shortcut.md)、[刷新界面](docs/refresh-button.md)、[重启应用](docs/restart-button.md)、[任务通知](docs/notifications.md)、[反馈与遥测精简](docs/telemetry-blocking.md)、[精简Todo工具](docs/todo-blocking.md)、[个性化](docs/personalization.md)、[技能管理](docs/skills.md)、[MCP 管理](docs/mcp.md) |

## 关键约束

- 用户明确任务优先；未确定的功能不视为已批准。保持社区身份，功能与界面清爽、克制、原生一致。
- 每项增强提供独立、持久化开关，集中在 **设置 → PowerDSH**。保留用户确认的简洁文案，变更公共约定时同步对应文档。
- 全屏设置已撤销，不重新引入该功能、开关或宿主布局覆盖。
- 优先使用宿主 slot、service、主题 token 和 locale。不要替换根节点、覆盖宿主布局、注入全局 CSS、查询其他插件 DOM 或运行时导入内部 UI 组件。
- 编写或配置插件前发现当前 API：先 `cordis_inspect_list`，再定向 `cordis_inspect_query`。Inspect 只用于发现；不猜方法、事件、props 或兼容性。参考源码与目标运行时的优先级见[开发指南](docs/development.md#源码与接口发现)。
- 注册、监听和其他副作用随 context 卸载释放。配置通过宿主服务保存；开启精简停用匹配目标，关闭精简启用匹配目标，不记忆之前的启用状态；每次操作核对应用结果，页面只保留开关与操作错误提示。
- 不手写用户 profile manifest 或 patch。仅在任务授权安装或运行预览时通过原生管理机制修改 profile。
- 不加入未要求的依赖、框架、演示功能或发布流程；不提交凭据、机器绝对路径或个人运行日志。不擅自提交、推送、发布或创建远端仓库。

## 验证与维护

运行 `npm run check`，再按影响执行[分层验证](docs/development.md#验证方法与限制)。纯文档修改无需安装插件。交付时分清静态检查、安装应用、Client 注册与实际页面验证，说明未验证部分。

长期规则只写入对应主题文档；本文件保留协作入口和关键约束。
