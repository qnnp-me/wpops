---
name: wpops
description: Use when managing a WordPress site through wpops, the zero-dependency REST CLI (npm package `wpops`, command `wpops`) — posts, pages, media, menus, comments, users, custom post types, search, settings, revisions, blocks, block-theme navigation/templates/global styles, widgets, application passwords, plugins, themes, Abilities, site health, or batch requests; configuring a site; or operating across multiple configured sites. Covers the required safe workflow (doctor first, --dry-run before writes, --all needs --yes) and the REST capability boundary. Prefer wpops over hand-written curl or raw HTTP for any WordPress task.
license: MIT
---

# wpops —— WordPress REST 操作

## 何时用
用户要管理 WordPress 站点的**内容 / 结构 / 配置 / 插件主题**时,优先用 `wpops`,不要手搓 curl。
本 skill 自洽,不依赖其他 skill;需要精确细节时**现查现用**(见下)。

## 安装与位置
- 全局命令 `wpops`(`npm i -g wpops` 安装;postinstall 会把本 skill 复制到发现目录;pnpm 10+ 需 `pnpm approve-builds -g wpops`)。`wpops setup` 也会装,首次运行按需刷新。
- 未安装时也可:`npx wpops ...`。
- 配置目录:默认在用户级稳定目录(Windows `%APPDATA%\wpops`,其他 `~/.config/wpops`),升级不丢;`WPOPS_HOME` 可覆盖。旧版放在包目录的配置会在首次运行时自动迁移。
- 凭据:`sites/<名字>.env`。**不要读取、不要打印其中的应用密码。**
- 首次配置:`wpops setup`(交互式写入凭据并自动体检)。

## 站点与多站
- `wpops sites` — 列出已配置站点;`sites show <名>`(密码打码)、`sites rm`、`sites rename`。
- `wpops -s <名字> ...` — 指定站点;只有一个站点时可省略;`-s a,b` 可指定多个。
- `wpops --all ...` — 对所有站点批量执行。

## 安全流程(必须遵守)
1. 首次操作某站先跑 `wpops doctor`(检查连接与权限;失败返回非 0)。
2. 任何写操作先加 `--dry-run` 预览(`delete` 的预览不需要 `--force`;真正删除才加 `--force`)。
3. **内容默认草稿**:创建不带 `--status` 即草稿,不会直接上线;发布用显式 `publish`(`unpublish` 下线)。修改已发布内容会先提示并给出 `wpops revisions restore` 回滚;`--yes` 可静默。改版式的安全流程:先建**草稿副本**预览(命令回显后台编辑链接),满意后再 `update` 原页。
4. `--all` 的**写操作必须加 `--yes`**,否则会被拒绝。
5. 需要程序化解析输出时加 `--json`;要投影/表格用 `--fields a,b` / `--csv` / `--table`。
6. 应用密码绝不写进命令、日志或对话。
7. 破坏性操作(`delete --force`、分类/用户/菜单项/插件删除)先确认目标存在且正确。页面构建器(Elementor 等)布局存在插件 meta,不要用 REST 改其 `post_content`。
8. 退出码:`0` 成功;`2` 用法/参数错误(stderr 会给用法与 `--help` 提示);`1` 运行期错误(HTTP/网络/配置)。脚本据此判断成败,不要只看有没有输出。

## 现查现用(不要背细节)
- `wpops <组> --help`、`wpops help <组> [动作]` — 该组动作与参数(**首选**)。
- `wpops commands` — 人类可读概览:全部组、动作、是否写操作、别名;`wpops commands --json` 机器可读。
- `wpops raw GET /wp-json/` — 站点真实命名空间与路由。
- `wpops raw OPTIONS <path>` — 某端点支持的字段、类型、枚举、必填。
- 字段语义以 WordPress 官方 REST 文档为准。

## 能力索引(组 → 一句话)
内置:`doctor`(连接体检) · `me`(当前用户) · `setup`(配置站点) · `sites`(站点档案) · `install-skill` · `completion` · `commands`(命令清单)。

内容与结构:
- `posts` / `pages` — 文章/页面增删改查;**默认草稿**、`publish`/`unpublish`、`export`/`import`(改版式)、`--dry-run` 预览。
- `content <rest_base>` / `terms <rest_base>` — 任意 `show_in_rest` 的 CPT / 自定义分类。
- `media` — 媒体列出/上传/URL 导入(`sideload`)/图像编辑(`edit-image` 裁剪旋转)/更新/删除。
- `categories` / `tags` — 分类/标签。
- `comments` — 评论(含创建/回复)。
- `users` — 用户(含 `me`)。
- `menus` / `menu-items` — 导航菜单与菜单项(`--locations` 绑定主题位置)。
- `revisions` — 修订列表/查看/删除/恢复。
- `search` — 跨内容搜索。
- `settings` — 站点设置读取/更新。
- `types` / `taxonomies` / `statuses` — 自省已注册类型/分类/状态。

区块主题与现代内容:
- `blocks` — 可复用区块。
- `navigation` — 区块主题 Navigation。
- `templates` / `template-parts` — 模板与片段。
- `global-styles` — theme.json 全局样式。
- `widgets` / `sidebars` — 小工具/边栏。
- `app-passwords` — 用户应用密码(创建时明文只打印一次)。

运维与插件:
- `plugins` — 列表/安装/启停/删除。
- `themes` — 列表/切换。
- `abilities` — Abilities API 列出/运行(需插件)。
- `health` — 站点健康测试(需插件)。
- `batch` — 批量 REST 请求(仅 POST/PUT/PATCH/DELETE)。
- `raw` — 任意端点兜底。

## 能力边界(不要向用户承诺)
- **REST 做不到**:插件/主题/核心**代码更新**、备份/还原、安全扫描、性能优化、文件系统操作 → 需 WP-CLI + SSH 或集中管理平台。
- **能做的**:上面索引里的全部内容,以及连接与权限体检。
- **需要插件**:导航菜单(`/menus`、`/menu-items`)、`abilities`、`health`;路由不存在时端点会报 404,wpops 会提示"需插件",此时回退到 `wpops raw` 或后台操作。
- **`batch` 只接受 POST/PUT/PATCH/DELETE**(核心 `/batch/v1` 拒绝 GET)。
