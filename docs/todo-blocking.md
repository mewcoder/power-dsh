# 精简Todo工具

## 入口与范围

在 **设置 → PowerDSH → 精简** 提供独立「精简Todo工具」开关，说明为「harness执行过程中不再生成待办列表」，默认关闭，使用宿主设置持久化为 `blockTodo`。UI 与 `power_dsh_settings` 工具共用 owner-only `setTodoBlocked` 操作，由现有 Host 队列串行执行。

只匹配 `@deepseek-ai/dsh-tool-todo`。全局条目通过原生 Plugin Manager 启停；可管理的 `@deepseek-ai/dsh-agent-preset` 声明通过原生 ConfigEditor 修改其中 Todo 条目的 `disabled`，包含 `group: true` 的嵌套条目。保留其他插件、模式元数据、配置与表达式，不手写 profile 文件。开启时禁用，关闭时启用，包括原本已停用的 Todo 条目，不保存之前的状态。

不修改 `@deepseek-ai/dsh-client-ui-conversation`，不遮蔽 Todo 面板，不删除历史 `todo/write` 事件或清空列表；已有面板由原生会话投影决定显示。自动化任务、后台命令、目标和子代理均不在目标范围内。

## 生效与生命周期

模式更新保留已经打开的 Agent 所用旧代际。Mod 为这些 Agent 添加原生 `tools.restrict`，从后续可见工具集合移除继承的 `todo_write`，并以全局 `tools.guard` 拒绝执行调用；不替换工具实现。Agent 创建、模式选择与下一步请求时重新核对限制，销毁时释放。已开始执行的调用不会被追溯撤销。自定义模式直接在 Agent 本层注册同名工具时，宿主不支持通过 inherited-tool restriction 隐藏，操作会明确报错。

关闭开关会启用当前模式声明并释放 Mod 添加的限制；从禁用代际创建的现有会话可能需要重新打开或重启 DSH 才能使用新启用的模式代际。其他插件施加的工具限制继续生效。停用或卸载 Mod 释放 guard、限制和监听，但不会自动启用已由原生管理器持久停用的插件；需要撤销精简时先关闭开关。

操作完成前读回全局条目及模式 composition inventory，保存偏好后核对配置与已有 Agent 的工具可见性。任一步失败在对应设置行显示错误，可重新执行；已完成的原生变更可能保留，不建立恢复记录或自动回滚框架。

ConfigEditor 保存完整模式配置作为 profile 覆盖；之后上游模式的默认配置更新可能被这一原生覆盖保留，沿用宿主的模式配置管理行为。

## 接口依据与验证

已检索 dsh-market 的 Todo、任务与精简相关条目，未找到可直接复用的原生全局与模式 Todo 停用实现。接口核对以本机 DSH `0.2.2-rc.1` 安装包与同版本 SDK 的 Plugin Manager、ConfigEditor、Tools 为依据，属于源码与 SDK 核对证据。对照官方参考仓库 `deepseek-ai/deepseek-harness`，提交 `fcc0ad462172522aaf5c93a7b2e01f6b9f0b0159` 的 `packages/todo/tool-todo`、`packages/preset/agent-preset-registry`、`packages/boot/config-editor`、`packages/core/tools` 和 `packages/bundle/web-app/presets` 理解作用域与代际行为，没有复制工具或 UI 实现，也不引入依赖。

仓库检查与行为测试验证原生启停调用、配置保留、工具限制与错误路径；Client 测试验证独立开关、RPC 合约、即时反馈和失败恢复。实际安装应用、页面点击和完整应用重启另行验收，不以仓库测试代替运行时页面验证。
