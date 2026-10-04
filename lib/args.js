// 已知的布尔开关:遇到它们不吞下一个参数,避免 `--json -s a` 把 -s 当值。
const BOOLEAN_FLAGS = new Set(['json', 'force', 'activate', 'dry-run', 'yes', 'all', 'help']);

/** 解析命令行。支持 --flag value、--flag=value、布尔 --flag、以及 -s/-a/-h/-y。 */
export function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-s') {
      flags.site = argv[++i];
      continue;
    }
    if (arg === '-a') {
      flags.all = true;
      continue;
    }
    if (arg === '-h') {
      flags.help = true;
      continue;
    }
    if (arg === '-y') {
      flags.yes = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        continue;
      }
      const key = arg.slice(2);
      if (BOOLEAN_FLAGS.has(key)) {
        flags[key] = true;
        continue;
      }
      // 需要取值的 flag:即使下一个以 - 开头也当作值(支持 --content "- 列表")
      const next = argv[i + 1];
      if (next !== undefined) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }
    positionals.push(arg);
  }
  return { positionals, flags };
}

const CONTENT_MUTATIONS = new Set(['create', 'new', 'update', 'edit', 'delete', 'rm']);

/** 判断命令是否会修改站点数据(用于 --all 护栏与 --dry-run 提示)。 */
export function isMutation(group, action) {
  const act = action || '';
  switch (group) {
    case 'posts':
    case 'post':
    case 'pages':
    case 'page':
    case 'categories':
    case 'category':
    case 'tags':
    case 'tag':
      return CONTENT_MUTATIONS.has(act);
    case 'media':
      return ['upload', 'update', 'edit', 'delete', 'rm'].includes(act);
    case 'plugins':
    case 'plugin':
      return ['install', 'activate', 'deactivate'].includes(act);
    case 'themes':
    case 'theme':
      return ['activate', 'switch'].includes(act);
    case 'comments':
    case 'comment':
      return ['update', 'edit', 'delete', 'rm'].includes(act);
    case 'users':
      return ['create', 'update', 'edit', 'delete', 'rm'].includes(act);
    case 'raw':
      return !['GET', 'HEAD', 'OPTIONS'].includes(act.toUpperCase());
    default:
      return false;
  }
}
