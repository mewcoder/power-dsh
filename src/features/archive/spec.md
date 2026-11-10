# 归档管理

模块 id：`archive`；主开关 `archiveManagerEnabled` 默认 `false`。模块的[定义](definition.ts)、[配置](config.ts)、[Host](host.ts)、[Client](client.ts)与[行为测试](tests/)在本目录维护。当前为**提案+已实现源码**，实际安装与页面验收尚未执行。

## 标识、入口与范围

在 **设置 → PowerDSH → 管理** 打开「归档管理」开关，设置侧栏新增独立 **归档** Tab（与技能、MCP、个性化同样的 `settings.section` 接入方式，`order: 54`）。开关默认关闭、独立持久化，只控制管理页入口。

目标：让用户不必翻阅侧栏，就能看到全部**已归档**会话，按工作区分组、按标题搜索，并把需要的会话**恢复**回原生列表。

保留：归档状态本身是宿主能力，本功能只读展示并调用原生恢复，不改变原生归档入口。**永久删除在原生 `Modal` 二次确认后进行**：先清除归档标记，再按 `sessionPersistence.stat().location.path` 删除该会话自己的转录产物，不触碰工作区文件或其他会话。明确不包含：自动归档与保留时长、批量恢复/批量删除、跨工作区移动。这些相邻能力均已与用户确认排除。

## 配置与行为

唯一配置键 `archiveManagerEnabled`（`z.boolean().default(false).volatile()`，与现有开关一起经宿主 `configForms` 持久化）。归档数据归宿主，本功能不另存、不缓存到配置。

- 打开页面即读一次完整归档集合；窗口重新获得焦点时再读一次，保证宿主导航产生的变化可见。
- 列表按工作区分组，分组顺序沿用原生工作区顺序；不属于任何工作区的归档会话归入末尾的「未归类」。
- 搜索只在标题与工作区名上做本地过滤，空查询展示全部；无结果显示「未找到匹配的归档会话」，完全无归档显示「暂无归档会话」。
- 排序支持更新时间、创建时间两种，作用于每个分组内的行；项目筛选可在「所有项目」与各工作区之间切换，只显示所选工作区的归档会话（「未归类」不作为筛选项）。
- 单条「取消归档」调用原生恢复；成功后以 Host 返回的最新归档集合重载页面，该项从列表消失。恢复期间该行按钮置为忙碌并禁止重复提交。
- 单条「删除」先弹出原生 `Modal` 二次确认（展示会话名，强调不可恢复），确认后永久删除：Host 先以 `unarchiveSession` 清除归档标记，再按 `sessionPersistence.stat().location.path` 解析转录产物；仅当产物父目录名等于会话 id 时递归删除该会话目录，否则只删除解析出的文件，并拒绝经符号链接删除。非归档项、无产物路径（例如尚未落盘的运行中会话）或无法解析产物的存储都会被拒绝并给出对应提示。
- 加载失败显示可重试的页面级错误；恢复或删除失败保留可恢复状态并给出错误，可再次操作。

## 生命周期、权限与兼容

- 关闭开关即移除归档 Tab 与图标；卸载释放订阅与监听。归档数据、原生归档状态与开关偏好保留。
- 只读工作区与会话元数据；删除时经原生 `sessionPersistence` 解析路径并用 Node 文件系统删除该会话自己的转录产物（不触碰工作区文件或其他会话）。无网络、无进程、无凭据。
- 原生接口依据（本机 DSH `0.2.2-rc.1` Inspect 与源码核对）：`workspaceController.follow(signal)` 基线的 `items[].{workspaceId,title,sessionIds}` 与 `archivedSessionIds`；`workspaceController.unarchiveSession({sessionId})`；`sessionQuery.readTitleSnapshots(ids, signal)` 的标题、`updatedAt` 与 `session.createdAt`；`sessionQuery.listSessions(signal)` 的 `live`；`sessionPersistence.stat(id, {signal}).location.path`（公开返回的转录产物路径）。
- 服务缺席（例如无 `workspaceController` 或 `sessionQuery` 的宿主）时，Host 方法抛 `archiveUnavailable`，页面显示「归档管理暂不可用」，不伪造空列表或成功状态。Host 通过可选 `ctx.inject` 获取服务，缺席不会阻止其余功能加载。

## 验收条件与验证

可观察条件：
- 开启开关后出现「归档」Tab 与其图标，关闭后两者消失，且不增加重复监听或订阅。
- 已归档会话按工作区正确成组，「未归类」收纳无工作区的归档会话。
- 搜索命中标题或工作区名，清空后恢复全部。
- 排序切换更新时间/创建时间时组内顺序随之变化；项目筛选只显示所选工作区并排除「未归类」。
- 点击「取消归档」后该项从归档列表消失，原生列表恢复该会话；恢复失败保留该行并给出可重试错误。
- 点击「删除」先出现原生确认框；确认后该会话从归档列表消失且转录产物被移除；运行中/非归档/无法解析时被拒绝并提示，不误删其他会话。
- 加载失败显示页面错误并可重试，不显示为空列表。

实现与测试：
- Host 纯逻辑 [archive-catalog.ts](archive-catalog.ts) 与 [archive-service.ts](archive-service.ts)；RPC 契约见 [rpc.ts](rpc.ts)。
- [行为测试](tests/archive-catalog.test.mjs)覆盖归档集合折叠（去重、标题缺失回退、工作区归属）、分组顺序、搜索命中标题与工作区、组内排序（更新时间/创建时间）、项目筛选与空组排除。
- 尚未执行：真实 slots 注册渲染、点击恢复后的原生列表实屏、跨版本缺服务降级与 Windows 表现。以上按[分层验证](../../../docs/development.md#验证方法与限制)分别记录，不以源码存在代替实际页面验收。

## 参考来源

开发前从 [dsh-market](https://dshmarket.com/browse/) 检索并浅克隆 [MichengAI/dsh-archive-manager](https://github.com/MichengAI/dsh-archive-manager/tree/c2146d58cfb23066a2df26221bf78de4b4b0cc78)，提交 `c2146d58cfb23066a2df26221bf78de4b4b0cc78`，Apache-2.0。参考「按工作区分组 + 搜索 + 排序/项目筛选 + 取消归档 + 二次确认删除」的信息结构。其删除依赖私有 `locate()` 与内部记账/投影清理；本项目没有复制其代码，改用公开 `sessionPersistence.stat().location.path` 定位产物并由 Host 文件系统删除，未采用其自动归档与保留时长。确切许可与参考边界见[第三方资源声明](../../../docs/third-party-notices.md)。
