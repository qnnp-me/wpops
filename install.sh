#!/usr/bin/env sh
# wpops 安装脚本(macOS / Linux)
# 做两件事:1) 全局安装 wpops CLI  2) 安装 wpops skill 到发现路径
set -eu
here="$(cd "$(dirname "$0")" && pwd)"

echo "==> 全局安装 wpops CLI"
if command -v pnpm >/dev/null 2>&1; then
  pnpm add -g "$here"
else
  npm install -g "$here"
fi

echo "==> 安装 wpops skill"
target="$HOME/.agents/skills/wpops"
mkdir -p "$target"
cp "$here/skills/wpops/SKILL.md" "$target/SKILL.md"
echo "   -> $target/SKILL.md"

echo ""
echo "完成。下一步:"
echo "  1) mkdir -p '$here/sites'"
echo "  2) 复制 .env.example 为 sites/<名字>.env 并填入凭据"
echo "  3) wpops doctor"
