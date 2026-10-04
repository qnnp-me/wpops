#!/usr/bin/env node
import { loadEnv, listSites } from '../lib/env.js';
import { buildConfig, createClient, WpError } from '../lib/client.js';
import * as cmd from '../lib/commands.js';

function parseArgs(argv) {
  const positionals = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '-s' || arg === '--site') {
      flags.site = argv[++i];
      continue;
    }
    if (arg === '-a' || arg === '--all') {
      flags.all = true;
      continue;
    }
    if (arg === '-h') {
      flags.help = true;
      continue;
    }
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq !== -1) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
      } else {
        const next = argv[i + 1];
        if (next !== undefined && !next.startsWith('--')) {
          flags[arg.slice(2)] = next;
          i++;
        } else {
          flags[arg.slice(2)] = true;
        }
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printHelp() {
  console.log(`wpops —— WordPress REST 操作工具

用法: wpops [--site 名字 | --all] <组> <动作> [参数] [--flags]

  doctor                          连接与权限体检(先跑这个)
  me                              当前用户与能力
  sites                           列出已配置的站点

  posts  list|get|create|update|delete ...
  pages  list|get|create|update|delete ...
  media  list|get|upload|delete ...
  plugins list|install|activate|deactivate ...
  themes list|activate ...
  raw <METHOD> <path> [--data JSON]   任意端点兜底

多站点:
  --site <名字> / -s <名字>        对 sites/<名字>.env 执行
  --all / -a                       对所有已配置站点批量执行

常用参数:
  --per-page N        每页数量(REST 上限 100)
  --page N            页码(列表默认第 1 页)
  --status <s>        状态(draft|publish|...)
  --search <s>        搜索
  --title/--content   标题/正文
  --from-file <path>  正文取自文件
  --slug <s>          别名(slug)
  --excerpt <s>       摘要
  --categories 1,2    分类 ID
  --tags 3,4          标签 ID
  --alt <文本>        图片替代文本(media upload)
  --force             彻底删除(delete,默认进回收站)
  --activate          安装后立即启用(plugins install)
  --data <JSON>       raw 的请求体
  --json              输出原始 JSON

示例:
  wpops doctor
  wpops -s blog-a posts list --per-page 5
  wpops --all posts list
  wpops posts create --title "标题" --content "正文" --status draft
  wpops media upload ./pic.jpg --alt "配图"
  wpops plugins list
  wpops plugins install wp-super-cache --activate
  wpops raw GET /wp-json/wp/v2/categories`);
}

function printSites() {
  const sites = listSites();
  if (!sites.length) {
    console.log('还没有配置任何站点。');
    console.log('把 .env.example 复制成 sites/<名字>.env,填入该站凭据。');
    return;
  }
  console.log(`已配置 ${sites.length} 个站点:`);
  for (const s of sites) {
    let url = '(未填 WP_URL)';
    try {
      const env = loadEnv(s.name);
      if (env.WP_URL) url = env.WP_URL;
    } catch {
      url = '(读取失败)';
    }
    console.log(`  ${s.label.padEnd(16)} ${url}`);
  }
}

async function runOne(site, group, action, rest, flags, showHeader) {
  const cfg = buildConfig(loadEnv(site));
  const client = createClient(cfg);

  if (showHeader) {
    console.log(`\n=== ${site || '(default)'} — ${cfg.url || '(未配置 WP_URL)'} ===`);
  }

  const needFirst = (what) => {
    const value = rest[0];
    if (!value) throw new Error(`${what} 需要一个参数`);
    return value;
  };

  const content = async (type) => {
    switch (action) {
      case undefined:
      case 'list':
        return cmd.listContent(client, type, flags);
      case 'get':
        return cmd.getContent(client, type, needFirst('get'), flags);
      case 'create':
      case 'new':
        return cmd.createContent(client, type, flags);
      case 'update':
      case 'edit':
        return cmd.updateContent(client, type, needFirst('update'), flags);
      case 'delete':
      case 'rm':
        return cmd.deleteContent(client, type, needFirst('delete'), flags);
      default:
        throw new Error(`${type} 未知子命令:${action}`);
    }
  };

  switch (group) {
    case 'doctor':
      return cmd.doctor(client, cfg, flags);
    case 'me':
    case 'user':
      return cmd.me(client, flags);
    case 'posts':
    case 'post':
      return content('posts');
    case 'pages':
    case 'page':
      return content('pages');
    case 'media':
      switch (action) {
        case undefined:
        case 'list':
          return cmd.listMedia(client, flags);
        case 'upload':
          return cmd.uploadMedia(client, needFirst('upload 需要文件路径'), flags);
        case 'delete':
        case 'rm':
          return cmd.deleteMedia(client, needFirst('delete'), flags);
        case 'get': {
          const { data } = await client.request('GET', `/wp-json/wp/v2/media/${Number(needFirst('get'))}`);
          return printJson(data);
        }
        default:
          throw new Error(`media 未知子命令:${action}`);
      }
    case 'plugins':
    case 'plugin':
      switch (action) {
        case undefined:
        case 'list':
          return cmd.listPlugins(client, flags);
        case 'install':
          if (!rest[0]) {
            throw new Error('plugins install 需要 wordpress.org 插件别名,例如 wpops plugins install akismet');
          }
          return cmd.installPlugin(client, rest[0], flags);
        case 'activate':
          return cmd.setPluginStatus(client, needFirst('activate'), true, flags);
        case 'deactivate':
          return cmd.setPluginStatus(client, needFirst('deactivate'), false, flags);
        default:
          throw new Error(`plugins 未知子命令:${action}`);
      }
    case 'themes':
    case 'theme':
      switch (action) {
        case undefined:
        case 'list':
          return cmd.listThemes(client, flags);
        case 'activate':
        case 'switch':
          return cmd.activateTheme(client, needFirst('activate'), flags);
        default:
          throw new Error(`themes 未知子命令:${action}`);
      }
    case 'raw':
      if (!action || !rest[0]) throw new Error('raw 用法:wpops raw <METHOD> <path> [--data JSON]');
      return cmd.raw(client, action, rest[0], flags);
    default:
      throw new Error(`未知命令:${group}(运行 wpops help 查看用法)`);
  }
}

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const [group, action, ...rest] = positionals;

  if (!group || group === 'help' || flags.help) {
    printHelp();
    return;
  }
  if (group === 'sites') {
    printSites();
    return;
  }

  const site = flags.site || process.env.WPOPS_SITE || null;

  if (flags.all) {
    const targets = listSites();
    if (!targets.length) throw new Error('还没有配置任何站点');
    let failures = 0;
    for (const target of targets) {
      try {
        await runOne(target.name, group, action, rest, flags, true);
      } catch (err) {
        failures++;
        console.error(`✗ [${target.label}] ${err.message}`);
      }
    }
    if (failures) {
      console.error(`\n完成:${failures}/${targets.length} 个站点出错。`);
      process.exitCode = 1;
    }
    return;
  }

  await runOne(site, group, action, rest, flags, false);
}

main().catch((err) => {
  if (err instanceof WpError) {
    console.error(`✗ ${err.message}`);
    if (err.code) console.error(`  代码:${err.code}`);
  } else {
    console.error(`✗ ${err.message}`);
  }
  process.exit(1);
});
