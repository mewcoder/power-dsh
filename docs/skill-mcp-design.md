# 技能与 MCP 管理页设计草案

状态：按用户三张参考图制作的设计研究。技能管理已按后续要求收敛为仅对 DSH 生效、不修改共享技能文件，当前行为以[技能管理](skills.md)为准，技能主分类已改为全局与项目、移除模式选择，下面的交互原型保留历史布局供研究；本文后续关于文件级启停的讨论属于历史备选。现行 MCP 管理仅提供全局列表，没有项目范围；具体行为以[MCP 管理](mcp.md)为准。现有生产功能不变。[交互草稿](designs/capability-management.html)使用示例数据，不请求网络、不读写真实配置；页面切换、搜索、来源筛选、主题和开关只用于查看设计。

## 入口与布局

建议沿用个性化的结构：PowerDSH → 增强增加「技能管理」「MCP 管理」两个独立持久化开关，分别控制原生设置侧栏的「技能」「MCP」入口。管理入口关闭后不改变技能或 MCP 原有状态。侧栏外壳由宿主提供，不另建全屏设置、不修改宿主插件页。

两页使用现有 [Title 与描述规范](ui.md#设置页-title-与描述)；标题分别为「技能」「MCP」，描述分别为「管理当前工作区可用的技能」「管理当前配置中的 MCP 服务器」。顶部一行放当前上下文、来源筛选和搜索框，列表占据下方空间。

列表采用有细分隔线的设置行，避免多层卡片。左侧统一 20px 图标；中部为名称、简短描述和轻量来源标签；右侧原生样式开关。来源按个人、项目、插件或当前配置、模式提供区分。搜索 placeholder 仅「搜索技能」「搜索 MCP」。不显示全量路径、连接参数、统计卡片或常驻帮助段。空列表显示「暂无可用技能」「暂无 MCP 配置」，搜索无结果显示「未找到匹配项」。

不借用其他产品的蓝色或绿色开关；实际接入遵循当前 DSH Switch token。草稿为本地独立 HTML，颜色只是主题近似值，生产实现须复用已核实 token，不能用本稿替代真机视觉验收。

## 开关行为

单项开关即时保存，不增设页面级保存、取消。请求中禁止重复点击；完成后读回实际状态，失败保留操作前的已确认状态或重新读取后端事实，在该行显示可理解错误。必须区分保存成功、已应用、被其他配置覆盖和需要重启，不能只凭请求成功改变开关。

只读项保留在列表，注明「由提供方管理」并禁用开关；将来有可靠单项 API 再开放。第一版不加安装、市场、编辑、删除、分组、导入导出、单个 MCP 工具开关、连接测试或会话级覆盖。

### 技能

目录必须与宿主真实 catalog 一致，包含当前工作区和当前模式的作用域，而不是只扫描个人目录。个人技能与项目技能明确来源；它们自身配置变更的影响范围不同，实施时需要保持来源与实际写入目标一致。

已核对当前 `dsh-skill` 的 `list/snapshot/get/register/registerProvider` 和 `dsh-skill-filesystem` 的双向调用策略。原生没有通用的技能 enable/restrict 方法。同类插件对可写文件通过 `disable-model-invocation` 与 `user-invocable` 管理模型和用户两条入口；部分插件对会话用同名 runtime shadow，但同层项目技能的优先级可能让 shadow 不生效。

因此，不能把所有技能都设计成保证可操作，也不能只隐藏 UI 却保留实际调用。文件级启停需最小化更改元数据、保留正文和原有调用策略、校验文件版本并处理只读/插件内置来源；这些实现细节在进入生产开发时单独落定。草稿的插件技能暂示为只读。

### MCP

范围写「当前配置中的 MCP」，不声称枚举全部运行中的服务器。现有公开可持久化途径是 `ctx.pluginManager.listPlugins()` 和 `ctx.pluginManager.setPluginEnabled(entryId, enabled)`；调用前核对可管理行，调用后读取 ChangeResult 并重新查询状态。严禁手写 profile patch。

可操作的是 profile 中可寻址的 Loader 条目；模式/preset composition 和其他插件动态挂载的实例不能直接交给这个 API。更完整的只读清单可用 `readPluginInventory(ctx)` / `agentPresets.compositionInventory()` 补充，但相对 entryId 不能冒充 profile 管理 ID。

MCP bridge 没有公开连接状态接口。enabled、fiberPhase 和工具数量均不足以证明已连接，所以不画「已连接」绿点；这不妨碍单独展示真实插件运行阶段。现行卡片第一行仅显示名称和独立开关，第二行并排显示已确认的「本地／HTTP」类型标签与运行状态，第三行保留「{count} 个工具」与展开箭头；未知类型只省略标签，类型与状态均无可显示内容时省略整行。`runtimeState` 为 `pending/loading/active/failed/unloading/inactive/disabled/unknown`：`active/failed/inactive` 对应「运行中／加载失败／未运行」三种稳定文字，`pending/loading/unloading` 只显示原生小加载指示并保留无障碍状态名称；disabled 由关闭开关表达，unknown 不伪造状态。页面挂载、focus、写后读回以及可见且无读写时的每 2 秒轮询刷新运行状态，卸载释放定时器与监听。不修改 `reconnect.enabled` 充当启停，不自建连接管理器或接管其他插件。

profile 级停用可能影响同一配置下全部会话，并中断正在等待的调用；HTTP 停用只关闭客户端，不代表关闭远端服务器。实施时在实际停用行为需要说明的位置明确这个影响，不用误导性的「仅当前对话」文案。

列表只传最少安全字段。友好名称、说明和传输类型在来源能可靠提供时才显示；不为填满草稿读取/透传 env、headers、完整 command/args、URL 或原始配置。没有描述时省略，不伪造服务器自报信息。草稿中的 MCP 名称和描述仅为示例。

## 已做研究与边界

当前会话无法调用 `cordis_inspect_list/query`，未声称完成 Inspect；以 App 安装包 0.2.2-rc.1 的公开实现为依据。研究只读，未安装第三方插件、未修改 profile、未启停真实能力。当前原生 PluginManager entries 清单无 canonical MCP client，不能据此断言 preset/agent/动态注入中不存在 MCP。

在市场检索后浅克隆并阅读了以下参考，借鉴入口组织和状态语义，没有复制或改编其实现代码：

- [alone-tree/dsh-skill-mcp-manager](https://github.com/alone-tree/dsh-skill-mcp-manager)，MIT，提交 `e4a426b23eba07773d15a7b5824ba16db0a364dd`。重点参考 scope、只读技能护栏与技能调用策略；其接管并重写 MCP patch 的架构不用于 Mod。
- [xx529/dsh-capability-settings](https://github.com/xx529/dsh-capability-settings)，MIT，提交 `282f1166356716f25e6973177d0935d308a736e1`。重点参考技能来源、文件级双向调用键、会话 shadow 的优先级限制，以及 MCP 配置与会话作用域的区分；不引入其安装器、自建持久化体系或提示词重写。

后续按用户截图核对了已安装的 [appthin/dsh-mcp-manager-plus](https://github.com/appthin/dsh-mcp-manager-plus) `0.4.5`（MIT）的 `lib/index.js`、`lib/client.js` 与 README，仅比较功能，没有复制代码或布局。它的展开区展示工具名及描述，并提供添加、编辑、重启和删除；这些管理能力不因此视为 Mod 已实现。该版本将 Fiber `active` 映射为「已连接」，无法据此确认实际网络连接，Mod 继续保留启用与连接状态的区分。

用户明确要求另查一个运行状态实现后，先读取 [市场页](https://awesome-dsh-plugin.com/zh/p/shinelon/dsh-mcp-plugin/)，再浅克隆 [shinelon/dsh-mcp-plugin](https://github.com/shinelon/dsh-mcp-plugin/tree/2852d89c2322a01784a1f0db862bbc20d67987e0) 至 `reference/shinelon/dsh-mcp-plugin/`，核对提交 `2852d89c2322a01784a1f0db862bbc20d67987e0`、MIT 许可与包 `@local/mcp-manager@1.0.0`；其清单声明 Node.js `>=22`、DSH `>=0.1.7-rc.2`、React `^18.2.0`。相关模块为 `src/host/routes.js` 的 `fiberStatus/listServers`、`src/client/locales.ts` 与 `src/client/section.tsx`：Host 将配置 disabled 与 Loader Fiber 阶段分开投影，UI 使用「运行中／加载中／等待／失败／已禁用」而非「在线」。该实现把 unloading 合并为 loading，无 Fiber 或已 disposed 时回落 pending；Mod 保留独立的 unloading、inactive 和 unknown，避免把无可靠证据的项说成等待中。它在挂载和 focus 时读取，并于写后 1.2／3／5.5 秒追加刷新；Mod 使用页面可见且空闲时的 2 秒运行状态轮询，卸载释放资源。研究只借鉴生命周期投影与状态命名，没有复制或改编代码、硬编码颜色、手写 patch 或私有错误透传，未执行参考仓库脚本、安装依赖或安装插件。

当前交付只证明设计文件与脚本可解析。尚未连接原生 RPC，未实际操作能力，未验收生产页面、键盘或浅深主题。后续实施需完成分层验证。
