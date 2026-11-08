# 发布与升级

本指南说明 power-dsh 的版本管理、兼容声明、GitHub Release 和 dsh-market 收录流程。源码提交与推送用于仓库协作，不代表已发布版本；标签、Release、npm 发布和市场投稿仍须用户明确确认后执行。

## 名称与准备状态

| 项目 | 当前约定 |
| --- | --- |
| 品牌 | PowerDSH |
| 技术包名 | `power-dsh` |
| 设置入口与页面标题 | PowerDSH（中英文一致） |
| 首版版本号 | `0.0.1`，待发布 |
| 简介 | 中文「DSH 增强插件。优雅克制，专注实效。让你的 DSH 更顺手、更高效。」；英文「A DeepSeek Harness (DSH) enhancement plugin. Minimal, elegant, yet deeply powerful. Making your DSH effortless and efficient.」 |
| 分发附件名 | `power-dsh.tgz`，每版相同 |
| 仓库地址 | `https://github.com/mewcoder/power-dsh`；origin 为 `https://github.com/mewcoder/power-dsh.git`，已核对实际改名 |
| 最低 DSH 版本 | 最低已测基线 `0.2.0-rc.1`；完整宿主验收与 `engines.dsh` 声明待完成 |

[包清单](../package.json)保留 `private: true`。已有 `dsh.bundle` 声明，无编译步骤。[更新日志](../CHANGELOG.md)保留「未发布」与首版草稿。新安装的 Loader 条目、设置命名空间、设置页 id、Host/Client 标识与 RPC 描述符统一为 `power-dsh`，对应技术形式为 `powerDsh`、`power_dsh`。

GitHub 仓库为 `mewcoder/power-dsh`，origin 已核对为新地址。首次源码提交保留 `0.0.1` 待发布状态，仓库元数据、Release 下载地址与市场条目统一使用此地址。尚未创建版本标签、GitHub Release、npm 版本或市场投稿，实际发布前 Release 下载地址不可用。

经用户授权，已通过原生插件管理器移除旧 `@local/dsh-mod` 安装，并从新目录安装、启用 `power-dsh@0.0.1`；当前条目 `include:power-dsh` 为 active。重装前已在 DSH 私有目录备份原 profile 文件，未手工改写 profile。通过原生设置工具恢复并读回版本显示、主题快捷切换、刷新按钮、精简官方账号、精简官方反馈与遥测及精简Todo工具六项偏好；通知声音、个性化和技能/MCP 管理入口等其余偏好未自动迁移。旧 ID `dsh-mod`、`dsh-x-mod` 和两个旧目录符号链接仅保留作兼容。完整 GUI、重启及最终 tarball 升级仍须单独验收。

## 插件卡片的名称与描述

[包清单](../package.json)的 `name` 是技术包名 `power-dsh`，`description` 是通用简介；[中文元数据](../locale/zh.json)与[英文元数据](../locale/en.json)的 `meta.title`、`meta.description` 是本地化名称和简介。插件显示名、Client 设置入口与页面标题中英文均为 **PowerDSH**；设置说明使用对应的双语主简介。改名或改简介时按各自用途一起核对。

用户提供的市场「已安装」截图中，本地开发卡片显示技术包名、版本和路径，没有显示简介；因此调整本项目元数据后仍需在目标市场页面实际核对展示。公开市场的发现卡片还会使用目录条目的描述，目录描述可以比设置页简介更具体。

## GitHub 简介、标签与发现入口

GitHub About、包清单、双语元数据与 Client 说明统一使用已确认的简介：中文「DSH 增强插件。优雅克制，专注实效。让你的 DSH 更顺手、更高效。」；英文「A DeepSeek Harness (DSH) enhancement plugin. Minimal, elegant, yet deeply powerful. Making your DSH effortless and efficient.」。README 首屏独立使用引用块：中文「优雅克制，专注实效。让你的 DSH 更顺手、更高效。」加粗，英文「Minimal, elegant, yet deeply powerful. Making your DSH effortless and efficient.」斜体。项目介绍明确 DSH 插件与独立社区维护身份。具体功能和变化随版本写入更新日志与 Release，主简介保持简短。GitHub topics 与包清单 keywords 仍准确反映宿主与现有功能：

```text
dsh-plugin, deepseek-harness, deepseek, dsh, mcp, notifications, skill-management, customization
```

`dsh-plugin` 同时是市场收录要求之一，其余标签用于准确表达宿主与功能。2026-11-08 的参考样本包括 [dsh-market](https://github.com/dsh-market/dsh-market) 的中英文用途、演示与安装入口，[dsh-unlag](https://github.com/regrevia/dsh-unlag) 的问题与效果说明，以及 [dsh-skill-mcp-manager](https://github.com/alone-tree/dsh-skill-mcp-manager) 的 Skills/MCP 定位与实际截图。参考的是信息表达和发现入口，stars 不作为质量或流量保证。

README 面向使用者，标题固定为 `# power-dsh`，首屏使用已确认的中英品牌引用块，其后展示宽度为 560 的真实截图，保留「分类 / 功能 / 描述」三列功能表与使用入口。功能表始终反映当前代码，不记录逐项版本号；发版时由 Git 标签保留对应代码与 README 快照，详细变化记录在更新日志与 Release。开发流程、测试命令及 SDK 验收矩阵保留在维护文档中。截图在实际界面变化时更新。没有已发布产物、CI 或确定许可证时，不添加相应的成功徽章。本地 README 在用户确认推送后才会更新到 GitHub；Release 下载和市场入口待发布、收录后更新。

## 选择分发方式

建议首版使用公开 GitHub 仓库、版本标签和 GitHub Release，附带可安装的 `.tgz`。后续需要原生注册表版本查询时再发布 npm；GitHub Release 和 npm 可以同时维护。

| 方式 | 用户获取版本 | 更新路径 |
| --- | --- | --- |
| 本地目录 | 本机工作目录 | 更新本地代码后按原生管理器结果重载；不是公开更新渠道 |
| GitHub 源码 | 仓库的提交或标签 | dsh-market 可检查 Git 来源；固定提交用于复现，升级需明确选新目标 |
| GitHub Release 附件 | 某次 Release 的 `.tgz` | dsh-market 可跟踪其支持的 Release 来源；固定标签 URL 指向该版，`latest/download` 指向最新正式版 |
| npm | 包名及确切版本 | 原生插件管理器支持符合其条件的注册表包版本查询与升级；dsh-market 也支持 npm 更新 |

更新能力取决于用户实际安装的来源和管理器。发布 Release 不会自动替换用户正在运行的代码；不能承诺所有管理器都会给 Git 或压缩包安装提供与 npm 相同的更新入口。

## DSH 兼容性

兼容性是发版前置条件。各功能接口依赖、当前证据、旧版验证步骤、平台范围与升级要求统一见[版本兼容性](compatibility.md)。已完成已发布的 12 个 `0.2.0` / `0.2.1` 发行版的代码适配验证、SDK 测试与固定生产 SDK 的 Host 装配检查；最低已测基线与完整宿主验收候选为 `0.2.0-rc.1`，实际产物安装与页面仍待完成，详见[调查报告](compatibility-audit.md)。当前 SDK 版本不是最低宿主要求；没有 `engines.dsh` 也不代表全版本兼容。

先完成兼容矩阵，再按验证结果填写 `engines.dsh` 并核对范围边界，README、更新日志、Release 和市场展示采用相同结论。DSH 安装和 profile 启动优先检查 `engines.dsh`，没有它时才检查 DSH peer 依赖；本包目前没有 DSH peer 范围，因此开发期间没有声明式宿主版本拦截。

兼容矩阵未完成时保留开发版和 Release 草稿。宿主新版、Mod 新功能及依赖变更均需重新评估受影响部分；通过验证后发布新 Mod 版本，保留旧版产物及其兼容声明。

## 版本与更新日志

| 变更 | 示例 |
| --- | --- |
| 修复问题或增加已验证的宿主支持 | `0.0.1 → 0.0.2` |
| 增加一组功能 | `0.0.2 → 0.1.0` |
| 配置或行为不兼容 | 在 `0.x` 阶段递增次版本并说明迁移操作；稳定后用主版本表达破坏性变化 |
| 提供试用版 | `0.1.0-beta.1`，GitHub 标为 Pre-release，npm 使用 `beta` tag |

开发时把用户可感知的变化写入[更新日志](../CHANGELOG.md)的「未发布」，按需使用「新增」「修复」「变更」「兼容性」小节。发版时移入版本小节，填写实际发布日期。说明改了什么、影响谁、是否需要操作；省略没有内容的小节。

包版本写 `0.0.1`，Git 标签写 `v0.0.1`，GitHub Release 标题写 `power-dsh v0.0.1`，对应同一个提交。Release 正文使用该版本的更新日志，加上宿主要求、安装方式与升级操作。已发布的 tag、版本和附件保持不变，修复另发新版本。

## 首次发版前的准备

1. 确认品牌、简介、仓库地址与选定许可证，补充真实的 `repository`、`homepage`、`bugs` 和作者信息，保留[第三方声明](third-party-notices.md)。许可证由作者决定。
2. 完成最低 DSH 版本验证，填写兼容范围，并明确实际验证的平台。
3. 允许公开分发时移除 `private: true` 或设为 `false`，同步调整检查脚本中的开发阶段 private 断言。该标记阻止 npm 发布，DSH 的参考索引生成器也会忽略 private 包，即使源码公开。
4. 如果发布 npm，再次确认包名可用和账号权限；一次注册表查询不是名称预留。包名、patch 引用与 Client 注册 id 必须一致。
5. 审阅项目和打包清单，确认没有凭据、参考仓库和个人日志；准备实际产物验收结果。

## GitHub Release 操作顺序

以下是得到发版确认后执行的步骤。首版用 `0.0.1`，后续替换为目标版本。

1. 修改包版本与更新日志，将「待发布」换为实际日期，并同步 README。
2. 执行检查和打包预览：

   ```sh
   npm run check
   npm pack --dry-run --ignore-scripts
   ```

3. 生成本地产物：

   ```sh
   mkdir -p dist
   npm pack --ignore-scripts --pack-destination dist
   ```

   当前包名会生成 `dist/power-dsh-0.0.1.tgz`。上传 Release 时将附件命名为 `power-dsh.tgz`，每版保持相同。先在测试 profile 中通过原生管理器安装这个实际产物，验证加载、操作、重载和偏好保留。

4. 审阅并提交最终改动；核对产物和检查对应最终提交，再推送主分支与标签：

   ```sh
   git tag -a v0.0.1 -m "power-dsh v0.0.1"
   git push origin main
   git push origin v0.0.1
   ```

5. 在 GitHub **Releases → Draft a new release** 选择已推送的 `v0.0.1`，标题填 `power-dsh v0.0.1`，正文使用该版本更新日志并上传 `power-dsh.tgz`。先保存草稿，核对提交、版本、附件与兼容要求后再发布。试用版使用 beta 版本和 Pre-release；正式版按实际发布意图设置 Latest。
6. 核对公开页面与下载，确认安装包版本、安装来源和源提交一致，再用公开下载地址验证安装。

按当前仓库地址，下载链接为：

```text
# 永久复现某一版
https://github.com/mewcoder/power-dsh/releases/download/v0.0.1/power-dsh.tgz

# 市场条目长期跟随最新正式版
https://github.com/mewcoder/power-dsh/releases/latest/download/power-dsh.tgz
```

`latest/download` 只动态解析标签，附件名是固定文本；因此每版都上传 `power-dsh.tgz`，不要把版本号放进这个固定链接的文件名。以上地址采用已改名的仓库，在实际发布前不可用。

当前使用手工发版流程，没有配置自动发布。需要自动化时，再添加 GitHub Actions：标签检查 → 运行仓库检查 → 打包 → 创建草稿 Release 并上传附件，保留最终人工发布步骤；npm 发布单独配置受信发布或凭据。

## 收录到 dsh-market

dsh-market 的目录来自 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，不是向市场应用本身提交插件代码。按[当前贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)，以当前仓库地址投稿时新增一个文件 `data/plugins/mewcoder__power-dsh.yml`：

```yaml
url: https://github.com/mewcoder/power-dsh
name: mewcoder/power-dsh
category: ui
description:
  en: 'A DSH enhancement plugin offering Skills/MCP management, global instructions, task notifications, and other practical features, with options to streamline built-in functionality as needed.'
  zh: 'DSH 增强插件，提供技能/MCP 管理、全局指令、任务通知等实用功能，支持按需精简内置功能。'
tarball: https://github.com/mewcoder/power-dsh/releases/latest/download/power-dsh.tgz
```

该样例尚未提交。条目中的 `name` 按上游规则使用已核对的 owner/repo；YAML 文件名、url、name 与 tarball 均已统一到 `mewcoder/power-dsh`。发 PR 前重新核对上游要求：当前要求真实可运行的 `dsh.bundle`、仓库创建满一天、添加 `dsh-plugin` topic 和准确描述；两个 README 由上游生成，只新增自己的 YAML 条目。

用户确认并完成首次公开发版后再投稿；合并和目录刷新需要等待。收录后，来源和描述不变的常规发版通常无需每次提收录 PR：发布新 Release、上传同名附件，等待目录或缓存刷新，再实际检查市场显示及更新链路。改变包名、仓库、分发来源或描述时修改自己的目录条目。

Git、npm 与 Release 附件的更新检测不同，不能只创建空 Release 就认定所有来源会升级。[市场文档](https://github.com/dsh-market/dsh-market/blob/main/README.md)说明能检查 npm 版本或 Git 提交，更新入口会提供 Release notes / commits；Release 分发仍需实际核对来源识别、最新版本与旧版升级后的偏好保留。本地目录安装不会因为远端发版就自动变成市场安装。

## 后续增加 npm 发布

确认可用包名与账户权限，完成私有标记调整、许可证与仓库元数据，执行检查、打包预览及真实产物验收。每版使用新版本号，npm 发布后同步创建同版 GitHub Release；npm 包安装者便可通过支持注册表升级的管理器查询版本。

npm 的 `latest` / `beta` 与 GitHub 的正式 / Pre-release 分别设置，一边发布不会自动更新另一边。发布后确认市场识别了正确包名与来源；已有本地目录或 Git 安装不会自动切换到 npm。

## 参考

- [DSH 官方打包与安装指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)
- [DSH 官方插件索引规则](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.zh.md)
- [dsh-market 当前功能与更新说明](https://github.com/dsh-market/dsh-market/blob/main/README.md)
- [市场收录贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)
