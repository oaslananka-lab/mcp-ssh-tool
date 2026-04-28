param(
  [string]$InventoryFile = "$(Split-Path -Parent $PSScriptRoot)\.doppler\secrets.txt"
)

$ErrorActionPreference = "Stop"
$dopplerProject = if ($env:DOPPLER_PROJECT) { $env:DOPPLER_PROJECT } else { "all" }
$dopplerConfig = if ($env:DOPPLER_CONFIG) { $env:DOPPLER_CONFIG } else { "main" }
$allowOffline = $env:ALLOW_DOPPLER_OFFLINE -eq "1"
$liveCheck = if ($env:DOPPLER_LIVE_CHECK) { $env:DOPPLER_LIVE_CHECK } else { "1" }

if (-not (Test-Path -LiteralPath $InventoryFile)) {
  throw "Missing Doppler inventory: $InventoryFile"
}

$requiredSecrets = Get-Content -LiteralPath $InventoryFile |
  Where-Object { $_ -and ($_ -notmatch '^\s*#') } |
  ForEach-Object { $_.Trim() }

if ($requiredSecrets.Count -eq 0) {
  throw "Doppler inventory has no required secrets."
}

if ($allowOffline -and $liveCheck -ne "1") {
  Write-Host "Doppler live verification disabled; validated inventory only."
  $requiredSecrets | ForEach-Object { Write-Host "  - $_" }
  exit 0
}

$doppler = Get-Command doppler -ErrorAction SilentlyContinue
if (-not $doppler) {
  if ($allowOffline) {
    Write-Host "Doppler CLI is not installed; validated inventory only."
    $requiredSecrets | ForEach-Object { Write-Host "  - $_" }
    exit 0
  }

  throw "Doppler CLI is required for live secret verification."
}

$missing = $false
foreach ($secretName in $requiredSecrets) {
  & doppler secrets get $secretName --plain --project $dopplerProject --config $dopplerConfig *> $null
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Verified Doppler secret: $secretName"
  } else {
    Write-Error "Missing Doppler secret: $secretName"
    $missing = $true
  }
}

if ($missing) {
  exit 1
}
