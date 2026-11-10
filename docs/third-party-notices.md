# 第三方资源声明

## DeepSeek Harness 原生插件目录布局

[技能与 MCP 管理界面](../src/client.ts)的搜索、分组、卡片布局及技能页范围 Tab 适配自 DeepSeek Harness 原生内置插件页面，包含卡片展开、悬浮、焦点和底部分隔背景等视觉反馈。使用本插件独立 CSS 类及数据，保留原生主题 token 与尺寸，不运行时导入内部页面组件。项目选择和提示复用宿主公共 `Menu`、`Tooltip`；具体行为见[技能管理](../src/features/skills/spec.md)、[MCP 管理](../src/features/mcp/spec.md)与 [UI 规范](ui.md#技能与-mcp-管理列表)。未包含无关插件清单、模式选择或配置编辑逻辑。

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

接口研究依据 DSH `0.2.2-rc.1` 安装包的公开实现：`dsh-skill` 的分层目录、rank 与调用策略，`dsh-skill-filesystem` 的 cwd 与项目根语义，`dsh-scope` 的上下文所有权，以及 Plugin Manager、Settings、Loader、Cordis Registry / Fiber 和 preset composition。原生服务是否存在须按目标发行包核对；profile 条目清单不能证明没有 preset、Agent 或动态实例。现行行为和接口约束分别维护在[技能管理](../src/features/skills/spec.md)与[MCP 管理](../src/features/mcp/spec.md)，历史版本差异见[兼容性调查](compatibility-audit.md#官方发行标签的接口证据)。

市场检索后的来源研究如下，仅借鉴入口组织、功能边界与状态语义，没有复制或改编实现代码：

| 仓库与确切版本 | 许可 | 参考范围与取舍 |
| --- | --- | --- |
| [alone-tree/dsh-skill-mcp-manager](https://github.com/alone-tree/dsh-skill-mcp-manager/tree/e4a426b23eba07773d15a7b5824ba16db0a364dd)，提交 `e4a426b23eba07773d15a7b5824ba16db0a364dd` | MIT | scope、只读技能护栏与技能调用策略；未采用接管并重写 MCP patch 的架构 |
| [xx529/dsh-capability-settings](https://github.com/xx529/dsh-capability-settings/tree/282f1166356716f25e6973177d0935d308a736e1)，提交 `282f1166356716f25e6973177d0935d308a736e1` | MIT | 技能来源、文件级双向调用键、会话 shadow 优先级及 MCP 配置与会话作用域区分；未引入安装器、自建持久化或提示词重写 |
| [appthin/dsh-mcp-manager-plus](https://github.com/appthin/dsh-mcp-manager-plus)，已安装包 `0.4.5`，原记录未注明提交 | MIT | 只比较 `lib/index.js`、`lib/client.js` 与 README 中的工具展开和管理功能；其 Fiber active 到“已连接”的映射不足以证明网络连接，未采用此语义 |

本次 MCP 设置页故障另只读核对已安装的 [Fishquito7/dsh-skill-mcp-panel](https://github.com/Fishquito7/dsh-skill-mcp-panel) 包 `2.3.7`（MIT，安装包未标明提交）的 `lib/mcp/gateway.js` 与 `lib/index.js`：其 `McpManagerGateway` 注册同名 `mcpManager`，没有原生 `config.servers`，且 `list()` 为异步网关协议。仅用于确认服务名冲突与原生接口归属边界，没有复制代码、调用其管理方法或读取其配置。

这些来源研究不代表 PowerDSH 提供文件级技能启停、服务器增删或连接管理，也不构成其他插件声明的兼容性保证。PowerDSH 不修改共享技能文件，不复制第三方目录扫描器或独立连接器。

## MCP 运行状态参考

从 [市场页](https://awesome-dsh-plugin.com/zh/p/shinelon/dsh-mcp-plugin/) 检索到 [shinelon/dsh-mcp-plugin](https://github.com/shinelon/dsh-mcp-plugin/tree/2852d89c2322a01784a1f0db862bbc20d67987e0)，核对提交 `2852d89c2322a01784a1f0db862bbc20d67987e0`、包版本 `@local/mcp-manager@1.0.0` 与 [MIT 许可证](https://github.com/shinelon/dsh-mcp-plugin/blob/2852d89c2322a01784a1f0db862bbc20d67987e0/LICENSE)（Copyright 2026 shinelon / SunMight）。声明兼容 Node.js `>=22`、DSH `>=0.1.7-rc.2`、React `^18.2.0`；该声明不是 Mod 的跨版本验证结论。

仅参考 `src/host/routes.js` 的 `fiberStatus/listServers` 状态投影、`src/client/locales.ts` 的运行状态命名及 `src/client/section.tsx` 的刷新生命周期，没有复制或改编代码、布局、硬编码颜色或配置写入实现。来源区分配置 disabled 与 Fiber 阶段，使用运行状态而非网络在线状态；其 unloading 合并到 loading、无 Fiber 回落 pending 的规则未沿用，PowerDSH 保留明确的 unloading、inactive 和 unknown。来源的挂载、focus 与写后延时刷新用于理解生命周期，现行刷新和状态约定见 [MCP 管理](../src/features/mcp/spec.md)。研究未执行参考仓库脚本或安装其依赖、插件。

## Plan 模式精简参考

开发前从 [dsh-market](https://dshmarket.com/browse/)检索到 [a903067276-rgb/dsh-plan-switch](https://github.com/a903067276-rgb/dsh-plan-switch/tree/c4b32611eec1b5c4992f01353f60801b78075e61)，浅克隆并阅读提交 `c4b32611eec1b5c4992f01353f60801b78075e61` 的 `lib/client.js` 和 MIT 许可证。仅参考原生 `/plan` 命令、projection 与 UI 入口关系，没有复制代码、图标、样式或旧版接口降级，也没有安装或执行其脚本。

接口依据为 DSH `0.2.2-rc.1` 桌面发行包及官方仓库提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 的 `packages/plan/plan-mode`、`packages/client/ui-plan`、`packages/preset/agent-preset-registry` 和 Web 模式声明。独立实现只启停原生 Plan 模块，不移除拥有历史卡片的 UI 插件，不处理已有 Agent 的状态。完整行为与验收限制见[停用 Plan 模式](../src/features/plan-blocking/spec.md)。

## Goal 模式精简参考

开发前检索 [dsh-market](https://dshmarket.com/browse/) 的 Goal 条目，并浅克隆 [xlennart/dsh-goal-mode-enhance](https://github.com/xlennart/dsh-goal-mode-enhance/tree/628ebe637a928bb14b0692cf54df146141b2ec92)，阅读提交 `628ebe637a928bb14b0692cf54df146141b2ec92` 的 README、MIT 许可证及 `src/client/index.ts` 的目标创建与 slot 注册。仅核对第三方界面通过 `remote.goals.create` 独立创建目标的范围，没有复制代码、控件或样式，也不采用替换原生目标栏的接入方式，未执行参考脚本或安装依赖。

本功能依据 DSH `0.2.2-rc.1` 桌面发行包与官方提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 的 Goal 服务、续跑驱动、命令、工具、原生目标界面和模式声明独立实现。只启停原生目标命令与工具，保留领域服务、续跑驱动与历史界面；第三方目标创建入口不在精简范围。完整行为与验证边界见[停用 Goal 模式](../src/features/goal-blocking/spec.md)。

## 重启插件参考

[hulibuld/dsh-refresh-restart](https://github.com/hulibuld/dsh-refresh-restart/tree/3228af3fc3bcc27eb5b290831e43e5734d85901d)，提交 `3228af3fc3bcc27eb5b290831e43e5734d85901d`，MIT。阅读 `lib/restart.js`、`lib/platform.js` 与 Client 交互，仅借鉴外部助手、正常退出后重开的思路，没有复制代码。其他同类实现、平台取舍与原生确认组件来源见[重启应用](../src/features/restart-button/spec.md#参考与验证)。

## 通知插件参考

任务通知开发前从 [dsh-market](https://dshmarket.com/browse/) 检索并浅克隆以下仓库，仅参考交互设计和接入方式，没有复制或改编其代码：

| 仓库与提交 | 许可 | 参考范围 |
| --- | --- | --- |
| [omdsh-dev/dsh-notification](https://github.com/omdsh-dev/dsh-notification/tree/675aab9b43d5011738feb6185281596c0365ccba) | [MIT](https://github.com/omdsh-dev/dsh-notification/blob/675aab9b43d5011738feb6185281596c0365ccba/LICENSE) | Host 完成摘要投影、Client 通知权限与对应会话前台抑制 |
| [YoyuDev/dsh-ping](https://github.com/YoyuDev/dsh-ping/tree/bbe2cb4bdf19dac3e4f3e876482ab51086ec6622) | [MIT](https://github.com/YoyuDev/dsh-ping/blob/bbe2cb4bdf19dac3e4f3e876482ab51086ec6622/LICENSE) | 完成、出错、输入和审批四类提醒的触发划分，以及 macOS 使用 afplay 的声音播放方式 |
| [DeepseekHarnessPlugins/Notification](https://github.com/DeepseekHarnessPlugins/Notification/tree/5da12d12d31e260e22210efa2779b44d71db8891) | [MIT](https://github.com/DeepseekHarnessPlugins/Notification/blob/5da12d12d31e260e22210efa2779b44d71db8891/LICENSE) | 以系统声音名称选择原生提示音的设计 |

Mod 使用已核对的 DSH `0.2.2-rc.1` 原生会话、交互及 subprocess 通道，自行实现最小投影、系统默认通知与本机系统声音白名单播放，仅借鉴上述项目的设计，没有复制或改编其代码，不引入其依赖、音频文件、脚本或设置页面。Windows 使用固定 WinMM 系统事件别名，接口依据为微软 [PlaySound 文档](https://learn.microsoft.com/en-us/previous-versions/dd743680(v=vs.85))。行为边界见[任务通知](../src/features/notifications/spec.md)。

## 推理等级插件参考

开发前检索 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 市场目录（快照 `e190236`），并浅克隆下列仓库，仅用于理解市场做法与宿主接口，**没有复制或改编任何代码、样式或配置写入实现**：

| 仓库与提交 | 许可 | 参考范围 |
| --- | --- | --- |
| [ChimeSky/dsh-effort-keeper](https://github.com/ChimeSky/dsh-effort-keeper/tree/afc2a68) | MIT | Host 侧装饰 `selectModel` 记忆档位，不改动界面 |
| [Ayowait/dsh-official-reasoning-effort](https://github.com/Ayowait/dsh-official-reasoning-effort/tree/7872985) | MIT | 复用官方组件并注入档位，观察官方档位序列 |
| [zszz3/dsh-model-provider-prefix](https://github.com/zszz3/dsh-model-provider-prefix/tree/bc89f42) | MIT | 替换 `conversation.input.model` 座位的做法，作为本项目刻意不采用的对照 |

本功能的信号格、循环序列与点击提交均为独立实现；接口依据为 DSH `0.2.2-rc.1` 安装包只读源码，未执行参考仓库脚本或安装其依赖、插件。行为边界见[推理等级选择器](../src/features/thinking-effort/spec.md)。

## 自定义背景参考

本轮按用户要求结合下列三个实现的职责划分：`dsh-ui-appearance@0.1.28`（提交 `fe6d9b930b9554e99b7fcdd44c8628afc2e1191a`）的媒体淡化／模糊与界面玻璃分离；`dsh-homepage-glass@1.3.1`（提交 `a9bb39e7a9ceb1a83b1467312076f786d6e30fa0`）的动效节流、减少动效和 GPU 回收；`dsh-mpkg-wallpaper`（提交 `ab8d50db9b4a29916be7ba8b45aed452ee80d538`）的零值语义、表面／媒体归属与避免滤镜影响 fixed 弹层定位。PowerDSH 使用「背景不透明度」「背景模糊」描述已有功能，保留官方组件样式、Host 图片存储、自有图层范围和旧配置；仅作源码研究，未复制第三方样式、着色器或渲染器，也未安装或执行这些插件。各来源链接、许可与边界见下文。

按用户指定，只读核对 [TQSY114514/dsh-ui-appearance](https://github.com/TQSY114514/dsh-ui-appearance/tree/fe6d9b930b9554e99b7fcdd44c8628afc2e1191a)，包 `0.1.28`、提交 `fe6d9b930b9554e99b7fcdd44c8628afc2e1191a`、MIT（Copyright (c) 2026 TQSY114514）。阅读 README、LICENSE、媒体存储与 `applier.ts`，参考媒体层不透明度／背景模糊分离、模糊画面留边、异步图片身份校验与释放的实现思路。最终保持画面原尺寸，只应用背景模糊滤镜，避免外扩 cover 容器引入额外放大裁切；保留既有 Host profile 图片存储和官方公共组件；未移植其样式表、全局主题覆写、视频／URL／配色功能或 IndexedDB 存储，也未执行其安装脚本、构建或安装该插件。

调节面板的尺寸与排版适配自官方提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 的 [Modal.module.css](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-primitives/src/Modal.module.css)，独立背景材质层参考同提交的 [MenuSurface.module.css](https://github.com/deepseek-ai/deepseek-harness/blob/fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159/packages/client/ui-primitives/src/MenuSurface.module.css)。Copyright (c) 2026 DeepSeek，适用本文开头完整保留的 MIT 许可证。使用本功能自有类名与更低底色不透明度，不运行时导入内部样式模块；关闭、更换与移除操作复用公开 `Button`。

[自定义背景](../src/features/flowing-background/spec.md)参考 [DeepSeek 首页](https://www.deepseek.com/)及市场中的 [Tim5613/dsh-homepage-glass](https://github.com/Tim5613/dsh-homepage-glass/tree/a9bb39e7a9ceb1a83b1467312076f786d6e30fa0)，确切提交 `a9bb39e7a9ceb1a83b1467312076f786d6e30fa0`、包版本 `1.3.1`。阅读其 README、LICENSE 与 `lib/client.js` 中的 FLOW_PARAMS、颜色混合、时间归一化和遮罩；核对蓝白三色、softness 100 的两级宽范围混色、八次旋涡、坐标缩放与慢速流动。该插件背景本身没有 CSS blur，其 `backdrop-filter:blur(14px)` 属于输入卡，未搬入 PowerDSH。官网当前使用有界周期相位，参数也已对照。PowerDSH 独立编写值噪声、旋涡、颜色合成及相位实现，不引入依赖或远程资源。参考插件自身声明 MIT，但同时声明官网 GLSL 为逐字提取；其外层 MIT 不作为官网源码的独立再分发许可，因此没有复制该 shader、皮肤全局 CSS 或宿主 DOM 接入代码。底部采用官网归零遮罩，没有采用参考插件保留 30% 蓝色的改版。WebGL 不可用或上下文丢失时显示自有 CSS 渐变。

全局底层接入另外参考该提交中 `lib/client.js` 的挂载、负层级与结构背景透出思路（416–493 行的布局说明与 `.dhps_flow`，642 行的 `host.appendChild(canvas)`）。参考插件直接处理整页框架/内容列透明度、主题 token 与输入卡片；PowerDSH 没有复制其全局 CSS、卡片样式或宿主 DOM 接入代码。用户已授权独立编写范围受控的 AppFrame 底层适配。初版采用 npm `0.2.2-rc.1` 包中的类名，但直接读取已安装桌面包发现同版 `@deepseek-ai/dsh-client-ui-layout` 的样式及类映射（第 74、83–93 行）使用 `PIRFFq_frame`、`PIRFFq_sidebarCol`、`PIRFFq_centerCol`，`@deepseek-ai/dsh-client-ui-sidebar` 第 116–125 行使用 `kB3qhq_root`，与 npm 包的 `pI_x6G_*`、`hHd-Xa_root` 不同；构建差异导致固定选择器无法命中。当前必需框架映射只读自已加载的两个精确官方 `style[data-plugin-css]` 标签 `@deepseek-ai/dsh-client-ui-layout/AppFrame.module.css`、`@deepseek-ai/dsh-client-ui-sidebar/SidebarRoot.module.css`，要求标签及所需简单后缀类名唯一，再核对语义直接子元素和定位布局；不复制、重新注入这些官方样式，也不扫描任意样式表。只对主 Spec 列明的结构表面设置内联透明背景，不将全局主题 token 或任意后代改为透明；输入卡片、编辑器、文件卡片、菜单和弹窗保留原生表面。同一框架的映射或目标表面替换只刷新适配，框架替换或关闭时按原值、优先级与所有权恢复。授权范围、窄窗口抽屉保护、延迟样式恢复、失败保护和验收限制见[自定义背景 Spec](../src/features/flowing-background/spec.md)。本次未适配操作系统原生标题栏，也未强制清空其他面板的独立不透明内容表面；浏览器未连接，本次映射修复后的全局实屏效果尚未验收。

用户反馈底部 `_fade` 阴影后，另直接只读核对已安装 `0.2.2-rc.1` 官方工作区 Client 的 `WorkspaceBrowser.module.css` 标签、类名映射及分组/平铺/搜索结果渲染结构：原生底部 span.fade 为 24px 渐变，macOS 隐藏。PowerDSH 未复制或重新注入官方样式，仅增加精确模块元数据的可选读取和受控目标的 display 隐藏/恢复；动态哈希和授权范围见功能 Spec。

其他对照来源为 [JohnnyTing/dsh-official-homepage-theme](https://github.com/JohnnyTing/dsh-official-homepage-theme/tree/a80b70e809a091c815f8678d69cf1c88ffa11e91)（提交 `a80b70e809a091c815f8678d69cf1c88ffa11e91`，MIT）和 [yushi-xxh/dsh-homepage-skin](https://github.com/yushi-xxh/dsh-homepage-skin/tree/329f9e0b12cab223b00b3e75e2f73453d9a46ed5)（提交 `329f9e0b12cab223b00b3e75e2f73453d9a46ed5`，MIT）。二者主要复刻 `/harness` 的深海、鲸鱼与流体光效；后者的 20px blur 不能当作根首页三色 pattern 的模糊参数。本次没有复制其代码或资源，也没有安装、执行这些参考插件。另阅读 Paper Design 的公开 warp 说明作为算法分类对照，未复制或引入该代码。

开发前从 [dsh-market](https://dshmarket.com/browse/)检索并浅克隆 [XHR666/dsh-mpkg-wallpaper](https://github.com/XHR666/dsh-mpkg-wallpaper/tree/ab8d50db9b4a29916be7ba8b45aed452ee80d538)，提交 `ab8d50db9b4a29916be7ba8b45aed452ee80d538`，阅读 README、许可证与 Client 壁纸相关模块。仓库主体 MIT，渲染部分另有 GPL-3.0-or-later 声明；这里只对照动态装饰、暂停与背景接入的功能边界，没有复制或改编其代码，也未采用宿主 DOM/CSS 透明化及布局改写方式，未运行其脚本或安装其依赖。

## 归档管理插件参考

[归档管理](../src/features/archive/spec.md)开发前从 [dsh-market](https://dshmarket.com/browse/) 检索并浅克隆 [MichengAI/dsh-archive-manager](https://github.com/MichengAI/dsh-archive-manager/tree/c2146d58cfb23066a2df26221bf78de4b4b0cc78)，提交 `c2146d58cfb23066a2df26221bf78de4b4b0cc78`，Apache-2.0。参考「按工作区分组 + 搜索 + 排序/项目筛选 + 取消归档 + 二次确认删除」的信息结构。其删除依赖私有 `locate()` 及内部记账/投影清理，本项目没有复制其代码或样式，改用公开 `sessionPersistence.stat().location.path` 定位转录产物并由 Host 文件系统删除，未采用其自动归档与保留时长。PowerDSH 的归档读取由 Host 侧 `workspaceController.follow` 基线配合 `sessionQuery.readTitleSnapshots` 完成，恢复走原生 `unarchiveSession`。

## Lucide Puzzle、Sparkles 与 Cable

[Mod 图标](../assets/icon.svg)与 Mod 设置导航使用 Lucide Puzzle；[技能与 MCP 设置导航](../src/client.ts)分别使用 Lucide Sparkles 和 Cable；[归档设置导航](../src/features/archive/client.ts)使用 Lucide Archive、Folder 与 Trash。仅内联所需 SVG，不引入 Lucide 运行时依赖。图形使用约定见 [UI 规范](ui.md#logo-与图标)，独立 SVG 中也保留完整许可。

- [Puzzle 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/puzzle.svg)
- [Sparkles 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/sparkles.svg)
- [Cable 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/cable.svg)
- [Archive 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/archive.svg)
- [Folder 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/folder.svg)
- [Trash 图标源文件](https://raw.githubusercontent.com/lucide-icons/lucide/main/icons/trash-2.svg)
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

「透明度」「毛玻璃」两行设置的交互参考同目录 wallpaper 插件与 homepage-glass：wallpaper 以 0–100 的整屏磨砂与表面透明度滑块、homepage-glass 以卡片 `backdrop-filter: blur(14px) saturate(1.5)` 与固定半透明底色呈现毛玻璃，并在系统「减少透明」时退回不透明。PowerDSH 只借鉴其「磨砂 + 透明度」的思路，用自有图层 `opacity` 与 Canvas `filter: blur()` 实现，未复制其滑块组件、样式表或 DOM 接入代码。

「自定义壁纸」的存储与上传交互参考同目录 wallpaper 插件的本地文件导入思路（本地读取、不自动上传、校验类型与体积）。PowerDSH 未复制其渲染器、壁纸库或界面代码，只实现单个壁纸文件的本地上传、校验与读取；图片保存在用户自己的 DSH profile 内，不上传任何远端。
