// 全局样式(/wp-json/wp/v2/global-styles):区块主题的 theme.json 样式配置。
import { stripTags, printJson, dry, parseJson, readJsonFile } from './util.js';
import { UsageError } from './errors.js';

const GLOBAL_STYLES = '/wp-json/wp/v2/global-styles';

export async function getGlobalStyles(client, id, flags) {
  const { data } = await client.request('GET', `${GLOBAL_STYLES}/${id}`);
  if (flags.json) return printJson(data);
  const title = stripTags(data.title?.rendered || data.title || '');
  console.log(`${data.id}  ${title}`.trimEnd());
  console.log(JSON.stringify(data.styles ?? {}, null, 2));
}

export async function updateGlobalStyles(client, id, flags) {
  let styles;
  if (flags['from-file'] !== undefined) styles = readJsonFile(flags['from-file']);
  else if (flags.styles !== undefined) styles = parseJson(flags.styles);
  if (styles === undefined) throw new UsageError('更新全局样式需要 --styles JSON 或 --from-file');
  const body = { styles };
  if (flags['dry-run']) return dry(`更新全局样式 ${id} ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', `${GLOBAL_STYLES}/${id}`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已更新全局样式 ${data.id}`);
}
