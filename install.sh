#!/usr/bin/env sh
# wpops 安装脚本(macOS / Linux)
# 用法:
#   本地:   ./install.sh
#   一行流:  curl -fsSL https://raw.githubusercontent.com/qnnp-me/wpops/main/install.sh | sh
# 作用: 1) 全局安装 wpops CLI  2) 安装 wpops skill 到发现路径
set -eu

repo_url="https://github.com/qnnp-me/wpops.git"
install_dir="${WPOPS_INSTALL_DIR:-$HOME/App/wpops}"

is_wpops_dir() {
  [ -n "${1:-}" ] && [ -f "$1/package.json" ] && grep -q '"name"[[:space:]]*:[[:space:]]*"wpops"' "$1/package.json"
}

resolve_source() {
  script_dir="$(cd "$(dirname "$0")" 2>/dev/null && pwd || true)"
  if is_wpops_dir "$script_dir"; then
    printf '%s' "$script_dir"
    return
  fi
  echo "==> 获取 wpops 源码" >&2
  if [ -d "$install_dir/.git" ]; then
    git -C "$install_dir" pull --ff-only
  else
    git clone "$repo_url" "$install_dir"
  fi
  printf '%s' "$install_dir"
}

src="$(resolve_source)"

echo "==> 全局安装 wpops CLI"
if command -v pnpm >/dev/null 2>&1; then
  pnpm add -g "$src"
else
  npm install -g "$src"
fi

echo "==> 安装 wpops skill"
target="$HOME/.agents/skills/wpops"
mkdir -p "$target"
cp "$src/skills/wpops/SKILL.md" "$target/SKILL.md"
echo "   -> $target/SKILL.md"

echo ""
echo "完成。下一步:"
echo "  wpops setup        # 交互式配置站点"
echo "  wpops doctor       # 体检"
