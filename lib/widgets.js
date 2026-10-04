// 小工具与边栏(/wp-json/wp/v2/widgets、/wp-json/wp/v2/sidebars)。
import { printJson, dry, listRequest, parseJson, readJsonFile } from './util.js';
import { UsageError } from './errors.js';

const WIDGETS = '/wp-json/wp/v2/widgets';
const SIDEBARS = '/wp-json/wp/v2/sidebars';

/** 从 --instance / --from-file 解析小工具实例 JSON。 */
function instanceBody(flags) {
  if (flags['from-file'] !== undefined) return readJsonFile(flags['from-file']);
  if (flags.instance !== undefined) return parseJson(flags.instance);
  return undefined;
}

export async function listWidgets(client, flags) {
  const query = {
    per_page: flags['per-page'] ?? 100,
    page: flags.page,
    sidebar: flags.sidebar,
  };
  const { data, total } = await listRequest(client, WIDGETS, query, flags);
  if (flags.json) return printJson(data);
  console.log(`小工具 ${total ?? data.length} 个:`);
  for (const w of data) {
    console.log(`  ${w.id}  [${w.sidebar}]  ${w.type ?? ''}`);
  }
}

export async function getWidget(client, id, flags) {
  const { data } = await client.request('GET', `${WIDGETS}/${encodeURIComponent(id)}`);
  if (flags.json) return printJson(data);
  console.log(`${data.id}  [${data.sidebar}]  ${data.type ?? ''}`);
  console.log(JSON.stringify(data.instance ?? {}, null, 2));
}

export async function createWidget(client, flags) {
  if (flags.id === undefined || flags.sidebar === undefined) {
    throw new UsageError('创建小工具需要 --id 与 --sidebar');
  }
  const body = { id: String(flags.id), sidebar: String(flags.sidebar) };
  const instance = instanceBody(flags);
  body.instance = instance === undefined ? {} : instance;
  if (flags['dry-run']) return dry(`创建小工具 ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', WIDGETS, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已创建小工具 ${data.id} [${data.sidebar}]`);
}

export async function updateWidget(client, id, flags) {
  const body = {};
  if (flags.sidebar !== undefined) body.sidebar = String(flags.sidebar);
  const instance = instanceBody(flags);
  if (instance !== undefined) body.instance = instance;
  if (!Object.keys(body).length) throw new UsageError('更新小工具需要 --sidebar 或 --instance/--from-file');
  if (flags['dry-run']) return dry(`更新小工具 ${id} ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', `${WIDGETS}/${encodeURIComponent(id)}`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已更新小工具 ${data.id} [${data.sidebar}]`);
}

export async function deleteWidget(client, id, flags) {
  if (flags['dry-run']) return dry(`删除小工具 ${id}`);
  if (!flags.force) throw new UsageError('删除小工具需要 --force(不可撤销)');
  const { data } = await client.request('DELETE', `${WIDGETS}/${encodeURIComponent(id)}`);
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已删除小工具 ${id}` : `? 小工具 ${id} 未删除`);
}

export async function listSidebars(client, flags) {
  const { data } = await client.request('GET', SIDEBARS);
  if (flags.json) return printJson(data);
  console.log(`边栏 ${data.length} 个:`);
  for (const s of data) {
    console.log(`  ${s.id}  ${s.name}  widgets=[${(s.widgets || []).join(',')}]`);
  }
}

export async function getSidebar(client, id, flags) {
  const { data } = await client.request('GET', `${SIDEBARS}/${encodeURIComponent(id)}`);
  if (flags.json) return printJson(data);
  console.log(`${data.id}  ${data.name}`);
  console.log(`  widgets=[${(data.widgets || []).join(',')}]`);
}

export async function updateSidebar(client, id, flags) {
  if (flags.widgets === undefined) throw new UsageError('更新边栏需要 --widgets a,b,c');
  const widgets = String(flags.widgets).split(',').map((s) => s.trim()).filter(Boolean);
  const body = { widgets };
  if (flags['dry-run']) return dry(`更新边栏 ${id} ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', `${SIDEBARS}/${encodeURIComponent(id)}`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已更新边栏 ${data.id} widgets=[${(data.widgets || []).join(',')}]`);
}
