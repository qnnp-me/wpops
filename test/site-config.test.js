import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deleteWidget, listSidebars } from '../lib/widgets.js';
import { deleteAppPassword, listAppPasswords } from '../lib/app-passwords.js';
import { updateTemplate } from '../lib/templates.js';
import { updateGlobalStyles } from '../lib/global-styles.js';

/** 临时置空 console.log,返回恢复函数。 */
function silenceLog() {
  const original = console.log;
  console.log = () => {};
  return () => {
    console.log = original;
  };
}

test('deleteWidget:dry-run 不发请求且无需 --force;缺 --force 报错', async () => {
  const client = { request: async () => { throw new Error('不应发请求'); } };
  const restore = silenceLog();
  try {
    await deleteWidget(client, 'widget-1', { 'dry-run': true });
  } finally {
    restore();
  }
  await assert.rejects(() => deleteWidget(client, 'widget-1', {}), /--force/);
});

test('deleteAppPassword:dry-run 不发请求且无需 --force;缺 --force 报错', async () => {
  const client = { request: async () => { throw new Error('不应发请求'); } };
  const restore = silenceLog();
  try {
    await deleteAppPassword(client, 'me', 'uuid-1', { 'dry-run': true });
  } finally {
    restore();
  }
  await assert.rejects(() => deleteAppPassword(client, 'me', 'uuid-1', {}), /--force/);
});

test('listAppPasswords:非数组响应不崩溃(容错为空)', async () => {
  const client = { request: async () => ({ data: { unexpected: true } }) };
  const restore = silenceLog();
  try {
    await listAppPasswords(client, 'me', {});
  } finally {
    restore();
  }
});

test('updateTemplate:缺 content 直接报错(即使 --dry-run)', async () => {
  const client = { request: async () => { throw new Error('不应发请求'); } };
  await assert.rejects(
    () => updateTemplate(client, 'twentytwentyfour//index', { 'dry-run': true }),
    /--content/,
  );
});

test('updateGlobalStyles:--dry-run 不调用 request', async () => {
  let calls = 0;
  const client = { request: async () => { calls++; throw new Error('不应发请求'); } };
  const restore = silenceLog();
  try {
    await updateGlobalStyles(client, 'global', { styles: '{"color":{}}', 'dry-run': true });
  } finally {
    restore();
  }
  assert.equal(calls, 0);
});

test('listSidebars:请求路径解析为 /wp-json/wp/v2/sidebars', async () => {
  const seen = [];
  const client = {
    request: async (method, path) => {
      seen.push({ method, path });
      return { data: [], headers: new Map(), status: 200 };
    },
  };
  const restore = silenceLog();
  try {
    await listSidebars(client, {});
  } finally {
    restore();
  }
  assert.equal(seen.length, 1);
  assert.equal(seen[0].method, 'GET');
  assert.equal(seen[0].path, '/wp-json/wp/v2/sidebars');
});
