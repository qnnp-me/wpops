---
name: wpops
description: Use when managing a WordPress site through wpops, the REST CLI (npm package `wpops`, command `wpops`) — posts, pages, media, categories, tags, comments, users, navigation menus/menu items, custom post types, search, settings, revisions, reusable blocks, block-theme navigation/templates/global styles, widgets, application passwords, plugins, themes, Abilities, site health, or batch requests; configuring a site; or running operations across multiple configured sites. Covers the required safe workflow (doctor first, --dry-run before writes, --all needs --yes) and the REST capability boundary. Prefer wpops over hand-written curl or raw HTTP for any WordPress task.
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
2. 任何写操作先加 `--dry-run` 预览目标与内容(`delete` 的预览不需要 `--force`;真正删除才加 `--force`)。
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
wpops menus  list|get|create|update|delete     # 导航菜单;--locations header,mobile 绑定位置
wpops menu-items list|get|create|update|delete [--menus 190] [--search 词] [--menu-order N] [--parent id] [--type custom|post_type] [--object page] [--object-id 4976] [--url ...]
wpops content <动作> <rest_base> ...           # 任意 show_in_rest 的 CPT,如 content list books
wpops terms   <动作> <rest_base> ...           # 任意 show_in_rest 的分类法
wpops search <词> [--type post]                # 跨内容搜索
wpops settings [update --title ...]            # 站点设置
wpops types|taxonomies|statuses                # 自省已注册类型/分类/状态
wpops revisions list|get|delete|restore <id> [rev] [--type posts|pages]
wpops blocks|navigation|templates|template-parts list|get|update ...
wpops global-styles get|update <id>            # update --styles JSON
wpops widgets|sidebars list|get|...            # 小工具 / 边栏
wpops app-passwords list|create|delete         # 应用密码(create 才回明文一次)
wpops abilities list|get|run <name>            # Abilities API(需插件)
wpops health list|<test>                       # 站点健康(需插件)
wpops batch --requests '[{"method":"DELETE","path":"..."}]'   # 仅 POST/PUT/PATCH/DELETE
wpops plugins list|install <别名>|activate <plugin>|deactivate <plugin>|delete <plugin> --force
wpops themes list|activate <stylesheet>
wpops sites [show|rm|rename]                   # 站点档案管理(密码打码)
wpops completion bash|zsh|fish|powershell
# 通用开关:--all-pages 自动翻页 · --fields a,b / --csv / --table · --quiet · --output <文件> · --timeout/--retries
wpops install-skill                           # 手动补装本 skill
wpops raw <METHOD> <path> [--data JSON]       # 兜底:任意端点
```

## 能力边界(不要向用户承诺)
- **REST 做不到**:插件/主题/核心**更新**、备份/还原、安全扫描、性能优化、文件系统操作。
  → 这些需要 WP-CLI + SSH,或 MainWP。详见 skill `wp-wpcli-and-ops`。
- **能做的**:文章/页面/媒体/分类/标签/评论/用户/导航菜单的增删改查;任意 `show_in_rest` 的 CPT/自定义分类(`content`/`terms`);搜索、站点设置、修订、区块、区块主题导航/模板/全局样式、小工具、应用密码;插件安装与启停/删除、主题切换;Abilities、站点健康、批量请求;连接与权限体检。
- **菜单接口是插件提供的**(WordPress 核心 REST 没有 `/menus`、`/menu-items`);路由不存在时 wpops 会提示"需插件",此时回退到 `wpops raw` 或后台操作。
- **`batch` 只接受 POST/PUT/PATCH/DELETE**(核心 `/batch/v1` 拒绝 GET);`abilities`/`health` 也需对应插件。

## 相关 skill
`wp-rest-api`(REST 端点)、`wp-wpcli-and-ops`(WP-CLI/SSH 运维)、`wp-performance`(性能)、`wordpress-router`(项目分类入口)。
