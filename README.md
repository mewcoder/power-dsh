# power-dsh

> **优雅克制，专注实效。让你的 DSH 更顺手、更高效。**\
> *Minimal, elegant, yet deeply powerful. Making your DSH effortless and efficient.*

<img src="docs/images/0.0.1/settings.webp" alt="PowerDSH 0.0.1 通用设置" width="560">

*0.0.1 · 通用设置*

## 功能清单

<table>
  <thead>
    <tr><th>分类</th><th>功能</th><th>描述</th></tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="5" scope="rowgroup">通用</th>
      <td>显示版本号</td>
      <td>在侧栏显示 DSH 版本，桌面端可点击进入更新流程</td>
    </tr>
    <tr>
      <td>外观快捷切换</td>
      <td>切换浅色、深色与跟随系统</td>
    </tr>
    <tr>
      <td>界面刷新</td>
      <td>重新加载当前界面</td>
    </tr>
    <tr>
      <td>重启应用</td>
      <td>重新启动 DSH 应用，当前仅支持 macOS 桌面端</td>
    </tr>
    <tr>
      <td>任务通知</td>
      <td>提醒任务完成、出错或需要确认，支持系统提示音选择与试听</td>
    </tr>
  </tbody>
  <tbody>
    <tr>
      <th rowspan="3" scope="rowgroup">增强</th>
      <td>个性化</td>
      <td>在设置中编辑全局指令</td>
    </tr>
    <tr>
      <td>技能管理</td>
      <td>按全局和项目查看、启停技能，保留共享技能文件</td>
    </tr>
    <tr>
      <td>MCP 管理</td>
      <td>查看全局服务器、工具和运行状态，启停可管理项</td>
    </tr>
  </tbody>
  <tbody>
    <tr>
      <th rowspan="5" scope="rowgroup">精简</th>
      <td>精简官方登录与模型接入</td>
      <td>停用官方登录、账号界面及内置模型接入</td>
    </tr>
    <tr>
      <td>精简官方搜索</td>
      <td>停用内置网页搜索，保留网页抓取与第三方 MCP 搜索</td>
    </tr>
    <tr>
      <td>精简官方反馈与遥测</td>
      <td>停用官方反馈与遥测</td>
    </tr>
    <tr>
      <td>精简Todo工具</td>
      <td>harness执行过程中不再生成待办列表</td>
    </tr>
    <tr>
      <td>屏蔽双击重命名</td>
      <td>屏蔽侧栏会话标题的双击重命名操作</td>
    </tr>
  </tbody>
</table>

每项功能均可独立开启。刷新与重启入口收在侧栏顶部的横向三点「更多操作」菜单中。

## 使用

PowerDSH 是独立社区维护的 DSH 插件。在 DSH 插件管理页选择安装第三方插件，输入 GitHub 安装来源：

```text
github:mewcoder/power-dsh
```

DSH 会通过包管理器下载源码及运行依赖，无需手动编译。安装并启用后，进入 **设置 → PowerDSH** 按需开启。

当前为待发布开发版，GitHub 安装链路尚待完整验收。安装获取远端已推送的代码；本地目录安装与依赖说明见[安装说明](docs/development.md#安装与使用)。

## 更新记录

具体功能和变化随版本记录，详见[更新日志](CHANGELOG.md)与[版本发布记录](https://github.com/mewcoder/power-dsh/releases)。宿主版本要求见[兼容说明](docs/compatibility.md)。

## 文档与贡献

[文档索引](docs/README.md)汇总产品、界面、架构与各项功能说明。参与开发先读[开发指南](docs/development.md)，按流程检查工作区、实现与验证；AI 协作者从[协作入口](AGENTS.md)开始。版本发布与市场收录见[发布与升级](docs/releasing.md)。

## 链接

[GitHub](https://github.com/mewcoder/power-dsh) · [问题反馈](https://github.com/mewcoder/power-dsh/issues) · [第三方资源声明](docs/third-party-notices.md)
