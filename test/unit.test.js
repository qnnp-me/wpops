import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseDotenv } from '../lib/env.js';
import { configProblems } from '../lib/client.js';
import { parseArgs, isMutation } from '../lib/args.js';

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
