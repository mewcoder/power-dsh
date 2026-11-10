# 特性模块约定

按特性拆分已经实施。当前代码与宿主接入见[架构规范](architecture.md)，功能行为以模块内的[唯一主 Spec](README.md#功能规格spec)为准。一个 PowerDSH 安装项包含十七项功能，不单独发布功能包或提供新的动态插件市场。

## 目录与所有权

```text
src/
  index.ts                      # Host 公开门面
  client.ts                     # Client factory 源入口
  app/
    host.ts / client.ts         # 两端装配
    host-features.ts            # Host 显式清单
    client-features.ts          # Client 显式清单
    config.ts / rpc.ts          # 配置及严格协议聚合
    settings-tool.ts            # 具名工具贡献聚合
    locales.ts                  # 由 Client 清单组合文案
  shared/
    host/                      # 单队列、原生插件启停
    client/                    # 设置、目录、侧栏外壳
    rpc/                       # 复用的基础 codec
    types/                     # 偏好、wire 与具名方法契约
  features/<id>/
    definition.ts              # 纯元数据：id、分类、顺序、配置键、Spec
    config.ts                  # 本功能 schema，必要的设置工具贡献
    client.ts / locales.ts     # 展示、交互、订阅与双语文案
    spec.md                    # 唯一主规格
    tests/                     # 功能行为测试
    host.ts / rpc.ts           # 有真实 Host 行为或协议时提供
    styles.ts                  # 有独立样式时提供
    ...                        # 本功能内部策略、声音、来源等模块
```

[dist/index.js](../dist/index.js)、[index.d.ts](../dist/index.d.ts)和[client.js](../dist/client.js)是已生成并随源码提交的 Host、声明与 Client 入口；[tests/integration/](../tests/integration/)测试完整装配与功能组合，[tests/shared/](../tests/shared/)测试共享机制，[tests/helpers/](../tests/helpers/)提供内存夹具。不为纯 Client 功能创建空 Host、RPC 或样式文件。

## 装配契约

- `definition.ts` 不导入 Host 或 Client，实现无关的数据可供两端使用。`config.ts` 拥有本功能全部配置，装配核对键归属；目录或 id 变化不构成用户配置迁移。
- [Host 清单](../src/app/host-features.ts)组合 schema、具名设置工具、`createHost`、具名方法和 RPC；[Client 清单](../src/app/client-features.ts)组合对应定义、工厂、文案和协议。默认两端清单覆盖相同功能。
- Client 工厂只贡献自己的设置、页面、侧栏、装饰层或动作；共享外壳处理布局和保存反馈，不判断某个功能的业务流程。刷新与重启共享菜单，各自拥有动作行为。自定义背景独立拥有 `flowingBackgroundEnabled`、`flowingBackgroundOpacity` 与 `flowingBackgroundBlur` 配置，经原生 `configForms` 保存，通过 `shell.overlay` additive slot 仅注册返回 null 的生命周期控制组件。按用户明确授权，在唯一已核对的 AppFrame 底层挂单张全局 Canvas，并只适配主 Spec 列明的原生结构表面；不借用侧栏外壳、不读取会话内容，不将此例外扩大为任意宿主 DOM 改写。
- RPC 在功能目录定义，Host/Client 复用同一组严格 codec；稳定聚合保留公开 id、方法与顺序，裁剪组合只挂载所选协议。不得改为可调用任意字符串方法的远程分发器。
- 配置、设置、RPC 和文案聚合拒绝重复；每项操作仅改所属偏好，保留其他功能当前值。共享策略不维护全功能字段白名单。
- 只依赖本特性、`shared/` 与已核对的宿主能力。禁止跨特性实现导入、特性反向依赖 `app/`，或共享层反向依赖特性。Client 模块图不得包含 Host、schema、Node、测试或独立 React。

## 策略与生命周期

账号与遥测以各自目标、顺序和偏好复用原生启停策略；搜索保留其模式组合和旧 Agent 限制逻辑；Todo、Plan 与 Goal 只更新全局和模式声明，不干预已打开的 Agent；Goal 保留全局目标领域服务、续跑驱动和历史界面。通知、文件编辑、技能目录、MCP 与重启不强行继承同一个业务基类。

模块参与装配、功能开关和内部持久状态是不同层次。关闭技能管理入口不恢复技能；卸载精简模块不自动启用原生目标。副作用归属功能子 context 或组件，Host 操作仍共享一个 owner-only 队列；音效保留独立并发语义，已交接的单次重启助手保留跨退出生命周期。自定义背景的 Canvas、结构表面样式快照、动画与观察器归属自身控制组件；切换会话、运行状态或全局面板不重启动画，原生目标表面替换仅刷新背景适配。减弱动态效果时静态、页面隐藏时暂停，关闭、框架替换或卸载时释放资源，并只恢复仍属于本功能写入值和优先级的样式。各项差异写入本模块 Spec。

## 新增或调整功能

1. 在自己的目录维护定义、配置、实现、文案、主 Spec 与必要测试，遵循[Spec 规范](feature-spec.md)。只创建确有职责的文件。
2. 更新两端显式装配登记；有新 RPC 时更新稳定协议聚合，并在[功能索引](README.md#功能规格spec)登记主 Spec。公共配置键、工具参数、协议、已确认文案与用户行为不得因目录整理而改变。
3. 运行源码使用严格 TypeScript；配置键/值、特性贡献及 Host 方法有具体类型，Client 远程方法从共享 Host 契约映射并添加传输结果包装。共享 wire 文件只声明数据形状，不共享业务状态；外部动态配置在有界适配层进入，运行时 codec 不因 TS 而移除。新增或改变契约时同步必要类型负例。
4. 执行 `npm run build`，通过 tsdown 生成 Host ESM、Host 声明与 Client factory，三个产物与源码一并交付。工具仅为开发依赖；Git 和 npm/tarball 安装不运行构建或 `prepare`。
5. 执行 `npm run check`、`npm run check:package`、`git diff --check`。检查涵盖所有模块与 Spec、递归测试、两端登记、非法依赖、双语 key、构建新鲜度和实际包中的运行资源；测试、脚本与开发规范不进入安装包，模块 Spec 随代码提供。
6. 功能组合测试在内存环境排除登记，验证剩余设置、RPC、资源释放与偏好保留。实际安装和页面按[分层验证](development.md#验证方法与限制)执行，不能用目录结构或测试通过代替真实宿主验收。
