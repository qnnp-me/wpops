# wpops 安装脚本(Windows / PowerShell)
# 做两件事:1) 全局安装 wpops CLI  2) 安装 wpops skill 到发现路径
$ErrorActionPreference = 'Stop'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "==> 全局安装 wpops CLI" -ForegroundColor Cyan
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
  pnpm add -g $here
} else {
  npm install -g $here
}

Write-Host "==> 安装 wpops skill" -ForegroundColor Cyan
$target = Join-Path $env:USERPROFILE ".agents\skills\wpops"
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item (Join-Path $here "skills\wpops\SKILL.md") (Join-Path $target "SKILL.md") -Force
Write-Host "   -> $target\SKILL.md"

Write-Host ""
Write-Host "完成。下一步:" -ForegroundColor Green
Write-Host "  1) 新建 sites 目录:   New-Item -ItemType Directory -Force '$here\sites'"
Write-Host "  2) 复制 .env.example 为 sites\<名字>.env 并填入凭据"
Write-Host "  3) 体检:             wpops doctor"
