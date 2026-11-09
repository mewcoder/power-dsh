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

[包清单](../package.json)的 `name` 是技术包名 `power-dsh`，`description` 是通用简介；[中文元数据](../assets/locale/zh.json)与[英文元数据](../assets/locale/en.json)的 `meta.title`、`meta.description` 是本地化名称和简介。插件显示名、Client 设置入口与页面标题中英文均为 **PowerDSH**；设置页说明独立精简为「DSH 增强插件」／`A DSH enhancement plugin`。改名或改简介时按各自用途一起核对。

用户提供的市场「已安装」截图中，本地开发卡片显示技术包名、版本和路径，没有显示简介；因此调整本项目元数据后仍需在目标市场页面实际核对展示。公开市场的发现卡片还会使用目录条目的描述，目录描述可以比设置页简介更具体。

## GitHub 简介、标签与发现入口

GitHub About、包清单和双语元数据使用已确认的完整简介，设置页只用上文的短说明。完整简介为：中文「DSH 增强插件。优雅克制，专注实效。让你的 DSH 更顺手、更高效。」；英文「A DeepSeek Harness (DSH) enhancement plugin. Minimal, elegant, yet deeply powerful. Making your DSH effortless and efficient.」。README 首屏独立使用引用块：中文「优雅克制，专注实效。让你的 DSH 更顺手、更高效。」加粗，英文「Minimal, elegant, yet deeply powerful. Making your DSH effortless and efficient.」斜体。项目介绍明确 DSH 插件与独立社区维护身份。具体功能和变化随版本写入更新日志与 Release，主简介保持简短。GitHub topics 与包清单 keywords 仍准确反映宿主与现有功能：

```text
dsh-plugin, deepseek-harness, deepseek, dsh, mcp, notifications, skill-management, customization
```

`dsh-plugin` 同时是市场收录要求之一，其余标签用于准确表达宿主与功能。2026-11-08 的参考样本包括 [dsh-market](https://github.com/dsh-market/dsh-market) 的中英文用途、演示与安装入口，[dsh-unlag](https://github.com/regrevia/dsh-unlag) 的问题与效果说明，以及 [dsh-skill-mcp-manager](https://github.com/alone-tree/dsh-skill-mcp-manager) 的 Skills/MCP 定位与实际截图。参考的是信息表达和发现入口，stars 不作为质量或流量保证。

README 面向使用者，标题固定为 `# power-dsh`，首屏使用已确认的中英品牌引用块，其后展示宽度为 560 的真实截图，保留「分类 / 功能 / 描述」三列功能表与使用入口。功能表使用 HTML `rowspan` 纵向合并「通用」「增强」「精简」分类，功能名称使用纯文本，不附逐项文档超链接；始终反映当前代码，不记录逐项版本号；发版时由 Git 标签保留对应代码与 README 快照，详细变化记录在更新日志与 Release。开发流程、测试命令及 SDK 验收矩阵保留在维护文档中。截图在实际界面变化时更新。没有已发布产物、CI 或确定许可证时，不添加相应的成功徽章。本地 README 在用户确认推送后才会更新到 GitHub；Release 下载和市场入口待发布、收录后更新。

## 选择分发方式

建议首版使用公开 GitHub 仓库、版本标签和 GitHub Release，附带可安装的 `.tgz`，这是本项目推荐的分发方式，不是 dsh-market 收录的硬性前提。能从 GitHub 源码正常安装时，也可先按源码来源申请收录；只有无法从源码安装时，市场才要求提供可用的预构建 tarball。npm 发布是可选项，不影响是否收录；GitHub Release 和 npm 可以同时维护。

| 方式 | 用户获取版本 | 更新路径 |
| --- | --- | --- |
| 本地目录 | 本机工作目录 | 更新本地代码后按原生管理器结果重载；不是公开更新渠道 |
| GitHub 源码 | 仓库的提交或标签 | dsh-market 可检查 Git 来源；固定提交用于复现，升级需明确选新目标 |
| GitHub Release 附件 | 某次 Release 的 `.tgz` | dsh-market 可跟踪其支持的 Release 来源；固定标签 URL 指向该版，`latest/download` 指向最新正式版 |
| npm | 包名及确切版本 | 原生插件管理器支持符合其条件的注册表包版本查询与升级；dsh-market 也支持 npm 更新 |

### 安装来源与依赖

不发布 npm 包或 Release 附件时，用户仍可通过原生插件管理器安装 `github:mewcoder/power-dsh`，也可固定到已推送的提交或实际存在的标签。原生管理器调用 pnpm，负责获取 Git 源码和包清单声明的运行依赖；本项目的 JavaScript 入口无需构建，不需要另加 `prepare`。`private: true` 仅限制 npm 发布，不禁止 Git 或本地 tarball 安装。具体操作与当前验收状态见[安装说明](development.md#安装与使用)。

普通 `npm pack` 不会自动包含 `node_modules/`，Release `.tgz` 同样需要安装时解析并获取运行依赖，不能承诺离线安装。本地链接目录保留自己的依赖树，开发者须先在源码目录安装依赖。需要共享宿主实例的 SDK 与普通依赖的声明方式仍按[首次发版准备](#首次发版前的准备)核对，不因选择 Git 来源而机械移动依赖。

上述机制依据[官方安装指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md#从-github-安装构建脚本这道坎)及参考源码中 Plugin Manager 的 `installBundle()` → pnpm `add` 路径核对；上游主分支不等于全部历史发行版的验收结论。

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
3. 按分发渠道核对 `private`：npm 发布前须移除 `private: true` 或设为 `false`，并同步调整检查脚本中的开发阶段 private 断言；DSH 官方参考索引生成器也会忽略 private 包。不要将这项规则套作 dsh-market 收录的明确门槛，后者按自己的贡献指南检查。
4. 如果发布 npm，再次确认包名可用和账号权限；一次注册表查询不是名称预留。包名、patch 引用与 Client 注册 id 必须一致。
5. 审阅项目和打包清单，确认没有凭据、参考仓库和个人日志；准备实际产物验收结果。
6. 核对官方 `@deepseek-ai/*` 包的依赖声明。市场指南推荐使用 `peerDependencies`；本包目前仍使用固定版本的 `dependencies`，调整时须同时核对宿主模块身份、更新锁文件并执行检查与安装验证。peer 范围须显式包含所支持的预发布分支，不将宽泛范围误当成包含所有 alpha / rc。此项属于上游推荐，不能不经验证机械移动依赖。

以上许可证、兼容范围与实际产物验收是本项目的发布准备要求；市场自身的收录门槛见下文，不能将两者混为一谈。

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

dsh-market 的目录来自 [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)，不是向市场应用本身提交插件代码。投稿前重新读取[当前贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)，本文按 2026-11-09 核对结果维护；上游变更后同步修订，不从旧样例推断新要求。

### 上游要求与可选项

- 必须有真实可用的代码，公开仓库的 `package.json` 声明可安装的 `dsh.bundle`，并提供对应 patch；只有 `dsh.client` 不够。
- 仓库创建满一天，添加 `dsh-plugin` topic，保持维护；没有提交数量门槛。
- 描述准确、只说明功能，不写营销词或未经验证的能力；分类贴合实际用途。本项目采用 `ui`。
- 条目须有正确的 `url`、`name`、`category` 和以句号结尾的 `description.en`；中文描述可选，本项目保留中英文与中文「等实用功能」。
- npm、Release、图标和截图都是可选项；不能从源码安装时必须提供可用的 Release tarball。填写 `tarball` 时必须使用 GitHub Release 托管的 HTTPS `.tgz`，不能填写不存在的下载地址。

### 首次投稿

先确认所选公开来源能在目标 DSH 安装、加载和操作。源码来源须验证 GitHub 安装，不能只用本地目录加载结果替代；Release 来源须验证实际下载的 tarball。依照本项目的兼容规范记录证据和限制，不宣称未验证的版本或平台。

Fork 目录仓库，从最新 `main` 建立投稿分支，只新增 `data/plugins/mewcoder__power-dsh.yml`。源码收录使用以下内容：

```yaml
url: https://github.com/mewcoder/power-dsh
name: mewcoder/power-dsh
category: ui
description:
  en: 'A DSH enhancement plugin offering Skills/MCP management, global instructions, task notifications, and other practical features, with options to streamline built-in functionality as needed.'
  zh: 'DSH 增强插件，提供技能/MCP 管理、全局指令、任务通知等实用功能，支持按需精简内置功能。'
```

只有已公开发布并验证可下载的安装包才追加：

```yaml
tarball: https://github.com/mewcoder/power-dsh/releases/latest/download/power-dsh.tgz
```

该样例尚未投稿。条目中的 `name` 使用实际 owner/repo；YAML 文件名、url、name 与可选 tarball 必须一致。保存条目后向上游 `main` 提交 PR，只包含自己的 YAML；两个 README 由上游生成，不手动编辑，也不改动其他插件条目。一个 PR 最多新增三个条目，本项目只新增一个。

`dsh-plugin` topic 只是收录条件之一，不会自动将仓库加入 dsh-market 目录。通常由作者提 PR，也可能由维护者主动添加；目录条目合并并完成网站重建后才算收录，不把 GitHub topic、源码推送或 Release 发布视为已收录。此规则针对 dsh-market，不与 DSH 官方参考索引的发现方式混用。

实际样例与实现已在 2026-11-09 核对：[新增状态插件 PR #13103](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/13103) 和[新增 WebChat 插件 PR #13099](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/13099) 都只新增各自的 YAML；[更新路由插件描述 PR #13106](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/13106) 只修改原条目的双语描述。同类技能/MCP 管理插件也有[独立目录条目](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/data/plugins/alone-tree__dsh-skill-mcp-manager.yml)，其新增记录来自 [PR #2494](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/pull/2494)。目录的 [readEntries](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/scripts/lib/entries.mjs) 从 `data/plugins/*.yml` 读取条目，市场的 [loadRegistry](https://github.com/dsh-market/dsh-market/blob/main/src/registry.ts) 获取已生成目录；这条链路不靠 topic 自动入库。

用户确认投稿后才创建收录 PR，源码收录不额外要求先发 Release。CI 会检查条目数量、`dsh.bundle`、仓库年龄、格式及站点生成，但 CI 通过不等于收录通过；维护者还会核对代码、描述、功能重复与来源。审核或目录刷新没有固定时限。

CI 失败按具体结果修复同一分支，不重复开 PR。被标为 `held: author` 时，完成修改后在同一 PR 留一条说明，等待人工复审；不靠空提交、反复推送或催促解除标签。

### 收录后的更新

| 变化 | 自己的仓库或分发渠道 | 是否修改市场条目 |
| --- | --- | --- |
| Git 源码更新 | 检查、更新版本与说明、提交并推送；实际验证市场对 Git 提交的检测和安装更新 | 来源和描述不变时通常不需要 |
| Release 更新 | 使用新版本和标签，验证新产物，发布 Release 并上传同名 `power-dsh.tgz`；保留旧版本产物 | 已采用有效 `latest/download` 链接时通常不需要 |
| npm 更新 | 发布新版本并保证 `repository` 指向本仓库，等待市场自动关联；不要给 YAML 添加 `npm` 字段 | 通常不需要 |
| 描述、分类、包名、仓库或安装来源变化 | 同步修改相关元数据和文档 | 提 PR 修改自己的原条目，不重复新增 |
| 截图更新 | 在自己的仓库更新图片与可选截图清单 | 通常不需要，等待市场构建或缓存刷新 |

`latest/download` 只指向最新正式 Release；测试版使用明确标签的地址。更新后检查市场显示的版本、下载来源和用户升级后的偏好保留。市场发现新版本不等于用户自动完成升级。

可选的市场 `icon` 须为 GitHub 托管的 PNG / JPEG / WebP 位图，不接受 SVG；不填时回退为作者头像。本项目的插件 SVG 图标不直接用作市场 `icon`。截图可在自己的包根目录声明 `screenshots.json`，列出 1–8 张仓库内相对路径图片；不声明时市场可从 README 提取。不要修改目录仓库的旧截图汇总来添加新条目。

Git、npm 与 Release 附件的更新检测不同，不能只创建空 Release 就认定所有来源会升级。[市场文档](https://github.com/dsh-market/dsh-market/blob/main/README.md)说明能检查 npm 版本或 Git 提交，更新入口会提供 Release notes / commits；Release 分发仍需实际核对来源识别、最新版本与旧版升级后的偏好保留。本地目录安装不会因为远端发版就自动变成市场安装。

## 后续增加 npm 发布

确认可用包名与账户权限，完成私有标记调整、许可证与仓库元数据，执行检查、打包预览及真实产物验收。每版使用新版本号，npm 发布后同步创建同版 GitHub Release；npm 包安装者便可通过支持注册表升级的管理器查询版本。

npm 的 `latest` / `beta` 与 GitHub 的正式 / Pre-release 分别设置，一边发布不会自动更新另一边。发布后确认市场识别了正确包名与来源；已有本地目录或 Git 安装不会自动切换到 npm。

## 参考

- [DSH 官方打包与安装指南](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)
- [DSH 官方插件索引规则](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/guide/plugin-market.zh.md)
- [dsh-market 当前功能与更新说明](https://github.com/dsh-market/dsh-market/blob/main/README.md)
- [市场收录贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)
