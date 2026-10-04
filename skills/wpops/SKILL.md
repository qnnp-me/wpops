---
name: wpops
description: Use when managing a WordPress site through wpops, the local REST CLI at ~/App/wpops — listing/creating/updating/deleting posts, pages, media, categories, tags, comments, or users; installing/activating/deactivating plugins; switching themes; checking a site's connection and permissions; or running operations across multiple configured sites. Covers the required safe workflow (doctor first, --dry-run before writes, --all needs --yes) and the REST capability boundary. Prefer wpops over hand-written curl or raw HTTP for any WordPress task.
---

# wpops —— WordPress REST 操作

## 何时用
用户要管理 WordPress 站点的**内容**或**插件/主题**时,优先用 `wpops`,不要手搓 curl/HTTP 请求。

## 位置与调用
- 全局命令 `wpops`(通过 `pnpm add -g .` 安装,链接到源码,**改代码立即生效**)。
- 若 `wpops` 不在 PATH,回退:`node <仓库>/bin/wpops.js ...`
- 凭据:`sites/<名字>.env`。**不要读取、不要打印其中的应用密码。**

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
6. 破坏性操作(`delete --force`、分类/用户删除)先确认目标存在且正确。

## 常用命令
```
wpops doctor
wpops posts  list [--per-page 20] [--page 2] [--status draft] [--search 词] [--orderby date] [--order desc] [--categories 1,2]
wpops posts  get <id>
wpops posts  create --title "标题" --content "正文" [--status draft] [--featured-media 44]
wpops posts  update <id> --from-file ./post.md [--status publish]
wpops posts  delete <id> [--force]
wpops pages  ...                     # 同 posts
wpops media  upload ./pic.jpg [--alt "替代文本"]
wpops media  update <id> [--alt "替代文本"]
wpops categories list|create|update|delete ...
wpops tags   list|create|update|delete ...
wpops comments list [--status hold] | update <id> --status approved
wpops users  list|create|update|delete|me ...
wpops plugins list | install <wp.org别名> [--activate] | activate <plugin> | deactivate <plugin>
wpops themes list | activate <stylesheet>
wpops raw <METHOD> <path> [--data JSON]   # 兜底:任意端点
```

## 能力边界(不要向用户承诺)
- **REST 做不到**:插件/主题/核心**更新**、备份/还原、安全扫描、性能优化、文件系统操作。
  → 这些需要 WP-CLI + SSH,或 MainWP。详见 skill `wp-wpcli-and-ops`。
- **能做的**:文章/页面/媒体/分类/标签/评论/用户的增删改查、插件安装与启停、主题切换、连接与权限体检。

## 相关 skill
`wp-rest-api`(REST 端点)、`wp-wpcli-and-ops`(WP-CLI/SSH 运维)、`wp-performance`(性能)、`wordpress-router`(项目分类入口)。
