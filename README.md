# wpops

WordPress REST 操作工具。只依赖 Node 内置能力(无第三方包),用应用密码通过
`/wp-json/` 管理站点内容与插件。

## 为什么是它

- **不用装插件、不用 SSH**,纯走 WordPress 核心 REST API。
- 凭据只落在本机 `sites/*.env`,不进 shell 历史、不写进命令。
- 输出可读,也可以 `--json` 交给别的脚本。

## 1. 配置

给每个站点建一个档案:把 `.env.example` 复制成 `sites/<名字>.env`,填入真实值:

```
WP_URL=https://your-site.example.com
WP_USER=你的用户名
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

应用密码生成:WP 后台 → 用户 → 个人资料 → 应用程序密码 → 新建。
建议**单独建一个自动化专用管理员账号**,别用你自己的主账号。

> `sites/*.env` 已在 `.gitignore` 中,不会被提交。

## 2. 先体检

```
node bin/wpops.js doctor
```

它会逐项检查:配置、REST 根、当前用户与角色、文章/媒体/插件/主题权限、版本。
有 ✗ 就看末尾的提示(401 多半是主机没透传 `Authorization` 头)。

## 3. 命令

```
# 内容
wpops posts  list [--per-page 10] [--page 2] [--status draft] [--search 关键词]
                 [--orderby date] [--order desc] [--categories 1,2] [--tags 3]
                 [--author 1] [--after 2026-01-01] [--before 2026-12-31] [--json]
wpops posts  get <id>
wpops posts  create --title "标题" --content "正文" [--status draft] [--categories 1,2] [--tags 3] [--featured-media 44]
wpops posts  create --title "标题" --from-file ./post.md --status draft
wpops posts  update <id> --title "新标题" [--status publish] [--featured-media 0]
wpops posts  delete <id> [--force]        # 默认进回收站
wpops pages  ...                          # 同样的子命令
wpops me

# 媒体
wpops media  list [--per-page 20] [--media-type image]
wpops media  get <id>
wpops media  upload ./pic.jpg [--title "标题"] [--alt "替代文本"]
wpops media  update <id> [--alt "替代文本"] [--caption "说明"] [--post 123]
wpops media  delete <id>

# 分类 / 标签
wpops categories list [--per-page 100] [--search 关键词]
wpops categories create --name "新分类" [--slug x] [--parent 3] [--description "..."]
wpops categories update <id> --name "改名"
wpops categories delete <id> --force      # 分类删除不可撤销,必须 --force
wpops tags ...                            # 同样的子命令

# 评论 / 用户
wpops comments list [--status hold|approved|spam|trash] [--post 123]
wpops comments update <id> --status approved
wpops comments delete <id> [--force]
wpops users  list [--search 关键词] [--role administrator]
wpops users  create --username bob --email bob@example.com --role editor
wpops users  update <id> --role editor
wpops users  delete <id> --force [--reassign 1]   # 有内容的用户需指定内容转交人
wpops users  me

# 插件 / 主题(见下方能力说明)
wpops plugins list [--status active] [--search 关键词]
wpops plugins install <wordpress.org 别名> [--activate]
wpops plugins activate <plugin>           # plugin 形如 akismet/akismet
wpops plugins deactivate <plugin>
wpops themes list
wpops themes activate <stylesheet>

# 兜底:任意端点
wpops raw GET /wp-json/wp/v2/categories
wpops raw POST /wp-json/wp/v2/comments --data '{"post":1,"content":"hi"}'

# 安全开关
wpops posts delete 12 --dry-run                     # 只预览,不执行(所有写命令都支持)
wpops --all posts delete 12 --dry-run               # 跨站预览
wpops --all plugins list                            # 读操作无需确认
wpops --all plugins activate akismet/akismet --yes  # 写操作必须 --yes
```

## 4. 多站点

所有站点都放在 `sites/`,一个站点一个文件:

```
App\wpops\
└── sites\
    ├── qnnp.env          ← 站点:qnnp.me
    ├── blog-a.env
    └── blog-b.env
```

每个文件内容和 `.env.example` 一样,填该站自己的凭据(用各自的**应用密码**)。

```powershell
wpops sites                   # 列出所有已配置站点
wpops doctor                  # 只有一个站点时,默认用它
wpops -s blog-a doctor        # 指定站点(s 是 --site 的简写)
wpops -s blog-a posts list
wpops --all posts list        # 对全部站点批量执行
wpops --all plugins list      # 巡检所有站的插件
```

- 只有一个站点时,不带 `-s` 的命令默认用它;有多个时请用 `-s <名字>` 或 `--all`。
- `--all` 遍历 `sites/` 下所有站点;某个站失败会单独报错,不影响其它站。
- 命名站点的配置**只**来自它自己的文件,不会被 shell 环境变量串味。
- `sites/*.env` 已被 `.gitignore` 忽略。

> 站点数量到几十个、又想做「批量更新/备份/安全」时,REST 就不够用了,
> 应该上 MainWP 这类集中管理平台。wpops 负责内容,MainWP 负责维护。

## 5. 能力边界(重要,别被误导)

| 事项 | 核心 REST 能做到吗 |
|---|---|
| 文章 / 页面 / 媒体 / 分类 / 标签 / 评论 / 用户的增删改查 | ✅ 完整 |
| 插件:列出、**安装**(按 wp.org 别名)、启用/停用、删除 | ✅ |
| 插件:**更新已装插件代码** | ❌ 核心 REST 没有该端点 |
| 主题:列出、切换 | ✅ |
| 主题:安装 / 更新 | ❌ |
| WordPress 核心更新 | ❌ |
| 备份 / 数据库优化 / 缓存清理 | ❌(需服务器侧) |

**结论:REST 负责"内容运营",不负责"更新与维护"。** 想更新插件/核心,只能:
- WP-CLI + SSH(`wp plugin update --all`),或
- 后台手动点,或
- 装 MCP Adapter 类插件把 Abilities 暴露成 API。

## 6. 安全

- `sites/*.env` 存放应用密码,等同于该账号登录凭据;专用账号 + 可随时在后台吊销。
- 应用密码要求 HTTPS。
- **写操作前先 `--dry-run` 预览**;破坏性操作(`delete --force`、分类/用户删除)另需 `--force`。
- **`--all` 的写操作必须加 `--yes`**,否则直接拒绝,避免手滑波及全线。
- 网络抖动/429/5xx 会自动重试(默认 2 次,幂等方法才重试网络错误)。
- 这是本地脚本,不对外开端口。

## 7. 与 WordPress skills 的关系

本项目是**执行器**(真正发请求);已安装的官方 skills
(`wp-rest-api`、`wp-wpcli-and-ops`、`wp-performance`、`wordpress-router`)
是**知识/规范**,指导"该怎么安全地做"。

## 8. 全局命令(可选)

想让 `wpops` 在任意目录可用,用 pnpm 挂到全局:

```powershell
cd C:\Users\qnnp\App\wpops
pnpm add -g .
```

会生成 `wpops` 命令(在 pnpm 全局 bin,已在 PATH 上)。

- 与源码是链接关系,**改代码立即生效**,不用重新安装。
- 若移动了 `wpops` 目录,重新执行一次 `pnpm add -g .`。
- 卸载:`pnpm remove -g wpops`。
