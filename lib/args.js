// 已知的布尔开关:遇到它们不吞下一个参数,避免 `--json -s a` 把 -s 当值。
const BOOLEAN_FLAGS = new Set([
  'json', 'force', 'activate', 'dry-run', 'yes', 'all', 'help', 'version',
  'csv', 'table', 'quiet', 'verbose', 'all-pages', 'paginate', 'auto-add',
]);

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
    if (arg === '-v' || arg === '--version') {
      flags.version = true;
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

// 写操作判定统一来自 lib/spec.js(单一事实来源),这里只做转发。
export { isMutation, groupByName } from './spec.js';
