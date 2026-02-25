param()

$ErrorActionPreference = "Stop"

function Get-EnvOrDefault {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [string]$DefaultValue
  )

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    return $DefaultValue
  }
  return $value.Trim()
}

function Write-RunLog {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Message
  )

  $stamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
  $line = "[$stamp] $Message"
  Write-Host $line
  Add-Content -Path $script:RunLogLatest -Value $line
  Add-Content -Path $script:RunLogHistory -Value $line
}

function Run-Step {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Name,
    [Parameter(Mandatory = $true)]
    [scriptblock]$Action
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  Write-RunLog "$Name begin"
  try {
    & $Action
    $sw.Stop()
    Write-RunLog "$Name end rc=0 duration_ms=$($sw.ElapsedMilliseconds)"
  }
  catch {
    $sw.Stop()
    Write-RunLog "$Name end rc=1 duration_ms=$($sw.ElapsedMilliseconds)"
    throw
  }
}

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Resolve-Path (Join-Path $scriptDir "..")

$pythonBin = Get-EnvOrDefault -Name "PYTHON_BIN" -DefaultValue "D:\py311\python.exe"
if (-not (Test-Path -LiteralPath $pythonBin)) {
  $pythonBin = "python"
}

$scriptsDir = Get-EnvOrDefault -Name "SCRIPTS_DIR" -DefaultValue (Join-Path $projectRoot "scripts")
$testControllerPort = Get-EnvOrDefault -Name "TEST_CONTROLLER_PORT" -DefaultValue "19090"
$testMixedPort = Get-EnvOrDefault -Name "TEST_MIXED_PORT" -DefaultValue "17891"
$testSocksPort = Get-EnvOrDefault -Name "TEST_SOCKS_PORT" -DefaultValue "17892"
$testMihomoDir = Get-EnvOrDefault -Name "TEST_MIHOMO_DIR" -DefaultValue (Join-Path $projectRoot "config-test")
$testCoreDir = Get-EnvOrDefault -Name "TEST_CORE_DIR" -DefaultValue (Join-Path $projectRoot "tools\mihomo-test")
$clashDisableGeoip = Get-EnvOrDefault -Name "CLASH_DISABLE_GEOIP" -DefaultValue "1"
$forceUpdate = Get-EnvOrDefault -Name "FORCE_UPDATE_TEST_CORE" -DefaultValue "0"

New-Item -ItemType Directory -Path $testMihomoDir -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $testMihomoDir "subs") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $testMihomoDir "backups") -Force | Out-Null
New-Item -ItemType Directory -Path $testCoreDir -Force | Out-Null

$testCoreBin = Join-Path $testCoreDir "mihomo.exe"
$pidFile = Join-Path $testCoreDir "mihomo-test.pid"
$script:RunLogLatest = Join-Path $testCoreDir "start_test_kernel.latest.log"
$script:RunLogHistory = Join-Path $testCoreDir "start_test_kernel.log"

if (Test-Path -LiteralPath $script:RunLogLatest) {
  Remove-Item -LiteralPath $script:RunLogLatest -Force -ErrorAction SilentlyContinue
}

Write-RunLog "========================================"
Write-RunLog "start_test_kernel begin"
Write-RunLog "Project=$projectRoot"
Write-RunLog "Python=$pythonBin"
Write-RunLog "TEST_CORE_DIR=$testCoreDir"
Write-RunLog "TEST_MIHOMO_DIR=$testMihomoDir"
Write-RunLog "TEST_CONTROLLER_PORT=$testControllerPort"
Write-RunLog "TEST_MIXED_PORT=$testMixedPort"
Write-RunLog "TEST_SOCKS_PORT=$testSocksPort"
Write-RunLog "CLASH_DISABLE_GEOIP=$clashDisableGeoip"

Write-Host "== clash-web start test kernel =="
Write-Host "Project             : $projectRoot"
Write-Host "Python              : $pythonBin"
Write-Host "TEST_CORE_DIR       : $testCoreDir"
Write-Host "TEST_MIHOMO_DIR     : $testMihomoDir"
Write-Host "TEST_CONTROLLER_PORT: $testControllerPort"
Write-Host "TEST_MIXED_PORT     : $testMixedPort"
Write-Host "TEST_SOCKS_PORT     : $testSocksPort"
Write-Host "CLASH_DISABLE_GEOIP : $clashDisableGeoip"

$script:StartedPid = $null

try {
  Run-Step -Name "step1 ensure kernel" -Action {
    $forceArgs = @()
    if ($forceUpdate -eq "1") {
      $forceArgs = @("-ForceUpdate")
    }
    & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $scriptsDir "ensure_test_kernel.ps1") -CoreDir $testCoreDir @forceArgs
    if ($LASTEXITCODE -ne 0) {
      throw "ensure_test_kernel.ps1 failed with exit code $LASTEXITCODE"
    }
    if (-not (Test-Path -LiteralPath $testCoreBin)) {
      throw "missing test kernel binary: $testCoreBin"
    }
  }

  Run-Step -Name "step2 stop kernel" -Action {
    & cmd /c (Join-Path $scriptsDir "stop_test_kernel.bat")
    if ($LASTEXITCODE -ne 0) {
      throw "stop_test_kernel.bat failed with exit code $LASTEXITCODE"
    }
  }

  Run-Step -Name "step3 merge config" -Action {
    $env:MIHOMO_DIR = $testMihomoDir
    $env:CLASH_EXTERNAL_CONTROLLER = "0.0.0.0:$testControllerPort"
    $env:CLASH_MIXED_PORT = $testMixedPort
    $env:CLASH_SOCKS_PORT = $testSocksPort
    $env:CLASH_DISABLE_GEOIP = $clashDisableGeoip

    & $pythonBin (Join-Path $scriptsDir "merge.py") merge
    if ($LASTEXITCODE -ne 0) {
      throw "merge.py failed with exit code $LASTEXITCODE"
    }
  }

  Run-Step -Name "step4 start process" -Action {
    $process = Start-Process -FilePath $testCoreBin -ArgumentList "-d", $testMihomoDir -WorkingDirectory $testMihomoDir -PassThru -WindowStyle Hidden
    $script:StartedPid = $process.Id
    Set-Content -Path $pidFile -Value $script:StartedPid -Encoding ASCII
    Write-Host "  started pid $script:StartedPid"
  }

  Run-Step -Name "step5 wait api" -Action {
    if ($null -eq $script:StartedPid) {
      throw "test kernel pid is empty"
    }

    $deadline = (Get-Date).AddSeconds(15)
    $ok = $false
    while ((Get-Date) -lt $deadline) {
      if (-not (Get-Process -Id $script:StartedPid -ErrorAction SilentlyContinue)) {
        throw "test kernel process exited before API became healthy"
      }
      try {
        Invoke-RestMethod -Uri "http://127.0.0.1:$testControllerPort/version" -TimeoutSec 1 | Out-Null
        $ok = $true
        break
      }
      catch {
        Start-Sleep -Milliseconds 300
      }
    }
    if (-not $ok) {
      throw "test kernel API did not become healthy on port $testControllerPort"
    }
  }

  Write-Host ""
  Write-Host "Test kernel is ready."
  Write-Host "Controller: http://127.0.0.1:$testControllerPort"
  Write-Host "HTTP proxy: 127.0.0.1:$testMixedPort"
  Write-Host "SOCKS proxy: 127.0.0.1:$testSocksPort"
  Write-RunLog "start_test_kernel end success"
  exit 0
}
catch {
  Write-Host $_.Exception.Message
  Write-RunLog "start_test_kernel end failed: $($_.Exception.Message)"
  exit 1
}
