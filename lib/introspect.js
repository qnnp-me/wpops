// 站点自省:列出 / 查看已注册的文章类型、分类法与文章状态。
// 这些端点返回以 slug 为键的对象,而非数组。

import { printJson } from './util.js';

const TYPES = '/wp-json/wp/v2/types';
const TAXONOMIES = '/wp-json/wp/v2/taxonomies';
const STATUSES = '/wp-json/wp/v2/statuses';

export async function listTypes(client, flags) {
  const { data } = await client.request('GET', TYPES);
  if (flags.json) return printJson(data);

  const entries = Object.entries(data || {});
  console.log(`文章类型 ${entries.length} 个:`);
  for (const [name, type] of entries) {
    console.log(`  ${name}  rest_base=${type.rest_base}`);
  }
}

export async function getType(client, type, flags) {
  const { data } = await client.request('GET', `${TYPES}/${type}`);
  if (flags.json) return printJson(data);

  console.log(`name:${data.name}`);
  console.log(`slug:${data.slug}`);
  console.log(`rest_base:${data.rest_base}`);
}

export async function listTaxonomies(client, flags) {
  const { data } = await client.request('GET', TAXONOMIES);
  if (flags.json) return printJson(data);

  const entries = Object.entries(data || {});
  console.log(`分类法 ${entries.length} 个:`);
  for (const [name, tax] of entries) {
    console.log(`  ${name}  rest_base=${tax.rest_base}`);
  }
}

export async function getTaxonomy(client, tax, flags) {
  const { data } = await client.request('GET', `${TAXONOMIES}/${tax}`);
  if (flags.json) return printJson(data);

  console.log(`name:${data.name}`);
  console.log(`slug:${data.slug}`);
  console.log(`rest_base:${data.rest_base}`);
}

export async function listStatuses(client, flags) {
  const { data } = await client.request('GET', STATUSES);
  if (flags.json) return printJson(data);

  const entries = Object.entries(data || {});
  console.log(`状态 ${entries.length} 个:`);
  for (const [slug, status] of entries) {
    console.log(`  ${slug}  ${status.name}`);
  }
}
