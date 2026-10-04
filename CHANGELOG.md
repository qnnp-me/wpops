# Changelog

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/),
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

## [0.2.0] - 2026-10-04

### Added
- 导航菜单一级命令:
  - `wpops menus list|get|create|update|delete`;用 `--locations header,mobile` 把菜单绑定到主题位置。
  - `wpops menu-items list|get|create|update|delete`,支持 `--menus`、`--menu-order`、`--parent`、`--status`、`--type`、`--object`、`--object-id`、`--url`、`--target`、`--classes`、`--description`、`--attr-title`、`--xfn`;`delete` 真正执行需 `--force`。
- 核心 REST 覆盖大幅扩展:
  - `content` / `terms`:任意 `show_in_rest` 的 CPT / 自定义分类(按 rest_base)。
  - `search` 跨内容搜索;`settings` 读取/更新站点设置;`types` / `taxonomies` / `statuses` 自省。
  - `revisions`(list/get/delete/restore)、`blocks`(可复用区块)、`navigation`、`templates`、`template-parts`、`global-styles`。
  - `widgets` / `sidebars`、`app-passwords`(创建时明文只打印一次)。
  - `comments create`;`plugins delete <plugin> --force`。
  - `abilities`(list/get/run)、`health`(list/<test>)、`batch`(仅 POST/PUT/PATCH/DELETE)。
- CLI 能力:`--all-pages` 自动翻页;`--fields` / `--csv` / `--table` 输出投影;`--quiet`;`--output <文件>`;`--site a,b`;`--timeout` / `--retries`;`sites show|rm|rename`;`completion bash|zsh|fish|powershell`;`help <组>`。
- 所有菜单写命令支持 `--dry-run`;`--all` 护栏识别菜单与所有新写操作。
- 注:`/menus`、`/menu-items` 由站点插件提供;`abilities`、`health` 也需对应插件。

### Fixed
- `delete` 的 `--dry-run` 现在是**真预览**:预览不再要求 `--force`(菜单/菜单项/分类/用户与文章/媒体 行为对齐);真正执行删除仍需 `--force`。
- 菜单端点不存在(`rest_no_route`)时给出"需插件"的友好提示,便于排障。
- JSON 文件输入容忍 UTF-8 BOM(Windows 重定向/记事本常见),`--data` / `--requests-file` / `--from-file` 等不再因 BOM 解析失败。
- `batch` 明确拒绝 GET(核心 `/batch/v1` 只支持 POST/PUT/PATCH/DELETE),并兼容裸数组与 `{"requests":[...]}` 两种写法。

### Changed
- README 命令清单/能力表与内置 skill 速查补充上述用法,并说明 `--dry-run` 预览与 `--force` 的关系。

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

[Unreleased]: https://github.com/qnnp-me/wpops/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/qnnp-me/wpops/compare/v0.1.1...v0.2.0
[0.1.1]: https://github.com/qnnp-me/wpops/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/qnnp-me/wpops/releases/tag/v0.1.0
