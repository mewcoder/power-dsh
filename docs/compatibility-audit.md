# 首版兼容性调查

本报告记录 `power-dsh 0.0.1` 在发版准备期间的源码比较及隔离 SDK 验证。调查日期为 2026-11-08。结论用于选择真实宿主验收目标，不能替代最终安装包、完整 profile 或页面验证；当前兼容约定见[版本兼容性](compatibility.md)。

## 结论

已补全 DSH `0.2.0` / `0.2.1` 目标分支已发布的全部 12 个具体版本，**最低已测基线为 `0.2.0-rc.1`**。每版匹配 SDK 的 192 项测试、固定生产 SDK 配合对应 Host 服务的 3 项装配检查均通过，无失败或跳过；`0.2.2-alpha.2` 和当前 SDK 回归也已通过。原先两个先行样本之外的中间发行版现已逐一测试。完整 DSH 的产物安装、Client 实际加载、系统通知和跨平台界面仍未验收，因此暂不填写正式 `engines.dsh` 范围。

旧版没有 `tools.definitions()` 的阻碍已通过公开 `schemas()` / `get()` 适配，工具列表、作用域隔离及同名覆盖均保留，不读取私有注册表，也不为列目录连接 MCP。旧宿主内部生成 schema 会读取描述与参数，Mod 只消费名称、不保存或返回其余字段；这项取舍及失败语义已同步到 [MCP 规范](mcp.md)。此次不承诺尚未重新验证的 `0.1.7-rc.2`，也不把已发布版本的结果外推到未来的新 alpha / rc。

## 同类插件怎么声明

下表是作者声明或本地参考快照所记录的支持范围，不是本项目复测过的兼容保证。不同插件的功能与依赖方式不同。

| 插件及所查版本 | 声明方式 | 核对结果 |
| --- | --- | --- |
| [dsh-unlag 1.17.5](https://github.com/regrevia/dsh-unlag/blob/f013115817afeb46e03665830a032c02dd4df832/package.json) | 顶层 `engines.dsh` | `>=0.2.0-rc.1` |
| [dsh-ui-tweaks 0.23.1](https://github.com/wlj521/dsh-ui-tweaks/blob/main/package.json) | DSH peer 依赖 | 多项宿主 peer 为 `^0.2.0-rc.2`，顶层 engines 只有 Node 要求；这是调查时远端 main 的内容，后续可能变化 |
| [dsh-capability-settings 1.15.1](https://github.com/xx529/dsh-capability-settings/blob/282f1166356716f25e6973177d0935d308a736e1/package.json) | DSH peer 依赖与 README | peer 多为 `^0.2.0-rc.1`；[README](https://github.com/xx529/dsh-capability-settings/blob/282f1166356716f25e6973177d0935d308a736e1/README.md)另明确侧栏入口需要外壳 `>=0.2.0-rc.2`，不能只看 peer 字符串 |
| [dsh-custom-instructions 0.5.0](https://github.com/huanghai-lab/dsh-custom-instructions/blob/53bf72514f25dcf400d382499662c3f94cbc0dc3/README.md#兼容矩阵) | 文档矩阵、源码检查及作者的隔离 E2E | README 只承诺 DSH `0.1.2-alpha.1`；[包清单](https://github.com/huanghai-lab/dsh-custom-instructions/blob/53bf72514f25dcf400d382499662c3f94cbc0dc3/package.json)没有宿主 engines / DSH peer 范围 |
| [dsh-skill-mcp-manager 1.2.2](https://github.com/alone-tree/dsh-skill-mcp-manager/blob/e4a426b23eba07773d15a7b5824ba16db0a364dd/package.json) | 没有宿主 engines / DSH peer 限制 | DSH 包只放开发依赖；不能把开发依赖范围理解为已声明的宿主最低版本 |

因此可借鉴“清单声明 + 文档矩阵 + 隔离验证”的维护方法，但不能把别人的最低版本复制到本包。此次只阅读来源与接口，没有复制或执行这些插件的代码。

## 发行版本与基线选择

核对 [npm 实际发行记录](https://registry.npmjs.org/@deepseek-ai%2fdsh)与[官方标签](https://github.com/deepseek-ai/deepseek-harness/tags)，截至本次调查，两个目标分支共发布 12 个具体版本：

- `0.2.0-rc.1`、`0.2.0-rc.2`。
- `0.2.1-alpha.1` 至 `0.2.1-alpha.5`，以及 `0.2.1-rc.1` 至 `0.2.1-rc.5`。

没有实际发布名为 `0.2.0` 或 `0.2.1` 的无后缀版本。原先的 `0.2.0-rc.2` 与 `0.2.1-rc.5` 只是先行测试样本，并非由接口要求推导出的最低编号。此次补全这 12 个发行版的矩阵，最低测试目标取目标分支最早实际发行的 `0.2.0-rc.1`；不追求证明 Mod 能运行的绝对最早历史版本，也不把未来的新 alpha / rc 自动纳入结论。

## 官方发行标签的接口证据

读取官方 Git 标签的不可变文件，没有切换参考 checkout，也没有构建或运行历史 DSH。表格只描述所查样本，不外推所有未检查版本。

| 官方标签 | 提交 | `tools.definitions()` | `Fiber.effectiveConfig` | 项目菜单 `minWidthFromAnchor` |
| --- | --- | --- | --- | --- |
| `dsh-v0.1.7-rc.2` | [477b4f4](https://github.com/deepseek-ai/deepseek-harness/tree/477b4f420553e8a52c2fbccc464d7561b239c443) | 无 | 无 | 无 |
| `dsh-v0.2.0-rc.1` | [4878cda](https://github.com/deepseek-ai/deepseek-harness/tree/4878cdabd87d4041bdaff61d04c966883b9fd07a) | 无 | 无 | 无 |
| `dsh-v0.2.0-rc.2` | [639ed01](https://github.com/deepseek-ai/deepseek-harness/tree/639ed015397290b3745d163aafe02ffee4aa3f84) | 无 | 无 | 无 |
| `dsh-v0.2.1-rc.5` | [b830ec9](https://github.com/deepseek-ai/deepseek-harness/tree/b830ec950faba0a46dda564be3e2d854afed94f1) | 无 | 无 | 有 |
| `dsh-v0.2.2-alpha.2` | [f3803c9](https://github.com/deepseek-ai/deepseek-harness/tree/f3803c96974ad4a94195fb97e5c637e9c2a3afe3) | 有 | 有 | 有 |
| `dsh-v0.2.2-alpha.3` | [05b1cae](https://github.com/deepseek-ai/deepseek-harness/tree/05b1cae8db6e674c5685101494d4eec24652424a) | 有 | 有 | 有 |
| `dsh-v0.2.2-rc.1` | [66491b0](https://github.com/deepseek-ai/deepseek-harness/tree/66491b05e3f05ad35bcdd4f6cd7ed26041d9e3db) | 有 | 有 | 有 |

对比 `0.2.0-rc.1` 与 `rc.2` 的关键源码，Mod 使用的 Tools、Scope、技能与 preset 服务、会话状态、Menu / Tooltip / StateDot 实现无变化。公共 UI 入口新增的 MenuGroup 和 remote 启动列表新增的 userQuestions contribution 均非 Mod 的新增依赖；这部分源码比较支持将测试基线前移至 `rc.1`，不代替实际页面验收。

工具定义枚举存在新旧差异：[旧 Tools 服务](https://github.com/deepseek-ai/deepseek-harness/blob/639ed015397290b3745d163aafe02ffee4aa3f84/packages/core/tools/src/index.ts)只提供 `get()` 和深克隆的 `schemas()`；[新版 Tools 服务](https://github.com/deepseek-ai/deepseek-harness/blob/f3803c96974ad4a94195fb97e5c637e9c2a3afe3/packages/core/tools/src/index.ts)提供返回真实定义对象的 `definitions(scope)`。当前实现优先走新版接口；旧版从 schema 取得名称后，通过 `get(name, scope)` 与 `get(name, parentScope)` 的真实定义身份排除继承项，不能比较 schema 副本的对象引用。限制和同名覆盖由原生视图决定。旧版会投影当前作用域所有可见工具的描述和参数，包括非 MCP 工具；其中任一投影失败即保持加载失败，不吞成空列表。执行回调、连接配置和私有 registry 均不读取。

多数技能和原生管理接口在 `0.1.7-rc.2` 已有相符证据：技能 provider 的 `signal/invalidate`、`snapshot({cwd,scope})`、最近作用域覆盖及层内 rank，preset 的 `acquireScope()` / `compositionInventory()` / `serviceFor()`，Plugin Manager 的条目地址性和写后读回，ConfigEditor 的回调签名，以及 Scope/Fiber 的生命周期。它们没有构成此次发现的明确最低版本阻碍；这也不等于整包兼容旧版。

## SDK 验证方法与结果

[兼容检查脚本](../scripts/check-compatibility.mjs)在被 Git 忽略的独立目录复制本项目源码、测试、资源及文档，只调整测试副本的依赖，安装时使用 `--ignore-scripts`。原项目生产依赖与用户 profile 均未修改。此次 Node 为 `24.14.0`。

| SDK 版本 | Cordis / Schemastery | 仓库检查（每版） | 固定生产 SDK + 对应旧 Host 装配（每版） |
| --- | --- | --- | --- |
| `0.2.0-rc.1`、`rc.2` | `4.0.4` / `3.18.4` | 192 通过、0 失败、0 跳过 | 3 通过、0 失败、0 跳过 |
| `0.2.1-alpha.1`、`alpha.2` | `4.0.5-alpha.1` / `3.18.5-alpha.1` | 192 通过、0 失败、0 跳过 | 3 通过、0 失败、0 跳过 |
| `0.2.1-alpha.3` 至 `alpha.5` | `4.0.5-alpha.2` / `3.18.5-alpha.2` | 192 通过、0 失败、0 跳过 | 3 通过、0 失败、0 跳过 |
| `0.2.1-rc.1` 至 `rc.5` | `4.0.5` / `3.18.5` | 192 通过、0 失败、0 跳过 | 3 通过、0 失败、0 跳过 |
| `0.2.2-alpha.2` | `4.0.6-alpha.1` / `3.18.6-alpha.1` | 192 通过、0 失败、0 跳过 | 3 通过、0 失败、0 跳过 |
| `0.2.2-rc.1` | 当前原项目依赖 | 192 通过、0 失败、0 跳过 | 由当前 Host 装配用例覆盖 |

装配检查保持生产入口及其依赖导入不变，Context、真实 Tools 和通知投影服务由历史 SDK 解析；验证 Mod service、工具与投影注册，以及技能与 MCP 目录调用。Settings、Typert transport、Plugin Manager、技能 provider 和 Loader 仍有测试替身，不是完整应用启动；真实传输、完整 profile 组合与客户端页面仍需实际安装验收。

重复执行：

```sh
npm run check
npm run check:compat
npm run check:compat -- 0.2.0-rc.1
npm run check:compat -- 0.2.2-alpha.2
```

检查脚本保留各环境的安装、检查及装配日志和汇总 JSON，目录由脚本输出，不启动 DSH 应用或修改 profile。适配前在 `0.1.7-rc.2` 复现过缺少 `definitions()` 及测试夹具导出差异；那是历史诊断，未作为当前实现对该版本的验证结论。

最终验收仍须安装不改清单的实际 tarball，确认完整旧宿主中的依赖解析、共享实例和真实 RPC 正确。DSH 自身的 Node 要求仍须满足；本包 `engines.node: >=22` 不会降低宿主要求，此次未覆盖 Node 22。

## 本次修复

[MCP 提供方](../src/mcp-providers.js)在 Fiber 尚未完成首次配置解析时，可从公开 `rawConfig.serverName` 读取字面量身份，避免等待依赖或加载中的服务器消失。优先使用已解析配置，不执行表达式，不读取命令、参数、环境变量、请求头或 URL；原始名称只用于标识声明，不证明连接成功。模式归属读取补充已验证配置的 id 回退。[MCP 规范](mcp.md)记录现行规则。

[通知注册测试](../tests/notifications.test.mjs)使用两端均提供的 `onChanged` 和 snapshot 结果验证注册、通知内容、卸载和重新加载，不要求新版才有的 summary keys 接口。[Todo 测试](../tests/todo-policy.test.mjs)在旧版使用其导出的真实 scheduler，新版使用真实 pipeline，保留执行拒绝及无关工具可执行的业务断言，不跳过旧版用例。[MCP 提供方测试](../tests/mcp-providers.test.mjs)补充旧版 schema 深克隆、父层过滤、同名覆盖、限制及错误传播；新版仍验证不读取 schema 的快路径。

## 下一步验收

先在独立环境的最低基线 DSH `0.2.0-rc.1` 与较新目标 `0.2.1-rc.5` 中安装实际 tarball，验证默认关闭时冷启动、设置入口、各功能操作、持久化与卸载；再核对当前版本及目标平台。通过后正式声明最低支持版本，并核对 rc / alpha 范围匹配。旧版仅有 profile 声明、尚未解析配置的 MCP 仍能标记 pending；没有公开身份的纯动态实例在解析后再列出，不读取内部 `_config`。`0.2.0-rc.2` 的项目 Menu 不支持 `minWidthFromAnchor`，使用该版原生默认宽度，实际页面仍需复核。

后续按用户重装授权，已在当前 DSH `0.2.2-rc.1` desktop profile 中，通过原生管理器移除旧包、以新目录链接安装 `power-dsh@0.0.1`，核对条目 active，并通过实际工具调用恢复、读回六项偏好。原 profile 文件已私下备份，其余通知声音与管理入口等偏好未自动迁移；未手工编辑 profile。此项证据属于当前宿主的源码链接安装，不替代历史宿主的最终 tarball 或完整 GUI 验收。未创建标签、提交、推送或发布版本。
