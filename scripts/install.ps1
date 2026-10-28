#Requires -Version 5.1
[CmdletBinding()]
param(
  [switch]$DryRun,
  [switch]$NoLaunch
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"
$repository = "https://github.com/Samuel-Urrego/Nix.git"
$releaseOwner = "Samuel-Urrego"
$releaseRepository = "Nix"

function Stop-WithError([string]$Code, [string]$Message) {
  throw "${Code}: $Message"
}

function Require-Command([string]$Name, [string]$Code, [string]$InstallHint) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Stop-WithError $Code "$Name is required. $InstallHint"
  }
}

function Get-LatestReleaseTag {
  $raw = & git ls-remote --tags --refs --sort=-v:refname $repository "refs/tags/v*" 2>$null
  if ($LASTEXITCODE -ne 0) { return $null }
  $line = @($raw) | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -First 1
  if ($null -eq $line) { return $null }
  $ref = ($line -split '\s+')[1]
  if ([string]::IsNullOrWhiteSpace($ref)) { return $null }
  $tag = $ref -replace '^refs/tags/', ''
  $version = $tag -replace '^v', ''
  if ([string]::IsNullOrWhiteSpace($version)) { return $null }
  return [pscustomobject]@{ Tag = $tag; Version = $version }
}

$tarball = $null

try {
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
  Write-Host "Release:    latest v* tag, installed from its prebuilt release artifact"
  Write-Host "Resolve:    git ls-remote --tags --refs --sort=-v:refname $repository refs/tags/v*"
  Write-Host "Asset:      https://github.com/$releaseOwner/$releaseRepository/releases/download/<tag>/nix-ai-stack-<version>.tgz"
  Write-Host "Node.js:    v$nodeVersionText"
  Write-Host "npm:        v$npmVersionText"
  Write-Host "Install:    $installPrefix (current user; no administrator access)"
  Write-Host "Next:       launch the Nix configuration TUI after installation"

  if ($DryRun) {
    Write-Host "[dry run] Would resolve the latest tag, download its nix-ai-stack-<version>.tgz asset, then run: npm install --global --prefix $installPrefix --ignore-scripts <tarball>" -ForegroundColor Yellow
    Write-Host "[dry run] No release artifact is downloaded and no lifecycle script is executed." -ForegroundColor Yellow
    return
  }

  $release = Get-LatestReleaseTag
  if ($null -eq $release) {
    Stop-WithError "NIX-INST-015" "No release tag matching v* was found in '$repository'. Confirm the repository is reachable and at least one release tag exists, then retry."
  }
  $tag = $release.Tag
  $version = $release.Version
  $assetName = "nix-ai-stack-$version.tgz"
  $assetUrl = "https://github.com/$releaseOwner/$releaseRepository/releases/download/$tag/$assetName"

  Write-Host ""
  Write-Host "Latest tag: $tag" -ForegroundColor Cyan
  Write-Host "Artifact:   $assetUrl"

  $tarball = Join-Path ([System.IO.Path]::GetTempPath()) "nix-ai-stack-$version-$([guid]::NewGuid().ToString('N').Substring(0, 8)).tgz"
  Write-Host ""
  Write-Host "Downloading the prebuilt release artifact..." -ForegroundColor Cyan
  try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $assetUrl -OutFile $tarball -UseBasicParsing
  } catch {
    Stop-WithError "NIX-INST-016" "Could not download the '$tag' release artifact from '$assetUrl'. Check network access and confirm the asset exists for that tag, then retry."
  }
  if (-not (Test-Path -LiteralPath $tarball -PathType Leaf)) {
    Stop-WithError "NIX-INST-016" "The '$tag' release artifact was not written to '$tarball'. Check network access and retry."
  }

  $npmArgs = @("install", "--global", "--prefix", $installPrefix, "--ignore-scripts", $tarball)

  Write-Host ""
  Write-Host "Installing Nix $version with --ignore-scripts..." -ForegroundColor Cyan
  try { & npm @npmArgs } catch {
    Stop-WithError "NIX-INST-010" "npm could not run the Nix installation. Check network access, npm configuration, and the downloaded artifact, then retry."
  }
  if ($LASTEXITCODE -ne 0) {
    Stop-WithError "NIX-INST-010" "npm could not install Nix (exit code $LASTEXITCODE). Check network access and npm configuration, then retry."
  }

  $cliPath = Join-Path $installPrefix "nix-ai.cmd"
  if (-not (Test-Path -LiteralPath $cliPath -PathType Leaf)) {
    Stop-WithError "NIX-INST-011" "npm completed, but the Nix CLI shim was not found at '$cliPath'. The '$tag' artifact may be incomplete; retry the installation."
  }

  try { $installedVersion = (& $cliPath --version | Out-String).Trim() } catch {
    Stop-WithError "NIX-INST-017" "The Nix CLI was installed at '$cliPath' but could not report its version. Remove that folder and retry."
  }
  if ($installedVersion -ne $version) {
    Stop-WithError "NIX-INST-017" "The installed CLI reports version '$installedVersion' but the '$tag' release is '$version'. Remove '$installPrefix' and retry."
  }
  Write-Host "Installed Nix $installedVersion." -ForegroundColor Green

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
} finally {
  if (-not [string]::IsNullOrWhiteSpace($tarball) -and (Test-Path -LiteralPath $tarball)) {
    Remove-Item -LiteralPath $tarball -Force -ErrorAction SilentlyContinue
  }
}
