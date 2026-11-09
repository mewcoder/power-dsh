# 精简官方搜索

入口：**设置 → PowerDSH → 精简 → 精简官方搜索**，默认关闭，通过 `blockOfficialSearch` 独立持久化。说明：「停用内置网页搜索，保留网页抓取与第三方 MCP 搜索。」[精简官方登录与模型接入](account-blocking.md)继续使用已有 `blockOfficialAccount`，两个开关互不联动。

## 范围与行为

开启时，只在 `@deepseek-ai/dsh-tool-web` 的声明中设置 `config.search: false`，关闭时设置 `true`，不记忆原先的搜索配置。全局和各模式分别处理，嵌套组内的声明也包含在内；保留 `config.fetch`、其他配置及每个声明原有的启停标记。搜索提供方无需分别停用：内置 `web_search` 入口统一撤下，因此旧版 DeepSeek 辅助模型搜索与直接 Search API 都不再通过该入口发起请求。

保留 `web_fetch`、本机 HTTP 抓取、DeepSeek Fetch API 提供方及搜索提供方配置，不改用户已有的抓取选择；第三方 MCP 搜索与抓取工具也保留。该开关不强制把已选的 DeepSeek Fetch API 改为 HTTP，也不承诺拦截其他插件直接调用搜索服务。若其他原生插件占用同名 `web_search`，原生调用限制也会匹配它；规范命名的 `mcp__<server>__<tool>` 不受影响。

已停用的全局条目或整个模式保持停用，因原生 ConfigEditor 只允许编辑活动条目，不为修改搜索配置而临时启用它们。活动模式内部已停用的工具声明仍可更新搜索配置，但保留其停用标记。Mod 在运行期间用执行 guard 与 Agent 作用域限制覆盖已打开会话的旧模式代际，以及后来创建或重新选择模式的 Agent；仅隐藏声明不足以阻止旧工具调用。

## 保存与恢复

UI 与 `power_dsh_settings(blockOfficialSearch: ...)` 共用 owner-only Host 操作并进入同一个操作队列。先由 ConfigEditor 保存原生搜索配置并核对读回值，再检查目标模式组合没有缺失或加载错误，最后保存偏好并同步已有 Agent。失败明确返回错误，不把部分写入当作成功；重新执行可重新应用期望值，不维护回滚或旧状态记录。

关闭开关释放当前会话的搜索限制，并把可编辑声明设为 `search: true`。如果会话打开于搜索已停用的模式代际，需重新打开会话以取得新代际的工具。停用或卸载 PowerDSH 释放 guard、事件监听和作用域限制，不自动恢复已保存的原生搜索配置；旧代际中的工具可能随限制释放而重新可用。要撤销精简，先关闭本开关。

## 实现与验证依据

实现见 [SearchPolicy](../src/search-policy.js)，Host 配置与工具见 [index.js](../src/index.js)，严格 RPC 见 [rpc.js](../src/rpc.js)，界面文案与独立行见 [client.js](../src/client.js)。行为测试见 [search-policy.test.mjs](../tests/search-policy.test.mjs)。

本会话没有 `cordis_inspect_list` / `cordis_inspect_query`，接口依据是本机 DSH `0.2.2-rc.1` 安装包的 `dsh-tool-web`、`dsh-config-editor`、`dsh-agent-preset-registry` 和固定 SDK。`tool-web` 公开 `search` / `fetch` 两个布尔配置；ConfigEditor 编辑活动条目并等待 Loader 应用；模式清单不包含工具配置，必须另读声明并核对组合状态。参考仓库的版本和实现可能领先安装包，不据此推断本机默认提供方。

市场按 Browser & Web 与搜索停用关键词检索，结果主要为搜索提供方及搜索路由插件，没有发现可直接复用的独立精简控制；沿用本项目已有的原生 ConfigEditor、Tools 限制与生命周期方式。市场入口：[dsh-market](https://dshmarket.com/browse/)。本次不安装插件或修改运行偏好，真实页面、完整宿主重载和旧版兼容仍需分别验收，不沿用既有历史矩阵作为新增功能的结论。
