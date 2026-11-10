# power-dsh

> **优雅克制，专注实效。让你的 DSH 更顺手、更高效。**\
> *Minimal, elegant, yet deeply powerful. Making your DSH effortless and efficient.*

<img src="docs/images/0.0.1/settings.webp" alt="PowerDSH 0.0.1 通用设置" width="560">

*0.0.1 · 通用设置（历史截图，展示旧分组；当前分类见下表）*

## 功能清单

<table>
  <thead>
    <tr><th>分类</th><th>功能</th><th>描述</th></tr>
  </thead>
  <tbody>
    <tr>
      <th rowspan="1" scope="rowgroup">通用</th>
      <td>任务通知</td>
      <td>提醒任务完成、出错或需要确认，支持系统提示音选择与试听</td>
    </tr>
  </tbody>
  <tbody>
    <tr>
      <th rowspan="4" scope="rowgroup">界面</th>
      <td>快捷推理等级切换</td>
      <td>在模型选择右侧点击切换推理等级，默认仪表盘，可切换信号格</td>
    </tr>
    <tr>
      <td>外观快捷切换</td>
      <td>切换浅色、深色与跟随系统</td>
    </tr>
    <tr>
      <td>自定义背景</td>
      <td>为界面添加柔和的官网流动背景或自定义壁纸，在弹窗中选择背景类型并调节不透明度与模糊，覆盖侧边栏与主内容区，减弱动态效果时保持静态</td>
    </tr>
    <tr>
      <td>显示版本号</td>
      <td>在侧栏显示 DSH 版本，桌面端可点击进入更新流程</td>
    </tr>
  </tbody>
  <tbody>
    <tr>
      <th rowspan="4" scope="rowgroup">管理</th>
      <td>技能管理</td>
      <td>按全局和项目查看、启停技能，保留共享技能文件</td>
    </tr>
    <tr>
      <td>MCP 管理</td>
      <td>查看全局服务器、工具和运行状态，启停可管理项</td>
    </tr>
    <tr>
      <td>全局指令</td>
      <td>在设置中编辑全局指令</td>
    </tr>
    <tr>
      <td>归档管理</td>
      <td>按工作区分组查看已归档会话，支持搜索、排序、项目筛选、恢复与二次确认后永久删除</td>
    </tr>
  </tbody>
  <tbody>
    <tr>
      <th rowspan="6" scope="rowgroup">精简</th>
      <td>停用官方登录与模型接入</td>
      <td>停用官方登录、账号界面及内置模型接入</td>
    </tr>
    <tr>
      <td>停用官方搜索</td>
      <td>关闭内置 WebSearch，保留 WebFetch。</td>
    </tr>
    <tr>
      <td>停用官方反馈与遥测</td>
      <td>停用官方反馈与遥测</td>
    </tr>
    <tr>
      <td>停用 Todo 工具</td>
      <td>新对话中不再生成待办列表</td>
    </tr>
    <tr>
      <td>停用 Plan 模式</td>
      <td>停用新对话的内置计划模式，保留历史计划</td>
    </tr>
    <tr>
      <td>停用 Goal 模式</td>
      <td>停用新对话的内置目标模式，保留已有目标</td>
    </tr>
  </tbody>
  <tbody>
    <tr>
      <th rowspan="3" scope="rowgroup">其他</th>
      <td>界面刷新</td>
      <td>重新加载当前界面</td>
    </tr>
    <tr>
      <td>重启应用</td>
      <td>重新启动应用，仅在 macOS 打包桌面端显示设置项</td>
    </tr>
    <tr>
      <td>屏蔽双击重命名</td>
      <td>屏蔽侧栏会话标题的双击重命名操作</td>
    </tr>
  </tbody>
</table>

设置按使用频率和功能关联性排序，每项功能均可独立开启。通知声音紧随任务通知，推理按钮样式紧随快捷推理等级切换。表格列出全部功能；「其他」分类收纳界面刷新、重启应用与屏蔽双击重命名，其中 macOS 打包桌面端显示重启设置行，Windows、Linux 和 Web 隐藏该设置项及菜单入口，保留已有偏好。刷新与重启入口收在侧栏顶部的横向三点「更多操作」菜单中，重启菜单项还需 Host 能力确认。

## 使用

PowerDSH 是独立社区维护的 DSH 插件。在 DSH 插件管理页选择安装第三方插件，输入 GitHub 安装来源：

```text
github:mewcoder/power-dsh
```

DSH 会通过包管理器下载源码及运行依赖，无需手动编译。安装并启用后，进入 **设置 → PowerDSH** 按需开启。

正式版计划通过 npm 包 `power-dsh` 分发，目前尚未发布；开发版使用上述 GitHub 来源，安装链路尚待完整验收。安装获取远端已推送的代码；本地目录安装与依赖说明见[安装说明](docs/development.md#安装与使用)。

## 更新记录

具体功能和变化随版本记录，详见[更新日志](CHANGELOG.md)与[版本发布记录](https://github.com/mewcoder/power-dsh/releases)。宿主版本要求见[兼容说明](docs/compatibility.md)。

## 文档与贡献

[文档索引](docs/README.md)汇总产品、界面、架构与各项功能说明。参与开发先读[开发指南](docs/development.md)，按流程检查工作区、实现与验证；AI 协作者从[协作入口](AGENTS.md)开始。版本发布与市场收录见[发布与升级](docs/releasing.md)。

## 链接

[GitHub](https://github.com/mewcoder/power-dsh) · [问题反馈](https://github.com/mewcoder/power-dsh/issues) · [第三方资源声明](docs/third-party-notices.md)
