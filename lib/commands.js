import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const CONTENT = {
  posts: '/wp-json/wp/v2/posts',
  pages: '/wp-json/wp/v2/pages',
};

function stripTags(html = '') {
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function printJson(value) {
  console.log(JSON.stringify(value, null, 2));
}

function printItem(data, flags) {
  if (flags.json) return printJson(data);
  console.log(`✓ #${data.id} [${data.status}] ${stripTags(data.title?.rendered || '')}`);
  if (data.link) console.log(`  ${data.link}`);
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
      update_plugins: '更新插件',
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
    async () => (await client.request('GET', '/wp-json/wp/v2/media', { query: { per_page: 1 } })).headers.get('x-wp-total'),
    (n) => `可读写,共 ${n ?? '?'} 项`,
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

// ------------------------------------------------------------------ users

export async function me(client, flags) {
  const { data } = await client.request('GET', '/wp-json/wp/v2/users/me', { query: { context: 'edit' } });
  if (flags.json) return printJson(data);
  console.log(`#${data.id} ${data.name} (@${data.slug})`);
  console.log(`角色:${(data.roles || []).join(', ')}`);
  if (data.capabilities) {
    const on = Object.entries(data.capabilities).filter(([, v]) => v).map(([k]) => k);
    console.log(`能力:${on.join(', ')}`);
  }
}

// ------------------------------------------------------------------ content

export async function listContent(client, type, flags) {
  const perPage = Number(flags['per-page'] ?? 10) || 10;
  const page = Number(flags.page ?? 1) || 1;
  const { data, headers } = await client.request('GET', CONTENT[type], {
    query: {
      per_page: perPage,
      page,
      status: flags.status,
      search: flags.search,
      context: flags.context,
    },
  });
  if (flags.json) return printJson(data);
  const total = headers.get('x-wp-total');
  const totalPages = headers.get('x-wp-totalpages');
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
  const { data } = await client.request('GET', `${CONTENT[type]}/${Number(id)}`, {
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
    throw new Error('至少需要 --title 或 --content/--from-file');
  }
  const { data } = await client.request('POST', CONTENT[type], { body });
  printItem(data, flags);
}

export async function updateContent(client, type, id, flags) {
  const body = contentBody(flags);
  if (!Object.keys(body).length) throw new Error('没有可更新的字段');
  const { data } = await client.request('POST', `${CONTENT[type]}/${Number(id)}`, { body });
  printItem(data, flags);
}

export async function deleteContent(client, type, id, flags) {
  const { data } = await client.request('DELETE', `${CONTENT[type]}/${Number(id)}`, {
    query: { force: flags.force ? 'true' : undefined },
  });
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已彻底删除 #${id}` : `✓ #${id} 已移入回收站`);
}

// ------------------------------------------------------------------ media

export async function listMedia(client, flags) {
  const perPage = Number(flags['per-page'] ?? 10) || 10;
  const page = Number(flags.page ?? 1) || 1;
  const { data, headers } = await client.request('GET', '/wp-json/wp/v2/media', {
    query: { per_page: perPage, page },
  });
  if (flags.json) return printJson(data);
  const total = headers.get('x-wp-total');
  const totalPages = headers.get('x-wp-totalpages');
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

export async function uploadMedia(client, file, flags) {
  const buffer = readFileSync(file);
  const name = basename(file);
  const form = new FormData();
  form.append('file', new Blob([buffer]), name);
  if (flags.title) form.append('title', String(flags.title));
  if (flags.alt) form.append('alt_text', String(flags.alt));
  const { data } = await client.request('POST', '/wp-json/wp/v2/media', {
    form,
    headers: { 'Content-Disposition': `attachment; filename="${name}"` },
  });
  if (flags.json) return printJson(data);
  console.log(`✓ 已上传 #${data.id}  ${data.source_url}`);
}

export async function deleteMedia(client, id, flags) {
  const { data } = await client.request('DELETE', `/wp-json/wp/v2/media/${Number(id)}`, {
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
  const { data } = await client.request('POST', '/wp-json/wp/v2/plugins', {
    body: { slug: String(slug), status: flags.activate ? 'active' : 'inactive' },
  });
  if (flags.json) return printJson(data);
  console.log(`✓ 已安装 ${data.name} ${data.version} [${data.status === 'active' ? '启用' : '停用'}]`);
}

export async function setPluginStatus(client, plugin, activate, flags) {
  const { data } = await client.request('POST', `/wp-json/wp/v2/plugins/${encodeURIComponent(plugin)}`, {
    body: { status: activate ? 'active' : 'inactive' },
  });
  if (flags.json) return printJson(data);
  console.log(`✓ ${data.name} → ${data.status === 'active' ? '已启用' : '已停用'}`);
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
  const { data } = await client.request('POST', `/wp-json/wp/v2/themes/${encodeURIComponent(stylesheet)}`, {
    body: { status: 'active' },
  });
  if (flags.json) return printJson(data);
  console.log(`✓ 已切换到主题 ${stripTags(data.name?.rendered || stylesheet)}`);
}

// ------------------------------------------------------------------ raw

export async function raw(client, method, path, flags) {
  let body;
  if (flags.data !== undefined) body = JSON.parse(String(flags.data));
  else if (flags['data-file'] !== undefined) body = JSON.parse(readFileSync(String(flags['data-file']), 'utf8'));
  const { status, data } = await client.request(String(method).toUpperCase(), path, { body });
  if (typeof data === 'string') {
    if (flags.json) return printJson({ status, data });
    console.log(data);
  } else {
    printJson(data);
  }
}
