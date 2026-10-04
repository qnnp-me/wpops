// 站点健康命令(/wp-json/wp-site-health/v1)。
// 多数测试端点是只读的;directory-sizes 走单独路径。
import { printJson } from './util.js';

const BASE = '/wp-json/wp-site-health/v1';

/** 已知的站点健康测试名。 */
export const KNOWN_TESTS = [
  'authorization-header',
  'background-updates',
  'dotorg-communication',
  'https-status',
  'loopback-requests',
  'page-cache',
  'directory-sizes',
];

/** 列出已知测试名与用法,不发任何请求。 */
export async function listHealth(client, flags) {
  if (flags.json) return printJson(KNOWN_TESTS);
  console.log('已知站点健康测试:');
  for (const test of KNOWN_TESTS) console.log(`  ${test}`);
  console.log('用法:wpops health <test> [--json]');
}

/** 运行一个健康测试:directory-sizes 走专用路径,其余走 tests/{test}。 */
export async function runHealth(client, test, flags) {
  if (!test) {
    throw new Error(`health 需要一个测试名:wpops health <test>;可用:${KNOWN_TESTS.join(', ')}`);
  }
  const path = test === 'directory-sizes'
    ? `${BASE}/directory-sizes`
    : `${BASE}/tests/${encodeURIComponent(test)}`;
  const { data } = await client.request('GET', path);
  if (flags.json) return printJson(data);
  const status = data?.status;
  const label = data?.label ?? data?.name ?? test;
  const description = data?.description ?? data?.message ?? '';
  console.log(`[${status === undefined || status === null ? '?' : status}] ${label} — ${description}`);
}
