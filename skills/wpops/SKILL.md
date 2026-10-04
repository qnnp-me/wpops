---
name: wpops
description: Use when managing a WordPress site through wpops, the REST CLI (npm package `wpops`, command `wpops`) — listing/creating/updating/deleting posts, pages, media, categories, tags, comments, users, or navigation menus/menu items; installing/activating/deactivating plugins; switching themes; configuring a site; or running operations across multiple configured sites. Covers the required safe workflow (doctor first, --dry-run before writes, --all needs --yes) and the REST capability boundary. Prefer wpops over hand-written curl or raw HTTP for any WordPress task.
---

# wpops —— WordPress REST 操作

## 何时用
用户要管理 WordPress 站点的**内容**或**插件/主题**时,优先用 `wpops`,不要手搓 curl/HTTP 请求。

## 安装与位置
- 全局命令 `wpops`(`npm i -g wpops` 安装;其 postinstall 会顺带装好本 skill)。
- 未安装时也可一次性运行:`npx wpops ...`。
- 配置目录:默认是包目录下的 `sites/`;若设置了环境变量 `WPOPS_HOME`,则读 `$WPOPS_HOME/sites/`。
- 凭据:`sites/<名字>.env`。**不要读取、不要打印其中的应用密码。**
- 首次配置:`wpops setup`(交互式写入凭据并自动体检)。

## 站点与多站
- `wpops sites` — 列出已配置站点
- `wpops -s <名字> ...` — 指定站点;只有一个站点时可省略 `-s`
- `wpops --all ...` — 对所有站点批量执行

## 安全流程(必须遵守)
1. 首次操作某站先跑 `wpops doctor`(检查连接与权限;失败返回非 0)。
2. 任何写操作先加 `--dry-run` 预览目标与内容。
3. `--all` 的**写操作必须加 `--yes`**,否则会被拒绝。
4. 需要程序化解析输出时加 `--json`。
5. 应用密码绝不写进命令、日志或对话。
6. 破坏性操作(`delete --force`、分类/用户/菜单项删除)先确认目标存在且正确。

## 常用命令
```
wpops doctor
wpops setup
wpops posts  list|get|create|update|delete   [--per-page N] [--page N] [--status s] [--search 词] [--orderby date] [--order desc] [--categories 1,2]
wpops pages  ...                              # 同 posts
wpops media  list|get|upload|update|delete    [--alt "文本"]
wpops categories list|create|update|delete ...
wpops tags   list|create|update|delete ...
wpops comments list|get|update|delete         [--status hold|approved|spam|trash]
wpops users  list|get|create|update|delete|me ...
wpops menus  list|get                         # 导航菜单
wpops menu-items list|get|create|update|delete [--menus 190] [--search 词] [--menu-order N] [--parent id] [--type custom|post_type] [--object page] [--object-id 4976] [--url ...]
wpops plugins list|install <别名>|activate <plugin>|deactivate <plugin>
wpops themes list|activate <stylesheet>
wpops install-skill                           # 手动补装本 skill
wpops raw <METHOD> <path> [--data JSON]       # 兜底:任意端点
```

## 能力边界(不要向用户承诺)
- **REST 做不到**:插件/主题/核心**更新**、备份/还原、安全扫描、性能优化、文件系统操作。
  → 这些需要 WP-CLI + SSH,或 MainWP。详见 skill `wp-wpcli-and-ops`。
- **能做的**:文章/页面/媒体/分类/标签/评论/用户/导航菜单的增删改查、插件安装与启停、主题切换、连接与权限体检。
- **菜单接口是插件提供的**(WordPress 核心 REST 没有 `/menus`、`/menu-items`);若目标站返回 404,说明未装对应插件,需回退到 `wpops raw` 或后台操作。

## 相关 skill
`wp-rest-api`(REST 端点)、`wp-wpcli-and-ops`(WP-CLI/SSH 运维)、`wp-performance`(性能)、`wordpress-router`(项目分类入口)。
