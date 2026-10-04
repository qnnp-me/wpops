import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteRevision } from '../lib/revisions.js';
import { listBlocks, deleteBlock } from '../lib/blocks.js';
import { createNavigation, deleteNavigation } from '../lib/navigation.js';

test('删除命令:dry-run 不发请求,真实删除缺 --force 报错', async () => {
  const client = { request: async () => { throw new Error('不应发请求'); } };
  const originalLog = console.log;
  console.log = () => {};
  try {
    await deleteRevision(client, 'posts', 1, 2, { 'dry-run': true });
    await deleteBlock(client, 3, { 'dry-run': true });
    await deleteNavigation(client, 4, { 'dry-run': true });
  } finally {
    console.log = originalLog;
  }

  await assert.rejects(() => deleteRevision(client, 'posts', 1, 2, {}), /--force/);
  await assert.rejects(() => deleteBlock(client, 3, {}), /--force/);
  await assert.rejects(() => deleteNavigation(client, 4, {}), /--force/);
});

test('listBlocks:读取路径解析,返回数组不抛', async () => {
  let seen;
  const client = {
    request: async (method, path, opts) => {
      seen = { method, path, opts };
      return {
        data: [{ id: 1, status: 'publish', title: { rendered: '示例区块' } }],
        headers: { get: (key) => (key === 'x-wp-total' ? '1' : undefined) },
        status: 200,
      };
    },
  };
  const originalLog = console.log;
  console.log = () => {};
  try {
    await assert.doesNotReject(() => listBlocks(client, {}));
  } finally {
    console.log = originalLog;
  }
  assert.equal(seen.method, 'GET');
  assert.equal(seen.path, '/wp-json/wp/v2/blocks');
  assert.equal(seen.opts.query.context, 'edit');
});

test('createNavigation:缺 --title 报错', async () => {
  const client = { request: async () => { throw new Error('不应发请求'); } };
  await assert.rejects(() => createNavigation(client, { content: 'x', 'dry-run': true }), /--title/);
});
