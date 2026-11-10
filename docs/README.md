# 文档索引

功能清单与使用入口见[仓库首页](../README.md)，安装说明与协作流程见[开发指南](development.md)，AI 协作者先读[协作入口](../AGENTS.md)。

## 现行规范与流程

| 文档 | 主要职责 |
| --- | --- |
| [产品规范](product.md) | 定位、功能收录条件与入口原则 |
| [UI 规范](ui.md) | 原生表单、图标、主题、文案与可访问性 |
| [错误处理规范](error-handling.md) | 全功能共享错误反馈、诊断信息、恢复与按需日志原则 |
| [架构规范](architecture.md) | 当前文件职责、Host/Client、原生启停与侧栏接入 |
| [特性模块约定](feature-modules.md) | 已实施的功能目录、两端装配契约、依赖与生命周期边界、新增功能流程 |
| [功能 Spec 规范](feature-spec.md) | 一项用户功能对应一份主规格、必要内容、模板与同步规则 |
| [开发指南](development.md) | 目录职责、固定开发环境、CI、接口发现、独立包安装与分层验证 |
| [版本兼容性](compatibility.md) | 各功能宿主接口依赖、兼容矩阵、升级验证与发版条件 |
| [发布与升级](releasing.md) | 品牌、分发方式、版本发布、市场收录与后续更新 |
| [第三方资源声明](third-party-notices.md) | 随包资源来源、参考实现与许可 |

## 功能规格（Spec）

每项用户功能的唯一主 Spec 与实现、文案和行为测试位于同一特性目录。维护要求见[功能 Spec 规范](feature-spec.md)，模块归属与索引由仓库检查核对。下表按「通用」「界面」「管理」「精简」「其他」顺序列出，分类范围与关联设置见[分类 Tab](ui.md#分类-tab)。

| 功能 | 主要职责 |
| --- | --- |
| [任务通知](../src/features/notifications/spec.md) | 事件触发、权限、前台抑制与系统提示音 |
| [界面刷新](../src/features/refresh-button/spec.md) | 原生页面重载、状态边界与按钮显隐 |
| [重启应用](../src/features/restart-button/spec.md) | macOS 打包桌面端的设置入口、确认、退出与同路径重开，以及平台和验收限制 |
| [快捷推理等级切换](../src/features/thinking-effort/spec.md) | 模型选择右侧的信号格／仪表盘切换、档位序列、读回与失败边界 |
| [外观快捷切换](../src/features/appearance-shortcut/spec.md) | 原生主题同步、按钮定位与生命周期 |
| [自定义背景](../src/features/flowing-background/spec.md) | 单一开关、官网流动图案与自定义壁纸、Host 侧壁纸存储与校验、背景淡化与模糊调节、全局连续画布、受控结构表面适配、样式恢复与 GPU 生命周期 |
| [显示版本号](../src/features/version-display/spec.md) | 宿主版本展示、桌面更新入口与侧栏定位 |
| [技能管理](../src/features/skills/spec.md) | 全局与项目来源、仅对 DSH 生效的启停与共享文件保护 |
| [MCP 管理](../src/features/mcp/spec.md) | 全局服务器、原生启停、运行状态与工具列表 |
| [全局指令](../src/features/personalization/spec.md) | 全局指令编辑、原生文件保存与入口关闭行为 |
| [归档管理](../src/features/archive/spec.md) | 已归档会话的分组列表、搜索、排序、项目筛选、恢复与二次确认删除 |
| [停用官方登录与模型接入](../src/features/account-blocking/spec.md) | 登录与模型目标、保留范围与启停行为 |
| [停用官方搜索](../src/features/search-blocking/spec.md) | 独立搜索开关、抓取保留、旧会话限制与恢复 |
| [停用官方反馈与遥测](../src/features/telemetry-blocking/spec.md) | 七个内置目标、开关行为与网络边界 |
| [停用 Todo 工具](../src/features/todo-blocking/spec.md) | 新对话的待办工具启停，保留已有会话与待办历史 |
| [停用 Plan 模式](../src/features/plan-blocking/spec.md) | 新对话的计划能力启停，保留已有对话与历史计划 |
| [停用 Goal 模式](../src/features/goal-blocking/spec.md) | 新对话的目标命令与工具启停，保留已有目标与续跑驱动 |
| [屏蔽双击重命名](../src/features/double-click-rename/spec.md) | 会话行双击拦截范围、DOM 接入例外与监听释放 |

功能文档中的实现状态与验证边界同样有效；列入索引不代表已经完成安装、真实页面或跨平台验收。

## 验证依据、设计与历史资料

| 资料 | 用途与边界 |
| --- | --- |
| [首版兼容性调查](compatibility-audit.md) | 同类插件声明、官方标签差异、隔离 SDK 与 Host 装配结果；正式支持范围以[版本兼容性](compatibility.md)为准 |
| [更新日志](../CHANGELOG.md) | 已有版本记录、待发布功能、用户可感知变化与升级说明 |

每项事实保留一个主要出处，其他文档链接引用。现行规范记录已采用的约定；设计提案、历史备选与未验证结论明确标注。验证记录保留方法和限制，不累积逐版本试验日记。
