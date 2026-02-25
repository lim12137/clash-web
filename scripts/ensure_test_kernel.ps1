param(
  [Parameter(Mandatory = $true)]
  [string]$CoreDir,
  [string]$Repo = "MetaCubeX/mihomo",
  [string]$Arch = "amd64",
  [switch]$ForceUpdate
)

$ErrorActionPreference = "Stop"

function Invoke-WithRetry {
  param(
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action,
    [string]$TaskName = "operation",
    [int]$MaxAttempts = 4,
    [int]$DelaySeconds = 2
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      return & $Action
    }
    catch {
      if ($attempt -ge $MaxAttempts) {
        throw
      }
      Write-Host "[kernel] $TaskName failed (attempt $attempt/$MaxAttempts), retrying..."
      Start-Sleep -Seconds $DelaySeconds
    }
  }
}

if (-not (Test-Path -LiteralPath $CoreDir)) {
  New-Item -ItemType Directory -Path $CoreDir -Force | Out-Null
}

$coreDirPath = (Resolve-Path -LiteralPath $CoreDir).Path
$binPath = Join-Path $coreDirPath "mihomo.exe"
$versionFile = Join-Path $coreDirPath "version.txt"
$assetFile = Join-Path $coreDirPath "asset.txt"
$installedVersion = ""

if (Test-Path -LiteralPath $versionFile) {
  $installedVersion = (Get-Content -Path $versionFile -TotalCount 1 | Out-String).Trim()
}

if (-not $ForceUpdate -and (Test-Path -LiteralPath $binPath) -and $installedVersion) {
  Write-Host "[kernel] use installed mihomo: $installedVersion"
  Write-Host "[kernel] skip online update check (set FORCE_UPDATE_TEST_CORE=1 to refresh)"
  exit 0
}

Write-Host "[kernel] query latest release from $Repo ..."
$release = Invoke-WithRetry -TaskName "query latest release" -Action {
  Invoke-RestMethod `
    -Uri "https://api.github.com/repos/$Repo/releases/latest" `
    -Headers @{ "User-Agent" = "clash-web-local-test" }
}

$tag = [string]$release.tag_name
$assets = @($release.assets)
$tagEscaped = [Regex]::Escape($tag)
$patterns = @(
  "^mihomo-windows-$Arch-compatible-$tagEscaped\.zip$",
  "^mihomo-windows-$Arch-$tagEscaped\.zip$",
  "^mihomo-windows-$Arch-v[0-9]+-$tagEscaped\.zip$",
  "^mihomo-windows-$Arch-.*-$tagEscaped\.zip$"
)

$selectedAsset = $null
foreach ($pattern in $patterns) {
  $selectedAsset = $assets | Where-Object { $_.name -match $pattern } | Select-Object -First 1
  if ($null -ne $selectedAsset) {
    break
  }
}

if ($null -eq $selectedAsset) {
  $selectedAsset = $assets | Where-Object { $_.name -match "^mihomo-windows-$Arch.*\.zip$" } | Select-Object -First 1
}

if ($null -eq $selectedAsset) {
  throw "No suitable Windows asset found for arch=$Arch in release $tag"
}

$assetName = [string]$selectedAsset.name
$assetUrl = [string]$selectedAsset.browser_download_url

Write-Host "[kernel] latest=$tag asset=$assetName"

$needsInstall = $ForceUpdate -or -not (Test-Path -LiteralPath $binPath) -or ($installedVersion -ne $tag)
if (-not $needsInstall) {
  Write-Host "[kernel] mihomo already up to date: $installedVersion"
  exit 0
}

$stamp = [DateTime]::UtcNow.ToString("yyyyMMddHHmmssfff")
$downloadZip = Join-Path $coreDirPath ("download-" + $stamp + "-" + $assetName)
$extractDir = Join-Path $coreDirPath ("extract-" + $stamp)

try {
  Write-Host "[kernel] downloading asset ..."
  Invoke-WithRetry -TaskName "download asset" -Action {
    Invoke-WebRequest -Uri $assetUrl -OutFile $downloadZip -UseBasicParsing
    if (-not (Test-Path -LiteralPath $downloadZip)) {
      throw "download file missing: $downloadZip"
    }
    if ((Get-Item -LiteralPath $downloadZip).Length -le 0) {
      throw "download file is empty: $downloadZip"
    }
  }

  Write-Host "[kernel] extracting asset ..."
  Expand-Archive -Path $downloadZip -DestinationPath $extractDir -Force

  $exe = Get-ChildItem -Path $extractDir -Recurse -File `
    | Where-Object { $_.Extension -ieq ".exe" -and $_.Name -match "^mihomo" } `
    | Select-Object -First 1

  if ($null -eq $exe) {
    throw "Asset extracted but no mihomo .exe found: $assetName"
  }

  Copy-Item -LiteralPath $exe.FullName -Destination $binPath -Force
  Set-Content -Path $versionFile -Value $tag -Encoding UTF8
  Set-Content -Path $assetFile -Value $assetName -Encoding UTF8
}
finally {
  if (Test-Path -LiteralPath $downloadZip) {
    Remove-Item -LiteralPath $downloadZip -Force -ErrorAction SilentlyContinue
  }
  if (Test-Path -LiteralPath $extractDir) {
    Remove-Item -LiteralPath $extractDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "[kernel] installed: $binPath"
