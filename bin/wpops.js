#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { loadEnv, listSites } from '../lib/env.js';
import { buildConfig, createClient, WpError } from '../lib/client.js';
import { parseArgs, isMutation } from '../lib/args.js';
import { installSkill } from '../lib/skill.js';
import * as cmd from '../lib/commands.js';

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function version() {
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

function printHelp() {
  console.log(`wpops —— WordPress REST 操作工具

用法: wpops [--site 名字 | --all] <组> <动作> [参数] [--flags]

  --version / -v                  显示版本

  setup                           交互式配置一个站点(写入 sites/<名字>.env 并体检)
  doctor                          连接与权限体检(先跑这个)
  me                              当前用户与能力
  sites                           列出已配置的站点
  install-skill                   把内置 skill 装到 agent 发现目录

  posts      list|get|create|update|delete ...
  pages      list|get|create|update|delete ...
  media      list|get|upload|update|delete ...
  plugins    list|install|activate|deactivate ...
  themes     list|activate ...
  categories list|get|create|update|delete ...
  tags       list|get|create|update|delete ...
  comments   list|get|update|delete ...
  users      list|get|create|update|delete|me ...
  raw <METHOD> <path> [--data JSON]   任意端点兜底

多站点:
  --site <名字> / -s <名字>        对 sites/<名字>.env 执行
  --all / -a                       对所有已配置站点批量执行(写操作需 --yes)

安全:
  --dry-run                       只预览不执行(写操作)
  --yes / -y                      --all 写操作的确认开关

常用参数:
  --per-page N · --page N         分页(REST 上限 100)
  --status <s>                    状态(posts/comments 等)
  --search <s> · --orderby <f> · --order <asc|desc>
  --categories 1,2 · --tags 3,4   分类/标签 ID(过滤或设置)
  --author <id> · --after <日期> · --before <日期>
  --title/--content/--from-file   标题/正文
  --slug <s> · --excerpt <s>      别名 / 摘要
  --featured-media <id>           特色图
  --alt <文本> · --caption <文本> 媒体替代文本 / 说明
  --name/--parent/--description   分类/标签字段
  --username/--email/--role       用户字段
  --force                         彻底删除 / 危险操作确认
  --data <JSON>                   raw 的请求体
  --json                          输出原始 JSON

示例:
  wpops doctor
  wpops -s blog-a posts list --per-page 5 --orderby date --order desc
  wpops posts list --categories 3,7
  wpops posts update 12 --from-file ./post.md --status draft
  wpops media update 44 --alt "配图"
  wpops categories list
  wpops comments list --status hold
  wpops --all posts list
  wpops --all plugins list
  wpops --all posts delete 5 --dry-run
  wpops plugins install wp-super-cache --activate`);
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

  const taxonomy = async (tax) => {
    switch (action) {
      case undefined:
      case 'list':
        return cmd.listTaxonomy(client, tax, flags);
      case 'get':
        return cmd.getTaxonomy(client, tax, needFirst('get'));
      case 'create':
      case 'new':
        return cmd.createTaxonomy(client, tax, flags);
      case 'update':
      case 'edit':
        return cmd.updateTaxonomy(client, tax, needFirst('update'), flags);
      case 'delete':
      case 'rm':
        return cmd.deleteTaxonomy(client, tax, needFirst('delete'), flags);
      default:
        throw new Error(`${tax} 未知子命令:${action}`);
    }
  };

  switch (group) {
    case 'doctor':
      return cmd.doctor(client, cfg, flags);
    case 'me':
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
        case 'get':
          return cmd.getMedia(client, needFirst('get'), flags);
        case 'upload':
          return cmd.uploadMedia(client, needFirst('upload 需要文件路径'), flags);
        case 'update':
        case 'edit':
          return cmd.updateMedia(client, needFirst('update'), flags);
        case 'delete':
        case 'rm':
          return cmd.deleteMedia(client, needFirst('delete'), flags);
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
    case 'categories':
    case 'category':
      return taxonomy('categories');
    case 'tags':
    case 'tag':
      return taxonomy('tags');
    case 'comments':
    case 'comment':
      switch (action) {
        case undefined:
        case 'list':
          return cmd.listComments(client, flags);
        case 'get':
          return cmd.getComment(client, needFirst('get'));
        case 'update':
        case 'edit':
          return cmd.updateComment(client, needFirst('update'), flags);
        case 'delete':
        case 'rm':
          return cmd.deleteComment(client, needFirst('delete'), flags);
        default:
          throw new Error(`comments 未知子命令:${action}`);
      }
    case 'users':
    case 'user':
      switch (action) {
        case undefined:
        case 'list':
          return cmd.listUsers(client, flags);
        case 'me':
          return cmd.me(client, flags);
        case 'get':
          return cmd.getUser(client, needFirst('get'));
        case 'create':
        case 'new':
          return cmd.createUser(client, flags);
        case 'update':
        case 'edit':
          return cmd.updateUser(client, needFirst('update'), flags);
        case 'delete':
        case 'rm':
          return cmd.deleteUser(client, needFirst('delete'), flags);
        default:
          throw new Error(`users 未知子命令:${action}`);
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

  if (flags.version) {
    console.log(version());
    return;
  }
  if (!group || group === 'help' || flags.help) {
    printHelp();
    return;
  }
  if (group === 'sites') {
    printSites();
    return;
  }
  if (group === 'setup') {
    await cmd.setup(flags);
    return;
  }
  if (group === 'install-skill') {
    const dirs = installSkill();
    if (!dirs.length) {
      console.log('未安装 skill(可能已存在同名目录被跳过,或用 WPOPS_SKIP_SKILL 禁用)。');
    } else {
      for (const dir of dirs) console.log(`✓ skill 已安装到 ${dir}`);
    }
    return;
  }

  const site = flags.site || process.env.WPOPS_SITE || null;
  const mutating = isMutation(group, action);

  if (flags.all) {
    const targets = listSites();
    if (!targets.length) throw new Error('还没有配置任何站点');
    if (mutating && !flags.yes && !flags['dry-run']) {
      throw new Error('--all 会作用于所有站点。写操作请加 --yes 确认,或先用 --dry-run 预览。');
    }
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
