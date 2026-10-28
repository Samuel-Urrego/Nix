#Requires -Version 5.1
[CmdletBinding()]
param(
  [string]$Ref = "main",
  [switch]$DryRun,
  [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"
$repository = "https://github.com/Samuel-Urrego/Nix.git"
$package = "git+https://github.com/Samuel-Urrego/Nix.git#$Ref"

function Stop-WithError([string]$Code, [string]$Message) {
  throw "${Code}: $Message"
}

function Require-Command([string]$Name, [string]$Code, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Stop-WithError $Code "$Name is required. $InstallHint"
  }
}

try {
  if ($Ref -notmatch '^[A-Za-z0-9][A-Za-z0-9._/-]*$') {
    Stop-WithError "NIX-INST-015" "The selected ref is invalid. Use a branch or tag name containing only letters, numbers, dots, underscores, hyphens, or slashes."
  }

  if ([string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
    Stop-WithError "NIX-INST-009" "Windows did not provide LOCALAPPDATA, so the user install folder could not be determined."
  }
  $installPrefix = Join-Path $env:LOCALAPPDATA "Programs\Nix AI Stack\npm"

  Require-Command "node" "NIX-INST-001" "Install Node.js 20.11 or newer, then rerun this installer."
  Require-Command "npm" "NIX-INST-002" "Install Node.js with npm, then rerun this installer."
  Require-Command "git" "NIX-INST-003" "Install Git for Windows, then rerun this installer."

  try { $npmVersionText = (& npm --version).Trim() } catch {
    Stop-WithError "NIX-INST-004" "Could not run npm to read its version. Reinstall Node.js with npm and retry."
  }
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($npmVersionText)) {
    Stop-WithError "NIX-INST-004" "npm could not report its version. Reinstall Node.js with npm and retry."
  }
  try { $npmVersion = [version]$npmVersionText } catch {
    Stop-WithError "NIX-INST-005" "Could not parse npm version '$npmVersionText'. Reinstall Node.js with a supported npm version."
  }

  try { $nodeVersionText = (& node --version).Trim().TrimStart("v") } catch {
    Stop-WithError "NIX-INST-006" "Could not run Node.js to read its version. Install Node.js 20.11 or newer and retry."
  }
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($nodeVersionText)) {
    Stop-WithError "NIX-INST-006" "Node.js could not report its version. Reinstall Node.js 20.11 or newer and retry."
  }
  try { $nodeVersion = [version]$nodeVersionText } catch {
    Stop-WithError "NIX-INST-007" "Could not parse Node.js version '$nodeVersionText'. Install Node.js 20.11 or newer and retry."
  }
  if ($nodeVersion -lt [version]"20.11.0") {
    Stop-WithError "NIX-INST-008" "Node.js 20.11 or newer is required; found v$nodeVersionText."
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
  try { & npm @npmArgs } catch {
    Stop-WithError "NIX-INST-010" "npm could not run the Nix installation. Check network access, Git, and npm configuration, then retry."
  }
  if ($LASTEXITCODE -ne 0) {
    Stop-WithError "NIX-INST-010" "npm could not install Nix (exit code $LASTEXITCODE). Check network access, Git, and npm configuration, then retry."
  }

  $cliPath = Join-Path $installPrefix "nix-ai.cmd"
  if (-not (Test-Path -LiteralPath $cliPath -PathType Leaf)) {
    Stop-WithError "NIX-INST-011" "npm completed, but the Nix CLI shim was not found at '$cliPath'. Check npm's global prefix and retry."
  }

  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  $prefixPresent = @($userPath -split ";" | ForEach-Object { $_.Trim().TrimEnd("\") }) -contains $installPrefix.TrimEnd("\")
  if (-not $prefixPresent) {
    $answer = Read-Host "Add Nix's command folder to your user PATH? (y/N)"
    if ($answer.Trim().ToLowerInvariant() -eq "y") {
      try {
        $nextUserPath = if ([string]::IsNullOrWhiteSpace($userPath)) { $installPrefix } else { "$userPath;$installPrefix" }
        [Environment]::SetEnvironmentVariable("Path", $nextUserPath, "User")
        $env:Path = "$env:Path;$installPrefix"
      } catch {
        Stop-WithError "NIX-INST-012" "Could not update the user PATH. Add '$installPrefix' to your user PATH manually if you want to run nix-ai from a new terminal."
      }
      Write-Host "Added Nix's command folder to your user PATH. Open a new terminal to use nix-ai everywhere." -ForegroundColor Green
    } else {
      Write-Host "Skipped the PATH change. Nix will launch by its full path in this session: $cliPath" -ForegroundColor Yellow
    }
  }

  if (-not $NoLaunch) {
    Write-Host ""
    Write-Host "Nix is installed. Configure agents, skills, commands, and optional integrations in the TUI." -ForegroundColor Green
    try { & $cliPath } catch {
      Stop-WithError "NIX-INST-013" "Nix was installed, but its TUI could not be launched from '$cliPath'. Try running that path directly."
    }
    if ($LASTEXITCODE -ne 0) { Stop-WithError "NIX-INST-014" "The Nix TUI exited with code $LASTEXITCODE." }
  }
} catch {
  $errorMessage = $_.Exception.Message
  if ($errorMessage -match '^NIX-INST-\d{3}:') {
    Write-Host "[installer error] $errorMessage" -ForegroundColor Red
  } else {
    Write-Host "[installer error] NIX-INST-999: An unexpected failure occurred. Share this code and the full error details: $errorMessage" -ForegroundColor Red
  }
  throw
}
