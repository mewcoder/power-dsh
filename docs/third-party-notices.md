# 第三方资源声明

## DeepSeek Harness 原生插件目录布局

[技能与 MCP 管理界面](../src/client.js)的搜索、分组与卡片布局，以及技能页的范围 Tab，适配自 DeepSeek Harness 的原生内置插件页面；技能与 MCP 卡片按需求提供独立启停开关，技能保持静态卡片；MCP 参考原生卡片的头部悬浮、展开高亮、按下与键盘焦点反馈、展开箭头及底部分隔背景，第一行保留名称 Tooltip 与独立启停开关，第二行并排显示运行状态与已确认的本地／HTTP 类型标签，类型使用原生 outline Tag 规格；第三行展开按钮将无括号的工具数量摘要与箭头左右排列，默认收起，展开区逐项展示工具名，整个三行头部支持点击展开或收起，开关与工具按钮过滤冒泡而独立操作，开关不嵌套在展开按钮内；展开后的工具列表仍可选择与复制文本。保留原有主题 token 与尺寸，使用本插件独立 CSS 类及技能、MCP 数据，不运行时导入其页面内部组件，不修改宿主页面。技能页的项目选择与两页的悬浮提示使用宿主 baseline 提供的公共 `Menu`、`Tooltip`，具体约定见 [UI 下拉规范](ui.md#下拉选择)和[悬浮提示](ui.md#悬浮提示tooltip)。与技能管理无关的插件清单、模式选择和配置编辑逻辑不包含在内。

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

## MCP 运行状态参考

按用户要求从 [市场页](https://awesome-dsh-plugin.com/zh/p/shinelon/dsh-mcp-plugin/) 查到并浅克隆 [shinelon/dsh-mcp-plugin](https://github.com/shinelon/dsh-mcp-plugin/tree/2852d89c2322a01784a1f0db862bbc20d67987e0)，核对提交 `2852d89c2322a01784a1f0db862bbc20d67987e0`、包版本 `@local/mcp-manager@1.0.0` 与 [MIT 许可证](https://github.com/shinelon/dsh-mcp-plugin/blob/2852d89c2322a01784a1f0db862bbc20d67987e0/LICENSE)（Copyright 2026 shinelon / SunMight）。声明兼容 Node.js `>=22`、DSH `>=0.1.7-rc.2`、React `^18.2.0`；该声明不是 Mod 的跨版本验证结论。

仅参考 `src/host/routes.js` 的 Loader Fiber 状态投影、`src/client/locales.ts` 的运行状态命名及 `src/client/section.tsx` 的刷新生命周期，没有复制或改编代码、布局、硬编码颜色或配置写入实现，未执行该仓库脚本或安装依赖、插件。Mod 的第一行显示名称与独立开关，第二行显示本地／HTTP 类型标签与真实运行阶段，第三行显示「{count} 个工具」和展开箭头；运行状态不宣称网络在线。`runtimeState` 八值及状态文字、开关区分和刷新约定见 [MCP 管理](mcp.md)。

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
