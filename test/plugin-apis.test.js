import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listAbilities, getAbility, runAbility } from '../lib/abilities.js';
import { listHealth, runHealth, KNOWN_TESTS } from '../lib/health.js';
import { batch } from '../lib/batch.js';

/** 临时置空 console.log,执行后恢复;返回捕获到的所有输出行。 */
async function captureLog(fn) {
  const original = console.log;
  const lines = [];
  console.log = (...args) => lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
  try {
    await fn();
  } finally {
    console.log = original;
  }
  return lines;
}

test('runAbility:--dry-run 不发请求(可无 name 校验)', async () => {
  let called = false;
  const client = { request: async () => { called = true; return { data: {} }; } };
  const lines = await captureLog(() =>
    runAbility(client, 'demo/ability', { 'dry-run': true, input: '{"x":1}' }),
  );
  assert.equal(called, false);
  assert.ok(lines.some((l) => l.includes('运行 Ability demo/ability') && l.includes('{"x":1}')));
});

test('runAbility:--data 作为 body 的 JSON 来源', async () => {
  let body;
  const client = { request: async (_method, _path, opts) => { body = opts.body; return { data: { ok: true } }; } };
  await captureLog(() => runAbility(client, 'demo/ability', { data: '{"y":2}' }));
  assert.deepEqual(body, { y: 2 });
});

test('runHealth:缺测试名报错', async () => {
  const client = { request: async () => { throw new Error('不应发请求'); } };
  await assert.rejects(() => runHealth(client, undefined, {}), /health 需要一个测试名/);
});

test('runHealth:路径正确且能解析返回对象(布尔/字符串 status 均容错)', async () => {
  const seen = [];
  const client = {
    request: async (method, path) => {
      seen.push({ method, path });
      return { data: { status: true, label: 'HTTPS', description: '可用' } };
    },
  };
  await captureLog(() => runHealth(client, 'directory-sizes', {}));
  await captureLog(() => runHealth(client, 'https-status', {}));
  assert.deepEqual(seen[0], { method: 'GET', path: '/wp-json/wp-site-health/v1/directory-sizes' });
  assert.deepEqual(seen[1], { method: 'GET', path: '/wp-json/wp-site-health/v1/tests/https-status' });
});

test('runHealth:字符串 status 与缺失字段不崩溃', async () => {
  const client = { request: async () => ({ data: { status: 'good' } }) };
  const lines = await captureLog(() => runHealth(client, 'loopback-requests', {}));
  assert.ok(lines.some((l) => l.includes('[good]')));
});

test('listHealth:不发请求并列出已知测试', async () => {
  let called = false;
  const client = { request: async () => { called = true; } };
  const lines = await captureLog(() => listHealth(client, {}));
  assert.equal(called, false);
  assert.ok(lines.some((l) => l.includes('已知站点健康测试:')));
  for (const name of KNOWN_TESTS) {
    assert.ok(lines.some((l) => l.includes(name)), `缺少测试名 ${name}`);
  }
});

test('batch:缺 requests 报错', async () => {
  const client = { request: async () => { throw new Error('不应发请求'); } };
  await assert.rejects(() => batch(client, {}), /batch 需要/);
  await assert.rejects(() => batch(client, { requests: '不是 JSON' }), /batch 需要/);
});

test('batch:--dry-run 不发请求', async () => {
  let called = false;
  const client = { request: async () => { called = true; return { data: {} }; } };
  const lines = await captureLog(() =>
    batch(client, { 'dry-run': true, requests: '[{"method":"POST","path":"/wp-json/"}]' }),
  );
  assert.equal(called, false);
  assert.ok(lines.some((l) => l.includes('批量请求 1 条')));
});

test('batch:解析 data.responses 并逐项容错', async () => {
  const client = {
    request: async () => ({
      data: {
        responses: [
          { status: 200, method: 'POST', path: '/wp-json/wp/v2/posts' },
          { status: 404 },
        ],
      },
    }),
  };
  const lines = await captureLog(() =>
    batch(client, { requests: '[{"method":"POST","path":"/a"},{"method":"POST","path":"/b"}]' }),
  );
  assert.ok(lines.some((l) => l.includes('[200] POST /wp-json/wp/v2/posts')));
  assert.ok(lines.some((l) => l.includes('[404] POST /b')));
});

test('batch:同时接受 {"requests":[...]} 包装形式', async () => {
  const client = { request: async () => ({ data: { responses: [] } }) };
  const lines = await captureLog(() =>
    batch(client, { requests: '{"requests":[{"method":"POST","path":"/x"}]}' }),
  );
  assert.ok(lines.some((l) => l.includes('批量返回 0 条')));
});

test('batch:拒绝 GET(核心批量端点不支持)', async () => {
  const client = { request: async () => { throw new Error('不应发请求'); } };
  await assert.rejects(
    () => batch(client, { requests: '[{"method":"GET","path":"/x"}]' }),
    /不支持 GET/,
  );
});

test('listAbilities:读路径正确且字段缺失容错', async () => {
  const seen = [];
  const client = {
    request: async (method, path) => {
      seen.push({ method, path });
      return {
        data: [
          { name: 'core/get-site-info', label: '站点信息' },
          { name: 'core/only-name' },
          {},
        ],
      };
    },
  };
  const lines = await captureLog(() => listAbilities(client, {}));
  assert.deepEqual(seen[0], { method: 'GET', path: '/wp-json/wp-abilities/v1/abilities' });
  assert.ok(lines.some((l) => l.includes('Abilities 3 个:')));
  assert.ok(lines.some((l) => l.includes('core/get-site-info') && l.includes('站点信息')));
});

test('getAbility:读路径对 name 做 URL 编码', async () => {
  const seen = [];
  const client = {
    request: async (method, path) => {
      seen.push({ method, path });
      return { data: { name: 'demo/x', label: 'X' } };
    },
  };
  await captureLog(() => getAbility(client, 'demo/x y', {}));
  assert.deepEqual(seen[0], { method: 'GET', path: '/wp-json/wp-abilities/v1/abilities/demo%2Fx%20y' });
});
