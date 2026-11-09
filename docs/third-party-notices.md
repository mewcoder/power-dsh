# 第三方资源声明

## DeepSeek Harness 原生插件目录布局

[技能与 MCP 管理界面](../src/client.js)的搜索、分组、卡片布局及技能页范围 Tab 适配自 DeepSeek Harness 原生内置插件页面，包含卡片展开、悬浮、焦点和底部分隔背景等视觉反馈。使用本插件独立 CSS 类及数据，保留原生主题 token 与尺寸，不运行时导入内部页面组件。项目选择和提示复用宿主公共 `Menu`、`Tooltip`；具体行为见[技能管理](skills.md)、[MCP 管理](mcp.md)与 [UI 规范](ui.md#技能与-mcp-管理列表)。未包含无关插件清单、模式选择或配置编辑逻辑。

- [原生 Tab 样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-settings-plugins/src/client/PluginsSettingsSection.module.css)
- [原生目录页面](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.tsx)
- [原生目录样式](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/client/ui-settings-plugin-inventory/src/client/PluginInventorySettingsTab.module.css)
- 对照发行包：`@deepseek-ai/dsh-client-ui-settings-plugin-inventory@0.2.2-rc.1`。
- [上游 MIT 许可证](https://github.com/deepseek-ai/deepseek-harness/blob/master/LICENSE)

```text
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 技能与 MCP 来源研究

接口研究依据 DSH `0.2.2-rc.1` 安装包的公开实现：`dsh-skill` 的分层目录、rank 与调用策略，`dsh-skill-filesystem` 的 cwd 与项目根语义，`dsh-scope` 的上下文所有权，以及 Plugin Manager、Settings、Loader、Cordis Registry / Fiber 和 preset composition。原生服务是否存在须按目标发行包核对；profile 条目清单不能证明没有 preset、Agent 或动态实例。现行行为和接口约束分别维护在[技能管理](skills.md)与[MCP 管理](mcp.md)，历史版本差异见[兼容性调查](compatibility-audit.md#官方发行标签的接口证据)。

市场检索后的来源研究如下，仅借鉴入口组织、功能边界与状态语义，没有复制或改编实现代码：

| 仓库与确切版本 | 许可 | 参考范围与取舍 |
| --- | --- | --- |
| [alone-tree/dsh-skill-mcp-manager](https://github.com/alone-tree/dsh-skill-mcp-manager/tree/e4a426b23eba07773d15a7b5824ba16db0a364dd)，提交 `e4a426b23eba07773d15a7b5824ba16db0a364dd` | MIT | scope、只读技能护栏与技能调用策略；未采用接管并重写 MCP patch 的架构 |
| [xx529/dsh-capability-settings](https://github.com/xx529/dsh-capability-settings/tree/282f1166356716f25e6973177d0935d308a736e1)，提交 `282f1166356716f25e6973177d0935d308a736e1` | MIT | 技能来源、文件级双向调用键、会话 shadow 优先级及 MCP 配置与会话作用域区分；未引入安装器、自建持久化或提示词重写 |
| [appthin/dsh-mcp-manager-plus](https://github.com/appthin/dsh-mcp-manager-plus)，已安装包 `0.4.5`，原记录未注明提交 | MIT | 只比较 `lib/index.js`、`lib/client.js` 与 README 中的工具展开和管理功能；其 Fiber active 到“已连接”的映射不足以证明网络连接，未采用此语义 |

这些来源研究不代表 PowerDSH 提供文件级技能启停、服务器增删或连接管理，也不构成其他插件声明的兼容性保证。PowerDSH 不修改共享技能文件，不复制第三方目录扫描器或独立连接器。

## MCP 运行状态参考

从 [市场页](https://awesome-dsh-plugin.com/zh/p/shinelon/dsh-mcp-plugin/) 检索到 [shinelon/dsh-mcp-plugin](https://github.com/shinelon/dsh-mcp-plugin/tree/2852d89c2322a01784a1f0db862bbc20d67987e0)，核对提交 `2852d89c2322a01784a1f0db862bbc20d67987e0`、包版本 `@local/mcp-manager@1.0.0` 与 [MIT 许可证](https://github.com/shinelon/dsh-mcp-plugin/blob/2852d89c2322a01784a1f0db862bbc20d67987e0/LICENSE)（Copyright 2026 shinelon / SunMight）。声明兼容 Node.js `>=22`、DSH `>=0.1.7-rc.2`、React `^18.2.0`；该声明不是 Mod 的跨版本验证结论。

仅参考 `src/host/routes.js` 的 `fiberStatus/listServers` 状态投影、`src/client/locales.ts` 的运行状态命名及 `src/client/section.tsx` 的刷新生命周期，没有复制或改编代码、布局、硬编码颜色或配置写入实现。来源区分配置 disabled 与 Fiber 阶段，使用运行状态而非网络在线状态；其 unloading 合并到 loading、无 Fiber 回落 pending 的规则未沿用，PowerDSH 保留明确的 unloading、inactive 和 unknown。来源的挂载、focus 与写后延时刷新用于理解生命周期，现行刷新和状态约定见 [MCP 管理](mcp.md)。研究未执行参考仓库脚本或安装其依赖、插件。

## 重启插件参考

[hulibuld/dsh-refresh-restart](https://github.com/hulibuld/dsh-refresh-restart/tree/3228af3fc3bcc27eb5b290831e43e5734d85901d)，提交 `3228af3fc3bcc27eb5b290831e43e5734d85901d`，MIT。阅读 `lib/restart.js`、`lib/platform.js` 与 Client 交互，仅借鉴外部助手、正常退出后重开的思路，没有复制代码。其他同类实现、平台取舍与原生确认组件来源见[重启应用](restart-button.md#参考与验证)。

## 通知插件参考

任务通知开发前从 [dsh-market](https://dshmarket.com/browse/) 检索并浅克隆以下仓库，仅参考交互设计和接入方式，没有复制或改编其代码：

| 仓库与提交 | 许可 | 参考范围 |
| --- | --- | --- |
| [omdsh-dev/dsh-notification](https://github.com/omdsh-dev/dsh-notification/tree/675aab9b43d5011738feb6185281596c0365ccba) | [MIT](https://github.com/omdsh-dev/dsh-notification/blob/675aab9b43d5011738feb6185281596c0365ccba/LICENSE) | Host 完成摘要投影、Client 通知权限与对应会话前台抑制 |
| [YoyuDev/dsh-ping](https://github.com/YoyuDev/dsh-ping/tree/bbe2cb4bdf19dac3e4f3e876482ab51086ec6622) | [MIT](https://github.com/YoyuDev/dsh-ping/blob/bbe2cb4bdf19dac3e4f3e876482ab51086ec6622/LICENSE) | 完成、出错、输入和审批四类提醒的触发划分，以及 macOS 使用 afplay 的声音播放方式 |
| [DeepseekHarnessPlugins/Notification](https://github.com/DeepseekHarnessPlugins/Notification/tree/5da12d12d31e260e22210efa2779b44d71db8891) | [MIT](https://github.com/DeepseekHarnessPlugins/Notification/blob/5da12d12d31e260e22210efa2779b44d71db8891/LICENSE) | 以系统声音名称选择原生提示音的设计 |

Mod 使用已核对的 DSH `0.2.2-rc.1` 原生会话、交互及 subprocess 通道，自行实现最小投影、系统默认通知与本机系统声音白名单播放，仅借鉴上述项目的设计，没有复制或改编其代码，不引入其依赖、音频文件、脚本或设置页面。Windows 使用固定 WinMM 系统事件别名，接口依据为微软 [PlaySound 文档](https://learn.microsoft.com/en-us/previous-versions/dd743680(v=vs.85))。行为边界见[任务通知](notifications.md)。

## Lucide Puzzle、Sparkles 与 Cable

[Mod 图标](../assets/icon.svg)与 Mod 设置导航使用 Lucide Puzzle；[技能与 MCP 设置导航](../src/client.js)分别使用 Lucide Sparkles 和 Cable。仅内联所需 SVG，不引入 Lucide 运行时依赖。图形使用约定见 [UI 规范](ui.md#logo-与图标)，独立 SVG 中也保留完整许可。

- [Puzzle 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/puzzle.svg)
- [Sparkles 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/sparkles.svg)
- [Cable 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/cable.svg)
- [上游许可证](https://raw.githubusercontent.com/lucide-icons/lucide/main/LICENSE)
- 获取日期：2026-11-07。

```text
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
```
