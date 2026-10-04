// Abilities API 命令(/wp-json/wp-abilities/v1/abilities)。
// 需要站点安装并启用 Abilities API 插件。
import { printJson, dry, parseJson } from './util.js';

const ABILITIES = '/wp-json/wp-abilities/v1/abilities';

/** 端点可能返回数组、{ abilities: [...] } 或按名字索引的对象,统一成数组。 */
function asList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.abilities)) return data.abilities;
  if (data && typeof data === 'object') return Object.values(data);
  return [];
}

/** 列表:GET /abilities。字段可能缺失,逐项容错。 */
export async function listAbilities(client, flags) {
  const { data } = await client.request('GET', ABILITIES);
  if (flags.json) return printJson(data);
  const items = asList(data);
  console.log(`Abilities ${items.length} 个:`);
  for (const item of items) {
    const name = item?.name ?? item?.id ?? '?';
    const label = item?.label ?? '';
    const description = item?.description ?? '';
    console.log(`  ${name}  ${label}  ${description}`);
  }
}

/** 详情:GET /abilities/{name}。 */
export async function getAbility(client, name, flags) {
  const { data } = await client.request('GET', `${ABILITIES}/${encodeURIComponent(name)}`);
  if (flags.json) return printJson(data);
  console.log(`${data?.name ?? name}  ${data?.label ?? ''}`);
  if (data?.description) console.log(`  描述:${data.description}`);
  if (data?.input_schema) console.log(`  输入:${JSON.stringify(data.input_schema)}`);
  if (data?.output_schema) console.log(`  输出:${JSON.stringify(data.output_schema)}`);
}

/**
 * 运行:POST /abilities/{name}/run。
 * body 来自 --input 或 --data(JSON 字符串),都没有则 {}。
 */
export async function runAbility(client, name, flags) {
  const raw = flags.input !== undefined ? flags.input : flags.data;
  const body = raw !== undefined ? parseJson(raw) : {};
  if (flags['dry-run']) return dry(`运行 Ability ${name} ${JSON.stringify(body)}`);
  const { data } = await client.request('POST', `${ABILITIES}/${encodeURIComponent(name)}/run`, { body });
  if (flags.json) return printJson(data);
  console.log(`✓ 已运行 ${name}`);
  console.log(JSON.stringify(data, null, 2));
}
