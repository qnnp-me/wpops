#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEnv, listSites, configHome } from '../lib/env.js';
import { buildConfig, createClient, WpError } from '../lib/client.js';
import { parseArgs, isMutation } from '../lib/args.js';
import { installSkill } from '../lib/skill.js';
import { configureOutput } from '../lib/util.js';
import * as cmd from '../lib/commands.js';
import * as searchMod from '../lib/search.js';
import * as settingsMod from '../lib/settings.js';
import * as introspectMod from '../lib/introspect.js';
import * as revisionsMod from '../lib/revisions.js';
import * as blocksMod from '../lib/blocks.js';
import * as navigationMod from '../lib/navigation.js';
import * as templatesMod from '../lib/templates.js';
import * as globalStylesMod from '../lib/global-styles.js';
import * as widgetsMod from '../lib/widgets.js';
import * as appPasswordsMod from '../lib/app-passwords.js';
import * as abilitiesMod from '../lib/abilities.js';
import * as healthMod from '../lib/health.js';
import * as batchMod from '../lib/batch.js';

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
  sites [list|show <名>|rm <名>|rename <旧> <新>]   站点配置管理
  install-skill                   把内置 skill 装到 agent 发现目录
  completion [bash|zsh|fish|powershell]  输出补全脚本
  help <组>                       查看某组用法

  posts      list|get|create|update|delete ...
  pages      list|get|create|update|delete ...
  media      list|get|upload|update|delete ...
  content    <动作> <rest_base> ...  任意 show_in_rest 的 CPT(如 content list books)
  terms      <动作> <rest_base> ...  任意 show_in_rest 的分类法
  categories list|get|create|update|delete ...
  tags       list|get|create|update|delete ...
  comments   list|get|create|update|delete ...
  users      list|get|create|update|delete|me ...
  menus      list|get|create|update|delete ...
  menu-items list|get|create|update|delete ...
  revisions  list|get|delete|restore ...  内容历史版本
  blocks     list|get|create|update|delete ...  可复用区块
  navigation list|get|create|update|delete ...  区块主题导航
  templates  list|get|update ...        区块主题模板
  template-parts list|get|update ...    模板片段
  global-styles get|update ...          theme.json 全局样式
  widgets    list|get|create|update|delete ...
  sidebars   list|get|update ...
  app-passwords list|create|delete ... 用户应用密码
  settings   [list] · settings update ...
  types|taxonomies|statuses             自省已注册类型/分类/状态
  search <词>                           跨内容搜索
  abilities  list|get|run ...           Abilities API(需插件)
  health     list|<test>                站点健康测试(需插件)
  batch      --requests JSON            批量 REST 请求
  plugins    list|install|activate|deactivate|delete ...
  themes     list|activate ...
  raw <METHOD> <path> [--data JSON]     任意端点兜底

多站点:
  --site <名字> / -s <名字>        对 sites/<名字>.env 执行(可逗号分隔多个)
  --all / -a                       对所有已配置站点批量执行(写操作需 --yes)

安全:
  --dry-run                       只预览不执行(写操作;delete 的预览不需要 --force)
  --yes / -y                      批量写操作的确认开关
  --timeout <ms> · --retries <n>  覆盖请求超时/重试(也可用 WP_TIMEOUT_MS/WP_RETRIES)

常用参数:
  --per-page N · --page N         分页(REST 上限 100)
  --all-pages / --paginate        自动翻完所有页
  --status <s>                    状态(posts/comments 等)
  --search <s> · --orderby <f> · --order <asc|desc>
  --categories 1,2 · --tags 3,4   分类/标签 ID(过滤或设置)
  --author <id> · --after <日期> · --before <日期>
  --title/--content/--from-file   标题/正文
  --slug <s> · --excerpt <s>      别名 / 摘要
  --featured-media <id>           特色图
  --alt <文本> · --caption <文本> 媒体替代文本 / 说明
  --name/--parent/--description   分类/标签字段
  --menus <id> · --menu-order N   菜单项所属菜单 / 排序
  --object/--object-id            菜单项指向的对象(如 page 4976)
  --attr-title/--classes/--target/--xfn  菜单项属性
  --locations header,mobile       菜单绑定的主题位置
  --username/--email/--role       用户字段
  --force                         彻底删除 / 危险操作确认
  --data <JSON>                   raw / 部分命令的请求体
  --json                          输出原始 JSON
  --fields a,b · --csv · --table  输出投影 / CSV / 表格
  --quiet                         只出错时才输出
  --output <文件>                  把输出写入文件

示例:
  wpops doctor
  wpops -s blog-a posts list --per-page 5 --orderby date --order desc
  wpops posts list --categories 3,7
  wpops posts update 12 --from-file ./post.md --status draft
  wpops media update 44 --alt "配图"
  wpops categories list
  wpops comments list --status hold
  wpops menus list
  wpops menu-items list --menus 190
  wpops menu-items create --title Projects --url https://qnnp.me/projects --menus 190 --menu-order 6
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
  if (flags.timeout !== undefined) cfg.timeoutMs = Number(flags.timeout);
  if (flags.retries !== undefined) cfg.retries = Number(flags.retries);
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
        case 'delete':
        case 'rm':
          return cmd.deletePlugin(client, needFirst('delete'), flags);
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
        case 'create':
        case 'new':
          return cmd.createComment(client, flags);
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
    case 'menus':
    case 'menu':
      switch (action) {
        case undefined:
        case 'list':
          return cmd.listMenus(client, flags);
        case 'get':
          return cmd.getMenu(client, needFirst('get'), flags);
        case 'create':
        case 'new':
          return cmd.createMenu(client, flags);
        case 'update':
        case 'edit':
          return cmd.updateMenu(client, needFirst('update'), flags);
        case 'delete':
        case 'rm':
          return cmd.deleteMenu(client, needFirst('delete'), flags);
        default:
          throw new Error(`menus 未知子命令:${action}`);
      }
    case 'menu-items':
    case 'menu-item':
      switch (action) {
        case undefined:
        case 'list':
          return cmd.listMenuItems(client, flags);
        case 'get':
          return cmd.getMenuItem(client, needFirst('get'), flags);
        case 'create':
        case 'new':
          return cmd.createMenuItem(client, flags);
        case 'update':
        case 'edit':
          return cmd.updateMenuItem(client, needFirst('update'), flags);
        case 'delete':
        case 'rm':
          return cmd.deleteMenuItem(client, needFirst('delete'), flags);
        default:
          throw new Error(`menu-items 未知子命令:${action}`);
      }
    case 'content': {
      const type = rest[0];
      if (!type) throw new Error('content 用法:wpops content list|get|create|update|delete <rest_base> [id]');
      const id = rest[1];
      switch (action) {
        case undefined:
        case 'list':
          return cmd.listContent(client, type, flags);
        case 'get':
          if (!id) throw new Error('content get 需要 id');
          return cmd.getContent(client, type, id, flags);
        case 'create':
        case 'new':
          return cmd.createContent(client, type, flags);
        case 'update':
        case 'edit':
          if (!id) throw new Error('content update 需要 id');
          return cmd.updateContent(client, type, id, flags);
        case 'delete':
        case 'rm':
          if (!id) throw new Error('content delete 需要 id');
          return cmd.deleteContent(client, type, id, flags);
        default:
          throw new Error(`content 未知子命令:${action}`);
      }
    }
    case 'terms': {
      const tax = rest[0];
      if (!tax) throw new Error('terms 用法:wpops terms list|get|create|update|delete <rest_base> [id]');
      const id = rest[1];
      switch (action) {
        case undefined:
        case 'list':
          return cmd.listTaxonomy(client, tax, flags);
        case 'get':
          if (!id) throw new Error('terms get 需要 id');
          return cmd.getTaxonomy(client, tax, id);
        case 'create':
        case 'new':
          return cmd.createTaxonomy(client, tax, flags);
        case 'update':
        case 'edit':
          if (!id) throw new Error('terms update 需要 id');
          return cmd.updateTaxonomy(client, tax, id, flags);
        case 'delete':
        case 'rm':
          if (!id) throw new Error('terms delete 需要 id');
          return cmd.deleteTaxonomy(client, tax, id, flags);
        default:
          throw new Error(`terms 未知子命令:${action}`);
      }
    }
    case 'search':
      return searchMod.search(client, action, flags);
    case 'settings':
      switch (action) {
        case undefined:
        case 'list':
        case 'get':
          return settingsMod.getSettings(client, flags);
        case 'update':
        case 'set':
        case 'edit':
          return settingsMod.updateSettings(client, flags);
        default:
          throw new Error(`settings 未知子命令:${action}`);
      }
    case 'types':
      switch (action) {
        case undefined:
        case 'list':
          return introspectMod.listTypes(client, flags);
        case 'get':
          return introspectMod.getType(client, needFirst('get'), flags);
        default:
          throw new Error(`types 未知子命令:${action}`);
      }
    case 'taxonomies':
    case 'taxonomy':
      switch (action) {
        case undefined:
        case 'list':
          return introspectMod.listTaxonomies(client, flags);
        case 'get':
          return introspectMod.getTaxonomy(client, needFirst('get'), flags);
        default:
          throw new Error(`taxonomies 未知子命令:${action}`);
      }
    case 'statuses':
      return introspectMod.listStatuses(client, flags);
    case 'revisions':
    case 'revision': {
      const revType = flags.type || 'posts';
      switch (action) {
        case undefined:
        case 'list':
          return revisionsMod.listRevisions(client, revType, needFirst('list'), flags);
        case 'get':
          if (!rest[1]) throw new Error('revisions get 需要 <id> <rev>');
          return revisionsMod.getRevision(client, revType, rest[0], rest[1], flags);
        case 'delete':
        case 'rm':
          if (!rest[1]) throw new Error('revisions delete 需要 <id> <rev>');
          return revisionsMod.deleteRevision(client, revType, rest[0], rest[1], flags);
        case 'restore':
          if (!rest[1]) throw new Error('revisions restore 需要 <id> <rev>');
          return revisionsMod.restoreRevision(client, revType, rest[0], rest[1], flags);
        default:
          throw new Error(`revisions 未知子命令:${action}`);
      }
    }
    case 'blocks':
    case 'block':
      switch (action) {
        case undefined:
        case 'list':
          return blocksMod.listBlocks(client, flags);
        case 'get':
          return blocksMod.getBlock(client, needFirst('get'), flags);
        case 'create':
        case 'new':
          return blocksMod.createBlock(client, flags);
        case 'update':
        case 'edit':
          return blocksMod.updateBlock(client, needFirst('update'), flags);
        case 'delete':
        case 'rm':
          return blocksMod.deleteBlock(client, needFirst('delete'), flags);
        default:
          throw new Error(`blocks 未知子命令:${action}`);
      }
    case 'navigation':
      switch (action) {
        case undefined:
        case 'list':
          return navigationMod.listNavigation(client, flags);
        case 'get':
          return navigationMod.getNavigation(client, needFirst('get'), flags);
        case 'create':
        case 'new':
          return navigationMod.createNavigation(client, flags);
        case 'update':
        case 'edit':
          return navigationMod.updateNavigation(client, needFirst('update'), flags);
        case 'delete':
        case 'rm':
          return navigationMod.deleteNavigation(client, needFirst('delete'), flags);
        default:
          throw new Error(`navigation 未知子命令:${action}`);
      }
    case 'templates':
    case 'template':
      switch (action) {
        case undefined:
        case 'list':
          return templatesMod.listTemplates(client, flags);
        case 'get':
          return templatesMod.getTemplate(client, needFirst('get'), flags);
        case 'update':
        case 'edit':
          return templatesMod.updateTemplate(client, needFirst('update'), flags);
        default:
          throw new Error(`templates 未知子命令:${action}`);
      }
    case 'template-parts':
    case 'template-part':
      switch (action) {
        case undefined:
        case 'list':
          return templatesMod.listTemplateParts(client, flags);
        case 'get':
          return templatesMod.getTemplatePart(client, needFirst('get'), flags);
        case 'update':
        case 'edit':
          return templatesMod.updateTemplatePart(client, needFirst('update'), flags);
        default:
          throw new Error(`template-parts 未知子命令:${action}`);
      }
    case 'global-styles':
    case 'global-style':
      switch (action) {
        case undefined:
        case 'get':
        case 'list':
          return globalStylesMod.getGlobalStyles(client, needFirst('get'), flags);
        case 'update':
        case 'set':
          return globalStylesMod.updateGlobalStyles(client, needFirst('update'), flags);
        default:
          throw new Error(`global-styles 未知子命令:${action}`);
      }
    case 'widgets':
    case 'widget':
      switch (action) {
        case undefined:
        case 'list':
          return widgetsMod.listWidgets(client, flags);
        case 'get':
          return widgetsMod.getWidget(client, needFirst('get'), flags);
        case 'create':
        case 'new':
          return widgetsMod.createWidget(client, flags);
        case 'update':
        case 'edit':
          return widgetsMod.updateWidget(client, needFirst('update'), flags);
        case 'delete':
        case 'rm':
          return widgetsMod.deleteWidget(client, needFirst('delete'), flags);
        default:
          throw new Error(`widgets 未知子命令:${action}`);
      }
    case 'sidebars':
    case 'sidebar':
      switch (action) {
        case undefined:
        case 'list':
          return widgetsMod.listSidebars(client, flags);
        case 'get':
          return widgetsMod.getSidebar(client, needFirst('get'), flags);
        case 'update':
        case 'edit':
          return widgetsMod.updateSidebar(client, needFirst('update'), flags);
        default:
          throw new Error(`sidebars 未知子命令:${action}`);
      }
    case 'app-passwords':
    case 'app-password': {
      const user = flags.user || 'me';
      switch (action) {
        case undefined:
        case 'list':
          return appPasswordsMod.listAppPasswords(client, user, flags);
        case 'create':
        case 'new':
          return appPasswordsMod.createAppPassword(client, user, flags);
        case 'delete':
        case 'rm':
          return appPasswordsMod.deleteAppPassword(client, user, needFirst('delete'), flags);
        default:
          throw new Error(`app-passwords 未知子命令:${action}`);
      }
    }
    case 'abilities':
    case 'ability':
      switch (action) {
        case undefined:
        case 'list':
          return abilitiesMod.listAbilities(client, flags);
        case 'get':
          return abilitiesMod.getAbility(client, needFirst('get'), flags);
        case 'run':
          return abilitiesMod.runAbility(client, needFirst('run'), flags);
        default:
          throw new Error(`abilities 未知子命令:${action}`);
      }
    case 'health':
      if (action === undefined || action === 'list') return healthMod.listHealth(client, flags);
      return healthMod.runHealth(client, action, flags);
    case 'batch':
      return batchMod.batch(client, flags);
    case 'raw':
      if (!action || !rest[0]) throw new Error('raw 用法:wpops raw <METHOD> <path> [--data JSON]');
      return cmd.raw(client, action, rest[0], flags);
    default:
      throw new Error(`未知命令:${group}(运行 wpops help 查看用法)`);
  }
}

// ------------------------------------------------------------------ sites 管理

const SENSITIVE = /PASSWORD|SECRET|TOKEN|KEY/i;

function sitesCommand(action, rest) {
  const dir = join(configHome(), 'sites');
  switch (action) {
    case undefined:
    case 'list':
      return printSites();
    case 'show': {
      const name = rest[0];
      if (!name) throw new Error('sites show 需要站点名');
      const env = loadEnv(name);
      console.log(`站点 ${name}:`);
      for (const [key, value] of Object.entries(env)) {
        console.log(`  ${key}=${SENSITIVE.test(key) ? '***' : value}`);
      }
      return;
    }
    case 'rm': {
      const name = rest[0];
      if (!name) throw new Error('sites rm 需要站点名');
      const file = join(dir, `${name}.env`);
      if (!existsSync(file)) throw new Error(`找不到站点配置 ${file}`);
      rmSync(file);
      console.log(`✓ 已删除站点配置 ${name}`);
      return;
    }
    case 'rename': {
      const [from, to] = rest;
      if (!from || !to) throw new Error('sites rename 需要 <旧名> <新名>');
      const src = join(dir, `${from}.env`);
      const dst = join(dir, `${to}.env`);
      if (!existsSync(src)) throw new Error(`找不到站点配置 ${src}`);
      if (existsSync(dst)) throw new Error(`目标已存在 ${dst}`);
      renameSync(src, dst);
      console.log(`✓ 已重命名站点 ${from} → ${to}`);
      return;
    }
    default:
      throw new Error(`sites 未知子命令:${action}(list|show|rm|rename)`);
  }
}

// ------------------------------------------------------------------ 输出包装

/** 统一处理 --quiet / --output:抑制或把命令的人类可读输出写入文件。 */
async function withOutput(flags, fn) {
  const lines = [];
  const originalLog = console.log;
  if (flags.quiet) console.log = () => {};
  else if (flags.output) console.log = (...args) => lines.push(args.join(' '));
  try {
    return await fn();
  } finally {
    console.log = originalLog;
    if (!flags.quiet && flags.output && lines.length) {
      const file = resolve(String(flags.output));
      writeFileSync(file, lines.join('\n') + '\n', 'utf8');
      originalLog(`✓ 输出已写入 ${file}`);
    }
  }
}

// ------------------------------------------------------------------ help / completion

const GROUP_HELP = {
  menus: 'menus:list|get|create|update|delete\n  wpops menus list\n  wpops menus create --name Header --locations header,mobile\n  wpops menus update 190 --locations header,mobile\n  wpops menus delete 190 --force',
  'menu-items': 'menu-items:list|get|create|update|delete\n  wpops menu-items list --menus 190\n  wpops menu-items create --title Projects --url https://... --menus 190\n  wpops menu-items update <id> --menu-order 3\n  wpops menu-items delete <id> --force',
  content: 'content:<action> <rest_base> [id]   # 任意 show_in_rest 的 CPT\n  wpops content list books\n  wpops content get books 12\n  wpops content create books --title "..."',
  terms: 'terms:<action> <rest_base> [id]     # 任意 show_in_rest 的分类法\n  wpops terms list genres\n  wpops terms create genres --name 科幻',
  search: 'search <词> [--type post] [--subtype <s>] [--per-page N]',
  settings: 'settings [list] · settings update --title "..." [--timezone ...] [--data JSON]',
  revisions: 'revisions <list|get|delete|restore> <id> [rev] [--type posts|pages]',
  blocks: 'blocks list|get|create|update|delete ...',
  navigation: 'navigation list|get|create|update|delete ...',
  templates: 'templates list|get|update ...',
  'template-parts': 'template-parts list|get|update ...',
  'global-styles': 'global-styles get <id> · global-styles update <id> --styles JSON',
  widgets: 'widgets list|get|create|update|delete ...',
  sidebars: 'sidebars list|get|update ...',
  'app-passwords': 'app-passwords list|create|delete [--user <id|me>] --name <名字>',
  abilities: 'abilities list|get|run <name> [--input JSON]',
  health: 'health list · health <test-name>',
  batch: 'batch --requests JSON | --requests-file <文件>',
};

function printGroupHelp(group) {
  const help = GROUP_HELP[group];
  if (!help) {
    printHelp();
    return;
  }
  console.log(help);
}

const COMPLETION_GROUPS = [
  'posts', 'pages', 'media', 'plugins', 'themes', 'categories', 'tags', 'comments', 'users',
  'menus', 'menu-items', 'content', 'terms', 'search', 'settings', 'types', 'taxonomies',
  'statuses', 'revisions', 'blocks', 'navigation', 'templates', 'template-parts', 'global-styles',
  'widgets', 'sidebars', 'app-passwords', 'abilities', 'health', 'batch', 'raw',
  'doctor', 'me', 'sites', 'setup', 'install-skill', 'completion',
];

function printCompletion(shell) {
  const words = COMPLETION_GROUPS.join(' ');
  switch (shell || 'bash') {
    case 'bash':
      console.log(`# wpops bash completion(用法:eval "$(wpops completion bash)")\n_wpops() {\n  local cur="\${COMP_WORDS[COMP_CWORD]}"\n  COMPREPLY=( $(compgen -W "${words}" -- "$cur") )\n}\ncomplete -F _wpops wpops`);
      return;
    case 'zsh':
      console.log(`# wpops zsh completion(用法:eval "$(wpops completion zsh)")\n_wpops() { compadd ${words} }\ncompdef _wpops wpops`);
      return;
    case 'fish':
      console.log(`# wpops fish completion(用法:wpops completion fish | source)\ncomplete -c wpops -f -a "${words}"`);
      return;
    case 'powershell':
      console.log(`# wpops PowerShell completion(用法:wpops completion powershell | Out-String | Invoke-Expression)\nRegister-ArgumentCompleter -Native -CommandName wpops -ScriptBlock {\n  param($wordToComplete)\n  "${words}".Split(' ') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }\n}`);
      return;
    default:
      throw new Error('completion 支持:bash|zsh|fish|powershell');
  }
}

// ------------------------------------------------------------------ main

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const [group, action, ...rest] = positionals;

  configureOutput(flags);
  if (flags.paginate) flags['all-pages'] = true;
  if (flags.csv || flags.table || flags.fields) flags.json = true;

  if (flags.version) {
    console.log(version());
    return;
  }
  if (!group || group === 'help' || flags.help) {
    if (group === 'help' && action) {
      printGroupHelp(action);
      return;
    }
    printHelp();
    return;
  }
  if (group === 'sites') {
    sitesCommand(action, rest);
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
  if (group === 'completion') {
    printCompletion(action);
    return;
  }

  const single = flags.site || process.env.WPOPS_SITE || null;
  const named = flags.site && String(flags.site).includes(',')
    ? String(flags.site).split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  let targets = null;
  if (flags.all) targets = listSites();
  else if (named.length) targets = named.map((name) => ({ name, label: name }));

  if (targets) {
    if (!targets.length) throw new Error('还没有配置任何站点');
    if (isMutation(group, action) && !flags.yes && !flags['dry-run']) {
      throw new Error('批量执行会作用于多个站点。写操作请加 --yes 确认,或先用 --dry-run 预览。');
    }
    let failures = 0;
    for (const target of targets) {
      try {
        await withOutput(flags, () => runOne(target.name, group, action, rest, flags, true));
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

  await withOutput(flags, () => runOne(single, group, action, rest, flags, false));
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
