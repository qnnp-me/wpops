// 区块主题导航(wp_navigation):/wp-json/wp/v2/navigation。
// 结构与 blocks.js 一致。

import { readFileSync } from 'node:fs';
import { stripTags, printJson, dry, listRequest } from './util.js';

const NAVIGATION = '/wp-json/wp/v2/navigation';

export async function listNavigation(client, flags) {
  const query = {
    per_page: flags['per-page'] ?? 20,
    page: flags.page,
    search: flags.search,
    status: flags.status,
    context: 'edit',
  };
  const { data, total } = await listRequest(client, NAVIGATION, query, flags);
  if (flags.json) return printJson(data);
  console.log(`导航 ${total ?? data.length} 个:`);
  for (const n of data) {
    console.log(`  #${n.id}  [${n.status}]  ${stripTags(n.title?.raw ?? n.title?.rendered ?? '(无标题)')}`);
  }
}

export async function getNavigation(client, id, flags) {
  const { data } = await client.request('GET', `${NAVIGATION}/${Number(id)}`, {
    query: { context: flags.context || 'edit' },
  });
  if (flags.json) return printJson(data);
  console.log(`#${data.id}  [${data.status}]  ${stripTags(data.title?.raw ?? data.title?.rendered ?? '')}`);
  console.log('─'.repeat(44));
  console.log(data.content?.raw ?? stripTags(data.content?.rendered || ''));
}

function navigationBody(flags) {
  const body = {};
  if (flags.title !== undefined) body.title = String(flags.title);
  if (flags['from-file'] !== undefined) body.content = readFileSync(String(flags['from-file']), 'utf8');
  else if (flags.content !== undefined) body.content = String(flags.content);
  if (flags.status !== undefined) body.status = String(flags.status);
  return body;
}

export async function createNavigation(client, flags) {
  const body = navigationBody(flags);
  if (body.title === undefined) throw new Error('创建导航需要 --title');
  if (flags['dry-run']) return dry(`创建导航 ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', NAVIGATION, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已创建导航 #${data.id} [${data.status}]`);
}

export async function updateNavigation(client, id, flags) {
  const body = navigationBody(flags);
  if (!Object.keys(body).length) {
    throw new Error('没有可更新的字段(--title/--content/--from-file/--status)');
  }
  if (flags['dry-run']) return dry(`更新导航 #${id} ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', `${NAVIGATION}/${Number(id)}`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已更新导航 #${data.id}`);
}

export async function deleteNavigation(client, id, flags) {
  if (flags['dry-run']) return dry(`删除导航 #${id}`);
  if (!flags.force) throw new Error('删除导航需要 --force(不可撤销)');
  const { data } = await client.request('DELETE', `${NAVIGATION}/${Number(id)}`, { query: { force: 'true' } });
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已删除导航 #${id}` : `? 导航 #${id} 未删除`);
}
