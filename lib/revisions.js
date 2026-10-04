// 内容修订(revisions):列出 / 查看 / 删除 / 恢复到某个修订。
// type 取 posts 或 pages,默认 posts;端点挂在具体内容下。

import { stripTags, printJson, dry, listRequest, toId } from './util.js';
import { UsageError } from './errors.js';

function revisionsPath(type, id) {
  return `/wp-json/wp/v2/${type}/${toId(id)}/revisions`;
}

export async function listRevisions(client, type, id, flags) {
  const query = {
    per_page: flags['per-page'] ?? 10,
    page: flags.page,
  };
  const { data, total } = await listRequest(client, revisionsPath(type, id), query, flags);
  if (flags.json) return printJson(data);
  console.log(`${type} #${id} 修订 ${total ?? data.length} 条:`);
  for (const rev of data) {
    console.log(`  #${rev.id}  ${rev.date}  ${rev.author}  ${stripTags(rev.title?.rendered || '')}`);
  }
}

export async function getRevision(client, type, id, rev, flags) {
  const { data } = await client.request('GET', `${revisionsPath(type, id)}/${toId(rev, 'rev')}`);
  if (flags.json) return printJson(data);
  console.log(`#${data.id}  ${data.date}  ${data.author}  ${stripTags(data.title?.rendered || '')}`);
}

export async function deleteRevision(client, type, id, rev, flags) {
  if (flags['dry-run']) return dry(`删除 ${type} #${id} 修订 #${rev}`);
  if (!flags.force) throw new UsageError('删除修订需要 --force(不可撤销)');
  const { data } = await client.request('DELETE', `${revisionsPath(type, id)}/${toId(rev, 'rev')}`, {
    query: { force: 'true' },
  });
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已删除 ${type} #${id} 修订 #${rev}` : `? 修订 #${rev} 未删除`);
}

/** 取修订字段:优先 .raw,退回 .rendered。 */
function revisionValue(field) {
  return field?.raw ?? field?.rendered;
}

export async function restoreRevision(client, type, id, rev, flags) {
  const { data: revision } = await client.request('GET', `${revisionsPath(type, id)}/${toId(rev, 'rev')}`);
  const body = {
    title: revisionValue(revision.title),
    content: revisionValue(revision.content),
    excerpt: revisionValue(revision.excerpt),
  };
  if (flags['dry-run']) return dry(`恢复 ${type} #${id} 到修订 #${rev}`);
  const { data } = await client.request('POST', `/wp-json/wp/v2/${type}/${toId(id)}`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已恢复 ${type} #${id} 到修订 #${rev}`);
}
