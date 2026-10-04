// 站点设置:读取 / 更新核心 /wp/v2/settings 端点。
// flag 名(- 分隔)映射到 REST 字段(_ 分隔),数值字段自动转 Number。

import { printJson, dry, warn, parseJson, readJsonFile } from './util.js';
import { UsageError } from './errors.js';

const SETTINGS = '/wp-json/wp/v2/settings';

// 顺序即帮助/干跑输出顺序。
const SETTINGS_FIELDS = {
  title: 'title',
  description: 'description',
  url: 'url',
  email: 'email',
  timezone: 'timezone',
  'date-format': 'date_format',
  'time-format': 'time_format',
  'start-of-week': 'start_of_week',
  language: 'language',
  'posts-per-page': 'posts_per_page',
  'show-on-front': 'show_on_front',
  'page-on-front': 'page_on_front',
  'page-for-posts': 'page_for_posts',
  'default-category': 'default_category',
  'default-post-format': 'default_post_format',
  'default-ping-status': 'default_ping_status',
  'default-comment-status': 'default_comment_status',
};

const NUMERIC_FIELDS = new Set([
  'posts_per_page',
  'start_of_week',
  'page_on_front',
  'page_for_posts',
  'default_category',
]);

export async function getSettings(client, flags) {
  const { data } = await client.request('GET', SETTINGS);

  if (flags.json) return printJson(data);

  for (const [key, value] of Object.entries(data || {})) {
    const shown = value !== null && typeof value === 'object' ? JSON.stringify(value) : value;
    console.log(`  ${key}: ${shown}`);
  }
}

export async function updateSettings(client, flags) {
  let body;
  if (flags.data !== undefined) {
    body = parseJson(flags.data);
  } else if (flags['from-file'] !== undefined) {
    body = readJsonFile(flags['from-file']);
  } else {
    body = {};
    for (const [flagName, restName] of Object.entries(SETTINGS_FIELDS)) {
      if (flags[flagName] === undefined) continue;
      body[restName] = NUMERIC_FIELDS.has(restName)
        ? Number(flags[flagName])
        : String(flags[flagName]);
    }
  }

  if (!body || !Object.keys(body).length) {
    throw new UsageError('没有可更新的字段(--title/--description/--timezone/--posts-per-page/... 或 --data JSON)');
  }

  warn('正在修改站点设置,会立即对全站生效', flags);
  if (flags['dry-run']) return dry(`更新站点设置 ${JSON.stringify(body)}`);

  const { data } = await client.request('POST', SETTINGS, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已更新站点设置(${Object.keys(body).length} 项)`);
}
