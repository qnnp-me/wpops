// spec / help / dispatch 一致性测试。
// 目标:命令清单、帮助、写操作护栏、分发四者始终同源,任何一处漏掉都会在这里失败。

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GROUPS, groupByName, isMutation, manifest, completionWords } from '../lib/spec.js';
import { generalHelp, groupHelp, commandsJson, commandsText } from '../lib/help.js';
import { dispatch } from '../lib/run.js';

test('spec:别名都能解析到同一个组', () => {
  assert.equal(groupByName('post').name, 'posts');
  assert.equal(groupByName('menu-item').name, 'menu-items');
  assert.equal(groupByName('global-style').name, 'global-styles');
  assert.equal(groupByName('revision').name, 'revisions');
  assert.equal(groupByName('user').name, 'users');
  assert.equal(groupByName('nope'), null);
});

test('spec:isMutation 覆盖组、别名与特殊组', () => {
  assert.equal(isMutation('menu-items', 'create'), true);
  assert.equal(isMutation('menus', 'list'), false);
  assert.equal(isMutation('menus', undefined), false);
  assert.equal(isMutation('post', 'delete'), true);          // 别名
  assert.equal(isMutation('global-style', 'update'), true);  // 别名
  assert.equal(isMutation('revision', 'list'), false);
  assert.equal(isMutation('posts', 'publish'), true);
  assert.equal(isMutation('pages', 'unpublish'), true);
  assert.equal(isMutation('pages', 'import'), true);
  assert.equal(isMutation('posts', 'export'), false);
  assert.equal(isMutation('batch', 'anything'), true);
  assert.equal(isMutation('raw', 'GET'), false);
  assert.equal(isMutation('raw', 'POST'), true);
  assert.equal(isMutation('user', 'delete'), true);   // 别名(曾漏在 spec 之外)
  assert.equal(isMutation('nope', 'create'), false);
});

test('spec:manifest 覆盖所有组,字段齐全', () => {
  const m = manifest('9.9.9');
  assert.equal(m.version, '9.9.9');
  assert.equal(m.groups.length, GROUPS.length);
  assert.ok(m.globalFlags.length > 0);
  const posts = m.groups.find((g) => g.name === 'posts');
  assert.deepEqual(posts.aliases, ['post']);
  assert.ok(posts.actions.includes('create'));
  assert.ok(posts.actions.includes('publish'));
  assert.ok(posts.actions.includes('export'));
  assert.ok(posts.mutating.includes('delete'));
  assert.ok(posts.mutating.includes('publish'));
  assert.ok(!posts.mutating.includes('export'));
});

test('spec:completionWords 含组名与别名', () => {
  const words = completionWords(['help']);
  assert.ok(words.includes('posts'));
  assert.ok(words.includes('post'));
  assert.ok(words.includes('menu-item'));
  assert.ok(words.includes('help'));
});

test('help:每个组都有非空帮助;清单是合法 JSON', () => {
  for (const g of GROUPS) {
    const text = groupHelp(g.name);
    assert.ok(text && text.includes(g.name), `${g.name} 缺少帮助`);
    assert.ok(groupHelp(g.name, 'list') || !Object.keys(g.actions || {}).length);
  }
  assert.equal(groupHelp('nope'), null);
  assert.ok(generalHelp('1.0.0').includes('用法'));
  assert.doesNotThrow(() => JSON.parse(commandsJson('1.0.0')));
});

test('help:commandsText 是人类可读概览且含组/动作/写操作标记', () => {
  const text = commandsText('1.0.0');
  assert.match(text, /命令概览/);
  for (const g of GROUPS) assert.ok(text.includes(g.name), `概览缺少组 ${g.name}`);
  assert.match(text, /create\*/);            // posts 的写操作有 * 标记
  assert.match(text, /list · get/);          // 动作清单
  assert.equal(text.includes('{'), false);   // 不是 JSON
});

test('dispatch:无子动作的组拒绝多余动作(statuses)', async () => {
  const client = { request: async () => ({ data: {}, headers: new Headers() }) };
  await assert.rejects(
    () => dispatch(client, { url: 'https://example.invalid' }, 'statuses', 'frobnicate', [], {}),
    /不接受子命令/,
  );
});

test('dispatch:每个组与别名都有分发(不出现"未知命令")', async () => {
  // doctor 会直接 fetch 探测版本,这里跳过以免联网。
  const groups = GROUPS.filter((g) => !g.local && g.name !== 'doctor');
  const client = { request: async () => ({ data: [], headers: new Headers() }) };
  const cfg = { url: 'https://example.invalid' };

  const original = console.log;
  console.log = () => {};
  try {
    for (const g of groups) {
      for (const name of [g.name, ...(g.aliases || [])]) {
        try {
          await dispatch(client, cfg, name, undefined, [], {});
        } catch (err) {
          assert.ok(
            !/未知命令/.test(err.message),
            `${name} 未被分发:${err.message}`,
          );
        }
      }
    }
  } finally {
    console.log = original;
  }
});
