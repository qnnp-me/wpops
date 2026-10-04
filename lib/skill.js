import { copyFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** 内置 skill 的源文件路径。 */
export function skillSource() {
  return join(pkgRoot, 'skills', 'wpops', 'SKILL.md');
}

/** skill 要安装到的目录(可通过 WPOPS_SKILL_DIR 覆盖)。 */
export function skillTargets() {
  const targets = [];
  if (process.env.WPOPS_SKILL_DIR) targets.push(resolve(process.env.WPOPS_SKILL_DIR));
  targets.push(join(homedir(), '.agents', 'skills', 'wpops'));
  return targets;
}

/**
 * 把内置 skill 复制到发现目录,返回成功写入的目录列表。best-effort。
 * `quiet` 目前只是语义标记(本函数不打印);保留以便调用方统一传参。
 */
export function installSkill({ quiet = false } = {}) {
  void quiet;
  if (process.env.WPOPS_SKIP_SKILL) return [];
  const src = skillSource();
  const installed = [];
  if (!existsSync(src)) return installed;
  for (const dir of skillTargets()) {
    try {
      mkdirSync(dir, { recursive: true });
      copyFileSync(src, join(dir, 'SKILL.md'));
      installed.push(dir);
    } catch {
      // 忽略:安装 skill 失败不应中断命令
    }
  }
  return installed;
}

/**
 * 已安装的 skill 是否缺失或与内置版本不一致(用于启动时静默刷新)。
 * 只比对 SKILL.md;任一目标缺失/内容不同即认为需要刷新。
 */
export function skillStale() {
  if (process.env.WPOPS_SKIP_SKILL) return false;
  const src = skillSource();
  if (!existsSync(src)) return false;
  let want;
  try {
    want = readFileSync(src, 'utf8');
  } catch {
    return false;
  }
  for (const dir of skillTargets()) {
    const file = join(dir, 'SKILL.md');
    try {
      if (!existsSync(file) || readFileSync(file, 'utf8') !== want) return true;
    } catch {
      return true;
    }
  }
  return false;
}
