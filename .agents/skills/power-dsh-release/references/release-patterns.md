# 发版实践参考

核对日期：2026-11-12。以下只借鉴流程设计，不复制其他插件的发布脚本或执行其代码。它们的宿主范围不构成 PowerDSH 的兼容性证明；PowerDSH 的事实仍以仓库文档和本次实际结果为准。

## dsh-market：固定入口、版本校验与分渠道

核对提交：`4c330686ee5d761f9e05637820532d8c080947d5`。

- [发布 workflow](https://github.com/dsh-market/dsh-market/blob/4c330686ee5d761f9e05637820532d8c080947d5/.github/workflows/release.yml)集中处理发布，先检查、核对 tag 与包版本，再区分 `latest`、`beta`、`dev`。
- 正式 tag 与开发试用路径分开，避免试验版本覆盖所有用户使用的渠道。
- npm trusted publishing 绑定特定仓库与 workflow 文件；仅复制 YAML 不会获得发布权限。
- [README](https://github.com/dsh-market/dsh-market/blob/4c330686ee5d761f9e05637820532d8c080947d5/README.md#install)区分桌面管理器和 CLI 的 profile，提醒不要把 `web` 安装结果当成桌面安装结果。

**PowerDSH 采用**：固定 Skill 入口、版本／渠道核对、桌面安装说明、发布结果可追溯。

**不直接照搬**：OIDC 配置、自动打 tag、开发渠道、GitHub Release 自动发布或预打包钩子。当前仓库已有预生成 `dist` 与手工发布约定；改变 CI 和发布凭据方式须另有授权。

## dsh-unlag：发布后反查注册表

核对提交：`f013115817afeb46e03665830a032c02dd4df832`。

- [release.sh](https://github.com/regrevia/dsh-unlag/blob/f013115817afeb46e03665830a032c02dd4df832/scripts/release.sh)不是看到上传输出就结束，而是查询确切版本文档，确认公共注册表能实际提供该版本。
- 版本元数据与 `latest` 可能有不同缓存延迟；脚本对结果不明和已上传的情况先核验，而不是盲目重发。
- [package.json](https://github.com/regrevia/dsh-unlag/blob/f013115817afeb46e03665830a032c02dd4df832/package.json)用 `engines.dsh` 声明 `>=0.2.0-rc.1`。这是该插件的声明，不自动成为本项目的范围。

**PowerDSH 采用**：确切版本、integrity 与渠道三项核验，有上限的查询重试，区分上传与公开可用。

**不直接照搬**：平台钥匙串读取、临时 token 配置和机器上的绝对日志路径。使用正常 npm 登录／官方人工验证，不收集用户秘密。

## dsh-ui-tweaks：构建产物随发布准备

核对提交：`c2e0a0cefbf3d95f4b904d266d657a5ab358021c`。

[package.json](https://github.com/wlj521/dsh-ui-tweaks/blob/c2e0a0cefbf3d95f4b904d266d657a5ab358021c/package.json)提供独立 typecheck、build，并在 `prepublishOnly` 构建。

**PowerDSH 采用**：源码、类型和实际交付产物都需检查。

**保留本项目做法**：使用既有 `check:build`、`check:package` 和 `check:install`，先校验已提交产物的新鲜度，不靠发布前自动重建掩盖遗漏；不新增重复构建钩子。

## 市场投稿的独立边界

[awesome-dsh-plugin 贡献指南](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin/blob/main/contributing.md)是投稿时需要重新核对的活动规则：一条 YAML、正确 Bundle、仓库年龄和 topic、准确功能描述。生成的 README 不手改；只有真实可用的 GitHub Release `.tgz` 才填写 `tarball`。npm 发布不是市场已收录，PR 创建也不是审核通过。

## 继承兼容证据的原则

PowerDSH 已有历史十二版 SDK／Host 装配矩阵与后续回归。发版读取对应记录和实际变更，只补受影响检查；不因换了操作系统、SDK 或操作者就将全部历史结果清零。用户实机反馈、脚本测试和完整页面验收分别记录，既不丢掉已有事实，也不扩大验证结论。
