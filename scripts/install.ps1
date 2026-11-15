<#
.SYNOPSIS
  omnichat-agent 一键安装脚本（Windows）。

.DESCRIPTION
  检测环境 → 安装依赖 → 生成 config.json → 安装 DSH preset/MCP → 启动 → 自检。
  需要人工的三件事会停下提示：登录 DSH、安装并扫码登录 SnowLuma、提供 QQ 号。
  失败即停（非 0 退出码），不跳步。

.PARAMETER QQ
  你的 QQ 号（只填数字）。不传时：已有 config.json 就沿用，否则交互式询问。

.PARAMETER Profile
  DSH profile 名。不传时自动探测：优先 desktop，其次 profile 目录里的第一个。

.PARAMETER SkipStart
  只配置，不启动 start.bat。

.PARAMETER SkipInstall
  跳过 npm install（依赖已装时用于提速）。

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File scripts\install.ps1 -QQ 123456789 -Profile desktop
#>
param(
  [string]$QQ = '',
  [string]$Profile = '',
  [switch]$SkipStart,
  [switch]$SkipInstall
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Step([string]$title) { Write-Host "`n== $title ==" -ForegroundColor Cyan }
function Ok([string]$msg) { Write-Host "  [OK] $msg" -ForegroundColor Green }
function Warn([string]$msg) { Write-Host "  [WARN] $msg" -ForegroundColor Yellow }
function Fail([string]$msg) { Write-Host "  [FAIL] $msg" -ForegroundColor Red; exit 1 }
function WriteUtf8NoBom([string]$path, [string]$content) {
  $utf8 = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($path, $content, $utf8)
}

# 0. 仓库根
if (-not (Test-Path (Join-Path $root 'package.json'))) {
  Fail '当前不在仓库根（缺 package.json）。请用仓库里的 scripts\install.ps1 运行。'
}
if (-not (Test-Path (Join-Path $root 'config.example.json'))) {
  Fail '缺 config.example.json，仓库不完整。'
}

# 1. Node
Step '检查 Node.js'
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if (-not $nodeCmd) {
  # 与 start.bat 一致：优先使用 DSH 自带的运行时，免装全局 Node
  $dshNodeBin = Join-Path $env:USERPROFILE '.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin'
  if (Test-Path (Join-Path $dshNodeBin 'node.exe')) {
    $env:PATH = "$dshNodeBin;$env:PATH"
    Ok "使用 DSH 自带 Node：$dshNodeBin"
    $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  }
}
if (-not $nodeCmd) {
  Fail '未找到 node。安装 Node 22.13+，或把 DSH 自带 node 目录放进 PATH 后重跑。'
}
$nodeVersion = (& node -v).Trim()
$parts = $nodeVersion.TrimStart('v').Split('.')
$major = [int]$parts[0]
$minor = [int]$parts[1]
if ($major -lt 22 -or ($major -eq 22 -and $minor -lt 13)) {
  Fail "Node $nodeVersion 太低，需要 22.13+。"
}
Ok "Node $nodeVersion"

# 2. 依赖
Step '安装依赖'
if ((-not $SkipInstall) -and (-not (Test-Path (Join-Path $root 'node_modules\@snowluma\sdk')))) {
  if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Fail '未找到 npm：请安装 Node 22.13+ 后重跑。'
  }
  & npm install
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path (Join-Path $root 'node_modules\@snowluma\sdk'))) {
    Fail 'npm install 失败（网络/权限/版本）。可重试一次；仍失败按 SETUP_WITH_AI.md 第 7 节处理。'
  }
}
Ok '依赖就绪'

# 3. config.json
Step '准备 config.json'
$cfgFile = Join-Path $root 'config.json'
if (-not (Test-Path $cfgFile)) {
  Copy-Item (Join-Path $root 'config.example.json') $cfgFile
  Ok '已从 config.example.json 生成 config.json'
}
try {
  $cfg = Get-Content $cfgFile -Raw -Encoding UTF8 | ConvertFrom-Json
} catch {
  Fail "config.json 不是合法 JSON：$($_.Exception.Message)"
}
if (-not $QQ) {
  if ($cfg.ownerQQ) { $QQ = [string]$cfg.ownerQQ }
  else { $QQ = Read-Host '输入你的 QQ 号（只填数字，决定谁能指挥机器人）' }
}
if ($QQ -match '^\d{5,12}$') {
  $cfg.ownerQQ = [long]$QQ
  $json = ($cfg | ConvertTo-Json -Depth 24)
  WriteUtf8NoBom $cfgFile ($json + "`n")
  Ok "ownerQQ = $QQ"
} else {
  Warn 'QQ 号格式不对（应为 5-12 位数字），保留原值；请手动改 config.json 的 ownerQQ'
}

# 4. SnowLuma
Step '检查 SnowLuma'
$p3000 = $false
$p3001 = $false
try { $p3000 = (Test-NetConnection -ComputerName 127.0.0.1 -Port 3000 -WarningAction SilentlyContinue).TcpTestSucceeded } catch {}
try { $p3001 = (Test-NetConnection -ComputerName 127.0.0.1 -Port 3001 -WarningAction SilentlyContinue).TcpTestSucceeded } catch {}
if ($p3000 -and $p3001) {
  Ok 'OneBot HTTP 3000 / WS 3001 在监听'
} else {
  Warn 'SnowLuma 端口未就绪：先安装并扫码登录 SnowLuma，开启 OneBot HTTP(3000) 与 WS(3001)，再重跑本脚本。'
}

# 5. profile
Step '探测 DSH profile'
$profilesDir = Join-Path $env:USERPROFILE '.dsh\profiles'
if (-not $Profile) {
  $names = @()
  if (Test-Path $profilesDir) {
    $names = @(Get-ChildItem $profilesDir -Directory | Select-Object -ExpandProperty Name)
  }
  if ($names -contains 'desktop') { $Profile = 'desktop' }
  elseif ($names.Count -gt 0) { $Profile = $names[0] }
  else { Fail '找不到 DSH profile。先打开并登录一次 DSH，再重跑本脚本。' }
}
Ok "profile = $Profile（setup-dsh.mjs 用位置参数，不是 --profile）"

# 6. setup-dsh
Step '安装 DSH preset / MCP'
& node scripts/setup-dsh.mjs $Profile
if ($LASTEXITCODE -ne 0) {
  Fail 'setup-dsh 失败。看输出；仍不行按 SETUP_WITH_AI.md 第 7 节第 6 条。'
}
Ok 'preset / MCP 已安装（必须重启 DSH 才生效）'

# 7. 启动
if (-not $SkipStart) {
  Step '启动桥接'
  if (-not (Test-Path (Join-Path $root 'start.bat'))) { Fail '缺 start.bat。' }
  Start-Process -FilePath (Join-Path $root 'start.bat') -WorkingDirectory $root
  Ok '已在新窗口启动 start.bat'
}

# 8. 自检
Step '最终自检'
& node scripts/verify-setup.mjs
if ($LASTEXITCODE -ne 0) {
  Warn '自检未全绿：按上面输出逐项处理；若只是 DSH 刚重启导致「事件流 0 帧」，等 30 秒会自愈。'
} else {
  Ok '全部就绪'
}

Write-Host "`n下一步：如果 DSH 还没重启，先完全退出再打开；然后在 QQ 私聊机器人发一句话测试。" -ForegroundColor Cyan
