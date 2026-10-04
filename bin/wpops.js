#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync, rmSync, renameSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadEnv, listSites, configHome, migrateLegacyConfig } from '../lib/env.js';
import { WpError } from '../lib/client.js';
import { UsageError } from '../lib/errors.js';
import { parseArgs, isMutation } from '../lib/args.js';
import { installSkill, skillStale } from '../lib/skill.js';
import { configureOutput } from '../lib/util.js';
import { runOne } from '../lib/run.js';
import { generalHelp, groupHelp, commandsJson, usageHint } from '../lib/help.js';
import { completionWords, groupByName } from '../lib/spec.js';
import { setup } from '../lib/commands.js';

function version() {
  try {
    return JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
  } catch {
    return 'unknown';
  }
}

function printSites() {
  const sites = listSites();
  if (!sites.length) {
    console.log('还没有配置任何站点。');
    console.log('把 .env.example 复制成 sites/<名字>.env,填入该站凭据。');
    return;
  }
  console.log(`已配置 ${sites.length} 个站点:`);
  for (const s of sites) {
    let url = '(未填 WP_URL)';
    try {
      const env = loadEnv(s.name);
      if (env.WP_URL) url = env.WP_URL;
    } catch {
      url = '(读取失败)';
    }
    console.log(`  ${s.label.padEnd(16)} ${url}`);
  }
}

// ------------------------------------------------------------------ sites 管理

const SENSITIVE = /PASSWORD|SECRET|TOKEN|KEY/i;

function sitesCommand(action, rest) {
  const dir = join(configHome(), 'sites');
  switch (action) {
    case undefined:
    case 'list':
      return printSites();
    case 'show': {
      const name = rest[0];
      if (!name) throw new Error('sites show 需要站点名');
      const env = loadEnv(name);
      console.log(`站点 ${name}:`);
      for (const [key, value] of Object.entries(env)) {
        console.log(`  ${key}=${SENSITIVE.test(key) ? '***' : value}`);
      }
      return;
    }
    case 'rm': {
      const name = rest[0];
      if (!name) throw new Error('sites rm 需要站点名');
      const file = join(dir, `${name}.env`);
      if (!existsSync(file)) throw new Error(`找不到站点配置 ${file}`);
      rmSync(file);
      console.log(`✓ 已删除站点配置 ${name}`);
      return;
    }
    case 'rename': {
      const [from, to] = rest;
      if (!from || !to) throw new Error('sites rename 需要 <旧名> <新名>');
      const src = join(dir, `${from}.env`);
      const dst = join(dir, `${to}.env`);
      if (!existsSync(src)) throw new Error(`找不到站点配置 ${src}`);
      if (existsSync(dst)) throw new Error(`目标已存在 ${dst}`);
      renameSync(src, dst);
      console.log(`✓ 已重命名站点 ${from} → ${to}`);
      return;
    }
    default:
      throw new Error(`sites 未知子命令:${action}(list|show|rm|rename)`);
  }
}

// ------------------------------------------------------------------ 输出包装

/** 统一处理 --quiet / --output:抑制或把命令的人类可读输出写入文件。 */
async function withOutput(flags, fn) {
  const lines = [];
  const originalLog = console.log;
  if (flags.quiet) console.log = () => {};
  else if (flags.output) console.log = (...args) => lines.push(args.join(' '));
  try {
    return await fn();
  } finally {
    console.log = originalLog;
    if (!flags.quiet && flags.output && lines.length) {
      const file = resolve(String(flags.output));
      writeFileSync(file, lines.join('\n') + '\n', 'utf8');
      originalLog(`✓ 输出已写入 ${file}`);
    }
  }
}

// ------------------------------------------------------------------ 用法错误

/** 用法错误:stderr 打印「消息 + 精简用法 + --help 提示」,退出码 2(与运行期错误的 1 区分)。 */
function reportUsageError(err, group, action) {
  console.error(`✗ ${err.message}`);
  const lines = usageHint(group, action);
  if (lines.length) {
    console.error('用法:');
    for (const line of lines) console.error(`  ${line}`);
  }
  if (group && groupByName(group)) {
    console.error(`提示:wpops ${group} --help 查看完整用法`);
  } else {
    console.error('提示:wpops help 查看全部命令');
  }
  process.exitCode = 2;
}

// ------------------------------------------------------------------ completion

function printCompletion(shell) {
  const words = completionWords(['help']).join(' ');
  switch (shell || 'bash') {
    case 'bash':
      console.log(`# wpops bash completion(用法:eval "$(wpops completion bash)")\n_wpops() {\n  local cur="\${COMP_WORDS[COMP_CWORD]}"\n  COMPREPLY=( $(compgen -W "${words}" -- "$cur") )\n}\ncomplete -F _wpops wpops`);
      return;
    case 'zsh':
      console.log(`# wpops zsh completion(用法:eval "$(wpops completion zsh)")\n_wpops() { compadd ${words} }\ncompdef _wpops wpops`);
      return;
    case 'fish':
      console.log(`# wpops fish completion(用法:wpops completion fish | source)\ncomplete -c wpops -f -a "${words}"`);
      return;
    case 'powershell':
      console.log(`# wpops PowerShell completion(用法:wpops completion powershell | Out-String | Invoke-Expression)\nRegister-ArgumentCompleter -Native -CommandName wpops -ScriptBlock {\n  param($wordToComplete)\n  "${words}".Split(' ') | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object { [System.Management.Automation.CompletionResult]::new($_, $_, 'ParameterValue', $_) }\n}`);
      return;
    default:
      throw new Error('completion 支持:bash|zsh|fish|powershell');
  }
}

// ------------------------------------------------------------------ main

async function main() {
  const { positionals, flags } = parseArgs(process.argv.slice(2));
  const [group, action, ...rest] = positionals;

  configureOutput(flags);
  if (flags.paginate) flags['all-pages'] = true;
  if (flags.csv || flags.table || flags.fields) flags.json = true;

  if (flags.version) {
    console.log(version());
    return;
  }

  // help:wpops / wpops help [组] [动作] / wpops <组> [动作] --help
  if (!group || group === 'help' || flags.help) {
    const helpGroup = group === 'help' ? action : group;
    const helpAction = group === 'help' ? rest[0] : action;
    if (helpGroup) {
      const text = groupHelp(helpGroup, helpAction);
      if (!text) {
        console.error(`未知命令组:${helpGroup}(运行 wpops help 查看全部)`);
        process.exitCode = 1;
        return;
      }
      console.log(text);
      return;
    }
    console.log(generalHelp(version()));
    return;
  }

  // 首次运行:把旧版「包目录内」的配置迁到稳定目录,并静默刷新内置 skill。
  // best-effort;不污染 --json(提示走 stderr),--quiet 静默;测试环境跳过。
  if (!process.env.NODE_TEST_CONTEXT) {
    try {
      const moved = migrateLegacyConfig();
      if (moved && !flags.quiet) {
        console.error(
          `注意:已把 ${moved} 个旧配置从包目录迁移到 ${configHome()}(以后升级不再丢;旧文件仍在,可自行删除)`,
        );
      }
    } catch {
      // 忽略
    }
    try {
      if (skillStale()) installSkill({ quiet: true });
    } catch {
      // 忽略
    }
  }

  if (group === 'sites') {
    await withOutput(flags, () => sitesCommand(action, rest));
    return;
  }
  if (group === 'setup') {
    await setup(flags);
    return;
  }
  if (group === 'install-skill') {
    await withOutput(flags, () => {
      const dirs = installSkill();
      if (!dirs.length) {
        console.log('未安装 skill(可能已存在同名目录被跳过,或用 WPOPS_SKIP_SKILL 禁用)。');
      } else {
        for (const dir of dirs) console.log(`✓ skill 已安装到 ${dir}`);
      }
    });
    return;
  }
  if (group === 'completion') {
    await withOutput(flags, () => printCompletion(action));
    return;
  }
  if (group === 'commands') {
    await withOutput(flags, () => console.log(commandsJson(version())));
    return;
  }

  const single = flags.site || process.env.WPOPS_SITE || null;
  const named = flags.site && String(flags.site).includes(',')
    ? String(flags.site).split(',').map((s) => s.trim()).filter(Boolean)
    : [];

  let targets = null;
  if (flags.all) targets = listSites();
  else if (named.length) targets = named.map((name) => ({ name, label: name }));

  if (targets) {
    if (!targets.length) throw new Error('还没有配置任何站点');
    if (isMutation(group, action) && !flags.yes && !flags['dry-run']) {
      reportUsageError(
        new UsageError('批量执行会作用于多个站点。写操作请加 --yes 确认,或先用 --dry-run 预览。', { group, action }),
        group,
        action,
      );
      return;
    }
    let failures = 0;
    let usageError = null;
    await withOutput(flags, async () => {
      for (const target of targets) {
        try {
          await runOne(target.name, group, action, rest, flags, true);
        } catch (err) {
          if (err instanceof UsageError) {
            usageError = err; // 用法与站点无关:立即中止,不逐站重复
            return;
          }
          failures++;
          console.error(`✗ [${target.label}] ${err.message}`);
        }
      }
    });
    if (usageError) {
      reportUsageError(usageError, usageError.group || group, usageError.action ?? action);
      return;
    }
    if (failures) {
      console.error(`\n完成:${failures}/${targets.length} 个站点出错。`);
      process.exitCode = 1;
    }
    return;
  }

  try {
    await withOutput(flags, () => runOne(single, group, action, rest, flags, false));
  } catch (err) {
    if (err instanceof UsageError) {
      reportUsageError(err, err.group || group, err.action ?? action);
      return;
    }
    throw err;
  }
}

main().catch((err) => {
  if (err instanceof UsageError) {
    console.error(`✗ ${err.message}`);
    console.error('提示:wpops help 查看全部命令');
    process.exit(2);
  }
  if (err instanceof WpError) {
    console.error(`✗ ${err.message}`);
    if (err.code) console.error(`  代码:${err.code}`);
  } else {
    console.error(`✗ ${err.message}`);
  }
  process.exit(1);
});
