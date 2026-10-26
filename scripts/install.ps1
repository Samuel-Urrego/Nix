#Requires -Version 5.1
[CmdletBinding()]
param(
  [ValidatePattern('^[A-Za-z0-9][A-Za-z0-9._/-]*$')]
  [string]$Ref = "main",
  [switch]$DryRun,
  [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"
$repository = "https://github.com/Samuel-Urrego/Nix.git"
$package = "git+https://github.com/Samuel-Urrego/Nix.git#$Ref"
$installPrefix = Join-Path $env:LOCALAPPDATA "Programs\Nix AI Stack\npm"

function Stop-WithError([string]$Message) {
  Write-Host "[error] $Message" -ForegroundColor Red
  throw $Message
}

function Require-Command([string]$Name, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Stop-WithError "$Name is required. $InstallHint"
  }
}

Require-Command "node" "Install Node.js 20.11 or newer, then rerun this installer."
Require-Command "npm" "Install Node.js with npm, then rerun this installer."
Require-Command "git" "Install Git for Windows, then rerun this installer."

$npmVersionText = (& npm --version).Trim()
try { $npmVersion = [version]$npmVersionText } catch { Stop-WithError "Could not parse npm version '$npmVersionText'." }

$nodeVersionText = (& node --version).Trim().TrimStart("v")
try { $nodeVersion = [version]$nodeVersionText } catch { Stop-WithError "Could not parse Node.js version '$nodeVersionText'." }
if ($nodeVersion -lt [version]"20.11.0") {
  Stop-WithError "Node.js 20.11 or newer is required; found v$nodeVersionText."
}

Write-Host "Nix AI Stack installer" -ForegroundColor Cyan
Write-Host "Repository: $repository"
Write-Host "Ref:        $Ref"
Write-Host "Node.js:    v$nodeVersionText"
Write-Host "npm:        v$npmVersionText"
Write-Host "Install:    $installPrefix (current user; no administrator access)"
Write-Host "Next:       launch the Nix configuration TUI after installation"

$npmArgs = @("install", "--global", "--prefix", $installPrefix, "--foreground-scripts")
if ($npmVersion.Major -ge 11) { $npmArgs += @("--allow-scripts", "nix-ai-stack") }
$npmArgs += $package

if ($DryRun) {
  Write-Host "[dry run] Would run: npm $($npmArgs -join ' ')" -ForegroundColor Yellow
  return
}

Write-Host ""
Write-Host "Installing Nix from the configured Git repository..." -ForegroundColor Cyan
& npm @npmArgs
if ($LASTEXITCODE -ne 0) { Stop-WithError "npm could not install Nix. Check network access, Git, and the Node.js version, then retry." }

$cliPath = Join-Path $installPrefix "nix-ai.cmd"
if (-not (Test-Path -LiteralPath $cliPath -PathType Leaf)) {
  Stop-WithError "Nix installed, but its CLI shim was not found at '$cliPath'. Check npm's global prefix."
}

$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
$prefixPresent = @($userPath -split ";" | ForEach-Object { $_.Trim().TrimEnd("\") }) -contains $installPrefix.TrimEnd("\")
if (-not $prefixPresent) {
  $answer = Read-Host "Add Nix's command folder to your user PATH? (y/N)"
  if ($answer.Trim().ToLowerInvariant() -eq "y") {
    $nextUserPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $installPrefix } else { "$userPath;$installPrefix" }
    [Environment]::SetEnvironmentVariable("Path", $nextUserPath, "User")
    $env:Path = "$env:Path;$installPrefix"
    Write-Host "Added Nix's command folder to your user PATH. Open a new terminal to use nix-ai everywhere." -ForegroundColor Green
  } else {
    Write-Host "Skipped the PATH change. Nix will launch by its full path in this session: $cliPath" -ForegroundColor Yellow
  }
}

if (-not $NoLaunch) {
  Write-Host ""
  Write-Host "Nix is installed. Configure agents, skills, commands, and optional integrations in the TUI." -ForegroundColor Green
  & $cliPath
  if ($LASTEXITCODE -ne 0) { throw "The Nix TUI exited with code $LASTEXITCODE." }
}
