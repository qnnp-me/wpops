import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sitesDir = resolve(root, 'sites');

/** 解析 .env 文本为对象(导出以便测试)。 */
export function parseDotenv(text) {
  const vars = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    vars[key] = value;
  }
  return vars;
}

function assertSiteName(site) {
  if (site && !/^[A-Za-z0-9._-]+$/.test(site)) {
    throw new Error(`非法站点名 "${site}":只允许字母、数字、点、下划线、连字符`);
  }
}

/** 某站点对应哪个配置文件。site 为空→根 .env;有值→sites/<site>.env。 */
export function envFileFor(site) {
  if (process.env.WPOPS_ENV) return process.env.WPOPS_ENV;
  if (site) return resolve(sitesDir, `${site}.env`);
  return resolve(root, '.env');
}

/** 列出所有已配置站点(默认站 + sites/ 下的名字)。 */
export function listSites() {
  const sites = [];
  if (existsSync(resolve(root, '.env'))) {
    sites.push({ name: null, label: '(default)', file: resolve(root, '.env') });
  }
  if (existsSync(sitesDir)) {
    for (const file of readdirSync(sitesDir).sort()) {
      if (file.endsWith('.env')) {
        const name = file.slice(0, -4);
        sites.push({ name, label: name, file: resolve(sitesDir, file) });
      }
    }
  }
  return sites;
}

/**
 * 读取配置。
 * - 指定 site                → 只读 sites/<site>.env(不叠加环境变量,避免多站串味)
 * - 未指定,但有根 .env       → 读根 .env,允许真实环境变量覆盖
 * - 未指定,且根 .env 不存在  → 若 sites/ 下只有一个站点,就当作默认站
 */
export function loadEnv(site) {
  assertSiteName(site);
  let effective = site || null;

  if (!effective && !process.env.WPOPS_ENV && !existsSync(resolve(root, '.env'))) {
    const named = listSites();
    if (named.length === 1) effective = named[0].name;
  }

  const file = envFileFor(effective);
  if (!existsSync(file)) {
    if (effective) throw new Error(`找不到站点配置 "${effective}":${file}`);
    return { ...process.env };
  }

  const fromFile = parseDotenv(readFileSync(file, 'utf8'));
  return effective ? fromFile : { ...fromFile, ...process.env };
}
