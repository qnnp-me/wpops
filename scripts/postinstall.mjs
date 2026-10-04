// postinstall:把内置 skill 装到 agent 的发现目录(装完即复制)。
// 任何失败都不应中断安装本身。
import { installSkill } from '../lib/skill.js';

try {
  const installed = installSkill();
  if (installed.length) {
    for (const dir of installed) console.log(`wpops: skill 已安装到 ${dir}`);
  } else {
    console.log('wpops: 未自动安装 skill(可运行 `wpops install-skill` 手动安装)');
  }
} catch {
  // 静默:postinstall 出错不影响安装
}
