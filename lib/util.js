// 所有命令共用的输出与参数小工具。
// 新增命令模块一律从这里引入,避免各文件重复实现。

import { readFileSync } from 'node:fs';

/** JSON.parse 的容错版:去掉 Windows 编辑器/重定向常见的 UTF-8 BOM。 */
export function parseJson(text) {
  return JSON.parse(String(text).replace(/^\uFEFF/, ''));
}

/** 读文件并解析 JSON(同样容忍 BOM)。 */
export function readJsonFile(path) {
  return parseJson(readFileSync(String(path), 'utf8'));
}

function stripTags(html = '') {
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function dry(message) {
  console.log(`[dry-run] ${message}`);
}

/** 把 flags 中的指定键转成 REST 查询参数(- 转 _)。 */
function pick(flags, keys) {
  const query = {};
  for (const key of keys) {
    const value = flags[key];
    if (value === undefined || value === null || value === false) continue;
    query[key.replace(/-/g, '_')] = String(value);
  }
  return query;
}

// ------------------------------------------------------------------ 输出模式

const output = { fields: null, csv: false, table: false };

/** 由 bin 在解析参数后调用,配置 --fields / --csv / --table 全局输出。 */
export function configureOutput(flags = {}) {
  output.fields = flags.fields
    ? String(flags.fields).split(',').map((s) => s.trim()).filter(Boolean)
    : null;
  output.csv = Boolean(flags.csv);
  output.table = Boolean(flags.table);
}

function getPath(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function project(obj, fields) {
  if (!fields || !obj || typeof obj !== 'object') return obj;
  const picked = {};
  for (const field of fields) {
    const value = getPath(obj, field);
    if (value !== undefined) picked[field] = value;
  }
  return picked;
}

function csvCell(value) {
  const text = value === undefined || value === null
    ? ''
    : typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(value, fields) {
  const rows = Array.isArray(value) ? value : [value];
  const columns = fields || [...new Set(rows.flatMap((r) => (r && typeof r === 'object' ? Object.keys(r) : [])))];
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(getPath(row, c))).join(','));
  }
  return lines.join('\n');
}

function pad(text, width) {
  return String(text).length >= width ? String(text) : String(text) + ' '.repeat(width - String(text).length);
}

function toTable(value, fields) {
  const rows = Array.isArray(value) ? value : [value];
  const columns = fields || [...new Set(rows.flatMap((r) => (r && typeof r === 'object' ? Object.keys(r) : [])))];
  const matrix = rows.map((r) => columns.map((c) => {
    const v = getPath(r, c);
    return v === undefined || v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
  }));
  const widths = columns.map((c, i) => Math.max(String(c).length, ...matrix.map((row) => row[i].length)));
  const head = columns.map((c, i) => pad(c, widths[i])).join('  ');
  const sep = widths.map((w) => '-'.repeat(w)).join('  ');
  return [head, sep, ...matrix.map((row) => row.map((cell, i) => pad(cell, widths[i])).join('  '))].join('\n');
}

function printJson(value) {
  let shaped = value;
  if (output.fields) shaped = Array.isArray(value) ? value.map((o) => project(o, output.fields)) : project(value, output.fields);
  if (output.csv) return console.log(toCsv(shaped, output.fields));
  if (output.table) return console.log(toTable(shaped, output.fields));
  console.log(JSON.stringify(shaped, null, 2));
}

// ------------------------------------------------------------------ 分页

/**
 * 拉取某个集合端点的全部页(--all-pages 用)。
 * 默认 per_page=100,按 x-wp-totalpages 翻到最后一页。
 */
export async function fetchAll(client, path, query = {}, request) {
  const call = request || ((method, p, opts) => client.request(method, p, opts));
  const all = [];
  let page = 1;
  for (;;) {
    const { data, headers } = await call('GET', path, {
      query: { ...query, per_page: 100, page },
    });
    if (Array.isArray(data)) all.push(...data);
    const totalPages = Number(headers.get('x-wp-totalpages') || 1);
    if (!Array.isArray(data) || page >= totalPages || data.length === 0) break;
    page++;
  }
  return all;
}

/**
 * 统一集合请求:默认单页 + 返回总数;带 --all-pages 时自动翻完所有页。
 * 返回 { data, total, totalPages }。
 * request(可选):签名必须是 (method, path, opts) 的函数(用于注入带兜底/提示的请求器;
 * 例如菜单端点要注入 menuRequest 时,请传 (m,p,o)=>menuRequest(client,m,p,o))。
 */
export async function listRequest(client, path, query, flags = {}, request) {
  const call = request || ((method, p, opts) => client.request(method, p, opts));
  if (flags['all-pages']) {
    const data = await fetchAll(client, path, query, request);
    return { data, total: data.length, totalPages: 1 };
  }
  const { data, headers } = await call('GET', path, { query });
  return { data, total: headers.get('x-wp-total'), totalPages: headers.get('x-wp-totalpages') };
}

export { stripTags, dry, pick, printJson, project, toCsv, toTable };

