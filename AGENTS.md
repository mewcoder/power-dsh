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
- 所有功能遵循[错误处理规范](docs/error-handling.md)，复用共享错误反馈与诊断处理，保留可恢复状态，不泄露原始配置；日志仅在关键操作发生意外故障且有排障价值时按需记录，不做全局强制包装。
- 遵循[特性模块约定](docs/feature-modules.md)与[目录职责](docs/development.md#目录职责)：功能实现、文案、主 Spec 和行为测试归 `src/features/<id>/`，装配与共享分别归 `src/app/` 和 `src/shared/`；组合测试与夹具归 `tests/`，静态资源归 `assets/`。运行源码使用严格 TypeScript；通过 tsdown 构建并一并维护 `dist/index.js`、`dist/index.d.ts`、`dist/client.js`，检查类型与产物新鲜度，不以抑制或排除源码绕过检查。公开导出键与安装无需现场构建的约束不变。不为整理而搬动或覆盖参考源码。
- 每项增强提供独立、持久化开关，集中在 **设置 → PowerDSH**。优先复用宿主 slot、service、主题与 locale，副作用随 context 释放；精简的启停与读回遵循[架构规范](docs/architecture.md#原生精简操作)。全屏设置已撤销，不重新引入。
- 编写或配置插件前按[源码与接口发现](docs/development.md#源码与接口发现)检索参考并核对目标 API，先 `cordis_inspect_list` 再定向查询。不得猜接口，或越过已确认的宿主布局、DOM 与内部 UI 接入边界。
- 按[检查与安装流程](docs/development.md#协作流程)验证；纯文档修改无需安装。只有任务授权安装或运行预览时才通过原生管理机制修改 profile，不手写 manifest/patch。交付区分静态检查、安装、注册与实际页面验收。
- 不加入未要求的依赖、框架或发布流程，不提交凭据、机器绝对路径或个人日志；不擅自提交、推送、发布或创建远端仓库。

长期规则写入对应主题文档，本文件只保留协作入口和关键约束。
