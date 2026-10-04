# wpops

[![npm version](https://img.shields.io/npm/v/wpops.svg)](https://www.npmjs.com/package/wpops)
[![npm downloads](https://img.shields.io/npm/dm/wpops.svg)](https://www.npmjs.com/package/wpops)
[![license](https://img.shields.io/npm/l/wpops.svg)](LICENSE)
[![node](https://img.shields.io/node/v/wpops.svg)](package.json)

> WordPress REST operations toolkit — a zero-dependency CLI (plus agent skill) to manage posts, pages, media, comments, users, navigation menus and plugins across one or many sites.

WordPress REST 操作工具。只依赖 Node 内置能力(无第三方包),用应用密码通过
`/wp-json/` 管理站点内容与插件。

## 为什么是它

- **不用装插件、不用 SSH**,纯走 WordPress 核心 REST API。
- 凭据只落在本机 `sites/*.env`,不进 shell 历史、不写进命令。
- 输出可读,也可以 `--json` 交给别的脚本。

## 安装 / 分发

零依赖、纯 Node(≥20)。

**最快:一条命令装好(含 skill)**

```powershell
npm i -g wpops     # 装 CLI;postinstall 会自动把 skill 装到 ~/.agents/skills/wpops
wpops setup        # 交互式配置站点:问 URL / 用户名 / 应用密码,写 sites/<名字>.env 并自动体检
```

第二条是配置站点(密码必须你亲自输入,不回显)。之后即可 `wpops posts list` 等。
不想安装、只想用一次:`npx wpops doctor`。

**从 Git / 开发者**

```powershell
git clone https://github.com/qnnp-me/wpops.git
cd wpops
./install.ps1          # Windows;macOS/Linux 用 sh install.sh(装 CLI + skill)
```

不想 clone?一行流(脚本不在仓库内时会自动 `git clone`):

```powershell
iwr -useb https://raw.githubusercontent.com/qnnp-me/wpops/main/install.ps1 | iex   # Windows
```

```sh
curl -fsSL https://raw.githubusercontent.com/qnnp-me/wpops/main/install.sh | sh    # macOS/Linux
```

> 若 `raw.githubusercontent.com` 访问不了,可换 jsDelivr 镜像:
> `https://cdn.jsdelivr.net/gh/qnnp-me/wpops@main/install.ps1`(或 `.sh`)。

也可以直接用 git 依赖:`pnpm add -g github:qnnp-me/wpops`,再加
`npx skills add qnnp-me/wpops --skill wpops -a opencode -g`。

**发布(维护者)**

```powershell
npm publish
```

> 凭据不进仓库 / 包:`sites/*.env` 与 `.env` 已忽略,且 `package.json` 的 `files`
> 白名单不含 `sites/`。每台机器各自 `wpops setup`,工具与 skill 都不携带密钥。
> `WPOPS_SKIP_SKILL=1 npm i -g wpops` 可跳过自动装 skill;`wpops install-skill` 可手动补装。

### 本机(开发) vs 其他机器(使用)

- **本机开发**:`pnpm add -g .` 会在 pnpm 全局建一个**指向本仓库的 Junction**,
  于是命令行的 `wpops` 就是**源码实时版** —— 改代码立即生效,无需重装。
  验证:`where.exe wpops`(应指向 `...\pnpm\bin`)。
- **其他机器使用**:`npm i -g wpops`,装的是 **npm 上发布的版本**;升级用 `npm i -g wpops@latest`。
- `npx wpops ...` 只在临时缓存里跑一次,不落 PATH。

## 1. 配置

给每个站点建一个档案。**推荐用向导**:`wpops setup`(问 URL/用户名/应用密码,自动写入并体检)。
也可以手动:把 `.env.example` 复制成 `sites/<名字>.env`,填入真实值:

```
WP_URL=https://your-site.example.com
WP_USER=你的用户名
WP_APP_PASSWORD=xxxx xxxx xxxx xxxx xxxx xxxx
```

应用密码生成:WP 后台 → 用户 → 个人资料 → 应用程序密码 → 新建。
建议**单独建一个自动化专用管理员账号**,别用你自己的主账号。

> `sites/*.env` 已在 `.gitignore` 中,不会被提交。

**配置位置**:默认读**包目录**下的 `.env` / `sites/`(git clone 就在仓库里)。
若用 `npm i -g wpops` 全局安装,建议设环境变量 `WPOPS_HOME` 指向固定目录,
把配置放那里,升级/重装不会丢:

```powershell
# 例如(Windows)
setx WPOPS_HOME "%USERPROFILE%\.config\wpops"
# 然后把 sites\<名字>.env 放到该目录下
```

## 2. 先体检

```
node bin/wpops.js doctor
```

它会逐项检查:配置、REST 根、当前用户与角色、文章/媒体/插件/主题权限、版本。
有 ✗ 就看末尾的提示(401 多半是主机没透传 `Authorization` 头)。

## 3. 命令

> **现查现用**:`wpops help <组>` 或 `wpops <组> --help` 看某组动作与参数;`wpops commands --json` 拿机器可读清单(全部组/动作/是否写操作)。
> 帮助与清单都由 `lib/spec.js` 单一事实来源生成,不会和实现漂移。
>
> **退出码**:`0` 成功;`2` 用法/参数错误(stderr 打印错误 + 精简用法 + `--help` 提示);`1` 运行期错误(HTTP/网络/配置)。`--help` 始终走 stdout 且为 `0`。

```
# 内容(默认存草稿,发布是独立动作——见下方"发布安全")
wpops posts  list [--per-page 10] [--page 2] [--status draft] [--search 关键词]
                 [--orderby date] [--order desc] [--categories 1,2] [--tags 3]
                 [--author 1] [--after 2026-01-01] [--before 2026-12-31] [--json]
wpops posts  get <id>
wpops posts  create --title "标题" --content "正文" [--categories 1,2] [--tags 3]   # 未给 --status 即草稿
wpops posts  create --title "标题" --from-file ./post.md --status draft
wpops posts  export <id> --file post.html              # 导出正文,本地改排版
wpops posts  update <id> --from-file post.html --dry-run   # 先预览,再真正应用(下面这行)
wpops posts  update <id> --from-file post.html
wpops posts  publish <id>                              # 显式发布
wpops posts  unpublish <id>                            # 下线为草稿
wpops posts  delete <id> [--force]                     # 默认进回收站
wpops pages  ...                          # 同样的子命令
wpops me

# 媒体
wpops media  list [--per-page 20] [--media-type image]
wpops media  get <id>
wpops media  upload ./pic.jpg [--title "标题"] [--alt "替代文本"]
wpops media  sideload --url https://example.com/pic.jpg [--title "标题"]   # 从 URL 导入
wpops media  edit-image <id> --rotation 90 [--crop] [--dest-width 800]     # 裁剪/旋转(缺 --src 自动取当前图)
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

# 导航菜单(接口由插件提供;核心 REST 没有)
wpops menus  list [--per-page 100]                # 列出菜单(id / name / slug / locations)
wpops menus  get <id>
wpops menu-items list [--menus 190] [--search 词] [--per-page 100] [--page 1]
wpops menu-items get <id>
wpops menu-items create --title "Projects" --url https://example.com/projects --menus 190 --menu-order 6
wpops menu-items create --title "Projects" --menus 190 --type post_type --object page --object-id 4976
wpops menu-items update <id> --menu-order 3 [--parent 4979] [--target _blank]
wpops menu-items delete <id> --dry-run            # 预览不需要 --force
wpops menu-items delete <id> --force              # 真正删除才必须 --force(不可撤销)
wpops menus  create --name Header --locations header,mobile
wpops menus  update 190 --locations header,mobile  # 位置分配靠更新菜单的 locations
wpops menus  delete 190 --force

# 搜索 / 站点设置 / 自省
wpops search 关键词 [--type post] [--subtype post] [--per-page 10]
wpops settings                                     # 查看站点设置
wpops settings update --title "新标题" [--description "..."] [--timezone Asia/Shanghai] [--posts-per-page 10]
wpops settings update --data '{"show_on_front":"page"}'
wpops types list|get <type>                        # 已注册文章类型(含 rest_base)
wpops taxonomies list|get <tax>                    # 已注册分类法
wpops statuses                                     # 文章状态

# 任意自定义类型(show_in_rest 的 CPT / 自定义分类)
wpops content list books [--per-page 10]           # rest_base 直接当 type
wpops content get  books 12
wpops content create books --title "..." [--status draft]
wpops content update books 12 --title "..."
wpops content delete books 12 --force
wpops terms list genres                            # 自定义分类法同理

# 修订 / 区块 / 区块主题结构
wpops revisions list <id> [--type posts|pages]
wpops revisions get <id> <rev>
wpops revisions restore <id> <rev>                 # 用旧修订覆盖正文
wpops revisions delete <id> <rev> --force
wpops blocks list|get|create|update|delete ...     # 可复用区块
wpops navigation list|get|create|update|delete ... # 区块主题导航
wpops templates list|get|update ...                # 模板(update --content/--from-file)
wpops template-parts list|get|update ...
wpops global-styles get <id> · global-styles update <id> --styles '{"...":...}'

# 小工具 / 应用密码 / 插件能力
wpops widgets list|get|create|update|delete ...    # --id --sidebar --instance JSON
wpops sidebars list|get|update ...                 # update --widgets a,b,c
wpops app-passwords list [--user me]               # 列出应用密码(不含明文)
wpops app-passwords create --name ci-token [--user me]   # 明文密码只打印这一次
wpops app-passwords delete <uuid> --force
wpops abilities list|get|run <name> [--input JSON] # Abilities API(需插件)
wpops health list · health <test>                  # 站点健康测试(需插件)
wpops batch --requests '[{"method":"DELETE","path":"/wp/v2/menu-items/123"}]'  # 仅 POST/PUT/PATCH/DELETE

# 输出与批量
wpops posts list --all-pages                       # 自动翻完所有页
wpops posts list --fields id,title,status --csv    # 字段投影 / CSV(--table 表格)
wpops menus list --quiet                           # 只出错时输出
wpops menus list --output menus.txt                # 写入文件
wpops sites show qnnp.me                            # 查看站点配置(密码打码)
wpops sites rm qnnp.me · sites rename 旧 新         # 管理站点档案(确认后再用)
wpops completion bash                              # 输出补全脚本
wpops help menus                                   # 某组用法

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
wpops posts update 12 --from-file post.html --dry-run
wpops --all posts delete 12 --dry-run               # 跨站预览
wpops --all plugins list                            # 读操作无需确认
wpops --all plugins activate akismet/akismet --yes  # 写操作必须 --yes
```

### 发布安全(两步走)

- **创建默认草稿**,不会直接上线;发布是独立动作 `wpops posts publish <id>`(页面/CPT 同理),下线用 `unpublish <id>`。
- 修改**已发布**内容的正文时,会先在 stderr 提示并给出修订回滚命令(加 `--yes` 可静默);`settings` / 菜单位置等 live 变更同样会提示。
- 改版式/长文的安全流程:`export` 导出正文 → 本地编辑 → 建**草稿副本**预览(回显后台编辑链接)→ `update --from-file` 应用到原页 → 不满意用 `revisions restore` 回滚。
- **页面构建器注意**:Elementor / SiteOrigin / Divi 等把布局存在插件 meta 里,直接改 REST 的 `post_content` 会**弄坏页面**;这类页面请在构建器 UI 里改,wpops 只用于体检/备份/回滚。
- WP 的**前端草稿预览**依赖登录态,应用密码在浏览器里用不了;可靠入口是回显的**后台编辑/预览链接**。

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
| 搜索、站点设置(site title/时区/…)、类型/分类/状态自省 | ✅ |
| 自定义类型 / 自定义分类(`show_in_rest` 的 CPT) | ✅(`content` / `terms` 通用命令) |
| 修订历史(列/看/删/恢复)、可复用区块、区块主题导航/模板/全局样式 | ✅ |
| 小工具 / 边栏、用户应用密码 | ✅ |
| 导航菜单 / 菜单项(列表、增删改) | ⚠️ 需站点装有暴露 `/menus`、`/menu-items` 的插件 |
| 插件:列出、**安装**(按 wp.org 别名)、启用/停用、删除 | ✅ |
| 插件:**更新已装插件代码** | ❌ 核心 REST 没有该端点 |
| 主题:列出、切换 | ✅ |
| 主题:安装 / 更新 | ❌ |
| Abilities API(`abilities list/run`)、站点健康测试(`health`) | ⚠️ 需对应插件 |
| 批量请求(`batch`) | ✅(仅 POST/PUT/PATCH/DELETE,核心限制) |
| WordPress 核心更新 | ❌ |
| 备份 / 数据库优化 / 缓存清理 | ❌(需服务器侧) |

**结论:REST 负责"内容运营",不负责"更新与维护"。** 想更新插件/核心,只能:
- WP-CLI + SSH(`wp plugin update --all`),或
- 后台手动点,或
- 装 MCP Adapter 类插件把 Abilities 暴露成 API。

## 6. 安全

- `sites/*.env` 存放应用密码,等同于该账号登录凭据;专用账号 + 可随时在后台吊销。
- 应用密码要求 HTTPS。
- **写操作前先 `--dry-run` 预览**(`delete` 的预览不需要 `--force`);真正执行破坏性删除(`delete --force`、分类/用户/菜单项删除)才必须加 `--force`。
- **`--all` 的写操作必须加 `--yes`**,否则直接拒绝,避免手滑波及全线。
- 网络抖动/429/5xx 会自动重试(默认 2 次,幂等方法才重试网络错误)。
- 这是本地脚本,不对外开端口。

## 7. 自洽执行器

本项目是**执行器**(真正发请求),内置 agent skill(`skills/wpops/SKILL.md`)自洽、不依赖其他 skill:
它只讲清**何时用、安全流程、能力索引、如何现查现用**(`wpops help` / `wpops commands --json` / `wpops raw`),
精确的字段与枚举一律在运行时向 CLI 或站点查询,因此不会随文档过时。

更广义的 WordPress 知识(主题/插件开发、WP-CLI 运维、性能等)属于其他领域,与本工具正交,按需另取即可。

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
