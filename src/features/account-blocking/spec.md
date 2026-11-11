# 停用官方登录与模型接入

模块 id：`account-blocking`；主开关 `blockOfficialAccount` 默认 `false`。模块的[定义](definition.ts)、[配置](config.ts)、[Client](client.ts)与[行为测试](tests/)在本目录维护。

入口：**设置 → PowerDSH → 精简 → 停用官方登录与模型接入**，默认关闭。说明为「停用官方登录、账号界面及内置模型接入」。配置键仍为 `blockOfficialAccount`，保留已有偏好。

本开关不控制搜索或网页抓取；搜索由独立的[停用官方搜索](../search-blocking/spec.md)开关控制。

## 目标与保留范围

通过原生 Plugin Manager 停用以下目标，不删除包、配置或凭据：

| 目标 | 效果 |
| --- | --- |
| `@deepseek-ai/dsh-client-ui-settings-account` | 移除账号与余额设置、头像菜单、模型登录选择、登录引导、充值与额度提示，以及该模块的账户状态订阅 |
| `@deepseek-ai/dsh-llm-deepseek-account` | 撤下 `deepseek-account` 提供方及模型目录刷新任务 |
| `@deepseek-ai/dsh-llm-deepseek-api-key` 的内置实例 | 仅匹配 `entryId: include:llm-deepseek`、`patchId: llm-deepseek`；停用随宿主提供的官方 API Key 接入 |

第三方及自行添加的模型实例、凭据、共享模型传输、更新和账号底层平台服务保留。不调用退出登录。账号模型停用后不能用于新请求，相关工作流需改用其他可用模型；需要其他兼容接入时可通过原生模型设置添加。

本功能不承诺阻断所有账号网络：其他消费者、第三方插件或原生 Electron 启动器仍可能使用账号平台服务，原生启动器页面不在本功能范围。

## 操作与启停

UI 与 `power_dsh_settings` 调用同一个 owner-only Host 操作。开启时停用上述匹配目标，关闭时启用这些目标，包括原先已停用的目标；不记忆或恢复之前的启用状态。共用流程见[原生精简操作](../../../docs/architecture.md#原生精简操作)。

保存精简偏好时只更新 `blockOfficialAccount`，保留通知、提示音、双击屏蔽、技能及其他功能配置，包括等待原生写锁期间保存的更新；只移除明确废止的恢复快照与全屏设置字段，不维护全功能配置白名单。行为测试见[账号策略测试](tests/account-policy.test.mjs)。

请通过开关或工具执行操作；直接修改布尔配置或在管理器单独启停目标后，再次执行开关操作可重新核对和应用期望状态。停用或卸载 Mod 不会自动启用目标，撤销精简的方法见[安装与使用](../../../docs/development.md#安装与使用)。

目标定义见 [account-policy.ts](account-policy.ts)，共享操作见 [plugin-policy.ts](../../shared/host/plugin-policy.ts)，Config 与 RPC 绑定见 [index.ts](../../index.ts)。接口发现、测试和实际验证的区分见[开发指南](../../../docs/development.md#验证方法与限制)。
