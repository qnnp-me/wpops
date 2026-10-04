// 由 lib/spec.js 生成所有帮助文本与机器清单,保证与实现同源。
import { GROUPS, GLOBAL_FLAGS, groupByName, manifest } from './spec.js';

function groupLine(g, width) {
  const alias = g.aliases?.length ? `  (别名:${g.aliases.join(',')})` : '';
  return `  ${g.name.padEnd(width)} ${g.summary}${alias}`;
}

/** 总帮助。 */
export function generalHelp(version = 'unknown') {
  const width = Math.max(...GROUPS.map((g) => g.name.length)) + 1;
  const local = GROUPS.filter((g) => g.local);
  const remote = GROUPS.filter((g) => !g.local);

  const lines = [];
  lines.push(`wpops ${version} —— WordPress REST 操作工具`);
  lines.push('');
  lines.push('用法: wpops [--site 名字 | --all] <组> <动作> [参数] [--flags]');
  lines.push('');
  lines.push('先看这个(现查现用,不要背细节):');
  lines.push('  wpops <组> --help · wpops help <组> [动作]   某组的动作与参数');
  lines.push('  wpops commands --json                        机器可读命令清单(组/动作/写操作)');
  lines.push('  wpops raw GET /wp-json/                      站点真实路由与命名空间');
  lines.push('  wpops raw OPTIONS <path>                     端点支持的字段与枚举');
  lines.push('  wpops doctor                                 连接与权限体检(先跑这个)');
  lines.push('');
  lines.push('内置命令:');
  for (const g of local) lines.push(groupLine(g, width));
  lines.push('');
  lines.push('站点命令:');
  for (const g of remote) lines.push(groupLine(g, width));
  lines.push('');
  lines.push('多站点:');
  lines.push('  --site <名字> / -s <名字>        对 sites/<名字>.env 执行,可逗号分隔多个');
  lines.push('  --all / -a                       对所有已配置站点批量执行(写操作需 --yes)');
  lines.push('');
  lines.push('安全:');
  lines.push('  --dry-run                       只预览不执行(--force 仅用于真正执行)');
  lines.push('  --yes / -y                      批量写操作确认');
  lines.push('');
  lines.push('全局开关:');
  for (const [flag, desc] of GLOBAL_FLAGS) lines.push(`  ${flag.padEnd(28)} ${desc}`);
  lines.push('');
  lines.push('示例:');
  lines.push('  wpops doctor');
  lines.push('  wpops -s blog-a posts list --per-page 5 --orderby date --order desc');
  lines.push('  wpops posts update 12 --from-file ./post.md --status draft');
  lines.push('  wpops menus list --help');
  lines.push('  wpops menu-items list --menus 190');
  lines.push('  wpops --all plugins list');
  lines.push('  wpops posts list --all-pages --fields id,title --csv');
  return lines.join('\n');
}

/**
 * 某组(可带动作)的帮助。未知组返回 null。
 * 动作级只补充该动作说明;细节参数统一用 `wpops raw OPTIONS <path>` 或上方用法。
 */
export function groupHelp(name, action) {
  const g = groupByName(name);
  if (!g) return null;

  const lines = [];
  lines.push(`${g.name} —— ${g.summary}`);
  if (g.aliases?.length) lines.push(`别名:${g.aliases.join(', ')}`);
  lines.push('');

  const actions = Object.entries(g.actions || {});
  if (actions.length) {
    lines.push('动作:');
    for (const [a, desc] of actions) lines.push(`  ${a.padEnd(10)} ${desc}`);
    lines.push('');
  } else {
    lines.push('(无子动作,直接运行)');
    lines.push('');
  }

  if (action) {
    const desc = (g.actions || {})[action];
    if (desc) lines.push(`动作 ${action}:${desc}`);
    else if (actions.length) lines.push(`未知动作 "${action}";可用:${actions.map(([a]) => a).join(', ')}`);
    lines.push('');
  }

  if (g.usage?.length) {
    lines.push('用法:');
    for (const u of g.usage) lines.push(`  ${u}`);
    lines.push('');
  }

  if (g.flags?.length) {
    lines.push('参数:');
    for (const f of g.flags) lines.push(`  ${f}`);
    lines.push('');
  }

  lines.push('提示:wpops commands --json 可列出全部组与动作;端点字段用 wpops raw OPTIONS <path>。');
  return lines.join('\n');
}

/** 机器可读清单。 */
export function commandsJson(version = 'unknown') {
  return JSON.stringify(manifest(version), null, 2);
}
