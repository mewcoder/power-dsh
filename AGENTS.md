# AI 协作入口

先读[仓库首页](README.md)与[更新日志](CHANGELOG.md)，再按[开发指南的协作流程](docs/development.md#协作流程)检查工作区、实现、验证和交付。完整主题与功能索引见[文档索引](docs/README.md)。

| 任务 | 阅读 |
| --- | --- |
| 定位、范围与功能取舍 | [产品规范](docs/product.md) |
| 页面、组件、文案与交互 | [UI 规范](docs/ui.md) |
| Bundle、Host/Client、状态与资源 | [架构规范](docs/architecture.md) |
| 目录、接口发现、检查与安装 | [开发指南](docs/development.md) |
| 宿主版本与升级验证 | [版本兼容性](docs/compatibility.md) |
| 发布、市场收录与更新 | [发布与升级](docs/releasing.md) |

## 关键约束

- 用户明确任务优先；未确定的功能不视为已批准。保护已有未提交改动，保留社区身份与已确认文案。
- 每项用户功能必须对应一份主 Spec，按[功能 Spec 规范](docs/feature-spec.md)维护；新增先明确规格，行为变更同步 Spec 与必要测试，功能与规格通过[索引](docs/README.md#功能规格spec)一一对应。
- 遵循[目录职责](docs/development.md#目录职责)：源码放在 `src/`、测试放在 `tests/`、静态资源放在 `assets/`，保持无编译步骤与现有包导出键；不为目录整理而搬动或覆盖已有参考源码。
- 每项增强提供独立、持久化开关，集中在 **设置 → PowerDSH**。优先复用宿主 slot、service、主题与 locale，副作用随 context 释放；精简的启停与读回遵循[架构规范](docs/architecture.md#原生精简操作)。全屏设置已撤销，不重新引入。
- 编写或配置插件前按[源码与接口发现](docs/development.md#源码与接口发现)检索参考并核对目标 API，先 `cordis_inspect_list` 再定向查询。不得猜接口，或越过已确认的宿主布局、DOM 与内部 UI 接入边界。
- 按[检查与安装流程](docs/development.md#协作流程)验证；纯文档修改无需安装。只有任务授权安装或运行预览时才通过原生管理机制修改 profile，不手写 manifest/patch。交付区分静态检查、安装、注册与实际页面验收。
- 不加入未要求的依赖、框架或发布流程，不提交凭据、机器绝对路径或个人日志；不擅自提交、推送、发布或创建远端仓库。

长期规则写入对应主题文档，本文件只保留协作入口和关键约束。
