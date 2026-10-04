# wpops 安装脚本(Windows / PowerShell)
# 用法:
#   本地:   cd wpops; ./install.ps1
#   一行流: iwr -useb https://raw.githubusercontent.com/qnnp-me/wpops/main/install.ps1 | iex
# 作用: 1) 全局安装 wpops CLI  2) 安装 wpops skill 到发现路径
$ErrorActionPreference = 'Stop'

$repoUrl = 'https://github.com/qnnp-me/wpops.git'
$installDir = if ($env:WPOPS_INSTALL_DIR) { $env:WPOPS_INSTALL_DIR } else { Join-Path $env:USERPROFILE 'App\wpops' }

function Test-WpopsDir([string]$dir) {
  if (-not $dir) { return $false }
  $pkg = Join-Path $dir 'package.json'
  if (-not (Test-Path $pkg)) { return $false }
  try { return ((Get-Content $pkg -Raw | ConvertFrom-Json).name -eq 'wpops') } catch { return $false }
}

function Resolve-Source {
  if (Test-WpopsDir $PSScriptRoot) { return $PSScriptRoot }
  Write-Host '==> 获取 wpops 源码' -ForegroundColor Cyan
  if (Test-Path (Join-Path $installDir '.git')) {
    git -C $installDir pull --ff-only
  } else {
    git clone $repoUrl $installDir
  }
  return $installDir
}

$src = Resolve-Source

Write-Host '==> 全局安装 wpops CLI' -ForegroundColor Cyan
if (Get-Command pnpm -ErrorAction SilentlyContinue) {
  pnpm add -g $src
} else {
  npm install -g $src
}

Write-Host '==> 安装 wpops skill' -ForegroundColor Cyan
$target = Join-Path $env:USERPROFILE '.agents\skills\wpops'
New-Item -ItemType Directory -Force -Path $target | Out-Null
Copy-Item (Join-Path $src 'skills\wpops\SKILL.md') (Join-Path $target 'SKILL.md') -Force
Write-Host "   -> $target\SKILL.md"

Write-Host ''
Write-Host '完成。下一步:' -ForegroundColor Green
Write-Host '  wpops setup        # 交互式配置站点(问 URL / 用户名 / 应用密码)'
Write-Host '  wpops doctor       # 体检'
