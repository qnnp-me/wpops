// CLI 集成测试:验证退出码约定与用法错误输出。
// 这些用例在发出网络请求之前就会失败,因此不联网、不依赖站点配置。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const bin = fileURLToPath(new URL('../bin/wpops.js', import.meta.url));

function run(args) {
  return spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
}

test('CLI:缺位置参数 → 退出码 2 + 用法提示', () => {
  const r = run(['posts', 'get']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /缺少必需参数/);
  assert.match(r.stderr, /用法:/);
  assert.match(r.stderr, /--help/);
});

test('CLI:缺必填开关 → 退出码 2 + 用法提示', () => {
  const r = run(['menus', 'create']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /--name/);
  assert.match(r.stderr, /--help/);
});

test('CLI:未知动作 → 退出码 2', () => {
  const r = run(['menus', 'frobnicate']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /未知子命令/);
});

test('CLI:未知组 → 退出码 2 + 通用提示', () => {
  const r = run(['nope']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /未知命令/);
  assert.match(r.stderr, /wpops help/);
});

test('CLI:--help → 退出码 0,帮助走 stdout', () => {
  const r = run(['posts', '--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /文章/);
  assert.match(r.stdout, /publish/);
  assert.equal(r.stderr, '');
});

test('CLI:commands 默认输出人类可读概览', () => {
  const r = run(['commands']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /命令概览/);
  assert.match(r.stdout, /posts/);
  assert.equal(r.stdout.includes('"groups"'), false);
});

test('CLI:commands show / --json 输出机器可读 JSON', () => {
  for (const args of [['commands', 'show'], ['commands', '--json'], ['commands', 'list', '--json']]) {
    const r = run(args);
    assert.equal(r.status, 0, args.join(' '));
    assert.doesNotThrow(() => JSON.parse(r.stdout), args.join(' '));
  }
});

test('CLI:commands 未知动作 → 退出码 2', () => {
  const r = run(['commands', 'frobnicate']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /未知子命令/);
  assert.match(r.stderr, /list\|show/);
});

test('CLI:本地命令用法错误也走退出码 2', () => {
  for (const args of [['sites', 'show'], ['sites', 'rm'], ['completion', 'foo'], ['help', 'nope']]) {
    const r = run(args);
    assert.equal(r.status, 2, args.join(' '));
  }
});

test('CLI:publish 缺 id → 退出码 2', () => {
  const r = run(['posts', 'publish']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /缺少必需参数/);
});

test('CLI:raw GET 带 --data → 退出码 2(用法错误)', () => {
  const r = run(['raw', 'GET', '/wp-json/', '--data', '{}']);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /不能带/);
});

test('CLI:用法错误不污染 stdout(便于管道)', () => {
  const r = run(['menus', 'create']);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /✗/);
});
