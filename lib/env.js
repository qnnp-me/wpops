import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UsageError } from './errors.js';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * 用户级配置目录(稳定、升级不丢):
 * - Windows:%APPDATA%\wpops
 * - 其他:$XDG_CONFIG_HOME/wpops 或 ~/.config/wpops
 */
export function userConfigHome() {
  if (process.platform === 'win32' && process.env.APPDATA) {
    return resolve(process.env.APPDATA, 'wpops');
  }
  const base = process.env.XDG_CONFIG_HOME || join(homedir(), '.config');
  return resolve(base, 'wpops');
}

/**
 * 配置根目录。
 * - 默认:用户级稳定目录(见 userConfigHome)。**不再默认用包目录**——升级会整目录替换包,配置会被清掉。
 * - `WPOPS_HOME` 覆盖(开发时想用仓库内目录,把它设成仓库路径即可)。
 */
export function configHome() {
  return process.env.WPOPS_HOME ? resolve(process.env.WPOPS_HOME) : userConfigHome();
}

function hasConfig(dir) {
  return existsSync(join(dir, '.env')) || existsSync(join(dir, 'sites'));
}

/**
 * 把旧版「包目录内」的配置搬到稳定的用户目录。
 * 仅当:未显式指定 WPOPS_HOME/WPOPS_ENV、旧目录有配置、新目录还没有配置时执行;best-effort。
 * 返回迁移的条目数(0 表示无需/未迁移)。
 */
export function migrateLegacyConfig() {
  if (process.env.WPOPS_HOME || process.env.WPOPS_ENV) return 0;
  const from = pkgRoot;
  const to = userConfigHome();
  if (resolve(from) === resolve(to)) return 0;
  if (!hasConfig(from) || hasConfig(to)) return 0;

  let migrated = 0;
  try {
    mkdirSync(join(to, 'sites'), { recursive: true });
    const legacyRoot = join(from, '.env');
    if (existsSync(legacyRoot)) {
      cpSync(legacyRoot, join(to, '.env'));
      migrated++;
    }
    const legacySites = join(from, 'sites');
    if (existsSync(legacySites)) {
      for (const file of readdirSync(legacySites)) {
        if (!file.endsWith('.env')) continue;
        cpSync(join(legacySites, file), join(to, 'sites', file));
        migrated++;
      }
    }
    if (migrated) hardenConfigPerms();
  } catch {
    return 0;
  }
  return migrated;
}

/** unix 下收紧配置权限(里面有应用密码)。Windows 跳过(用默认 ACL)。 */
export function hardenConfigPerms() {
  if (process.platform === 'win32') return;
  const home = configHome();
  try {
    chmodSync(resolve(home), 0o700);
  } catch {
    // 目录可能刚被删/无权限,忽略
  }
  const sites = resolve(home, 'sites');
  if (existsSync(sites)) {
    try {
      chmodSync(sites, 0o700);
    } catch {
      // 忽略
    }
    try {
      for (const file of readdirSync(sites)) {
        if (file.endsWith('.env')) chmodSync(join(sites, file), 0o600);
      }
    } catch {
      // 忽略
    }
  }
  const root = resolve(home, '.env');
  if (existsSync(root)) {
    try {
      chmodSync(root, 0o600);
    } catch {
      // 忽略
    }
  }
}

function sitesDir() {
  return resolve(configHome(), 'sites');
}

function rootEnvFile() {
  return resolve(configHome(), '.env');
}

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

/** 校验站点名(用于拼文件名/路径,拒绝路径分隔符等)。 */
export function assertSiteName(site) {
  if (site && !/^[A-Za-z0-9._-]+$/.test(site)) {
    throw new UsageError(`非法站点名 "${site}":只允许字母、数字、点、下划线、连字符`);
  }
}

/** 某站点对应哪个配置文件。site 为空→根 .env;有值→sites/<site>.env。 */
export function envFileFor(site) {
  if (process.env.WPOPS_ENV) return process.env.WPOPS_ENV;
  if (site) return resolve(sitesDir(), `${site}.env`);
  return rootEnvFile();
}

/** 列出所有已配置站点(默认站 + sites/ 下的名字)。 */
export function listSites() {
  const sites = [];
  if (existsSync(rootEnvFile())) {
    sites.push({ name: null, label: '(default)', file: rootEnvFile() });
  }
  const dir = sitesDir();
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).sort()) {
      if (file.endsWith('.env')) {
        const name = file.slice(0, -4);
        sites.push({ name, label: name, file: resolve(dir, file) });
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

  if (!effective && !process.env.WPOPS_ENV && !existsSync(rootEnvFile())) {
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
