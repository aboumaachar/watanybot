[CmdletBinding()]
param(
  [string]$ProjectRoot = "C:\xampp\htdocs\projectx\watanybot",
  [string]$GatewayBaseUrl = "http://127.0.0.1:8010",
  [string]$WhatsAppAccountNumber = "+96181396332",
  [string]$WhatsAppReceiverNumber = "+9613156789",
  [string]$WhatsAppPhoneNumberId = "",
  [switch]$IncludeBehaviorPack,
  [switch]$OpenReport,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

function Convert-SecureStringToPlainText {
  param([Parameter(Mandatory = $true)][Security.SecureString]$SecureString)

  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($SecureString)
  try {
    return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  } finally {
    if ($ptr -ne [IntPtr]::Zero) {
      [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
    }
  }
}

function Resolve-RequiredValue {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [string]$CurrentValue = "",
    [string]$Prompt = "",
    [switch]$Secret,
    [switch]$AllowPlaceholder
  )

  if (-not [string]::IsNullOrWhiteSpace($CurrentValue)) {
    return $CurrentValue.Trim()
  }

  if ($DryRun -and $AllowPlaceholder) {
    return "<$Name>"
  }

  if ($Secret) {
    $secure = Read-Host -Prompt $Prompt -AsSecureString
    return (Convert-SecureStringToPlainText -SecureString $secure).Trim()
  }

  return (Read-Host -Prompt $Prompt).Trim()
}

function Get-RepoGatewayProcess {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [int]$Port = 8010
  )

  $listener = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -First 1
  if (-not $listener) {
    return $null
  }

  $process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)" -ErrorAction SilentlyContinue
  if (-not $process) {
    return [pscustomobject]@{
      IsRepoGateway = $false
      Port = $Port
      Process = $null
      CommandLine = ""
    }
  }

  $commandLine = [string]$process.CommandLine
  $isRepoGateway =
    $process.Name -match '^node(\.exe)?$' -and
    $commandLine -match [regex]::Escape($Root) -and
    $commandLine -match 'src[\\/]+server\.ts'

  return [pscustomobject]@{
    IsRepoGateway = $isRepoGateway
    Port = $Port
    Process = $process
    CommandLine = $commandLine
  }
}

function Stop-RepoGatewayProcess {
  param([Parameter(Mandatory = $true)][string]$Root)

  $repoGateway = Get-RepoGatewayProcess -Root $Root
  if (-not $repoGateway) {
    return $false
  }

  if (-not $repoGateway.IsRepoGateway) {
    throw "Port 8010 is already in use by a non-repo process. Stop it manually before running live proof."
  }

  Stop-Process -Id $repoGateway.Process.ProcessId -Force -ErrorAction Stop
  return $true
}

function Get-LatestReport {
  param(
    [Parameter(Mandatory = $true)][string]$Root,
    [Parameter(Mandatory = $true)][string]$PhaseFolder,
    [Parameter(Mandatory = $true)][string]$Pattern
  )

  $phaseRoot = Join-Path $Root $PhaseFolder
  if (-not (Test-Path $phaseRoot)) {
    return $null
  }

  return Get-ChildItem -Path $phaseRoot -Recurse -File -Filter $Pattern -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First 1
}

function Invoke-ProofScript {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string]$Name,
    [Parameter(Mandatory = $true)][string]$ProjectRoot,
    [Parameter(Mandatory = $true)][string]$GatewayBaseUrl,
    [string]$PhoneNumber = "",
    [switch]$OpenReport
  )

  $arguments = @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $Path,
    "-ProjectRoot", $ProjectRoot,
    "-GatewayBaseUrl", $GatewayBaseUrl
  )
  if (-not [string]::IsNullOrWhiteSpace($PhoneNumber)) {
    $arguments += @("-PhoneNumber", $PhoneNumber)
  }
  if ($OpenReport) {
    $arguments += "-OpenReport"
  }

  Write-Host ""
  Write-Host "Running $Name..." -ForegroundColor Cyan
  & powershell @arguments
  if ($LASTEXITCODE -ne 0) {
    throw "$Name failed with exit code $LASTEXITCODE"
  }
}

$root = [IO.Path]::GetFullPath($ProjectRoot)
if (-not (Test-Path $root)) {
  throw "ProjectRoot not found: $root"
}

$phase8bScript = Join-Path $env:USERPROFILE "Downloads\APEX-WatanyBot-Phase8B-Fix-StrictOtpEndpointProofOnly-V1.ps1"
$phase8cScript = Join-Path $env:USERPROFILE "Downloads\APEX-WatanyBot-Phase8C-OtpBehaviorProofPack-V1.ps1"
$phase8dScript = Join-Path $env:USERPROFILE "Downloads\APEX-WatanyBot-Phase8D-DevDeliverySignoff-V1.ps1"

foreach ($path in @($phase8bScript, $phase8dScript)) {
  if (-not (Test-Path $path)) {
    throw "Required proof script not found: $path"
  }
}
if ($IncludeBehaviorPack -and -not (Test-Path $phase8cScript)) {
  throw "Phase 8C proof script not found: $phase8cScript"
}

$whatsAppPhoneNumberId = Resolve-RequiredValue `
  -Name "WHATSAPP_PHONE_NUMBER_ID" `
  -CurrentValue $(if ($WhatsAppPhoneNumberId) { $WhatsAppPhoneNumberId } else { $env:WHATSAPP_PHONE_NUMBER_ID }) `
  -Prompt "Enter WHATSAPP_PHONE_NUMBER_ID" `
  -AllowPlaceholder

$whatsAppApiToken = Resolve-RequiredValue `
  -Name "WHATSAPP_API_TOKEN" `
  -CurrentValue $env:WHATSAPP_API_TOKEN `
  -Prompt "Enter WHATSAPP_API_TOKEN" `
  -Secret `
  -AllowPlaceholder

$managedEnv = [ordered]@{
  OTP_PROVIDER = "whatsapp"
  WHATSAPP_OUTBOUND_MODE = "live"
  WHATSAPP_ACCOUNT_NUMBER = $WhatsAppAccountNumber
  WHATSAPP_TEST_RECEIVER_NUMBER = $WhatsAppReceiverNumber
  WHATSAPP_PHONE_NUMBER_ID = $whatsAppPhoneNumberId
  WHATSAPP_API_TOKEN = $whatsAppApiToken
}

$originalEnv = @{}
foreach ($key in $managedEnv.Keys) {
  $originalEnv[$key] = [Environment]::GetEnvironmentVariable($key, "Process")
}

if ($DryRun) {
  Write-Host "Dry run only. No secrets were written to disk and no proof scripts were executed." -ForegroundColor Yellow
  Write-Host ""
  Write-Host "Process env overrides:" -ForegroundColor Cyan
  foreach ($entry in $managedEnv.GetEnumerator()) {
    $displayValue = if ($entry.Key -eq "WHATSAPP_API_TOKEN") { "<hidden>" } else { $entry.Value }
    Write-Host ("- {0}={1}" -f $entry.Key, $displayValue)
  }
  Write-Host ""
  Write-Host "Proof scripts:" -ForegroundColor Cyan
  Write-Host ("- {0}" -f $phase8bScript)
  if ($IncludeBehaviorPack) {
    Write-Host ("- {0}" -f $phase8cScript)
  }
  Write-Host ("- {0}" -f $phase8dScript)
  return
}

try {
  foreach ($key in $managedEnv.Keys) {
    [Environment]::SetEnvironmentVariable($key, $managedEnv[$key], "Process")
  }

  $stoppedGateway = Stop-RepoGatewayProcess -Root $root

  if ($stoppedGateway) {
    Write-Host "Stopped stale repo gateway on port 8010 so the live provider config can take effect." -ForegroundColor Yellow
  }

  Invoke-ProofScript -Path $phase8bScript -Name "Phase 8B-fix strict OTP proof" -ProjectRoot $root -GatewayBaseUrl $GatewayBaseUrl -PhoneNumber $WhatsAppReceiverNumber -OpenReport:$OpenReport
  if ($IncludeBehaviorPack) {
    Invoke-ProofScript -Path $phase8cScript -Name "Phase 8C OTP behavior proof pack" -ProjectRoot $root -GatewayBaseUrl $GatewayBaseUrl -OpenReport:$OpenReport
  }
  Invoke-ProofScript -Path $phase8dScript -Name "Phase 8D delivery signoff" -ProjectRoot $root -GatewayBaseUrl $GatewayBaseUrl -PhoneNumber $WhatsAppReceiverNumber -OpenReport:$OpenReport

  $phase8bReport = Get-LatestReport -Root $root -PhaseFolder ".pma\closure-audit\phase8b-fix" -Pattern "05_WAT012_STRICT_OTP_FINAL_VERDICT.md"
  $phase8dReport = Get-LatestReport -Root $root -PhaseFolder ".pma\closure-audit\phase8d" -Pattern "04_PHASE8D_DELIVERY_SIGNOFF_VERDICT.md"
  $phase8cReport = if ($IncludeBehaviorPack) {
    Get-LatestReport -Root $root -PhaseFolder ".pma\closure-audit\phase8c" -Pattern "04_PHASE8C_OTP_BEHAVIOR_VERDICT.md"
  } else {
    $null
  }

  Write-Host ""
  Write-Host "Live WhatsApp OTP proof completed." -ForegroundColor Green
  if ($phase8bReport) {
    Write-Host ("Phase 8B-fix report: {0}" -f $phase8bReport.FullName)
  }
  if ($phase8cReport) {
    Write-Host ("Phase 8C report: {0}" -f $phase8cReport.FullName)
  }
  if ($phase8dReport) {
    Write-Host ("Phase 8D report: {0}" -f $phase8dReport.FullName)
  }
  Write-Host ("Sender account: {0}" -f $WhatsAppAccountNumber)
  Write-Host ("OTP receiver: {0}" -f $WhatsAppReceiverNumber)
  Write-Host "Secrets were kept in the current PowerShell process only." -ForegroundColor Green
} finally {
  foreach ($key in $managedEnv.Keys) {
    [Environment]::SetEnvironmentVariable($key, $originalEnv[$key], "Process")
  }
}