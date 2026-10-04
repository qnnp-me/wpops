import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDotenv } from '../lib/env.js';
import { configProblems, WpError, createClient } from '../lib/client.js';
import { parseArgs, isMutation } from '../lib/args.js';
import { readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  deleteMenuItem, createMenuItem, listMenus, listMenuItems, listContent,
  editMediaImage, sideloadMedia, createContent, updateContent, setContentStatus, exportContent,
  listMedia, listUsers, getContent,
} from '../lib/commands.js';
import { parseJson, listRequest } from '../lib/util.js';

test('parseDotenv:注释、引号、空值、去空格', () => {
  const vars = parseDotenv(
    ['# 注释', 'A=1', 'B="x y"', "C='z'", 'D=', '', 'E = value '].join('\n'),
  );
  assert.equal(vars.A, '1');
  assert.equal(vars.B, 'x y');
  assert.equal(vars.C, 'z');
  assert.equal(vars.D, '');
  assert.equal(vars.E, 'value');
});

test('configProblems:缺失与 http 检出', () => {
  assert.equal(configProblems({ url: '', user: '', password: '' }).length, 3);
  assert.ok(
    configProblems({ url: 'http://x.com', user: 'u', password: 'p' }).some((s) => /https/.test(s)),
  );
  assert.equal(configProblems({ url: 'https://x.com', user: 'u', password: 'p' }).length, 0);
});

test('parseArgs:位置参数、长/短、布尔、等号', () => {
  const { positionals, flags } = parseArgs([
    'posts',
    'list',
    '--per-page',
    '5',
    '--json',
    '-s',
    'a',
    '7',
    '--status=draft',
  ]);
  assert.deepEqual(positionals, ['posts', 'list', '7']);
  assert.equal(flags['per-page'], '5');
  assert.equal(flags.json, true);
  assert.equal(flags.site, 'a');
  assert.equal(flags.status, 'draft');
});

test('isMutation:区分读写', () => {
  assert.equal(isMutation('posts', 'list'), false);
  assert.equal(isMutation('posts', undefined), false);
  assert.equal(isMutation('posts', 'delete'), true);
  assert.equal(isMutation('plugins', 'list'), false);
  assert.equal(isMutation('plugins', 'activate'), true);
  assert.equal(isMutation('media', 'upload'), true);
  assert.equal(isMutation('themes', 'activate'), true);
  assert.equal(isMutation('categories', 'create'), true);
  assert.equal(isMutation('menus', 'list'), false);
  assert.equal(isMutation('menus', undefined), false);
  assert.equal(isMutation('menu-items', 'create'), true);
  assert.equal(isMutation('menu-items', 'delete'), true);
  assert.equal(isMutation('menu-items', 'list'), false);
  assert.equal(isMutation('raw', 'GET'), false);
  assert.equal(isMutation('raw', 'POST'), true);
  assert.equal(isMutation('doctor'), false);
});

test('menu-items:--dry-run 预览不依赖 --force,且不发请求;真实删除仍要 --force', async () => {
  const client = { request: async () => { throw new Error('不应发请求'); } };
  const originalLog = console.log;
  console.log = () => {};
  try {
    // dry-run:只预览,不需要 --force,也不调用 client
    await deleteMenuItem(client, 42, { 'dry-run': true });
    await createMenuItem(client, { title: 'x', url: 'https://e', menus: 7, 'dry-run': true });
  } finally {
    console.log = originalLog;
  }
  // 真实删除仍必须 --force
  await assert.rejects(() => deleteMenuItem(client, 42, {}), /--force/);
  // 缺少 --title 直接报错
  await assert.rejects(() => createMenuItem(client, { 'dry-run': true }), /--title/);
});

test('parseJson:容忍 UTF-8 BOM(Windows 重定向/文件常见)', () => {
  assert.deepEqual(parseJson('\uFEFF{"a":1}'), { a: 1 });
  assert.deepEqual(parseJson('[1,2,3]'), [1, 2, 3]);
});

test('listMenuItems/listContent:列表实际调用 client.request(路径/方法正确)', async () => {
  const calls = [];
  const client = {
    request: async (method, path, opts) => {
      calls.push({ method, path, opts });
      return { data: [], headers: new Headers() };
    },
  };
  const log = console.log;
  console.log = () => {};
  try {
    await listMenuItems(client, { menus: '190' });
    await listContent(client, 'posts', {});
  } finally {
    console.log = log;
  }
  assert.equal(calls.length, 2);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].path, '/wp-json/wp/v2/menu-items');
  assert.equal(calls[0].opts.query.menus, '190');
  assert.equal(calls[1].method, 'GET');
  assert.equal(calls[1].path, '/wp-json/wp/v2/posts');
});

test('listMedia:--media-type/--mime-type 会进入查询(pick 兼容下划线键)', async () => {
  const calls = [];
  const client = { request: async (m, p, o) => { calls.push({ m, p, o }); return { data: [], headers: new Headers() }; } };
  const log = console.log;
  console.log = () => {};
  try {
    await listMedia(client, { 'media-type': 'image', 'mime-type': 'image/png' });
  } finally {
    console.log = log;
  }
  assert.equal(calls[0].o.query.media_type, 'image');
  assert.equal(calls[0].o.query.mime_type, 'image/png');
});

test('listUsers:--role 映射到 REST 的 roles 查询参数', async () => {
  const calls = [];
  const client = { request: async (m, p, o) => { calls.push({ m, p, o }); return { data: [], headers: new Headers() }; } };
  const log = console.log;
  console.log = () => {};
  try {
    await listUsers(client, { role: 'administrator' });
  } finally {
    console.log = log;
  }
  assert.equal(calls[0].o.query.roles, 'administrator');
});

test('listContent pages:--menu-order 映射到 menu_order', async () => {
  const calls = [];
  const client = { request: async (m, p, o) => { calls.push({ m, p, o }); return { data: [], headers: new Headers() }; } };
  const log = console.log;
  console.log = () => {};
  try {
    await listContent(client, 'pages', { 'menu-order': '3' });
  } finally {
    console.log = log;
  }
  assert.equal(calls[0].o.query.menu_order, '3');
});

test('非数字 id:本地直接报用法错误,不拼出 /NaN 去撞服务端', async () => {
  const client = { request: async () => { throw new Error('不应发请求'); } };
  await assert.rejects(() => getContent(client, 'posts', 'abc', {}), /非法的 id/);
  await assert.rejects(() => getContent(client, 'posts', '0', {}), /非法的 id/);
});

test('listContent 自定义类型:通用筛选键(--orderby)生效', async () => {
  const calls = [];
  const client = { request: async (m, p, o) => { calls.push({ m, p, o }); return { data: [], headers: new Headers() }; } };
  const log = console.log;
  console.log = () => {};
  try {
    await listContent(client, 'books', { orderby: 'date', order: 'desc' });
  } finally {
    console.log = log;
  }
  assert.equal(calls[0].o.query.orderby, 'date');
  assert.equal(calls[0].o.query.order, 'desc');
});

test('listRequest --all-pages:尊重 --per-page(不再强制 100)', async () => {
  const calls = [];
  const client = {
    request: async (m, p, o) => {
      calls.push(o.query);
      return { data: [{ id: 1 }], headers: new Headers({ 'x-wp-totalpages': '2' }) };
    },
  };
  const { data } = await listRequest(client, '/x', { per_page: 5 }, { 'all-pages': true });
  assert.equal(calls.length, 2); // 翻完 2 页
  assert.equal(calls[0].per_page, 5);
  assert.equal(calls[0].page, 1);
  assert.equal(calls[1].page, 2);
  assert.equal(data.length, 2);
});

test('client:未配置 URL 时给出可读错误(而非 Invalid URL)', async () => {
  const { request } = createClient({ url: '', user: 'u', password: 'p', timeoutMs: 1000, retries: 0 });
  await assert.rejects(() => request('GET', '/wp-json/'), /未配置站点地址/);
});

test('createContent:未指定 --status 时显式按草稿创建', async () => {
  const calls = [];
  const client = {
    root: 'https://e',
    request: async (m, p, o) => {
      calls.push({ m, p, o });
      return { data: { id: 1, status: 'draft', title: { rendered: 'x' }, link: 'https://e/?p=1' } };
    },
  };
  const log = console.log;
  console.log = () => {};
  try {
    await createContent(client, 'posts', { title: 'x', content: 'y' });
  } finally {
    console.log = log;
  }
  assert.equal(calls.length, 1);
  assert.equal(calls[0].m, 'POST');
  assert.equal(calls[0].o.body.status, 'draft');
});

test('updateContent:改已发布内容先提示;--yes 跳过预检与提示', async () => {
  const originalLog = console.log;
  const originalErr = console.error;
  console.log = () => {};

  // 默认:预检 GET 发现 publish → 警告(GET + POST)
  const calls = [];
  const errs = [];
  const client = {
    root: 'https://e',
    request: async (m) => {
      calls.push(m);
      if (m === 'GET') return { data: { id: 1, status: 'publish' } };
      return { data: { id: 1, status: 'publish', title: { rendered: 'x' } } };
    },
  };
  console.error = (...a) => errs.push(a.join(' '));
  try {
    await updateContent(client, 'pages', 1, { content: 'new' });
  } finally {
    console.log = originalLog;
    console.error = originalErr;
  }
  assert.deepEqual(calls, ['GET', 'POST']);
  assert.ok(errs.some((l) => /已发布内容/.test(l)));

  // --yes:跳过预检,不警告
  const calls2 = [];
  const errs2 = [];
  const client2 = {
    root: 'https://e',
    request: async (m) => {
      calls2.push(m);
      return { data: { id: 1, status: 'publish', title: { rendered: 'x' } } };
    },
  };
  console.log = () => {};
  console.error = (...a) => errs2.push(a.join(' '));
  try {
    await updateContent(client2, 'pages', 1, { content: 'new', yes: true });
  } finally {
    console.log = originalLog;
    console.error = originalErr;
  }
  assert.deepEqual(calls2, ['POST']);
  assert.equal(errs2.length, 0);
});

test('setContentStatus:publish/unpublish dry-run 不发请求', async () => {
  const client = {
    root: 'https://e',
    request: async () => {
      throw new Error('不应发请求');
    },
  };
  const log = console.log;
  console.log = () => {};
  try {
    await setContentStatus(client, 'posts', 5, 'publish', { 'dry-run': true });
    await setContentStatus(client, 'posts', 5, 'draft', { 'dry-run': true });
  } finally {
    console.log = log;
  }
});

test('exportContent:把 content.raw 写到 --file', async () => {
  const client = { request: async () => ({ data: { id: 5, content: { raw: '<p>hi</p>' } } }) };
  const file = join(tmpdir(), `wpops-export-${process.pid}-${Date.now()}.html`);
  const log = console.log;
  console.log = () => {};
  try {
    await exportContent(client, 'pages', 5, { file });
  } finally {
    console.log = log;
  }
  assert.equal(readFileSync(file, 'utf8'), '<p>hi</p>');
  rmSync(file, { force: true });
});

test('media:sideload 需要 --url;edit-image/sideload dry-run 不发请求', async () => {
  const client = { request: async () => { throw new Error('不应发请求'); } };
  const log = console.log;
  console.log = () => {};
  try {
    await editMediaImage(client, 1, { 'dry-run': true, rotation: '90' });
    await sideloadMedia(client, { 'dry-run': true, url: 'https://e/x.jpg' });
  } finally {
    console.log = log;
  }
  await assert.rejects(() => sideloadMedia(client, {}), /--url/);
});

test('menus:路由缺失(rest_no_route)时提示需插件', async () => {
  const client = {
    request: async () => {
      throw new WpError('404 未找到路由', { status: 404, code: 'rest_no_route' });
    },
  };
  await assert.rejects(() => listMenus(client, {}), /插件/);
});
