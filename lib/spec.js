// 命令的单一事实来源。
// help / `wpops commands --json` / --all 写操作护栏(isMutation)/ shell 补全 全部由这里派生,
// 避免文档与代码各写一份、越走越偏。

const CONTENT_MUT = ['create', 'new', 'update', 'edit', 'delete', 'rm'];
const ITEM_MUT = ['create', 'new', 'update', 'edit', 'delete', 'rm'];

/** 全局开关(所有组通用)。 */
export const GLOBAL_FLAGS = [
  ['--dry-run', '只预览不执行(写操作;delete 的预览不需要 --force)'],
  ['--force', '彻底删除 / 危险操作确认'],
  ['--yes / -y', '批量写操作确认(配合 --all)'],
  ['--site <名> / -s <名>', '指定站点,可逗号分隔多个'],
  ['--all / -a', '对所有已配置站点执行'],
  ['--per-page N · --page N', '分页(REST 上限 100)'],
  ['--all-pages / --paginate', '自动翻完所有页'],
  ['--fields a,b · --csv · --table', '输出字段投影 / CSV / 表格'],
  ['--json', '输出原始 JSON'],
  ['--quiet · --output <文件>', '只出错时输出 / 写入文件'],
  ['--timeout <ms> · --retries <n>', '请求超时 / 重试次数(也可用 WP_* 环境变量)'],
];

/**
 * 组描述。
 * - name/aliases:命令名
 * - summary:一句话说明
 * - actions:动作 → 说明(顺序即展示顺序;空对象表示无动作)
 * - mutation:会改数据的动作集合;特殊值 'batch'(总是) / 'raw'(非 GET)
 * - local:true 表示在本地执行,不走站点 REST(如 setup/sites/completion)
 * - usage:示例行;flags:该组关键参数
 */
export const GROUPS = [
  {
    name: 'doctor', summary: '连接与权限体检(先跑这个)',
    actions: {}, usage: ['wpops doctor'], flags: [],
  },
  {
    name: 'me', summary: '当前用户与能力',
    actions: {}, usage: ['wpops me'], flags: ['--json'],
  },
  {
    name: 'setup', summary: '交互式配置一个站点(写入 sites/<名字>.env)', local: true,
    actions: {},
    usage: ['wpops setup'],
    flags: ['--url <URL>', '--user <用户名>', '--password <应用密码>', '--name <站点名>', '--force'],
  },
  {
    name: 'sites', summary: '站点档案管理', aliases: [], local: true,
    actions: {
      list: '列出已配置站点', show: '查看站点配置(密码打码)',
      rm: '删除站点档案', rename: '重命名站点档案',
    },
    usage: ['wpops sites list', 'wpops sites show qnnp.me', 'wpops sites rm qnnp.me', 'wpops sites rename 旧 新'],
    flags: [],
  },
  {
    name: 'install-skill', summary: '把内置 agent skill 装到发现目录', local: true,
    actions: {}, usage: ['wpops install-skill'], flags: [],
  },
  {
    name: 'completion', summary: '输出 shell 补全脚本', local: true,
    actions: { bash: 'bash', zsh: 'zsh', fish: 'fish', powershell: 'Windows PowerShell' },
    usage: ['wpops completion bash'],
    flags: [],
  },
  {
    name: 'commands', summary: '输出机器可读的命令清单(agent 现查现用)', local: true,
    actions: { list: '人类可读概览', show: 'JSON 清单' },
    usage: ['wpops commands --json'],
    flags: ['--json'],
  },

  {
    name: 'posts', summary: '文章:增删改查', aliases: ['post'],
    actions: { list: '列出', get: '查看', create: '新建', update: '更新', delete: '删除' },
    mutation: CONTENT_MUT,
    usage: [
      'wpops posts list [--per-page 10] [--page 2] [--status draft] [--search 词] [--categories 1,2]',
      'wpops posts get <id>',
      'wpops posts create --title "标题" --content "正文" [--status draft] [--categories 1,2] [--tags 3]',
      'wpops posts create --title "标题" --from-file ./post.md',
      'wpops posts update <id> --title "新标题" [--status publish] [--featured-media 44]',
      'wpops posts delete <id> [--force]        # 默认进回收站',
    ],
    flags: ['--title', '--content', '--from-file', '--status', '--slug', '--excerpt',
      '--featured-media', '--author', '--date', '--categories', '--tags',
      '--per-page', '--page', '--search', '--orderby', '--order'],
  },
  {
    name: 'pages', summary: '页面:增删改查', aliases: ['page'],
    actions: { list: '列出', get: '查看', create: '新建', update: '更新', delete: '删除' },
    mutation: CONTENT_MUT,
    usage: ['wpops pages ...                            # 与 posts 同'],
    flags: ['同 posts'],
  },
  {
    name: 'content', summary: '任意 show_in_rest 的 CPT(按 rest_base)', local: false,
    actions: { list: '列出', get: '查看', create: '新建', update: '更新', delete: '删除' },
    mutation: CONTENT_MUT,
    usage: ['wpops content list books', 'wpops content get books 12', 'wpops content create books --title "..."'],
    flags: ['同 posts;第一个位置参数是 rest_base'],
  },
  {
    name: 'media', summary: '媒体:列出/上传/导入/图像编辑/更新/删除',
    actions: {
      list: '列出', get: '查看', upload: '上传本地文件', sideload: '从 URL 导入',
      'edit-image': '图像编辑(裁剪/旋转)', update: '更新元数据', delete: '删除',
    },
    mutation: ['upload', 'sideload', 'edit-image', 'crop', 'update', 'edit', 'delete', 'rm'],
    usage: [
      'wpops media list [--per-page 20] [--media-type image]',
      'wpops media upload ./pic.jpg [--title "标题"] [--alt "替代文本"]',
      'wpops media sideload --url https://example.com/pic.jpg [--title "标题"]',
      'wpops media edit-image <id> --rotation 90 [--crop] [--dest-width 800] [--src <url>]',
      'wpops media update <id> [--alt "替代文本"] [--caption "说明"] [--post 123]',
      'wpops media delete <id> [--force]',
    ],
    flags: ['--url', '--title', '--alt', '--caption', '--description', '--post', '--media-type',
      '--rotation', '--crop', '--x', '--y', '--dest-width', '--dest-height', '--modifiers', '--src'],
  },
  {
    name: 'categories', summary: '分类:增删改查', aliases: ['category'],
    actions: { list: '列出', get: '查看', create: '新建', update: '更新', delete: '删除' },
    mutation: CONTENT_MUT,
    usage: ['wpops categories create --name "新分类" [--slug x] [--parent 3]', 'wpops categories delete <id> --force'],
    flags: ['--name', '--slug', '--parent', '--description'],
  },
  {
    name: 'tags', summary: '标签:增删改查', aliases: ['tag'],
    actions: { list: '列出', get: '查看', create: '新建', update: '更新', delete: '删除' },
    mutation: CONTENT_MUT,
    usage: ['wpops tags ...                               # 与 categories 同'],
    flags: ['--name', '--slug', '--parent', '--description'],
  },
  {
    name: 'terms', summary: '任意 show_in_rest 的自定义分类法(按 rest_base)', local: false,
    actions: { list: '列出', get: '查看', create: '新建', update: '更新', delete: '删除' },
    mutation: CONTENT_MUT,
    usage: ['wpops terms list genres', 'wpops terms create genres --name 科幻'],
    flags: ['同 categories;第一个位置参数是 rest_base'],
  },
  {
    name: 'comments', summary: '评论:列出/创建/更新/删除', aliases: ['comment'],
    actions: { list: '列出', get: '查看', create: '新建', update: '更新', delete: '删除' },
    mutation: ITEM_MUT,
    usage: [
      'wpops comments list [--status hold|approved|spam|trash] [--post 123]',
      'wpops comments create --post 123 --content "文字" [--author-name x] [--author-email a@b.c]',
      'wpops comments update <id> --status approved',
      'wpops comments delete <id> [--force]',
    ],
    flags: ['--post', '--content', '--from-file', '--author-name', '--author-email', '--parent', '--status'],
  },
  {
    name: 'users', summary: '用户:增删改查 / 当前用户',
    actions: { list: '列出', get: '查看', create: '新建', update: '更新', delete: '删除', me: '当前用户' },
    mutation: ['create', 'new', 'update', 'edit', 'delete', 'rm'],
    usage: [
      'wpops users list [--search 词] [--role administrator]',
      'wpops users create --username bob --email bob@example.com --role editor',
      'wpops users delete <id> --force [--reassign 1]',
      'wpops users me',
    ],
    flags: ['--username', '--email', '--name', '--role', '--password', '--reassign'],
  },
  {
    name: 'menus', summary: '导航菜单:增删改查', aliases: ['menu'],
    actions: { list: '列出', get: '查看', create: '新建', update: '更新', delete: '删除' },
    mutation: ITEM_MUT,
    usage: [
      'wpops menus list',
      'wpops menus get <id>',
      'wpops menus create --name Header [--slug header] [--locations header,mobile]',
      'wpops menus update <id> --locations header,mobile   # 位置分配靠这个',
      'wpops menus delete <id> --force',
    ],
    flags: ['--name', '--slug', '--description', '--locations', '--auto-add'],
  },
  {
    name: 'menu-items', summary: '菜单项:增删改查', aliases: ['menu-item'],
    actions: { list: '列出', get: '查看', create: '新建', update: '更新', delete: '删除' },
    mutation: ITEM_MUT,
    usage: [
      'wpops menu-items list [--menus 190] [--search 词] [--per-page 100]',
      'wpops menu-items get <id>',
      'wpops menu-items create --title Projects --url https://... --menus 190 --menu-order 6',
      'wpops menu-items create --title Projects --menus 190 --type post_type --object page --object-id 4976',
      'wpops menu-items update <id> --menu-order 3 [--parent 4979]',
      'wpops menu-items delete <id> --force',
    ],
    flags: ['--title', '--url', '--menus', '--menu-order', '--parent', '--status', '--type',
      '--object', '--object-id', '--target', '--classes', '--description', '--attr-title', '--xfn'],
  },
  {
    name: 'search', summary: '跨内容搜索',
    actions: {}, usage: ['wpops search <词> [--type post] [--subtype post] [--per-page 10]'],
    flags: ['--type', '--subtype', '--per-page', '--page'],
  },
  {
    name: 'settings', summary: '站点设置:读取/更新',
    actions: { list: '查看', get: '查看', update: '更新', set: '更新', edit: '更新' },
    mutation: ['update', 'set', 'edit'],
    usage: [
      'wpops settings',
      'wpops settings update --title "新标题" [--description "..."] [--timezone Asia/Shanghai] [--posts-per-page 10]',
      'wpops settings update --data \'{"show_on_front":"page"}\'',
    ],
    flags: ['--title', '--description', '--url', '--email', '--timezone', '--date-format', '--time-format',
      '--posts-per-page', '--show-on-front', '--page-on-front', '--default-category', '--data'],
  },
  {
    name: 'types', summary: '已注册文章类型(含 rest_base)',
    actions: { list: '列出', get: '查看' }, usage: ['wpops types list|get <type>'], flags: [],
  },
  {
    name: 'taxonomies', summary: '已注册分类法', aliases: ['taxonomy'],
    actions: { list: '列出', get: '查看' }, usage: ['wpops taxonomies list|get <tax>'], flags: [],
  },
  {
    name: 'statuses', summary: '文章状态',
    actions: {}, usage: ['wpops statuses'], flags: [],
  },
  {
    name: 'revisions', summary: '内容修订:列/看/删/恢复', aliases: ['revision'],
    actions: { list: '列出', get: '查看', delete: '删除', restore: '恢复到该修订' },
    mutation: ['delete', 'rm', 'restore'],
    usage: [
      'wpops revisions list <id> [--type posts|pages]',
      'wpops revisions get <id> <rev>',
      'wpops revisions restore <id> <rev>',
      'wpops revisions delete <id> <rev> --force',
    ],
    flags: ['--type posts|pages', '--per-page'],
  },
  {
    name: 'blocks', summary: '可复用区块:增删改查', aliases: ['block'],
    actions: { list: '列出', get: '查看', create: '新建', update: '更新', delete: '删除' },
    mutation: ITEM_MUT,
    usage: ['wpops blocks list', 'wpops blocks create --title x --content y', 'wpops blocks delete <id> --force'],
    flags: ['--title', '--content', '--from-file', '--status', '--search'],
  },
  {
    name: 'navigation', summary: '区块主题导航:增删改查',
    actions: { list: '列出', get: '查看', create: '新建', update: '更新', delete: '删除' },
    mutation: ITEM_MUT,
    usage: ['wpops navigation list', 'wpops navigation create --title "Main" --content "..."'],
    flags: ['--title', '--content', '--from-file', '--status'],
  },
  {
    name: 'templates', summary: '区块主题模板', aliases: ['template'],
    actions: { list: '列出', get: '查看', update: '更新' },
    mutation: ['update', 'edit'],
    usage: ['wpops templates list', 'wpops templates get theme//slug', 'wpops templates update theme//slug --from-file t.html'],
    flags: ['--content', '--from-file', '--title'],
  },
  {
    name: 'template-parts', summary: '区块主题模板片段', aliases: ['template-part'],
    actions: { list: '列出', get: '查看', update: '更新' },
    mutation: ['update', 'edit'],
    usage: ['wpops template-parts list', 'wpops template-parts update theme//slug --content "..."'],
    flags: ['--content', '--from-file', '--title'],
  },
  {
    name: 'global-styles', summary: 'theme.json 全局样式', aliases: ['global-style'],
    actions: { get: '查看', update: '更新' },
    mutation: ['update', 'set'],
    usage: ['wpops global-styles get <id-or-stylesheet>', 'wpops global-styles update <id> --styles \'{"...":...}\''],
    flags: ['--styles JSON', '--from-file'],
  },
  {
    name: 'widgets', summary: '小工具:增删改查', aliases: ['widget'],
    actions: { list: '列出', get: '查看', create: '新建', update: '更新', delete: '删除' },
    mutation: ITEM_MUT,
    usage: [
      'wpops widgets list [--sidebar primary]',
      'wpops widgets create --id custom_html-3 --sidebar primary [--instance \'{...}\']',
      'wpops widgets delete <id> --force',
    ],
    flags: ['--id', '--sidebar', '--instance JSON', '--from-file'],
  },
  {
    name: 'sidebars', summary: '边栏:列出/查看/更新', aliases: ['sidebar'],
    actions: { list: '列出', get: '查看', update: '更新' },
    mutation: ['update', 'edit'],
    usage: ['wpops sidebars list', 'wpops sidebars update primary --widgets a,b,c'],
    flags: ['--widgets a,b,c'],
  },
  {
    name: 'app-passwords', summary: '用户应用密码', aliases: ['app-password'],
    actions: { list: '列出', create: '新建(明文只打印一次)', delete: '吊销' },
    mutation: ['create', 'new', 'delete', 'rm'],
    usage: [
      'wpops app-passwords list [--user me]',
      'wpops app-passwords create --name ci-token [--user me]',
      'wpops app-passwords delete <uuid> --force [--user me]',
    ],
    flags: ['--user', '--name', '--app-id'],
  },
  {
    name: 'abilities', summary: 'Abilities API:列出/查看/运行(需插件)', aliases: ['ability'],
    actions: { list: '列出', get: '查看', run: '运行' },
    mutation: ['run'],
    usage: ['wpops abilities list', 'wpops abilities run core/get-site-info [--input \'{}\']'],
    flags: ['--input JSON', '--data JSON'],
  },
  {
    name: 'health', summary: '站点健康测试(需插件)',
    actions: { list: '列出测试名' },
    usage: ['wpops health list', 'wpops health loopback-requests'],
    flags: [],
  },
  {
    name: 'batch', summary: '批量 REST 请求(仅 POST/PUT/PATCH/DELETE)',
    actions: {}, mutation: 'batch',
    usage: ['wpops batch --requests \'[{"method":"DELETE","path":"/wp/v2/menu-items/1"}]\'',
      'wpops batch --requests-file reqs.json'],
    flags: ['--requests JSON', '--requests-file <文件>'],
  },
  {
    name: 'plugins', summary: '插件:列出/安装/启停/删除', aliases: ['plugin'],
    actions: { list: '列出', install: '安装', activate: '启用', deactivate: '停用', delete: '删除' },
    mutation: ['install', 'activate', 'deactivate', 'delete', 'rm'],
    usage: [
      'wpops plugins list [--status active] [--search 词]',
      'wpops plugins install <wp.org 别名> [--activate]',
      'wpops plugins activate <plugin>            # 形如 akismet/akismet',
      'wpops plugins delete <plugin> --force',
    ],
    flags: ['--status', '--search', '--activate'],
  },
  {
    name: 'themes', summary: '主题:列出/切换', aliases: ['theme'],
    actions: { list: '列出', activate: '切换', switch: '切换' },
    mutation: ['activate', 'switch'],
    usage: ['wpops themes list', 'wpops themes activate <stylesheet>'],
    flags: [],
  },
  {
    name: 'raw', summary: '任意端点兜底(任意 METHOD + path)', mutation: 'raw',
    actions: {}, usage: ['wpops raw GET /wp-json/wp/v2/categories', 'wpops raw POST /wp-json/wp/v2/comments --data \'{"post":1,"content":"hi"}\''],
    flags: ['--data JSON', '--data-file <文件>'],
  },
];

/** 按名字或别名取组。 */
export function groupByName(name) {
  if (!name) return null;
  const key = String(name).toLowerCase();
  return GROUPS.find((g) => g.name === key || (g.aliases || []).includes(key)) || null;
}

/** 判断命令是否修改站点数据(供 --all 护栏)。 */
export function isMutation(group, action) {
  const g = groupByName(group);
  if (!g) return false;
  const act = action || '';
  if (g.mutation === 'batch') return true;
  if (g.mutation === 'raw') return !['GET', 'HEAD', 'OPTIONS'].includes(act.toUpperCase());
  return (g.mutation || []).includes(act);
}

/** 机器可读清单(agent 现查现用)。 */
export function manifest(version = 'unknown') {
  return {
    version,
    groups: GROUPS.map((g) => ({
      name: g.name,
      aliases: g.aliases || [],
      summary: g.summary,
      local: Boolean(g.local),
      actions: Object.keys(g.actions || {}),
      mutating: g.mutation === 'batch'
        ? ['<总是写>']
        : g.mutation === 'raw'
          ? ['<非 GET>']
          : (g.mutation || []),
    })),
    globalFlags: GLOBAL_FLAGS.map(([flag, description]) => ({ flag, description })),
  };
}

/** 供 shell 补全用:全部组名 + 别名。 */
export function completionWords(extra = []) {
  const words = new Set();
  for (const g of GROUPS) {
    words.add(g.name);
    for (const a of g.aliases || []) words.add(a);
  }
  for (const w of extra) words.add(w);
  return [...words].sort();
}
