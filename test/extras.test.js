// extras 模块测试:search / settings / introspect。
// 全部使用 stub client,不访问网络。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { search } from '../lib/search.js';
import { getSettings, updateSettings } from '../lib/settings.js';
import { listTypes, listStatuses } from '../lib/introspect.js';

function headers(map = {}) {
  return { get: (key) => (key in map ? map[key] : null) };
}

/** 记录调用的 stub client。 */
function stub(handler) {
  const calls = [];
  const client = {
    request: async (method, path, opts) => {
      calls.push({ method, path, opts });
      return handler(method, path, opts);
    },
  };
  return { client, calls };
}

/** 在断言期间静默并收集 console.log,结束后恢复。 */
async function runCapture(fn) {
  const original = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.map(String).join(' '));
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return lines;
}

test('search:缺少搜索词报错', async () => {
  const { client, calls } = stub(() => {
    throw new Error('不应发请求');
  });
  await assert.rejects(() => search(client, undefined, {}), /搜索词/);
  await assert.rejects(() => search(client, '', {}), /搜索词/);
  assert.equal(calls.length, 0);
});

test('search:读取路径可解析且不加 --json 时人类可读', async () => {
  const items = [
    { id: 7, title: 'Hello <b>World</b>', url: 'https://e/7', type: 'post', subtype: 'post' },
  ];
  const { client, calls } = stub(() => ({ data: items, headers: headers({ 'x-wp-total': '1' }), status: 200 }));

  let threw = false;
  const lines = await runCapture(async () => {
    try {
      await search(client, 'hello', {});
    } catch {
      threw = true;
    }
  });

  assert.equal(threw, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'GET');
  assert.equal(calls[0].path, '/wp-json/wp/v2/search');
  assert.equal(calls[0].opts.query.search, 'hello');
  assert.match(lines.join('\n'), /搜索 "hello" 共 1 条/);
  assert.match(lines.join('\n'), /#7/);
  assert.match(lines.join('\n'), /Hello World/);
});

test('search:--json 输出原始数组', async () => {
  const items = [{ id: 1, title: 'A', url: 'https://e/1', type: 'post', subtype: 'post' }];
  const { client } = stub(() => ({ data: items, headers: headers(), status: 200 }));

  const lines = await runCapture(async () => {
    await search(client, 'a', { json: true });
  });

  assert.deepEqual(JSON.parse(lines.join('\n')), items);
});

test('settings update:--dry-run 不发请求', async () => {
  const { client, calls } = stub(() => {
    throw new Error('不应发请求');
  });

  await runCapture(async () => {
    await updateSettings(client, { title: '新标题', 'dry-run': true });
  });

  assert.equal(calls.length, 0);
});

test('settings update:无字段报错', async () => {
  const { client, calls } = stub(() => {
    throw new Error('不应发请求');
  });
  await assert.rejects(() => updateSettings(client, {}), /没有可更新的字段/);
  assert.equal(calls.length, 0);
});

test('settings update:数值字段转 Number 并 POST 到 settings', async () => {
  const { client, calls } = stub(() => ({
    data: { title: 'T', posts_per_page: 5 },
    headers: headers(),
    status: 200,
  }));

  await runCapture(async () => {
    await updateSettings(client, { title: 'T', 'posts-per-page': '5', 'start-of-week': '1' });
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].method, 'POST');
  assert.equal(calls[0].path, '/wp-json/wp/v2/settings');
  assert.equal(calls[0].opts.body.posts_per_page, 5);
  assert.equal(calls[0].opts.body.start_of_week, 1);
  assert.equal(calls[0].opts.body.title, 'T');
});

test('settings get:打印每一项键值', async () => {
  const { client } = stub(() => ({
    data: { title: '站点', posts_per_page: 10, nested: { a: 1 } },
    headers: headers(),
    status: 200,
  }));

  const lines = await runCapture(async () => {
    await getSettings(client, {});
  });

  assert.match(lines.join('\n'), /title: 站点/);
  assert.match(lines.join('\n'), /posts_per_page: 10/);
  assert.match(lines.join('\n'), /nested: \{"a":1\}/);
});

test('introspect listTypes:读取路径可解析', async () => {
  const types = {
    post: { rest_base: 'posts', show_in_rest: true },
    page: { rest_base: 'pages', show_in_rest: true },
  };
  const { client, calls } = stub(() => ({ data: types, headers: headers(), status: 200 }));

  let threw = false;
  const lines = await runCapture(async () => {
    try {
      await listTypes(client, {});
    } catch {
      threw = true;
    }
  });

  assert.equal(threw, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].path, '/wp-json/wp/v2/types');
  assert.match(lines.join('\n'), /文章类型 2 个/);
  assert.match(lines.join('\n'), /post {2}rest_base=posts/);
});

test('introspect listStatuses:--json 输出原始对象', async () => {
  const statuses = { publish: { name: '已发布' }, draft: { name: '草稿' } };
  const { client } = stub(() => ({ data: statuses, headers: headers(), status: 200 }));

  const lines = await runCapture(async () => {
    await listStatuses(client, { json: true });
  });

  assert.deepEqual(JSON.parse(lines.join('\n')), statuses);
});
