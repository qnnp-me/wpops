// 区块主题模板与模板片段(/wp-json/wp/v2/templates、/wp-json/wp/v2/template-parts)。
// 注意:模板 id 可能形如 `theme//slug`,必须原样拼进路径,不能 encodeURIComponent(会编坏 /)。
import { readFileSync } from 'node:fs';
import { stripTags, printJson, dry, listRequest } from './util.js';

const TEMPLATES = '/wp-json/wp/v2/templates';
const TEMPLATE_PARTS = '/wp-json/wp/v2/template-parts';

/** 集合列表:分页 + 总数。 */
async function listCollection(client, base, label, flags) {
  const query = {
    per_page: flags['per-page'] ?? 100,
    page: flags.page,
    context: 'edit',
  };
  const { data, total } = await listRequest(client, base, query, flags);
  if (flags.json) return printJson(data);
  console.log(`${label} ${total ?? data.length} 个:`);
  for (const item of data) {
    console.log(`  ${item.id}  ${item.slug}  ${item.status}  ${stripTags(item.title?.rendered || '')}`);
  }
}

/** 单项:json 或打印 id/slug/status 与 content。 */
async function getItem(client, base, id, flags) {
  const { data } = await client.request('GET', `${base}/${id}`);
  if (flags.json) return printJson(data);
  console.log(`${data.id}  ${data.slug}  [${data.status}]  ${stripTags(data.title?.rendered || '')}`);
  console.log('─'.repeat(44));
  console.log(data.content?.raw ?? data.content?.rendered ?? '');
}

/** 更新:body { content }(--from-file 优先),可选 title。缺 content 报错。 */
async function updateItem(client, base, id, label, flags) {
  const body = {};
  if (flags['from-file'] !== undefined) body.content = readFileSync(String(flags['from-file']), 'utf8');
  else if (flags.content !== undefined) body.content = String(flags.content);
  if (body.content === undefined) throw new Error(`更新${label}需要 --content 或 --from-file`);
  if (flags.title !== undefined) body.title = String(flags.title);
  if (flags['dry-run']) return dry(`更新${label} ${id} ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', `${base}/${id}`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已更新${label} ${data.id}`);
}

export async function listTemplates(client, flags) {
  return listCollection(client, TEMPLATES, '模板', flags);
}

export async function getTemplate(client, id, flags) {
  return getItem(client, TEMPLATES, id, flags);
}

export async function updateTemplate(client, id, flags) {
  return updateItem(client, TEMPLATES, id, '模板', flags);
}

export async function listTemplateParts(client, flags) {
  return listCollection(client, TEMPLATE_PARTS, '模板片段', flags);
}

export async function getTemplatePart(client, id, flags) {
  return getItem(client, TEMPLATE_PARTS, id, flags);
}

export async function updateTemplatePart(client, id, flags) {
  return updateItem(client, TEMPLATE_PARTS, id, '模板片段', flags);
}
