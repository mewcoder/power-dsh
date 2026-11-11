# 首版兼容性调查

本报告保留 `power-dsh 0.0.1` 发版准备期间的兼容性证据。原调查日期为 **2026-11-08**，192 项 SDK / 3 项 Host 装配结果是当时的历史快照；后续复测单独记录，不回写历史数字。原调查未记录 Mod 的确切提交，不能将这些结果绑定到当前工作区。结论用于选择真实宿主验收目标，不能替代最终安装包、完整 profile 或页面验证；当前约定见[版本兼容性](compatibility.md)。

## 结论

2026-11-08 的调查覆盖 DSH `0.2.0` / `0.2.1` 目标分支当时已发布的全部 12 个具体版本，**最低已测基线为 `0.2.0-rc.1`**。每版匹配 SDK 的 192 项测试、固定生产 SDK 配合对应 Host 服务的 3 项装配检查均通过，无失败或跳过；另有 `0.2.2-alpha.2` 及 `0.2.2-rc.1` SDK 回归。2026-11-09 的后续单版复测见[SDK 结果](#sdk-验证方法与结果)，仅覆盖 `0.2.0-rc.1`，不能将新增测试数量扩到其余版本。完整 DSH 的产物安装、Client 实际加载、系统通知和跨平台界面仍待验收。

旧版没有 `tools.definitions()` 的阻碍已通过公开 `schemas()` / `get()` 适配，工具列表、作用域隔离及同名覆盖均保留，不读取私有注册表，也不为列目录连接 MCP。旧宿主内部生成 schema 会读取描述与参数，Mod 只消费名称、不保存或返回其余字段；这项取舍及失败语义已同步到 [MCP 规范](../src/features/mcp/spec.md)。此次不承诺尚未重新验证的 `0.1.7-rc.2`，也不把已发布版本的结果外推到未来的新 alpha / rc。

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

| 官方标签 | 提交 | `tools.definitions()` | `Fiber.effectiveConfig` | 工作区菜单 `minWidthFromAnchor` |
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

2026-11-08 的[兼容检查脚本](../scripts/check-compatibility.mjs)在被 Git 忽略的独立目录复制源码、测试、资源及文档，只调整测试副本的依赖，安装时使用 `--ignore-scripts`。原项目生产依赖与用户 profile 均未修改。该次 Node 为 `24.14.0`，未覆盖 Node 22；下表保持当时方法与数字，不能视为当前代码的完整矩阵。

| SDK 版本 | Cordis / Schemastery | 仓库检查（每版） | 固定生产 SDK + 对应旧 Host 装配（每版） |
| --- | --- | --- | --- |
| `0.2.0-rc.1`、`rc.2` | `4.0.4` / `3.18.4` | 192 通过、0 失败、0 跳过 | 3 通过、0 失败、0 跳过 |
| `0.2.1-alpha.1`、`alpha.2` | `4.0.5-alpha.1` / `3.18.5-alpha.1` | 192 通过、0 失败、0 跳过 | 3 通过、0 失败、0 跳过 |
| `0.2.1-alpha.3` 至 `alpha.5` | `4.0.5-alpha.2` / `3.18.5-alpha.2` | 192 通过、0 失败、0 跳过 | 3 通过、0 失败、0 跳过 |
| `0.2.1-rc.1` 至 `rc.5` | `4.0.5` / `3.18.5` | 192 通过、0 失败、0 跳过 | 3 通过、0 失败、0 跳过 |
| `0.2.2-alpha.2` | `4.0.6-alpha.1` / `3.18.6-alpha.1` | 192 通过、0 失败、0 跳过 | 3 通过、0 失败、0 跳过 |
| `0.2.2-rc.1` | 调查时原项目依赖 | 192 通过、0 失败、0 跳过 | 由当时 Host 装配用例覆盖 |

### 后续单版复测

2026-11-09 的单版复测仅运行 DSH **`0.2.0-rc.1`**：仓库测试 **219 通过、0 失败、0 跳过**，固定生产 SDK 的 Host 装配 **4 通过、0 失败、0 跳过**。Cordis / Schemastery 为 `4.0.4` / `3.18.4`。测试对象是后来提交 `3ccf1ae` 之前的工作区快照，未记录可精确还原该测试对象的 Mod 提交；不能将该提交包含的全部后续文档或当前改动视为已测。

本地原始证据保存在忽略目录 `.references/compatibility-tests/`：单版目录 `0.2.0-rc.1-zhIZRG` 中的 `check.log`、`production-sdk-host.log`，以及 `summary-1794191561328.json`。汇总仅列该一个版本。这些日志不随包发布；219 / 4 不替换上述 192 / 3 历史矩阵，也不证明其他版本、新功能实际页面或应用重启已验收。

2026-11-09 清理修复回归：基于 `3ccf1ae` 的未提交工作区，针对偏好保留、设置输出 schema 及安装包收敛重新验证 `0.2.0-rc.1`，仓库测试 **221 通过、0 失败、0 跳过**，固定生产 SDK 的 Host 装配 **4 通过、0 失败、0 跳过**。原始日志为 `0.2.0-rc.1-akYL1S/check.log`、`production-sdk-host.log`，汇总 `summary-1794193574442.json`。这只更新该单版工作区的隔离回归证据，不扩大其他版本的支持范围。

同日实际 tarball 经 `npm run check:package` 验证：28 个文件，入口、运行源码及导入、声明依赖、Client factory 登记、资源和开发文件排除通过；另在系统临时目录以 `npm install --omit=dev --ignore-scripts` 安装该 tarball，Host 和全部公开子路径可独立解析，不依赖仓库的 `node_modules`。这是 npm 产物与生产依赖验证，没有安装 DSH/profile 或激活真实页面，不等于 GitHub 来源及完整宿主验收。

### 模块化与 npm 产物回归

2026-11-09，基于 `37f174c` 的未提交模块化工作区，在 Node `24.14.0` 执行完整结构、构建新鲜度与行为检查，**248 通过、0 失败、0 跳过**。保留既有断言，新增功能排除组合、配置/文案/协议冲突、权限与装配校验；测试拆分也改变了顶层用例计数，不能只用数量推断覆盖提升。

| SDK 目标 | Cordis / Schemastery | 仓库测试 | 固定生产 SDK + 对应 Host 装配 | 原始目录 |
| --- | --- | --- | --- | --- |
| `0.2.0-rc.1` | `4.0.4` / `3.18.4` | 248 通过、0 失败、0 跳过 | 7 通过、0 失败、0 跳过 | `0.2.0-rc.1-L2xpDC` |
| `0.2.1-rc.5` | `4.0.5` / `3.18.5` | 248 通过、0 失败、0 跳过 | 7 通过、0 失败、0 跳过 | `0.2.1-rc.5-uuMwMJ` |

日志仍为各目录的 `check.log` 与 `production-sdk-host.log`，汇总为 `summary-1794195440660.json`。这两版不替代旧的十二版历史矩阵，也不表示其他版本或真实 GUI 已完成模块化验收。

实际标准 npm tarball 检查包含全部递归源码、十三份模块 Spec 与已校验 Client 产物，排除测试和开发脚本。在独立临时项目执行 `npm install --omit=dev --ignore-scripts` 后，Host 的十六个配置字段、所有公开导出和预生成 Client factory 均可解析，生产依赖树没有 esbuild。仅验证本地 npm 产物与依赖，未发布注册表或操作 DSH/profile；npm 安装来源、真实 RPC 传输、页面与平台行为仍待完整宿主验收。

### TypeScript 与 tsdown 迁移

2026-11-09，在同一未提交模块化工作区将运行源码迁为严格 TypeScript，使用 tsdown `0.23.7`、TypeScript `5.9.3` 与 Node `24.14.0`。完整 `tsc --noEmit`、编译型契约正负例、三个产物新鲜度及 **249 项行为测试**通过，0 失败、0 跳过；相较前一阶段新增首次技能租约无 key 的回归，不替换之前的 JS 快照计数。

| 隔离 SDK | 仓库测试 | 当前编译 Host + 历史 SDK 装配 | 原始目录 |
| --- | --- | --- | --- |
| `0.2.0-rc.1` | 249 通过 | 7 通过 | `0.2.0-rc.1-FNPJSc` |
| `0.2.1-rc.5` | 249 通过 | 7 通过 | `0.2.1-rc.5-Ws2LLx` |

各目录保存 `install.log`、`build.log`、`check.log` 和 `production-sdk-host.log`，汇总 `summary-1794199390535.json`。隔离目录按该 SDK 重新编译声明并执行类型/行为检查；生产 Host 装配通过当前 `dist/index.js` 加载真实历史 Context、Tools 与投影服务。只更新这两版证据，不外推其他版本或完整宿主行为。

标准 npm 包改为编译后的 Host ESM、公开声明、Client factory、十三份 Spec 与资源，不包含 TS 编译输入。独立临时项目安装生产依赖后，十六个配置字段与所有公开子路径可解析，Client factory 可登记，没有 TypeScript、tsdown、esbuild 或第二份 React；额外用独立 `usage.ts` 将包交给原生 `Context.plugin`，公开声明检查通过。公开入口只适配原生基础 Context，内部仍按注入后的结构化服务类型检查。上述验证没有安装 DSH/profile 或发布 npm，真实页面、RPC 传输与完整重启仍待验收。

### 方法边界与复现

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

## 原调查中的适配

[MCP 提供方](../src/features/mcp/mcp-providers.ts)在 Fiber 尚未完成首次配置解析时，可从公开 `rawConfig.serverName` 读取字面量身份，避免等待依赖或加载中的服务器消失。优先使用已解析配置，不执行表达式，不读取命令、参数、环境变量、请求头或 URL；原始名称只用于标识声明，不证明连接成功。模式归属读取补充已验证配置的 id 回退。[MCP 规范](../src/features/mcp/spec.md)记录现行规则。

[通知注册测试](../src/features/notifications/tests/notifications.test.mjs)使用两端均提供的 `onChanged` 和 snapshot 结果验证注册、通知内容、卸载和重新加载，不要求新版才有的 summary keys 接口。原调查中的 [Todo 测试](../src/features/todo-blocking/tests/todo-policy.test.mjs)在旧版使用其导出的真实 scheduler，新版使用真实 pipeline，当时覆盖旧 Agent 的执行拒绝及无关工具可执行行为，不跳过旧版用例。现行 Todo 已调整为只对新对话生效，旧 Agent 保留工具执行能力；这一行为变更未继承原调查的历史兼容结论。[MCP 提供方测试](../src/features/mcp/tests/mcp-providers.test.mjs)补充旧版 schema 深克隆、父层过滤、同名覆盖、限制及错误传播；新版仍验证不读取 schema 的快路径。

## 下一步验收

先在独立环境的最低基线 DSH `0.2.0-rc.1` 与较新目标 `0.2.1-rc.5` 中安装实际 tarball，验证默认关闭时冷启动、设置入口、各功能操作、持久化与卸载；再核对当前版本及目标平台。通过后正式声明最低支持版本，并核对 rc / alpha 范围匹配。旧版仅有 profile 声明、尚未解析配置的 MCP 仍能标记 pending；没有公开身份的纯动态实例在解析后再列出，不读取内部 `_config`。`0.2.0-rc.2` 的工作区 Menu 不支持 `minWidthFromAnchor`，使用该版原生默认宽度，实际页面仍需复核。

## 安装与平台验证记录

以下记录集中保存必要的安装与接口证据。原记录未注明的执行日期、Mod 提交或产物校验值均记为未记录；不推测，也不将当时的提交、推送或安装状态当作当前仓库状态。

| 对象 | 已有证据 | 记录缺项与限制 |
| --- | --- | --- |
| DSH `0.2.2-rc.1` desktop profile，`power-dsh@0.0.1` 源码目录链接 | 通过原生管理器移除旧 `@local/dsh-mod` 后安装新包，当时核对 `include:power-dsh` active；原 profile 有备份，未手工编辑 | 执行日期、Mod 提交与产物哈希未记录；只证明当时源码链接安装，不代表最终 tarball、GitHub 来源或完整 GUI |
| 同次重装的偏好读回 | 原生工具恢复并读回版本显示、主题快捷切换、刷新、账号精简、反馈与遥测精简、Todo 精简六项偏好 | 其余通知声音、个性化（现「全局指令」）及技能/MCP 入口等未自动迁移；不能推导通用自动迁移规则 |
| 任务通知接口与声音 | `0.2.2-rc.1` 安装包核对会话投影、交互状态、桌面 preload、loopback 与 subprocess；原记录声音目录/播放管理 9 项测试通过，macOS 实读声音目录 | 日期、Mod 提交未记录；未播放音频，Windows 仅固定参数与生命周期测试；未验证系统横幅与真实页面 |
| 重启接口与助手 | `0.2.2-rc.1` ASAR preload / main 未发现公开 restart bridge；打包应用身份只读探测可用，AppleScript 经 `osacompile` 编译检查 | 日期、Mod 提交未记录；未执行助手、应用退出或重开；编译成功不证明完整重启 |
| 历史 DSH 完整宿主与平台 | 上述标签、SDK 和 Host 装配证据 | 未安装或启动完整旧宿主；未完成最终 tarball、RPC 真实传输、跨平台页面或系统行为验收 |

原调查使用确切发行标签与相应 SDK 核对接口，没有运行时 Inspect 验收证据。新增功能须按对应[主 Spec](README.md#功能规格spec)逐项验收，不能继承旧矩阵的实际操作结论。
