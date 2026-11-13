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

### 2026-11-12 首版候选回归与实机反馈

本次候选基于 `9c800b1`，运行源码及三个构建产物未改变；新增发版 Skill 与安装文档，兼容检查器的隔离复制清单补齐 `LICENSE` 和 `.agents/`。这次只定向补测两版，不改写上面的十二版历史数字，也不将结果外推到未复测版本。

| 对象 | 本次结果 | 证据与限制 |
| --- | --- | --- |
| DSH SDK `0.2.0-rc.1` | 558 项仓库测试、7 项固定生产 SDK Host 装配检查通过，0 失败、0 跳过 | Node `24.14.0`，Cordis `4.0.4`、Schemastery `3.18.4`；隔离 SDK／Host 回归，不是完整旧版桌面安装 |
| DSH SDK `0.2.1-rc.5` | 558 项仓库测试、7 项固定生产 SDK Host 装配检查通过，0 失败、0 跳过 | Node `24.14.0`，Cordis `4.0.5`、Schemastery `3.18.5`；同样不替代完整旧版页面验收 |
| macOS arm64，DSH Desktop `0.2.2-rc.1`，desktop profile | 已安装 GitHub 来源 `mewcoder/power-dsh` 的 `9c800b17cd96d7a7020616e8e0cf1efb21f76566`；已核对三个产物与仓库一致、插件管理中启用、两次冷启动与主界面、PowerDSH 设置入口及五个分类可见 | 只记录实际执行到的层次；未将选图、永久删除、精简写入、系统通知、卸载及升级的全部场景记为通过 |
| Windows 桌面使用反馈 | 用户于本次发版准备中再次确认曾在 Windows 使用 PowerDSH | 这是已有实机使用反馈，不应写成“从未使用 Windows”；具体宿主版本、Mod 提交及逐项验收未补录，不擅自补造 |

本次兼容回归的汇总标识为 `summary-1794442466736.json`；对应目录标识为 `0.2.0-rc.1-hBc6hj`、`0.2.1-rc.5-N3BQnW`，各自保留 `check.log` 与 `production-sdk-host.log`。这些原始日志仍在忽略的兼容检查目录，不随仓库或安装包发布。首次运行曾因隔离副本缺少新 Skill 造成文档链接检查失败；修正复制清单后重新执行通过，未将该工具问题解释为 SDK 不兼容。

安装范围采用 `>=0.2.0-rc.1 <0.3.0-0`，保持既有最低基线，并排除下一次版本系列；允许安装的范围与已逐项验证的版本列表分别维护。本机 `0.2.2-rc.1` 的官方 app-boot 实现用 `semver.satisfies(..., { includePrerelease: true })` 检查 `engines.dsh`；这不改变普通 npm peer 范围的预发布匹配规则。

已安装 GitHub 产物的 SHA-256：

| 产物 | SHA-256 |
| --- | --- |
| `dist/index.js` | `851ad8f6cec3292d478f4be9d221f397ff2f0573f749f14c3e4011ea720a01ce` |
| `dist/index.d.ts` | `1a89acf0f887b7e53f44fab43122a17061ea58da918bdd7cf596ac28e81b6e0a` |
| `dist/client.js` | `77bd742a757a6722200ec6bdbf2b0311cb112e6ec2b18130b16f2572618aadff` |

### 2026-11-12 0.0.2 依赖模型修正

Windows 用户报告启用失败：`EPERM: operation not permitted, stat ...power-dsh\node_modules\.pnpm\@deepseek-ai+cordis@4.1.0\...\cosmokit`。原因是 0.0.1 把宿主 SDK 声明为普通依赖，安装时在插件目录内嵌套安装 `dsh-tools` 及其 peer `cordis`，pnpm 需在 Windows 上为这些包创建目录联接；权限不足或存在陈旧联接时即报 `EPERM`。

0.0.2 将 `@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-typert-protocol` 与 `@deepseek-ai/schemastery` 改为可选 `peerDependencies`，由宿主提供；包内不再声明生产依赖。peer 范围按预发布分支显式书写（`>=0.2.0-rc.1 <0.2.1-0 || >=0.2.1-alpha.1 <0.2.2-0 || >=0.2.2-alpha.1 <0.3.0-0`），避免 npm 默认规则把 rc 版本排除。

验证：`npm run check` 558 项通过、`check:package` 与实际 tarball 通过、`check:install` 在独立项目中确认包内零生产依赖且宿主提供的 peer 可解析；`check:compat` 在 `0.2.0-rc.1` 与 `0.2.1-rc.5` 上各通过 558 项测试与 7 项 Host 装配检查。该验证不包含 Windows 实机复测，Windows 结果待用户反馈。

### 2026-11-12 Windows 通知后续反馈

Issue #1 的新增实测环境为 Win11 24H2（26100）、DSH `0.2.2-rc.2`、PowerDSH `0.0.4`。反馈确认：即使使用独立 tag、`renotify: true` 和静音参数，renderer Web Notification 仍只进入通知中心；去掉这些参数的通知，以及同 AUMID 的 WinRT 直发通知能显示横幅。这是 0.0.4 的实机失败证据，先前的参数与 tag 历史模拟没有覆盖该故障，不再视为实际横幅修复的证明。

后续本地修复将本机 Windows 桌面端通知与默认声音试听交给 Host 的 PowerShell 5.1 / WinRT 通道；复用已核对的 subprocess 能力，不增加依赖、现场编译或系统身份注册。四类触发、静音、声音选择、定向清理、超时、owner 权限和卸载通过自动化回归；新增 Windows 专属检查只解析实际脚本及 XML，不显示通知。macOS 的仓库检查与隔离安装不能替代 Windows 的横幅、驻留、关闭及声音验收；新实现尚未完成这组实机复测。

本地最终检查为 576 项、575 通过、0 失败、1 项 Windows 专属脚本/XML 解析跳过，构建新鲜度、实际包和隔离生产安装通过。`0.2.0-rc.1`、`0.2.1-rc.5` 分别通过相同 576 项仓库检查（同样跳过 1 项）及 7 项固定生产 SDK Host 装配检查。汇总标识为 `summary-1794469999134.json`，隔离目录标识分别为 `0.2.0-rc.1-I3coDY`、`0.2.1-rc.5-HcF39V`。原始证据保留在忽略的兼容检查目录；未运行 Windows runner 或 Windows 桌面安装。

### 2026-11-12 通知通道握手与手动更新入口

Issue #1 的下一条反馈指向 `0.0.5`，仍描述 renderer 的 tag／renotify／silent 参数和点击聚焦行为，与 0.0.5 原生 Toast 的实现不同。现有材料不足以判定用户运行的是哪条路径，也不能将其直接归结为用户没有更新。核对官方 `dsh-v0.2.2-rc.2` 的桌面 preload、Web 启动和 connection 源码：正常桌面启动会提供平台标记、desktop bridge 以及 `ownsHost`，因此“这个宿主版本一定没有标记”并没有源码依据。

本轮将通知平台选择改为 Host RPC 握手，附真实 Host 包版本并检查 Client 构建版本；未知／失败／不匹配时不发送浏览器通知。本机 Windows 不再依赖页面标记路由。浏览器路径移除 tag／renotify；新增三档提醒与实际通道测试按钮，以便下次实机反馈能区分旧运行代际、浏览器路径和 WinRT 请求。新增能力沿用已使用的 Typert／configForms／subprocess 接口。

设置页的插件更新入口仅调用市场公开 update API v1（本轮参考 `dshmarket 1.73.19`），无此 API 的市场只显示不可用反馈，不导入或调用私有安装实现。市场 API 仍是 beta，正常状态不轮询；安装、恢复和来源处理归市场，插件只校验目标与读回结果。实际自更新、重载后的进度恢复和页面视觉尚未在真实 DSH 中验收。

最终本地检查 596 项，595 通过、0 失败、1 项 Windows 专属脚本解析跳过；实际 tarball、公开入口和独立生产安装通过。`0.2.0-rc.1` 与 `0.2.1-rc.5` 各通过同样仓库检查及 7 项固定生产 SDK Host 装配检查，汇总为 `summary-1794476515573.json`，目录标识 `0.2.0-rc.1-374CFg`、`0.2.1-rc.5-xNiUOZ`。没有执行 Windows 实机横幅、驻留及声音，也未重新运行 Windows CI；代码回归不能解释为反馈场景已实机修复。

### 0.0.6 后续本地通知与更新检查验证（2026-11-12）

本轮工作区仍使用 `0.0.6` 包版本，属于未发布修改。Windows Toast 身份改为显式配置优先，否则只读发现 DSH 的开始菜单／注册表身份，缺失或歧义时明确失败；任务通知合并为三档选项，测试铃铛放在选择框紧邻左侧。检查更新由 Host 使用 Git 远端标签并核对公开 Release 与附件，不再请求 GitHub REST API；安装仍交给市场。

已通过原生 CLI 将本地目录链接安装到既有 `desktop` profile，完成 macOS arm64 / DSH desktop `0.2.2-rc.2` 冷启动，核对来源与三个构建产物，保留偏好。实际点击测试图标收到浏览器 `show` 确认，图标变为勾号并提示「已交给系统」。从不提醒时图标禁用、声音子项隐藏，验收后恢复始终提醒与声音关闭。现场系统不允许共享屏幕时通知，且正在共享屏幕；没有修改系统设置，也没有确认横幅与声音，不将 `show` 事件等同于横幅验收。

最终调整图标位置与更新文案后，重建并通过应用内「刷新界面」载入，实际截图确认铃铛位于提醒选择框左侧，左侧保留名称与说明。实际点击检查更新成功，运行版本与正式版均为 `0.0.6`，页面显示「当前版本无需更新」。没有执行新版安装或自更新恢复验收。Inspect 不可用，接口依据沿用已核对的确切发行包与公共 subprocess 契约。

最终仓库检查 614 项，612 通过、0 失败、2 项 Windows 专属检查跳过；实际 tarball 37 文件、公开入口与独立生产安装通过。另以 macOS PowerShell `7.7.0` 执行 14 项 Toast 脚本解析、XML 与模拟身份发现检查，全部通过，无跳过；这不能替代 Windows PowerShell 5.1 或 Windows 实机 Toast。Windows 横幅、驻留与声音仍未完成本轮实机验收。

本轮 Host、协议及通知行为改动已在 `0.2.0-rc.1`、`0.2.1-rc.5` 隔离 SDK 上分别通过仓库检查与 7 项生产 SDK Host 装配检查，汇总为 `summary-1794484381309.json`，目录标识 `0.2.0-rc.1-IdXTjl`、`0.2.1-rc.5-2pmWZb`。该 SDK 记录先于最终图标位置与文案调整；最终调整通过上述当前 SDK 仓库与包检查，没有重复执行历史 SDK 矩阵。本轮未提交、推送或发布。

### 0.0.7 后续下拉控件修正（2026-11-12）

针对触发按钮缺少下箭头和交互状态的问题，读取实际 DSH desktop `0.2.2-rc.2` 发行包中的通用设置 `DesktopChannelRow.tsx` 与样式，核对固定高度、图文间距、字体及悬停态；提醒选项与提示音均引用宿主 regular 下箭头 sprite，继续使用公开 `Menu`，未新增宿主 API、依赖或菜单浮层。Inspect 不可用；参考来源与许可证见[第三方资源声明](third-party-notices.md#原生设置下拉触发按钮)。

在既有 macOS 本地链接安装中，重建后实际打开 PowerDSH 设置，截图确认提醒选择框的原生下箭头与左侧测试图标；实际打开三档菜单、按 Escape 收起并确认焦点回到触发按钮。临时开启通知声音以检查提示音下拉，实际打开系统默认与本机提示音列表，按 Escape 关闭并恢复声音关闭状态，最后返回原会话。没有重启应用或停止正在运行的任务。本记录仅证明该平台与当前场景的显示及菜单交互，不扩大原有通知横幅、声音或跨平台结论。

### Windows PowerShell 重启实现（2026-11-12，未发布）

按用户明确要求为 `restart-button` 增加 Windows 路径。只读依据包括桌面 `0.2.2-rc.2` 的关窗隐藏行为、Host 以 Electron Node 模式启动的进程关系，以及[重启 Spec](../src/features/restart-button/spec.md#参考与验证)列出的同类插件。Inspect 不可用；未使用私有 Electron IPC 或改写安装包。Windows 采用 Explorer 交接 PowerShell，按当前实例的路径、产品名、主进程／Host PID 与创建时间核对身份；匹配的助手确认就绪并得到一次性授权后，才结束当前进程树并重开同一路径。确认弹窗明确说明强制关闭与未保存内容风险。

macOS PowerShell `7.7.0` 下重启模块 23 项定向测试通过，无跳过，包括真实 PowerShell 语法解析、模拟 CIM 身份／祖先链／PID 复用校验，以及 Host 交接、失败、重复请求、过期、卸载和 Client 确认／断线回归。它们没有调用真实 Windows 进程结束、Explorer 或重开操作，不代替 Windows PowerShell 5.1 与 Windows 桌面实机验收。

为保护同一工作区正在开发的其他功能，先从 `0.0.7` 基线叠加本次重启与下拉修正，在临时隔离源码中执行完整检查：625 项，621 通过、0 失败、4 项平台检查跳过；实际包与独立生产安装通过。`0.2.0-rc.1`、`0.2.1-rc.5` 分别通过同轮隔离仓库检查及 7 项生产 SDK Host 装配检查，记录为 `summary-1794489370086.json`，目录标识 `0.2.0-rc.1-xmBp35`、`0.2.1-rc.5-3A5eC9`。此 SDK 检查先于最后一处终态临时目录清理补充；清理由最终当前 SDK 检查覆盖，未扩大平台结论。

并行功能完成类型登记后，合并工作区的最终构建、633 项仓库检查（629 通过、0 失败、4 跳过）、38 文件实际包和独立生产安装亦通过；数字包含并行功能，不能全部归为重启新增测试。保留已有开关及 macOS 正常退出路径，没有实际重启当前应用。本轮 Windows 真实关闭、重开、页面可用、偏好恢复仍未验证，尚未提交或发布。

### 插件版本设置行（2026-11-12，未发布）

版本与更新入口改为「通用」最后的标准设置行；右侧检查与更新操作直接使用宿主公共 `Button`，尺寸为 `md`（36px），与通知下拉等高。沿用已核对的公共 Button／Modal 接口，没有新增宿主 API。macOS / DSH desktop `0.2.2-rc.2` 既有本地链接安装中实际截图确认标题、版本与按钮布局；切到「界面」「其他」时版本行隐藏，入口不再提供独立开关，返回通用恢复版本行且不主动检查更新。

重建后仓库检查 625 项，621 通过、0 失败、4 项平台检查跳过；37 文件实际 tarball 与独立生产安装通过。此记录不增加 Windows 实机或实际自更新安装的验收结论；未提交、推送或发布。

### 0.0.8 技能管理与发版回归（2026-11-13）

本轮包含技能发现、按项目分组、搜索、目标确认导入、DSH 自有技能删除，以及共享错误反馈、版本设置行与通知控件修正。发版审查时，功能源码通过当前 SDK 的 698 项仓库检查：694 通过、0 失败、4 项平台检查跳过；构建新鲜度、37 文件实际包与隔离生产安装通过。

同一功能源码在 `0.2.0-rc.1`、`0.2.1-rc.5` 的隔离 SDK 中各通过相同 698 项检查和 7 项生产 SDK Host 装配检查，汇总标识 `summary-1794537600973.json`，目录标识分别为 `0.2.0-rc.1-jBqXCJ`、`0.2.1-rc.5-iZBy3o`。这些回归先于版本号、发版文档与内联版本产物改为 `0.0.8`；最终版本继续执行当前 SDK 的固定发布检查，不将旧 SDK 结果扩大为完整实机验收。

既有 macOS / DSH desktop `0.2.2-rc.2` 本地链接安装中，原生管理器重载后已实际验证技能卡片、工作区默认展开、发现搜索及数量联动、已存在状态、导入目标交互，以及删除确认和取消。实际文件删除与链接保留由隔离文件系统测试覆盖，没有删除用户实机技能。未执行本轮 Windows 完整关闭、重开和偏好恢复，也未验证真实插件自更新安装；保留此前通知与平台验证边界。
