# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.1.1] - 2026-10-04

### Added
- `wpops --version` / `-v` 显示版本。
- 安装脚本支持一行流,不在仓库内时自动 `git clone`:
  `iwr -useb .../install.ps1 | iex`(Windows)、`curl -fsSL .../install.sh | sh`(macOS/Linux)。

### Changed
- README 补充 npm 一键安装、配置向导与一行流安装说明。

## [0.1.0] - 2026-10-04

### Added
- 首次发布。
- 连接与权限体检:`wpops doctor`(失败返回非 0)。
- 内容增删改查:文章 / 页面 / 媒体 / 分类 / 标签 / 评论 / 用户。
- 插件:列出 / 安装 / 启用 / 停用;主题:列出 / 切换。
- 多站点:`sites/` 档案、`-s <名字>` 指定、`--all` 批量执行。
- 安全:`--dry-run` 预览、`--all` 写操作需 `--yes`、失败自动重试、GET 带 body 拦截。
- 配置向导 `wpops setup`;`wpops install-skill`;npm postinstall 自动安装 skill。
- 内置 agent skill(`skills/wpops/SKILL.md`)。
- 配置目录支持 `WPOPS_HOME` 覆盖。

[Unreleased]: https://github.com/qnnp-me/wpops/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/qnnp-me/wpops/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/qnnp-me/wpops/releases/tag/v0.1.0
