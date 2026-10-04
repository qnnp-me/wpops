# AGENTS.md — 在本仓库工作

本仓库**就是 `wpops` 的源码**(WordPress REST 操作 CLI,零依赖)。本文件面向**在此 checkout 里干活的 AI/贡献者**。
面向**使用者**的说明在 `README.md` 与 `skills/wpops/SKILL.md` —— 不要混进来。

## 铁律:改这个仓库 = 跑本地代码

机器上通常还装着全局 `wpops`(npm -g 或 pnpm link)。**开发/验证一律用仓库内的本地代码**,别用全局命令:

```bash
node bin/wpops.js <组> <动作> ...      # 本地 CLI(等价于 wpops ...)
node bin/wpops.js help
npm test                               # node --test,无外部依赖
```

只有本地能跑通,才谈发版。

## 目录结构

- `bin/wpops.js` —— 入口。
- `lib/spec.js` —— **单一事实来源**:组 / 动作 / 是否写操作 / 别名。`help`、`commands --json`、`--all` 写保护、补全都由它派生。**加/改命令必须同时改 spec**,否则一致性测试会挂。
- `lib/run.js` —— 参数解析与 `dispatch`。
- `lib/commands.js` —— 大部分命令;其余按域拆分:`client.js`(HTTP)、`env.js`(站点配置)、`blocks.js`、`revisions.js`、`settings.js`、`widgets.js`、`navigation.js`、`global-styles.js`、`templates.js`、`batch.js`、`search.js` 等。
- `skills/wpops/SKILL.md` —— **随包分发的 agent skill**(发布物的一部分,改它=改发布内容)。
- `scripts/postinstall.mjs` —— 安装后把内置 skill 复制到 agent 发现目录。
- `test/` —— `node --test` 测试(当前 57 个用例)。
- `sites/<名>.env`、`.env.example` —— 站点凭据。**绝不读取/打印其中的应用密码。**

## 约定

- **零依赖**:保持 `dependencies` 为空,只用 Node 内置模块。`engines.node >= 20`。
- **退出码**:`0` 成功;`2` 用法/参数错误;`1` 运行期错误(HTTP/网络/配置)。脚本据此判断,别只看有无输出。
- **安全默认**:内容创建默认草稿;写操作先 `--dry-run`;`--all` 写操作必须 `--yes`;改已发布内容要提示(附 `revisions restore` 回滚)。
- **错误信息**:中文、简洁;用法错误附精简用法 + `wpops <组> --help` 提示。
- **行尾 LF**(见 `.gitattributes`);提交信息用 Conventional Commits(`feat:`/`fix:`/`docs:`/`chore:` …)。

## 发版

1. 更新 `package.json` 的 `version` 与 `CHANGELOG.md`(Keep a Changelog,`## [x.y.z] - YYYY-MM-DD`)。
2. `npm test` 全绿。
3. `git commit && git push`。
4. 建 release:`gh release create vX.Y.Z --title vX.Y.Z --notes-file <notes>`(说明取自 CHANGELOG);或用 `gh skill publish --tag vX.Y.Z` 顺带校验内置 skill。
5. `npm publish`(需 npm 2FA / OTP;新包可能走 staged,必要时 `npm stage approve <uuid> --otp ...`)。
6. **版本号三处一致**:`package.json` ↔ git tag ↔ npm。仓库带 `agent-skills` topic,`gh skill install qnnp-me/wpops` 会解析最新 release。

## 边界

- **agent 指令放本文件**(`AGENTS.md`)。`skills/wpops/SKILL.md` 只放"怎么用 wpops",**不要**把开发/发版说明塞进 skill —— 它会被安装到用户机器。
- 本文件不进 npm 包(`files` 白名单未含它),也不参与 `gh skill` 发现;仅在仓库内生效。
- 别把本机 `.agents/`、`sites/*.env` 等提交进仓库。
