// 跨内容搜索:调用核心 /wp/v2/search 端点。
// 与 commands.js 保持一致的输出约定(--json / 中文人类可读)。

import { stripTags, printJson } from './util.js';

const SEARCH = '/wp-json/wp/v2/search';

export async function search(client, term, flags) {
  const keyword = term || flags.search;
  if (!keyword) {
    throw new Error('search 需要一个搜索词:wpops search <词> [--type post]');
  }

  const query = {
    search: keyword,
    type: flags.type,
    subtype: flags.subtype,
    per_page: flags['per-page'] ?? 10,
    page: flags.page,
  };
  const { data } = await client.request('GET', SEARCH, { query });

  if (flags.json) return printJson(data);

  const items = Array.isArray(data) ? data : [];
  console.log(`搜索 "${keyword}" 共 ${items.length} 条:`);
  for (const item of items) {
    console.log(`  #${item.id}  [${item.subtype}]  ${stripTags(item.title || '')}  ${item.url}`);
  }
}
