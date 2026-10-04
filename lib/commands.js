import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { createInterface } from 'node:readline';
import { loadEnv, configHome, hardenConfigPerms } from './env.js';
import { installSkill } from './skill.js';
import { buildConfig, createClient, WpError } from './client.js';
import { stripTags, printJson, dry, warn, pick, listRequest, parseJson, readJsonFile } from './util.js';
import { UsageError } from './errors.js';

const CONTENT = {
  posts: '/wp-json/wp/v2/posts',
  pages: '/wp-json/wp/v2/pages',
};

const TAX = {
  categories: '/wp-json/wp/v2/categories',
  tags: '/wp-json/wp/v2/tags',
};

/** 内置类型走映射;其余按 rest_base 直接拼,支持任意 show_in_rest 的 CPT。 */
function contentPath(type) {
  return CONTENT[type] || `/wp-json/wp/v2/${String(type).replace(/^\/+/, '')}`;
}

function taxPath(tax) {
  return TAX[tax] || `/wp-json/wp/v2/${String(tax).replace(/^\/+/, '')}`;
}

const MEDIA = '/wp-json/wp/v2/media';
const COMMENTS = '/wp-json/wp/v2/comments';
const USERS = '/wp-json/wp/v2/users';
const MENUS = '/wp-json/wp/v2/menus';
const MENU_ITEMS = '/wp-json/wp/v2/menu-items';

/** 内容写操作的结果输出:草稿/待审等非公开状态额外回显后台编辑(预览)链接。 */
function printItem(data, flags, client) {
  if (flags.json) return printJson(data);
  console.log(`✓ #${data.id} [${data.status}] ${stripTags(data.title?.rendered || '')}`);
  if (data.link) console.log(`  链接:${data.link}`);
  if (data.status && data.status !== 'publish' && client?.root) {
    console.log(`  编辑/预览:${client.root}/wp-admin/post.php?post=${Number(data.id)}&action=edit`);
  }
}

// ------------------------------------------------------------------ doctor

export async function doctor(client, cfg, flags) {
  const checks = [];
  const add = (label, status, detail = '') => checks.push({ label, status, detail });

  const problems = [];
  if (!cfg.url) problems.push('WP_URL 未设置');
  if (!cfg.user) problems.push('WP_USER 未设置');
  if (!cfg.password) problems.push('WP_APP_PASSWORD 未设置');
  if (cfg.url && !/^https:\/\//i.test(cfg.url)) problems.push('WP_URL 非 https');
  if (problems.length) {
    add('配置', 'fail', problems.join('; '));
    renderDoctor(checks);
    return;
  }
  add('配置', 'ok', `${cfg.url}(用户 ${cfg.user})`);

  const probe = async (label, fn, fmt) => {
    try {
      const value = await fn();
      add(label, 'ok', fmt ? fmt(value) : '');
      return value;
    } catch (err) {
      add(label, err.status ? 'fail' : 'error', err.message);
      return undefined;
    }
  };

  const root = await probe(
    'REST 根 /wp-json/',
    async () => (await client.request('GET', '/wp-json/')).data,
    (d) => `${d.name || '?'} — ${d.url || '?'}`,
  );

  if (root?.authentication) {
    add('认证方式', 'ok', Object.keys(root.authentication).join(', ') || '(无)');
  }

  const me = await probe(
    '当前用户 /wp/v2/users/me',
    async () => (await client.request('GET', '/wp-json/wp/v2/users/me', { query: { context: 'edit' } })).data,
    (d) => `${d.name} (@${d.slug}) 角色:${(d.roles || []).join(', ')}`,
  );

  if (me?.capabilities) {
    const caps = me.capabilities;
    const labels = {
      edit_posts: '编辑文章',
      publish_posts: '发布文章',
      upload_files: '上传媒体',
      manage_categories: '管理分类',
      manage_options: '管理选项(管理员)',
      install_plugins: '安装插件',
      activate_plugins: '启用插件',
      install_themes: '安装主题',
      switch_themes: '切换主题',
    };
    const have = Object.entries(labels)
      .filter(([key]) => caps[key])
      .map(([, label]) => label);
    add('能力', 'ok', have.join('、') || '—');
  }

  await probe(
    '文章 /wp/v2/posts',
    async () => (await client.request('GET', '/wp-json/wp/v2/posts', { query: { per_page: 1, context: 'edit' } })).headers.get('x-wp-total'),
    (n) => `可读写,共 ${n ?? '?'} 篇`,
  );

  await probe(
    '媒体 /wp/v2/media',
    async () => (await client.request('GET', MEDIA, { query: { per_page: 1 } })).headers.get('x-wp-total'),
    (n) => `可读写,共 ${n ?? '?'} 项`,
  );

  await probe(
    '评论 /wp/v2/comments',
    async () => (await client.request('GET', COMMENTS, { query: { per_page: 1 } })).headers.get('x-wp-total'),
    (n) => `可读写,共 ${n ?? '?'} 条`,
  );

  await probe(
    '插件 /wp/v2/plugins',
    async () => {
      const { data } = await client.request('GET', '/wp-json/wp/v2/plugins');
      return Array.isArray(data) ? data.length : 0;
    },
    (n) => `可安装/启停,已装 ${n} 个`,
  );

  await probe(
    '主题 /wp/v2/themes',
    async () => {
      const { data } = await client.request('GET', '/wp-json/wp/v2/themes');
      return Array.isArray(data) ? data.length : 0;
    },
    (n) => `可列出/切换,共 ${n} 个`,
  );

  await probe(
    '版本探测',
    async () => {
      const res = await fetch(cfg.url + '/', { redirect: 'follow' });
      const html = await res.text();
      const m = html.match(/name=["']generator["'][^>]*content=["']WordPress\s+([^"']+)["']/i);
      return m ? m[1] : null;
    },
    (v) => (v ? `WordPress ${v}` : '未暴露(常见于隐藏版本)'),
  );

  renderDoctor(checks);
}

function renderDoctor(checks) {
  const mark = { ok: '✓', warn: '!', fail: '✗', error: '✗' };
  console.log('\nwpops doctor\n' + '─'.repeat(44));
  for (const c of checks) {
    console.log(`${mark[c.status] || '?'} ${c.label}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  console.log('');
  const failed = checks.filter((c) => c.status === 'fail' || c.status === 'error');
  if (!failed.length) {
    console.log('连接正常,凭据可用。');
    return;
  }
  process.exitCode = 1;
  console.log('存在问题,请看上面的 ✗。');
  if (failed.some((c) => /401/.test(c.detail || ''))) {
    console.log('提示:401 通常是凭据错误,或主机没有把 Authorization 头传给 PHP');
    console.log('     (Apache/CGI/FastCGI 常见)。可在主机侧启用 HTTP_AUTHORIZATION 透传。');
  }
  if (failed.some((c) => /filesystem|credentials|无法连接/i.test(c.detail || ''))) {
    console.log('提示:插件安装/启停要求文件系统可写(FS_METHOD 直连,或提供 FTP 凭据)。');
  }
}

// ------------------------------------------------------------------ users(me)

export async function me(client, flags) {
  const { data } = await client.request('GET', `${USERS}/me`, { query: { context: 'edit' } });
  if (flags.json) return printJson(data);
  console.log(`#${data.id} ${data.name} (@${data.slug})`);
  console.log(`角色:${(data.roles || []).join(', ')}`);
  console.log(`邮箱:${data.email || '—'}`);
  if (data.capabilities) {
    const on = Object.entries(data.capabilities).filter(([, v]) => v).map(([k]) => k);
    console.log(`能力:${on.join(', ')}`);
  }
}

// ------------------------------------------------------------------ content

const CONTENT_FILTERS = {
  posts: ['orderby', 'order', 'author', 'after', 'before', 'categories', 'tags', 'slug', 'exclude', 'include', 'offset', 'sticky'],
  pages: ['orderby', 'order', 'author', 'after', 'before', 'slug', 'parent', 'menu_order', 'exclude', 'include', 'offset'],
};

export async function listContent(client, type, flags) {
  const perPage = Number(flags['per-page'] ?? 10) || 10;
  const page = Number(flags.page ?? 1) || 1;
  const query = {
    per_page: perPage,
    page,
    status: flags.status,
    search: flags.search,
    context: flags.context,
    ...pick(flags, CONTENT_FILTERS[type] || []),
  };
  const { data, total, totalPages } = await listRequest(client, contentPath(type), query, flags);
  if (flags.json) return printJson(data);
  console.log(
    `${type} 共 ${total ?? '?'} 条 / ${totalPages ?? '?'} 页;第 ${page} 页${totalPages ? `/${totalPages}` : ''},本页 ${data.length} 条:`,
  );
  for (const item of data) {
    console.log(`  #${item.id}  [${item.status}]  ${stripTags(item.title?.rendered || '(无标题)')}`);
  }
  if (totalPages && page < Number(totalPages)) {
    console.log(`  …下一页:wpops ${type} list --page ${page + 1} --per-page ${perPage}`);
  }
}

export async function getContent(client, type, id, flags) {
  const { data } = await client.request('GET', `${contentPath(type)}/${Number(id)}`, {
    query: { context: flags.context || 'edit' },
  });
  if (flags.json) return printJson(data);
  console.log(`#${data.id}  ${stripTags(data.title?.rendered || '')}`);
  console.log(`状态:${data.status}  链接:${data.link}`);
  console.log('─'.repeat(44));
  console.log(data.content?.raw ?? stripTags(data.content?.rendered || ''));
}

function contentBody(flags) {
  const body = {};
  if (flags.title !== undefined) body.title = String(flags.title);
  if (flags['from-file'] !== undefined) body.content = readFileSync(String(flags['from-file']), 'utf8');
  else if (flags.content !== undefined) body.content = String(flags.content);
  if (flags.status !== undefined) body.status = String(flags.status);
  if (flags.slug !== undefined) body.slug = String(flags.slug);
  if (flags.excerpt !== undefined) body.excerpt = String(flags.excerpt);
  if (flags['featured-media'] !== undefined) body.featured_media = Number(flags['featured-media']);
  if (flags.author !== undefined) body.author = Number(flags.author);
  if (flags.date !== undefined) body.date = String(flags.date);
  if (flags.categories) {
    body.categories = String(flags.categories).split(',').map((n) => Number(n.trim())).filter(Boolean);
  }
  if (flags.tags) {
    body.tags = String(flags.tags).split(',').map((n) => Number(n.trim())).filter(Boolean);
  }
  return body;
}

export async function createContent(client, type, flags) {
  const body = contentBody(flags);
  if (body.title === undefined && body.content === undefined) {
    throw new UsageError('至少需要 --title 或 --content/--from-file');
  }
  // 未显式指定状态时按草稿创建,不依赖服务端默认(避免"直接发布")。
  if (body.status === undefined) body.status = 'draft';
  if (flags['dry-run']) return dry(`将创建 ${type}(status=${body.status}) ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', contentPath(type), { body });
  printItem(data, flags, client);
}

export async function updateContent(client, type, id, flags) {
  const body = contentBody(flags);
  if (!Object.keys(body).length) throw new UsageError('没有可更新的字段');
  // 修改已发布内容的正文(未显式改状态)会立即影响线上:先提示可回滚(--yes 跳过预检与提示)。
  if (body.status === undefined && !flags.yes) {
    try {
      const { data: current } = await client.request('GET', `${contentPath(type)}/${Number(id)}`, {
        query: { context: 'edit' },
      });
      if (current.status === 'publish') {
        warn(
          `正在修改已发布内容 ${type} #${id};已生成修订,回滚:wpops revisions restore ${id} <rev> --type ${type}`,
          flags,
        );
      }
    } catch {
      // 预检失败(权限/网络)不阻断写入,也不提示。
    }
  }
  if (flags['dry-run']) return dry(`将更新 ${type} #${id} ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', `${contentPath(type)}/${Number(id)}`, { body });
  printItem(data, flags, client);
}

/** 显式发布 / 下线为草稿。 */
export async function setContentStatus(client, type, id, status, flags) {
  const label = status === 'publish' ? '发布' : '下线为草稿';
  if (flags['dry-run']) return dry(`将${label} ${type} #${id}`);
  const { data } = await client.request('POST', `${contentPath(type)}/${Number(id)}`, { body: { status } });
  if (flags.json) return printJson(data);
  console.log(`✓ #${data.id} → ${data.status}  ${data.link || ''}`);
  if (data.status !== 'publish' && client.root) {
    console.log(`  编辑/预览:${client.root}/wp-admin/post.php?post=${Number(data.id)}&action=edit`);
  }
}

/** 导出原始正文 content.raw 到文件(或 stdout),便于本地改排版后再 `update --from-file`。 */
export async function exportContent(client, type, id, flags) {
  const { data } = await client.request('GET', `${contentPath(type)}/${Number(id)}`, {
    query: { context: 'edit' },
  });
  const raw = data.content?.raw ?? stripTags(data.content?.rendered || '');
  if (flags.file !== undefined) {
    writeFileSync(String(flags.file), raw, 'utf8');
    console.log(`✓ 已导出 ${type} #${id} → ${flags.file}`);
    return;
  }
  process.stdout.write(raw.endsWith('\n') ? raw : `${raw}\n`);
}

export async function deleteContent(client, type, id, flags) {
  if (flags['dry-run']) return dry(`删除 ${type} #${id}${flags.force ? '(彻底)' : '(回收站)'}`);
  const { data } = await client.request('DELETE', `${contentPath(type)}/${Number(id)}`, {
    query: { force: flags.force ? 'true' : undefined },
  });
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已彻底删除 #${id}` : `✓ #${id} 已移入回收站`);
}

// ------------------------------------------------------------------ media

export async function listMedia(client, flags) {
  const perPage = Number(flags['per-page'] ?? 10) || 10;
  const page = Number(flags.page ?? 1) || 1;
  const query = {
    per_page: perPage,
    page,
    ...pick(flags, ['media_type', 'mime_type', 'parent', 'author', 'after', 'before', 'orderby', 'order', 'offset', 'include', 'exclude']),
  };
  const { data, total, totalPages } = await listRequest(client, MEDIA, query, flags);
  if (flags.json) return printJson(data);
  console.log(
    `媒体共 ${total ?? '?'} 项 / ${totalPages ?? '?'} 页;第 ${page} 页${totalPages ? `/${totalPages}` : ''},本页 ${data.length} 项:`,
  );
  for (const m of data) {
    console.log(`  #${m.id}  ${m.title?.rendered || m.slug}  ${m.source_url}`);
  }
  if (totalPages && page < Number(totalPages)) {
    console.log(`  …下一页:wpops media list --page ${page + 1} --per-page ${perPage}`);
  }
}

export async function getMedia(client, id, flags) {
  const { data } = await client.request('GET', `${MEDIA}/${Number(id)}`, { query: { context: flags.context || 'edit' } });
  printJson(data);
}

export async function uploadMedia(client, file, flags) {
  const name = basename(file);
  if (flags['dry-run']) return dry(`上传媒体 ${file}${flags.title ? ` title="${flags.title}"` : ''}`);
  const buffer = readFileSync(file);
  const form = new FormData();
  form.append('file', new Blob([buffer]), name);
  if (flags.title) form.append('title', String(flags.title));
  if (flags.alt) form.append('alt_text', String(flags.alt));
  if (flags.caption) form.append('caption', String(flags.caption));
  const { data } = await client.request('POST', MEDIA, {
    form,
    headers: { 'Content-Disposition': `attachment; filename="${name}"` },
  });
  if (flags.json) return printJson(data);
  console.log(`✓ 已上传 #${data.id}  ${data.source_url}`);
}

export async function updateMedia(client, id, flags) {
  const body = {};
  if (flags.title !== undefined) body.title = String(flags.title);
  if (flags.alt !== undefined) body.alt_text = String(flags.alt);
  if (flags.caption !== undefined) body.caption = String(flags.caption);
  if (flags.description !== undefined) body.description = String(flags.description);
  if (flags.post !== undefined) body.post = Number(flags.post);
  if (!Object.keys(body).length) {
    throw new UsageError('没有可更新的字段(--title/--alt/--caption/--description/--post)');
  }
  if (flags['dry-run']) return dry(`更新媒体 #${id} ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', `${MEDIA}/${Number(id)}`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已更新媒体 #${data.id}`);
}

/** 图像编辑(裁剪/旋转),POST /media/<id>/edit。缺 --src 时自动取当前 source_url。 */
export async function editMediaImage(client, id, flags) {
  const body = {};
  if (flags.src !== undefined) body.src = String(flags.src);
  if (flags.rotation !== undefined) body.rotation = Number(flags.rotation);
  if (flags['dest-width'] !== undefined) body.width = Number(flags['dest-width']);
  if (flags['dest-height'] !== undefined) body.height = Number(flags['dest-height']);
  if (flags.x !== undefined) body.x = Number(flags.x);
  if (flags.y !== undefined) body.y = Number(flags.y);
  const modifiers = [];
  if (flags.crop) modifiers.push('crop');
  if (flags.modifiers !== undefined) {
    modifiers.push(...String(flags.modifiers).split(',').map((s) => s.trim()).filter(Boolean));
  }
  if (modifiers.length) body.modifiers = modifiers;
  if (flags.title !== undefined) body.title = String(flags.title);
  if (flags.alt !== undefined) body.alt_text = String(flags.alt);
  if (flags.caption !== undefined) body.caption = String(flags.caption);
  if (flags.description !== undefined) body.description = String(flags.description);
  if (flags.post !== undefined) body.post = Number(flags.post);
  if (!Object.keys(body).length) {
    throw new UsageError('图像编辑需要至少一个参数(--rotation/--crop/--x/--y/--dest-width/--dest-height/--modifiers/--src/...)');
  }
  if (flags['dry-run']) return dry(`编辑媒体 #${id} ${JSON.stringify(body)}`);
  if (body.src === undefined) {
    const { data } = await client.request('GET', `${MEDIA}/${Number(id)}`, { query: { context: 'edit' } });
    body.src = data.source_url;
  }
  if (!body.src) throw new UsageError('无法确定图片来源,请显式传 --src <url>');
  const { data } = await client.request('POST', `${MEDIA}/${Number(id)}/edit`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已编辑媒体 #${data.id}  ${data.source_url || ''}`);
}

/** 从 URL 导入媒体:sideload,POST /media(带 url)。 */
export async function sideloadMedia(client, flags) {
  if (flags.url === undefined) throw new UsageError('media sideload 需要 --url <图片地址>');
  const body = { url: String(flags.url) };
  if (flags.title !== undefined) body.title = String(flags.title);
  if (flags.alt !== undefined) body.alt_text = String(flags.alt);
  if (flags.caption !== undefined) body.caption = String(flags.caption);
  if (flags.description !== undefined) body.description = String(flags.description);
  if (flags.slug !== undefined) body.slug = String(flags.slug);
  if (flags.post !== undefined) body.post = Number(flags.post);
  if (flags['dry-run']) return dry(`从 URL 导入媒体 ${body.url}`);
  const { data } = await client.request('POST', MEDIA, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已导入媒体 #${data.id}  ${data.source_url || ''}`);
}

export async function deleteMedia(client, id, flags) {
  if (flags['dry-run']) return dry(`删除媒体 #${id}${flags.force ? '(彻底)' : '(回收站)'}`);
  const { data } = await client.request('DELETE', `${MEDIA}/${Number(id)}`, {
    query: { force: flags.force ? 'true' : undefined },
  });
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已删除媒体 #${id}` : `✓ 媒体 #${id} 已移入回收站`);
}

// ------------------------------------------------------------------ plugins

export async function listPlugins(client, flags) {
  const { data } = await client.request('GET', '/wp-json/wp/v2/plugins', {
    query: { status: flags.status, search: flags.search },
  });
  if (flags.json) return printJson(data);
  console.log(`已装插件 ${data.length} 个:`);
  for (const p of data) {
    console.log(`  [${p.status === 'active' ? '启用' : '停用'}] ${p.name} ${p.version}  (${p.plugin})`);
  }
}

export async function installPlugin(client, slug, flags) {
  if (flags['dry-run']) return dry(`安装插件 ${slug}${flags.activate ? '(并启用)' : ''}`);
  const { data } = await client.request('POST', '/wp-json/wp/v2/plugins', {
    body: { slug: String(slug), status: flags.activate ? 'active' : 'inactive' },
  });
  if (flags.json) return printJson(data);
  console.log(`✓ 已安装 ${data.name} ${data.version} [${data.status === 'active' ? '启用' : '停用'}]`);
}

export async function setPluginStatus(client, plugin, activate, flags) {
  if (flags['dry-run']) return dry(`${activate ? '启用' : '停用'}插件 ${plugin}`);
  const { data } = await client.request('POST', `/wp-json/wp/v2/plugins/${encodeURIComponent(plugin)}`, {
    body: { status: activate ? 'active' : 'inactive' },
  });
  if (flags.json) return printJson(data);
  console.log(`✓ ${data.name} → ${data.status === 'active' ? '已启用' : '已停用'}`);
}

export async function deletePlugin(client, plugin, flags) {
  if (flags['dry-run']) return dry(`删除插件 ${plugin}`);
  if (!flags.force) throw new UsageError('删除插件需要 --force(不可撤销)');
  const { data } = await client.request('DELETE', `/wp-json/wp/v2/plugins/${encodeURIComponent(plugin)}`);
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已删除插件 ${plugin}` : `? 插件 ${plugin} 未删除`);
}

// ------------------------------------------------------------------ themes

export async function listThemes(client, flags) {
  const { data } = await client.request('GET', '/wp-json/wp/v2/themes');
  if (flags.json) return printJson(data);
  console.log(`主题 ${data.length} 个:`);
  for (const t of data) {
    console.log(`  ${t.status === 'active' ? '*' : ' '} ${stripTags(t.name?.rendered || t.stylesheet)} ${t.version}  (${t.stylesheet})`);
  }
}

export async function activateTheme(client, stylesheet, flags) {
  if (flags['dry-run']) return dry(`切换主题 ${stylesheet}`);
  const { data } = await client.request('POST', `/wp-json/wp/v2/themes/${encodeURIComponent(stylesheet)}`, {
    body: { status: 'active' },
  });
  if (flags.json) return printJson(data);
  console.log(`✓ 已切换到主题 ${stripTags(data.name?.rendered || stylesheet)}`);
}

// ------------------------------------------------------------------ taxonomy

export async function listTaxonomy(client, tax, flags) {
  const query = {
    per_page: flags['per-page'] ?? 100,
    page: flags.page,
    search: flags.search,
    orderby: flags.orderby,
    order: flags.order,
    parent: flags.parent,
    hide_empty: flags['hide-empty'] ? 'true' : 'false',
  };
  const { data, total } = await listRequest(client, taxPath(tax), query, flags);
  if (flags.json) return printJson(data);
  console.log(`${tax} 共 ${total ?? '?'} 个:`);
  for (const t of data) {
    console.log(`  #${t.id}  ${t.name}  (${t.count})  slug=${t.slug}${t.parent ? `  parent=#${t.parent}` : ''}`);
  }
}

export async function getTaxonomy(client, tax, id) {
  const { data } = await client.request('GET', `${taxPath(tax)}/${Number(id)}`);
  printJson(data);
}

function taxonomyBody(flags) {
  const body = {};
  if (flags.name !== undefined) body.name = String(flags.name);
  if (flags.slug !== undefined) body.slug = String(flags.slug);
  if (flags.parent !== undefined) body.parent = Number(flags.parent);
  if (flags.description !== undefined) body.description = String(flags.description);
  return body;
}

export async function createTaxonomy(client, tax, flags) {
  const body = taxonomyBody(flags);
  if (body.name === undefined) throw new UsageError(`创建 ${tax} 需要 --name`);
  if (flags['dry-run']) return dry(`创建 ${tax} ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', taxPath(tax), { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已创建 ${tax} #${data.id} ${data.name}`);
}

export async function updateTaxonomy(client, tax, id, flags) {
  const body = taxonomyBody(flags);
  if (!Object.keys(body).length) throw new UsageError('没有可更新的字段(--name/--slug/--parent/--description)');
  if (flags['dry-run']) return dry(`更新 ${tax} #${id} ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', `${taxPath(tax)}/${Number(id)}`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已更新 ${tax} #${data.id} ${data.name}`);
}

export async function deleteTaxonomy(client, tax, id, flags) {
  if (flags['dry-run']) return dry(`删除 ${tax} #${id}`);
  if (!flags.force) throw new UsageError(`删除 ${tax} 需要 --force(不可撤销)`);
  const { data } = await client.request('DELETE', `${taxPath(tax)}/${Number(id)}`, { query: { force: 'true' } });
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已删除 ${tax} #${id}` : `? ${tax} #${id} 未删除`);
}

// ------------------------------------------------------------------ menus

const MENU_PLUGIN_HINT =
  '菜单接口由插件提供(WordPress 核心 REST 没有 /menus、/menu-items);请确认站点已装并启用对应插件。';

/** 菜单端点请求:路由不存在时补充"需插件"的提示,便于排障。 */
async function menuRequest(client, method, path, opts) {
  try {
    return await client.request(method, path, opts);
  } catch (err) {
    if (err?.code === 'rest_no_route') {
      throw new WpError(`${err.message} —— ${MENU_PLUGIN_HINT}`, {
        status: err.status,
        code: err.code,
        data: err.data,
        method: err.method,
        path: err.path,
      });
    }
    throw err;
  }
}

export async function listMenus(client, flags) {
  const { data, headers } = await menuRequest(client, 'GET', MENUS, {
    query: { per_page: flags['per-page'] ?? 100, page: flags.page },
  });
  if (flags.json) return printJson(data);
  console.log(`菜单共 ${headers.get('x-wp-total') ?? data.length} 个:`);
  for (const m of data) {
    console.log(`  #${m.id}  ${m.name}  slug=${m.slug}  locations=${(m.locations || []).join(',') || '—'}`);
  }
}

export async function getMenu(client, id, flags) {
  const { data } = await menuRequest(client, 'GET', `${MENUS}/${Number(id)}`);
  if (flags.json) return printJson(data);
  console.log(`#${data.id}  ${data.name}  slug=${data.slug}`);
  console.log(`  位置:${(data.locations || []).join(', ') || '—'}`);
  console.log(`  自动添加:${data.auto_add ? '是' : '否'}`);
  if (data.description) console.log(`  描述:${data.description}`);
}

/** 菜单字段转请求体(locations/auto_add 用于给菜单绑定主题位置)。 */
function menuBody(flags) {
  const body = {};
  if (flags.name !== undefined) body.name = String(flags.name);
  if (flags.slug !== undefined) body.slug = String(flags.slug);
  if (flags.description !== undefined) body.description = String(flags.description);
  if (flags.locations !== undefined) {
    body.locations = String(flags.locations).split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (flags['auto-add'] !== undefined) body.auto_add = Boolean(flags['auto-add']);
  return body;
}

export async function createMenu(client, flags) {
  const body = menuBody(flags);
  if (body.name === undefined) throw new UsageError('创建菜单需要 --name');
  if (flags['dry-run']) return dry(`创建菜单 ${JSON.stringify(body)}`);
  const { data } = await menuRequest(client, 'POST', MENUS, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已创建菜单 #${data.id} ${data.name}`);
}

export async function updateMenu(client, id, flags) {
  const body = menuBody(flags);
  if (!Object.keys(body).length) {
    throw new UsageError('没有可更新的字段(--name/--slug/--description/--locations/--auto-add)');
  }
  if (body.locations !== undefined) {
    warn('正在修改菜单位置绑定,会立即影响站点导航', flags);
  }
  if (flags['dry-run']) return dry(`更新菜单 #${id} ${JSON.stringify(body)}`);
  const { data } = await menuRequest(client, 'POST', `${MENUS}/${Number(id)}`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已更新菜单 #${data.id} ${data.name}  位置:${(data.locations || []).join(',') || '—'}`);
}

export async function deleteMenu(client, id, flags) {
  warn('删除菜单会影响站点导航', flags);
  if (flags['dry-run']) return dry(`删除菜单 #${id}`);
  if (!flags.force) throw new UsageError('删除菜单需要 --force(不可撤销)');
  const { data } = await menuRequest(client, 'DELETE', `${MENUS}/${Number(id)}`, { query: { force: 'true' } });
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已删除菜单 #${id}` : `? 菜单 #${id} 未删除`);
}

/** 把 flags 中的菜单项字段转成 REST 请求体(注意数值/数组类型)。 */
function menuItemBody(flags) {
  const body = {};
  if (flags.title !== undefined) body.title = String(flags.title);
  if (flags.url !== undefined) body.url = String(flags.url);
  if (flags.menus !== undefined) body.menus = Number(flags.menus);
  if (flags['menu-order'] !== undefined) body.menu_order = Number(flags['menu-order']);
  if (flags.parent !== undefined) body.parent = Number(flags.parent);
  if (flags.status !== undefined) body.status = String(flags.status);
  if (flags.type !== undefined) body.type = String(flags.type);
  if (flags.object !== undefined) body.object = String(flags.object);
  if (flags['object-id'] !== undefined) body.object_id = Number(flags['object-id']);
  if (flags.target !== undefined) body.target = String(flags.target);
  if (flags.classes !== undefined) {
    body.classes = String(flags.classes).split(',').map((s) => s.trim()).filter(Boolean);
  }
  if (flags.description !== undefined) body.description = String(flags.description);
  if (flags['attr-title'] !== undefined) body.attr_title = String(flags['attr-title']);
  if (flags.xfn !== undefined) body.xfn = String(flags.xfn).split(',').map((s) => s.trim()).filter(Boolean);
  return body;
}

export async function listMenuItems(client, flags) {
  const perPage = Number(flags['per-page'] ?? 100) || 100;
  const page = Number(flags.page ?? 1) || 1;
  const query = {
    per_page: perPage,
    page,
    ...pick(flags, ['menus', 'search', 'status', 'orderby', 'order', 'menu-order']),
  };
  const { data, total, totalPages } = await listRequest(
    client,
    MENU_ITEMS,
    query,
    flags,
    (method, path, opts) => menuRequest(client, method, path, opts),
  );
  if (flags.json) return printJson(data);
  console.log(
    `菜单项共 ${total ?? '?'} 项 / ${totalPages ?? '?'} 页;第 ${page} 页${totalPages ? `/${totalPages}` : ''},本页 ${data.length} 项:`,
  );
  for (const item of data) {
    const title = stripTags(item.title?.rendered || '(无标题)');
    console.log(
      `  #${item.id}  [${item.status}]  order=${item.menu_order}  parent=${item.parent}  ${item.type}/${item.object}  ${title}  ${item.url}`,
    );
  }
  if (totalPages && page < Number(totalPages)) {
    console.log(`  …下一页:wpops menu-items list --page ${page + 1} --per-page ${perPage}`);
  }
}

export async function getMenuItem(client, id, flags) {
  const { data } = await menuRequest(client, 'GET', `${MENU_ITEMS}/${Number(id)}`);
  if (flags.json) return printJson(data);
  console.log(`#${data.id}  [${data.status}]  ${stripTags(data.title?.rendered || '')}`);
  console.log(`  顺序:${data.menu_order}  父级:#${data.parent}  类型:${data.type}/${data.object}  object_id=${data.object_id}`);
  console.log(`  链接:${data.url}`);
  if (data.attr_title) console.log(`  attr_title:${data.attr_title}`);
  if (data.target) console.log(`  target:${data.target}`);
  if (data.classes?.filter(Boolean).length) console.log(`  classes:${data.classes.filter(Boolean).join(',')}`);
  if (data.description) console.log(`  描述:${data.description}`);
}

export async function createMenuItem(client, flags) {
  const body = menuItemBody(flags);
  if (body.title === undefined) throw new UsageError('创建菜单项需要 --title');
  if (body.url === undefined && body.object === undefined) {
    throw new UsageError('创建菜单项需要 --url(自定义链接)或 --object/--object-id(指向现有内容)');
  }
  if (flags['dry-run']) return dry(`创建菜单项 ${JSON.stringify(body)}`);
  const { data } = await menuRequest(client, 'POST', MENU_ITEMS, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已创建菜单项 #${data.id} [${data.status}] ${stripTags(data.title?.rendered || '')}`);
}

export async function updateMenuItem(client, id, flags) {
  const body = menuItemBody(flags);
  if (!Object.keys(body).length) {
    throw new UsageError('没有可更新的字段(--title/--url/--menus/--menu-order/--parent/--status/--type/--object/--object-id/--target/--classes/--description/--attr-title)');
  }
  if (flags['dry-run']) return dry(`更新菜单项 #${id} ${JSON.stringify(body)}`);
  const { data } = await menuRequest(client, 'POST', `${MENU_ITEMS}/${Number(id)}`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已更新菜单项 #${data.id} ${stripTags(data.title?.rendered || '')}`);
}

export async function deleteMenuItem(client, id, flags) {
  if (flags['dry-run']) return dry(`删除菜单项 #${id}`);
  if (!flags.force) throw new UsageError('删除菜单项需要 --force(不可撤销)');
  const { data } = await menuRequest(client, 'DELETE', `${MENU_ITEMS}/${Number(id)}`, { query: { force: 'true' } });
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已删除菜单项 #${id}` : `? 菜单项 #${id} 未删除`);
}

// ------------------------------------------------------------------ comments

export async function listComments(client, flags) {
  const query = {
    per_page: flags['per-page'] ?? 10,
    page: flags.page,
    ...pick(flags, ['post', 'status', 'search', 'author', 'orderby', 'order', 'type']),
  };
  const { data, total } = await listRequest(client, COMMENTS, query, flags);
  if (flags.json) return printJson(data);
  console.log(`评论共 ${total ?? '?'} 条,本页 ${data.length}:`);
  for (const c of data) {
    console.log(`  #${c.id}  [${c.status}]  post#${c.post}  ${stripTags(c.author_name || '')}: ${stripTags(c.content?.rendered || '')}`);
  }
}

export async function getComment(client, id) {
  const { data } = await client.request('GET', `${COMMENTS}/${Number(id)}`);
  printJson(data);
}

export async function createComment(client, flags) {
  const post = flags.post ?? flags['post-id'];
  if (post === undefined) throw new UsageError('创建评论需要 --post <id>');
  const body = { post: Number(post) };
  if (flags['from-file'] !== undefined) body.content = readFileSync(String(flags['from-file']), 'utf8');
  else if (flags.content !== undefined) body.content = String(flags.content);
  if (body.content === undefined) throw new UsageError('创建评论需要 --content 或 --from-file');
  if (flags['author-name'] !== undefined) body.author_name = String(flags['author-name']);
  if (flags['author-email'] !== undefined) body.author_email = String(flags['author-email']);
  if (flags.parent !== undefined) body.parent = Number(flags.parent);
  if (flags.status !== undefined) body.status = String(flags.status);
  if (flags['dry-run']) return dry(`创建评论 ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', COMMENTS, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已创建评论 #${data.id} post#${data.post} [${data.status}]`);
}

export async function updateComment(client, id, flags) {
  const body = {};
  if (flags.status !== undefined) body.status = String(flags.status);
  if (flags.content !== undefined) body.content = String(flags.content);
  if (!Object.keys(body).length) {
    throw new UsageError('没有可更新的字段(--status approve|hold|spam|trash / --content)');
  }
  if (flags['dry-run']) return dry(`更新评论 #${id} ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', `${COMMENTS}/${Number(id)}`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 评论 #${data.id} → ${data.status}`);
}

export async function deleteComment(client, id, flags) {
  if (flags['dry-run']) return dry(`删除评论 #${id}${flags.force ? '(彻底)' : '(回收站)'}`);
  const { data } = await client.request('DELETE', `${COMMENTS}/${Number(id)}`, {
    query: { force: flags.force ? 'true' : undefined },
  });
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已彻底删除评论 #${id}` : `✓ 评论 #${id} 已移入回收站`);
}

// ------------------------------------------------------------------ users

export async function listUsers(client, flags) {
  const query = {
    per_page: flags['per-page'] ?? 10,
    page: flags.page,
    context: 'edit',
    ...pick(flags, ['search', 'roles', 'orderby', 'order', 'who']),
  };
  const { data, total } = await listRequest(client, USERS, query, flags);
  if (flags.json) return printJson(data);
  console.log(`用户共 ${total ?? '?'} 个,本页 ${data.length}:`);
  for (const u of data) {
    console.log(`  #${u.id}  ${u.name} (@${u.slug})  ${(u.roles || []).join(',')}  ${u.email || ''}`);
  }
}

export async function getUser(client, id) {
  const { data } = await client.request('GET', `${USERS}/${Number(id)}`, { query: { context: 'edit' } });
  printJson(data);
}

export async function createUser(client, flags) {
  if (flags.username === undefined) throw new UsageError('创建用户需要 --username');
  if (flags.email === undefined) throw new UsageError('创建用户需要 --email');
  const body = { username: String(flags.username), email: String(flags.email) };
  if (flags.password !== undefined) body.password = String(flags.password);
  if (flags.name !== undefined) body.name = String(flags.name);
  if (flags.role !== undefined) body.roles = String(flags.role).split(',').map((s) => s.trim()).filter(Boolean);
  if (flags['dry-run']) return dry(`创建用户 ${body.username} <${body.email}> roles=${(body.roles || ['subscriber']).join(',')}`);
  const { data } = await client.request('POST', USERS, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已创建用户 #${data.id} ${data.name} (@${data.slug})`);
}

export async function updateUser(client, id, flags) {
  const body = {};
  for (const key of ['name', 'email', 'password', 'first_name', 'last_name', 'url', 'description', 'slug', 'nickname']) {
    if (flags[key] !== undefined) body[key] = String(flags[key]);
  }
  if (flags.role !== undefined) body.roles = String(flags.role).split(',').map((s) => s.trim()).filter(Boolean);
  if (!Object.keys(body).length) throw new UsageError('没有可更新的字段(--name/--email/--password/--role/...)');
  if (flags['dry-run']) return dry(`更新用户 #${id} ${JSON.stringify({ ...body, password: body.password ? '***' : undefined })}`);
  const { data } = await client.request('POST', `${USERS}/${Number(id)}`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已更新用户 #${data.id} ${data.name}`);
}

export async function deleteUser(client, id, flags) {
  if (flags['dry-run']) return dry(`删除用户 #${id}${flags.reassign ? `(内容转交 #${flags.reassign})` : ''}`);
  if (!flags.force) throw new UsageError('删除用户需要 --force(不可撤销)');
  const { data } = await client.request('DELETE', `${USERS}/${Number(id)}`, {
    query: { force: 'true', reassign: flags.reassign },
  });
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已删除用户 #${id}` : `? 用户 #${id}`);
}

// ------------------------------------------------------------------ raw

export async function raw(client, method, path, flags) {
  const upper = String(method).toUpperCase();
  let body;
  if (flags.data !== undefined) body = parseJson(flags.data);
  else if (flags['data-file'] !== undefined) body = readJsonFile(flags['data-file']);
  if (body !== undefined && ['GET', 'HEAD'].includes(upper)) {
    throw new UsageError(`${upper} 请求不能带 --data(--data 仅用于写操作)`, { group: 'raw', action: upper });
  }

  if (flags['dry-run'] && !['GET', 'HEAD', 'OPTIONS'].includes(upper)) {
    return dry(`${upper} ${path}${body !== undefined ? ` ${JSON.stringify(body)}` : ''}`);
  }

  const { status, data } = await client.request(upper, path, { body });
  if (typeof data === 'string') {
    if (flags.json) return printJson({ status, data });
    console.log(data);
  } else {
    printJson(data);
  }
}

// ------------------------------------------------------------------ setup

function promptLine(query) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function promptHidden(query) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    process.stdout.write(query);
    const wasRaw = stdin.isRaw;
    if (stdin.setRawMode) stdin.setRawMode(true);
    stdin.resume();
    let value = '';
    const onData = (chunk) => {
      for (const ch of chunk.toString('utf8')) {
        if (ch === '\r' || ch === '\n') {
          if (stdin.setRawMode) stdin.setRawMode(wasRaw);
          stdin.removeListener('data', onData);
          stdin.pause();
          process.stdout.write('\n');
          resolve(value);
          return;
        }
        if (ch === '\u0003') {
          process.stdout.write('\n');
          process.exit(130);
        }
        if (ch === '\u007f' || ch === '\b') value = value.slice(0, -1);
        else if (ch >= ' ') value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

/** 交互式(或带 flag)配置一个站点,写入 sites/<名字>.env 并体检。 */
export async function setup(flags) {
  const tty = Boolean(process.stdin.isTTY);
  const need = (what) => {
    if (!tty) throw new UsageError(`非交互模式请提供 ${what}`);
  };

  let url = flags.url;
  if (!url) {
    need('--url');
    url = await promptLine('站点 URL(https://...):');
  }
  url = String(url).replace(/\/+$/, '');
  if (!/^https:\/\//i.test(url)) throw new UsageError('URL 必须以 https:// 开头');

  let user = flags.user;
  if (!user) {
    need('--user');
    user = await promptLine('用户名:');
  }

  let password = flags.password;
  if (!password) {
    need('--password');
    password = await promptHidden('应用密码(输入不回显):');
  }
  if (!password) throw new UsageError('应用密码为空');

  const defaultName = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      return 'default';
    }
  })();
  let name = flags.name;
  if (!name && tty) {
    const answer = await promptLine(`站点名(存为 sites/<名字>.env)[${defaultName}]:`);
    name = answer || defaultName;
  }
  name = name || defaultName;

  const dir = join(configHome(), 'sites');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, `${name}.env`);
  if (existsSync(file) && !flags.force) {
    throw new UsageError(`已存在 ${file};要覆盖请加 --force`);
  }

  const content = [
    '# wpops 站点配置(由 wpops setup 生成)',
    `WP_URL=${url}`,
    `WP_USER=${user}`,
    `WP_APP_PASSWORD=${password}`,
    '',
  ].join('\n');
  writeFileSync(file, content, 'utf8');
  hardenConfigPerms();

  const skillDirs = installSkill();
  const skillNote = skillDirs.length
    ? `内置 skill 已安装到 ${skillDirs.join(', ')}`
    : '内置 skill 未安装(可用 wpops install-skill)';

  console.log(`\n✓ 已写入 ${file}\n✓ ${skillNote}\n正在体检...`);
  const cfg = buildConfig(loadEnv(name));
  const client = createClient(cfg);
  return doctor(client, cfg, {});
}
