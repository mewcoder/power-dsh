# PowerDSH

> **优雅克制，专注实效。让你的 DSH 更顺手、更高效。**\
> *Minimal, elegant, yet deeply powerful. Making your DSH effortless and efficient.*

PowerDSH 是插件显示名称，`power-dsh` 是它的包名与仓库名。

<img src="docs/images/0.0.1/settings.webp" alt="PowerDSH 管理页" width="560">

## 功能清单

| 分类 | 功能 |
| --- | --- |
| 通用 | 任务通知 |
| 界面 | 自定义壁纸、快捷推理等级切换、外观快捷切换、显示版本号 |
| 管理 | 技能管理、MCP 管理、全局指令、工作区管理、归档、使用统计 |
| 精简 | 停用官方登录与模型接入、停用官方搜索、停用官方反馈与遥测、停用 Todo 工具、停用 Plan 模式、停用 Goal 模式 |
| 其他 | 界面刷新、重启应用、屏蔽双击重命名 |

各项增强在 **设置 → PowerDSH** 独立开关，默认关闭；手动更新入口默认显示，可单独隐藏。

设置页底部可手动检查 PowerDSH 更新，确认后由支持公开更新接口的插件市场处理安装；「其他」可关闭该入口。任务通知支持选择提醒时机，并提供测试通知按钮。

## 安装

PowerDSH 是独立社区维护的 DSH 桌面插件。

**桌面版**：打开 DSH **插件**页 → **添加插件** → 输入来源，安装后启用，进入 **设置 → PowerDSH** 开启功能。

```text
github:mewcoder/power-dsh
```

也可以安装 Release 提供的预构建包 `power-dsh.tgz`。市场收录申请见 [#14457](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/14457)。

**命令行安装**（已装 DSH CLI）：

```sh
dsh plugin --profile desktop add github:mewcoder/power-dsh
```

桌面应用自行管理 `desktop` 配置档，优先使用插件管理器；`dsh web` 使用独立的 `web` 配置档，需另行安装。详见[安装说明](docs/development.md#安装与使用)。

## 要求

DSH `>=0.2.0-rc.1 <0.3.0-0`（最低已测基线 `0.2.0-rc.1`），Node.js `>=22`。各版本、平台与功能的验证范围见[兼容说明](docs/compatibility.md)。

## 更新记录

具体变化见[更新日志](CHANGELOG.md)与[版本发布记录](https://github.com/mewcoder/power-dsh/releases)。

## 文档与贡献

[文档索引](docs/README.md)汇总产品、界面、架构与各项功能说明。参与开发先读[开发指南](docs/development.md)，按流程检查工作区、实现与验证；AI 协作者从[协作入口](AGENTS.md)开始。版本发布与市场收录见[发布与升级](docs/releasing.md)。

## 链接

[GitHub](https://github.com/mewcoder/power-dsh) · [问题反馈](https://github.com/mewcoder/power-dsh/issues) · [第三方资源声明](docs/third-party-notices.md)
