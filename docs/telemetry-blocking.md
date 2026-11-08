# 精简官方反馈与遥测

入口：**设置 → PowerDSH → 精简 → 精简官方反馈与遥测**，默认关闭。说明：「停用使用统计、环境信息采集、会话日志及插件清单上报」

## 七个内置目标

开启精简时通过原生 Plugin Manager 停用以下模块，关闭时启用这些模块，不记忆之前的启用状态：

| 包 | 内置 id | 效果 |
| --- | --- | --- |
| `@deepseek-ai/dsh-client-product-analytics` | `product-analytics` | 停止使用统计、为统计收集的环境信息和身份读取；包含经此入口提交的启动、登录与更新操作统计 |
| `@deepseek-ai/dsh-host-product-telemetry-otel` | `desktop-product-telemetry` | 停用产品统计发送端 |
| `@deepseek-ai/dsh-client-ui-message-feedback` | `ui-message-feedback` | 移除消息点赞、点踩、反馈弹窗及其界面入口 |
| `@deepseek-ai/dsh-command-feedback` | `command-feedback` | 移除输入菜单中的「反馈 feedback」入口与 `/feedback` 文字命令，停用会话反馈 Host 服务 |
| `@deepseek-ai/dsh-session-telemetry-otel` | `session-telemetry-otel` | 停止反馈触发的会话日志上传，保留本地反馈记录 |
| `@deepseek-ai/dsh-session-log-deepseek` | `session-log-deepseek` | 后续官方模型请求不附带 `dsh_session_log` |
| `@deepseek-ai/dsh-plugin-package-inventory-deepseek` | `plugin-package-inventory-deepseek` | 后续官方模型请求不附带 `dsh_plugin_packages` 包名与版本清单 |

精确匹配包名、`entryId: include:<id>` 与 `patchId: <id>`；保留用户另加的同包实例、第三方遥测与共享 OTel。先停用统计入口，反馈界面先于反馈命令与服务停用，最后停用发送端；启用按相反顺序。

原生 Session Log 上传行依赖上传模块的配置表单，模块停用后该行消失。停用由原生 profile 持久化，不依赖启动时异步写回。Mod 不修改桌面进程或预加载脚本。

## 开关与操作

页面只显示开关，操作失败时显示原因，不后台订阅精简状态或显示核对提示。每次启停操作核对原生应用结果；手动在管理器改动目标后，可重新切换开关以应用设置。旧版已开启精简的用户更新后，也需重新应用精简，才会停用新增的反馈命令目标。

`power_dsh_settings` 调用时按需返回 `telemetry.protected` 和七个目标条目 `senders` 的 available、enabled、active 状态。实现见 [telemetry-policy.js](../telemetry-policy.js)。

关闭精简会启用上述匹配目标，包括开启精简前已停用的模块。共用流程见[原生精简操作](architecture.md#原生精简操作)。停用或卸载 Mod 不会自动启用目标，撤销精简的方法见[安装与使用](development.md#安装与使用)。

## 网络边界

- 保留本地会话日志、运行日志、崩溃诊断文件、模型输入与凭据。会话反馈 Host 服务和文字命令随开关停用，已有本地反馈记录不删除。
- 更新检查、强制升级策略、搜索和其他业务请求按原配置工作，可能发送版本、平台等元数据；模型请求仍带 Harness User-Agent。
- 原生发送端 shutdown 时，已发送中或排队的数据可能完成；已准备的模型请求也可能保留附加字段。不承诺操作瞬间零流量或阻断所有官方网络。
- profile 所有者可以独立启停插件，本开关不构成权限限制。

验证覆盖目标启停、无关实例保留和失败重试；网络、页面验证的限制见[开发指南](development.md#验证方法与限制)。
