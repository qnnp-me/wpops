// 组 → 动作 的分发逻辑。
// runOne 负责读配置建 client;dispatch 只做分发,便于用 stub client 做覆盖测试。
import { loadEnv } from './env.js';
import { buildConfig, createClient } from './client.js';
import { UsageError } from './errors.js';
import * as cmd from './commands.js';
import * as searchMod from './search.js';
import * as settingsMod from './settings.js';
import * as introspectMod from './introspect.js';
import * as revisionsMod from './revisions.js';
import * as blocksMod from './blocks.js';
import * as navigationMod from './navigation.js';
import * as templatesMod from './templates.js';
import * as globalStylesMod from './global-styles.js';
import * as widgetsMod from './widgets.js';
import * as appPasswordsMod from './app-passwords.js';
import * as abilitiesMod from './abilities.js';
import * as healthMod from './health.js';
import * as batchMod from './batch.js';

/** 纯分发:把组/动作路由到具体命令实现。 */
export async function dispatch(client, cfg, group, action, rest, flags) {
  const needFirst = (what) => {
    const value = rest[0];
    if (!value) {
      const label = [group, action].filter(Boolean).join(' ');
      const detail = what && what !== action ? `:${what}` : '';
      throw new UsageError(`${label} 缺少必需参数${detail}`, { group, action });
    }
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
      case 'import':
        return cmd.updateContent(client, type, needFirst('import'), flags);
      case 'export':
        return cmd.exportContent(client, type, needFirst('export'), flags);
      case 'publish':
        return cmd.setContentStatus(client, type, needFirst('publish'), 'publish', flags);
      case 'unpublish':
        return cmd.setContentStatus(client, type, needFirst('unpublish'), 'draft', flags);
      case 'delete':
      case 'rm':
        return cmd.deleteContent(client, type, needFirst('delete'), flags);
      default:
        throw new UsageError(`${type} 未知子命令:${action}`);
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
        throw new UsageError(`${tax} 未知子命令:${action}`);
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
    case 'content': {
      const type = rest[0];
      if (!type) throw new UsageError('content 用法:wpops content list|get|create|update|delete <rest_base> [id]');
      const id = rest[1];
      switch (action) {
        case undefined:
        case 'list':
          return cmd.listContent(client, type, flags);
        case 'get':
          if (!id) throw new UsageError('content get 需要 id');
          return cmd.getContent(client, type, id, flags);
        case 'create':
        case 'new':
          return cmd.createContent(client, type, flags);
        case 'update':
        case 'edit':
          if (!id) throw new UsageError('content update 需要 id');
          return cmd.updateContent(client, type, id, flags);
        case 'delete':
        case 'rm':
          if (!id) throw new UsageError('content delete 需要 id');
          return cmd.deleteContent(client, type, id, flags);
        default:
          throw new UsageError(`content 未知子命令:${action}`);
      }
    }
    case 'terms': {
      const tax = rest[0];
      if (!tax) throw new UsageError('terms 用法:wpops terms list|get|create|update|delete <rest_base> [id]');
      const id = rest[1];
      switch (action) {
        case undefined:
        case 'list':
          return cmd.listTaxonomy(client, tax, flags);
        case 'get':
          if (!id) throw new UsageError('terms get 需要 id');
          return cmd.getTaxonomy(client, tax, id);
        case 'create':
        case 'new':
          return cmd.createTaxonomy(client, tax, flags);
        case 'update':
        case 'edit':
          if (!id) throw new UsageError('terms update 需要 id');
          return cmd.updateTaxonomy(client, tax, id, flags);
        case 'delete':
        case 'rm':
          if (!id) throw new UsageError('terms delete 需要 id');
          return cmd.deleteTaxonomy(client, tax, id, flags);
        default:
          throw new UsageError(`terms 未知子命令:${action}`);
      }
    }
    case 'media':
      switch (action) {
        case undefined:
        case 'list':
          return cmd.listMedia(client, flags);
        case 'get':
          return cmd.getMedia(client, needFirst('get'), flags);
        case 'upload':
          return cmd.uploadMedia(client, needFirst('文件路径'), flags);
        case 'sideload':
          return cmd.sideloadMedia(client, flags);
        case 'edit-image':
        case 'crop':
          return cmd.editMediaImage(client, needFirst('edit-image'), flags);
        case 'update':
        case 'edit':
          return cmd.updateMedia(client, needFirst('update'), flags);
        case 'delete':
        case 'rm':
          return cmd.deleteMedia(client, needFirst('delete'), flags);
        default:
          throw new UsageError(`media 未知子命令:${action}`);
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
          throw new UsageError(`comments 未知子命令:${action}`);
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
          throw new UsageError(`users 未知子命令:${action}`);
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
          throw new UsageError(`menus 未知子命令:${action}`);
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
          throw new UsageError(`menu-items 未知子命令:${action}`);
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
          throw new UsageError(`settings 未知子命令:${action}`);
      }
    case 'types':
      switch (action) {
        case undefined:
        case 'list':
          return introspectMod.listTypes(client, flags);
        case 'get':
          return introspectMod.getType(client, needFirst('get'), flags);
        default:
          throw new UsageError(`types 未知子命令:${action}`);
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
          throw new UsageError(`taxonomies 未知子命令:${action}`);
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
          if (!rest[1]) throw new UsageError('revisions get 需要 <id> <rev>');
          return revisionsMod.getRevision(client, revType, rest[0], rest[1], flags);
        case 'delete':
        case 'rm':
          if (!rest[1]) throw new UsageError('revisions delete 需要 <id> <rev>');
          return revisionsMod.deleteRevision(client, revType, rest[0], rest[1], flags);
        case 'restore':
          if (!rest[1]) throw new UsageError('revisions restore 需要 <id> <rev>');
          return revisionsMod.restoreRevision(client, revType, rest[0], rest[1], flags);
        default:
          throw new UsageError(`revisions 未知子命令:${action}`);
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
          throw new UsageError(`blocks 未知子命令:${action}`);
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
          throw new UsageError(`navigation 未知子命令:${action}`);
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
          throw new UsageError(`templates 未知子命令:${action}`);
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
          throw new UsageError(`template-parts 未知子命令:${action}`);
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
          throw new UsageError(`global-styles 未知子命令:${action}`);
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
          throw new UsageError(`widgets 未知子命令:${action}`);
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
          throw new UsageError(`sidebars 未知子命令:${action}`);
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
          throw new UsageError(`app-passwords 未知子命令:${action}`);
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
          throw new UsageError(`abilities 未知子命令:${action}`);
      }
    case 'health':
      if (action === undefined || action === 'list') return healthMod.listHealth(client, flags);
      return healthMod.runHealth(client, action, flags);
    case 'batch':
      return batchMod.batch(client, flags);
    case 'plugins':
    case 'plugin':
      switch (action) {
        case undefined:
        case 'list':
          return cmd.listPlugins(client, flags);
        case 'install':
          if (!rest[0]) {
            throw new UsageError('plugins install 需要 wordpress.org 插件别名,例如 wpops plugins install akismet');
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
          throw new UsageError(`plugins 未知子命令:${action}`);
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
          throw new UsageError(`themes 未知子命令:${action}`);
      }
    case 'raw':
      if (!action || !rest[0]) throw new UsageError('raw 用法:wpops raw <METHOD> <path> [--data JSON]');
      return cmd.raw(client, action, rest[0], flags);
    default:
      throw new UsageError(`未知命令:${group}(运行 wpops help 查看用法)`);
  }
}

/** 读取站点配置、建 client,再分发(--timeout/--retries 可覆盖)。 */
export async function runOne(site, group, action, rest, flags, showHeader) {
  const cfg = buildConfig(loadEnv(site));
  if (flags.timeout !== undefined) cfg.timeoutMs = Number(flags.timeout);
  if (flags.retries !== undefined) cfg.retries = Number(flags.retries);
  const client = createClient(cfg);

  if (showHeader) {
    console.log(`\n=== ${site || '(default)'} — ${cfg.url || '(未配置 WP_URL)'} ===`);
  }
  return dispatch(client, cfg, group, action, rest, flags);
}
