import { copyFileSync, existsSync, mkdirSync } from 'node:fs';
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

/** 把内置 skill 复制到发现目录,返回成功写入的目录列表。best-effort。 */
export function installSkill() {
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
      // 忽略:安装脚本不应因写 skill 失败而中断
    }
  }
  return installed;
}
