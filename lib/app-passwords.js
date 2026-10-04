// 用户应用密码(/wp-json/wp/v2/users/<user|me>/application-passwords)。
// 创建是唯一会返回明文 password 的接口,该字段只在此处打印一次。
import { printJson, dry } from './util.js';
import { UsageError } from './errors.js';

function appPasswordsPath(user) {
  return `/wp-json/wp/v2/users/${user || 'me'}/application-passwords`;
}

export async function listAppPasswords(client, user, flags) {
  const base = appPasswordsPath(user);
  const { data } = await client.request('GET', base);
  if (flags.json) return printJson(data);
  console.log(`应用密码 ${data.length} 个:`);
  for (const p of data) {
    console.log(`  ${p.uuid}  ${p.name}  ${p.last_used ?? '—'}  ${p.created ?? '—'}`);
  }
}

export async function createAppPassword(client, user, flags) {
  if (flags.name === undefined) throw new UsageError('创建应用密码需要 --name');
  const body = { name: String(flags.name) };
  if (flags['app-id'] !== undefined) body.app_id = String(flags['app-id']);
  const base = appPasswordsPath(user);
  if (flags['dry-run']) return dry(`创建应用密码 ${body.name}`);
  const { data } = await client.request('POST', base, { body });
  if (flags.json) return printJson(data);
  console.log(`${data.uuid}  ${data.name}`);
  console.log(`password: ${data.password}`);
}

export async function deleteAppPassword(client, user, uuid, flags) {
  const base = appPasswordsPath(user);
  if (flags['dry-run']) return dry(`删除应用密码 ${uuid}`);
  if (!flags.force) throw new UsageError('删除应用密码需要 --force(不可撤销)');
  const { data } = await client.request('DELETE', `${base}/${uuid}`);
  if (flags.json) return printJson(data);
  console.log(data.deleted ? `✓ 已删除应用密码 ${uuid}` : `? 应用密码 ${uuid} 未删除`);
}
