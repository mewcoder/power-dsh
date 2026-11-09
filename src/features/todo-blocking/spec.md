# 停用 Todo 工具

模块 id：`todo-blocking`；主开关 `blockTodo` 默认 `false`。模块的[定义](definition.ts)、[配置](config.ts)、[Client](client.ts)与[行为测试](tests/)在本目录维护。

## 入口与范围

在 **设置 → PowerDSH → 精简** 提供独立「停用 Todo 工具」开关，说明为「新对话中不再生成待办列表」，默认关闭，使用宿主设置持久化为 `blockTodo`。UI 与 `power_dsh_settings` 工具共用 owner-only `setTodoBlocked` 操作，由现有 Host 队列串行执行。

只匹配 `@deepseek-ai/dsh-tool-todo`。全局条目通过原生 Plugin Manager 启停；可管理的 `@deepseek-ai/dsh-agent-preset` 声明通过原生 ConfigEditor 修改其中 Todo 条目的 `disabled`，包含 `group: true` 的嵌套条目。保留其他插件、模式元数据、配置与表达式，不手写 profile 文件。开启时禁用，关闭时启用，包括原本已停用的 Todo 条目，不保存之前的状态。

不修改 `@deepseek-ai/dsh-client-ui-conversation`，不遮蔽 Todo 面板，不删除历史 `todo/write` 事件或清空列表；已有面板由原生会话投影决定显示。自动化任务、后台命令、目标和子代理均不在目标范围内。

## 生效与生命周期

按用户确认，仅对使用当前模式代际的新建顶层对话生效。已打开 Agent 保留旧代际及原有 `todo_write` 能力；Mod 不添加 `tools.restrict`、`tools.guard` 或 Agent/设置事件监听，不主动改写待办状态或拦截旧会话调用。旧 Agent 派生的子代理可按原生规则继承旧代际。

关闭开关启用当前模式声明，新建对话恢复 Todo；禁用期间创建的已打开对话不会自动取得新工具。会话重新打开、切换模式或宿主重启后使用哪个代际由宿主决定，不为历史会话保存额外快照。其他插件施加的限制继续生效。停用或卸载 Mod 释放策略绑定，但不会自动启用已由原生管理器持久停用的插件；需要撤销精简时先关闭开关。

Host 只依赖 `agentPresets` 提供策略执行，缺席时明确报错。操作完成前读回全局条目及模式 composition inventory，保存偏好后核对配置，不检查或改动已有 Agent。任一步失败在对应设置行显示错误，可重新执行；已完成的原生变更可能保留，不建立恢复记录或自动回滚框架。原生写锁回调和后续操作受共享队列生命周期保护。

ConfigEditor 保存完整模式配置作为 profile 覆盖；之后上游模式的默认配置更新可能被这一原生覆盖保留，沿用宿主的模式配置管理行为。

## 接口依据与验证

已检索 dsh-market 的 Todo、任务与精简相关条目，未找到可直接复用的原生全局与模式 Todo 停用实现。接口核对以本机 DSH `0.2.2-rc.1` 安装包与同版本 SDK 的 Plugin Manager、ConfigEditor、Tools 为依据，属于源码与 SDK 核对证据。对照官方参考仓库 `deepseek-ai/deepseek-harness`，提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 的 `packages/todo/tool-todo`、`packages/preset/agent-preset-registry`、`packages/boot/config-editor`、`packages/core/tools` 和 `packages/bundle/web-app/presets` 理解作用域与代际行为，没有复制工具或 UI 实现，也不引入依赖。

仓库检查与行为测试验证原生启停调用、配置保留、新旧代际的工具可见性与旧会话仍可执行、失败读回和卸载保护；代际测试使用真实 Cordis/Tools 作用域与受控配置夹具，租约保留另由原生源码核对。Client 测试验证独立开关、RPC 合约、即时反馈和失败恢复。本次已通过严格类型、构建新鲜度、344 项全仓测试（Todo 20 项）、实际打包、独立生产安装及 diff 空白检查。实际安装应用、页面点击和完整应用重启另行验收，不以仓库测试代替运行时页面验证。
