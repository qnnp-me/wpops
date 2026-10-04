// 可复用区块(wp_block):/wp-json/wp/v2/blocks。

import { readFileSync } from 'node:fs';
import { stripTags, printJson, dry, listRequest } from './util.js';

const BLOCKS = '/wp-json/wp/v2/blocks';

export async function listBlocks(client, flags) {
  const query = {
    per_page: flags['per-page'] ?? 20,
    page: flags.page,
    search: flags.search,
    status: flags.status,
    context: 'edit',
  };
  const { data, total } = await listRequest(client, BLOCKS, query, flags);
  if (flags.json) return printJson(data);
  console.log(`区块 ${total ?? data.length} 个:`);
  for (const b of data) {
    console.log(`  #${b.id}  [${b.status}]  ${stripTags(b.title?.raw ?? b.title?.rendered ?? '(无标题)')}`);
  }
}

export async function getBlock(client, id, flags) {
  const { data } = await client.request('GET', `${BLOCKS}/${Number(id)}`, {
    query: { context: flags.context || 'edit' },
  });
  if (flags.json) return printJson(data);
  console.log(`#${data.id}  [${data.status}]  ${stripTags(data.title?.raw ?? data.title?.rendered ?? '')}`);
  console.log('─'.repeat(44));
  console.log(data.content?.raw ?? stripTags(data.content?.rendered || ''));
}

function blockBody(flags) {
  const body = {};
  if (flags.title !== undefined) body.title = String(flags.title);
  if (flags['from-file'] !== undefined) body.content = readFileSync(String(flags['from-file']), 'utf8');
  else if (flags.content !== undefined) body.content = String(flags.content);
  if (flags.status !== undefined) body.status = String(flags.status);
  return body;
}

export async function createBlock(client, flags) {
  const body = blockBody(flags);
  if (body.title === undefined && body.content === undefined) {
    throw new Error('创建区块至少需要 --title 或 --content');
  }
  if (flags['dry-run']) return dry(`创建区块 ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', BLOCKS, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已创建区块 #${data.id} [${data.status}]`);
}

export async function updateBlock(client, id, flags) {
  const body = blockBody(flags);
  if (!Object.keys(body).length) {
    throw new Error('没有可更新的字段(--title/--content/--from-file/--status)');
  }
  if (flags['dry-run']) return dry(`更新区块 #${id} ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', `${BLOCKS}/${Number(id)}`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已更新区块 #${data.id}`);
}

export async function deleteBlock(client, id, flags) {
  if (flags['dry-run']) return dry(`删除区块 #${id}`);
  if (!flags.force) throw new Error('删除区块需要 --force(不可撤销)');
  const { data } = await client.request('DELETE', `${BLOCKS}/${Number(id)}`, { query: { force: 'true' } });
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已删除区块 #${id}` : `? 区块 #${id} 未删除`);
}
