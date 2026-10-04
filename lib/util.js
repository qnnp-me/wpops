// 所有命令共用的输出与参数小工具。
// 新增命令模块一律从这里引入,避免各文件重复实现。

import { readFileSync } from 'node:fs';
import { UsageError } from './errors.js';

/** JSON.parse 的容错版:去掉 Windows 编辑器/重定向常见的 UTF-8 BOM。 */
export function parseJson(text) {
  return JSON.parse(String(text).replace(/^\uFEFF/, ''));
}

/** 读文件并解析 JSON(同样容忍 BOM)。 */
export function readJsonFile(path) {
  return parseJson(readFileSync(String(path), 'utf8'));
}

/**
 * 把命令行传入的 id 转成正整数。
 * 非法时抛用法错误(退出码 2),而不是拼出 `.../NaN` 再去撞服务端 404。
 */
export function toId(value, label = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) {
    throw new UsageError(`非法的 ${label}:"${value}"(需要正整数)`);
  }
  return n;
}

function stripTags(html = '') {
  return String(html).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

function dry(message) {
  console.log(`[dry-run] ${message}`);
}

/** 非阻断风险提示(stderr);--yes 或 --quiet 时静默。 */
function warn(message, flags = {}) {
  if (flags.quiet || flags.yes) return;
  console.error(`⚠ ${message}`);
}

/**
 * 把 flags 中的指定键转成 REST 查询参数(- 转 _)。
 * key 可写成 flag 形式(`media-type`)或 REST 形式(`media_type`),两种都能取到;
 * 避免调用方写了下划线键、而 parseArgs 存的是连字符键时静默丢参数。
 */
function pick(flags, keys) {
  const query = {};
  for (const key of keys) {
    let value = flags[key];
    if (value === undefined) value = flags[key.replace(/_/g, '-')];
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
  // 尊重调用方的 --per-page(默认仍取 REST 上限 100)。
  const perPage = Number(query.per_page) > 0 ? Number(query.per_page) : 100;
  const all = [];
  let page = 1;
  for (;;) {
    const { data, headers } = await call('GET', path, {
      query: { ...query, per_page: perPage, page },
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

export { stripTags, dry, warn, pick, printJson, project, toCsv, toTable };
// toId 已用 `export function` 导出,这里不再重复列出。

