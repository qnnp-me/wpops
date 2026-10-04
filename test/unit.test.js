import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDotenv } from '../lib/env.js';
import { configProblems, WpError } from '../lib/client.js';
import { parseArgs, isMutation } from '../lib/args.js';
import {
  deleteMenuItem, createMenuItem, listMenus, listMenuItems, listContent,
  editMediaImage, sideloadMedia,
} from '../lib/commands.js';
import { parseJson } from '../lib/util.js';

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
