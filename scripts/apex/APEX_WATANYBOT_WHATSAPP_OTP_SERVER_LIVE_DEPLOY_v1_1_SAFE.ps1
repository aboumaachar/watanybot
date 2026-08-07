param(
  [Parameter(Mandatory = $true)]
  [string]$ServerHost,

  [string]$ServerUser = "root",
  [string]$SshKeyPath = "",
  [string]$ProjectRoot = "C:\xampp\htdocs\projectx\watanybot",
  [string]$SenderPhone = "+96181396332",
  [string]$RecipientPhone = "+9613156789",
  [switch]$Apply,
  [switch]$OpenReport
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$EvidenceRoot = Join-Path $ProjectRoot ".pma\apex\watanybot-whatsapp-otp-server-live-deploy"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RunRoot = Join-Path $EvidenceRoot $Stamp
$ReportPath = Join-Path $RunRoot "report.md"
$TranscriptPath = Join-Path $RunRoot "transcript.log"
$CsvPath = Join-Path $RunRoot "results.csv"

New-Item -ItemType Directory -Force -Path $RunRoot | Out-Null
Start-Transcript -LiteralPath $TranscriptPath -Force | Out-Null

$Rows = New-Object System.Collections.ArrayList

function Add-Result {
  param(
    [string]$Step,
    [string]$Status,
    [string]$Detail
  )

  [void]$Rows.Add([pscustomobject]@{
    Step = $Step
    Status = $Status
    Detail = $Detail
  })
}

function New-SshArgs {
  $argsList = New-Object System.Collections.Generic.List[string]
  if (-not [string]::IsNullOrWhiteSpace($SshKeyPath)) {
    $argsList.Add("-i") | Out-Null
    $argsList.Add($SshKeyPath) | Out-Null
  }
  $argsList.Add("-o") | Out-Null
  $argsList.Add("StrictHostKeyChecking=accept-new") | Out-Null
  $argsList.Add(($ServerUser + "@" + $ServerHost)) | Out-Null
  return @($argsList)
}

function Invoke-Native {
  param(
    [string]$Exe,
    [string[]]$CommandArgs,
    [string]$Step
  )

  $stdout = Join-Path $RunRoot (($Step -replace "[^A-Za-z0-9_.-]", "_") + ".stdout.log")
  $stderr = Join-Path $RunRoot (($Step -replace "[^A-Za-z0-9_.-]", "_") + ".stderr.log")
  $proc = Start-Process -FilePath $Exe -ArgumentList $CommandArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  $outText = if (Test-Path -LiteralPath $stdout) { Get-Content -LiteralPath $stdout -Raw -ErrorAction SilentlyContinue } else { "" }
  $errText = if (Test-Path -LiteralPath $stderr) { Get-Content -LiteralPath $stderr -Raw -ErrorAction SilentlyContinue } else { "" }
  $detail = "ExitCode=" + $proc.ExitCode + "; stdout=" + $stdout + "; stderr=" + $stderr
  if ($proc.ExitCode -eq 0) {
    Add-Result $Step "PASS" $detail
  } else {
    Add-Result $Step "FAIL" ($detail + "; stderrText=" + (($errText -replace "\r|\n", " ").Trim()))
  }
  return [pscustomobject]@{
    ExitCode = $proc.ExitCode
    Stdout = $outText
    Stderr = $errText
    StdoutPath = $stdout
    StderrPath = $stderr
  }
}

function Invoke-SshCommand {
  param([string]$Command, [string]$Step)
  $sshArgs = @(New-SshArgs)
  return Invoke-Native -Exe "ssh" -CommandArgs @($sshArgs + @($Command)) -Step $Step
}

try {
  Add-Result "ServerHost" "INFO" $ServerHost
  Add-Result "ServerUser" "INFO" $ServerUser
  Add-Result "ProjectRoot" "INFO" $ProjectRoot

  if (-not $Apply) {
    Add-Result "Apply" "SKIPPED" "Re-run with -Apply to execute SSH and server checks."
  } else {
    $sshTest = Invoke-SshCommand -Command "echo SSH_OK" -Step "ssh test"
    if ($sshTest.ExitCode -ne 0) {
      throw "SSH test failed."
    }

    $remoteCommand = 'SERVER_BASE_URL=http://127.0.0.1:4001; echo ''--- PORTS ---''; (ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null || true) | grep -E '':(4001)\b'' || true; echo ''--- HEALTH ---''; curl -sS "$SERVER_BASE_URL/health" || true; echo; echo ''--- FEATURES ---''; curl -sS "$SERVER_BASE_URL/api/admin/features" || true; echo; echo ''--- STATUS ---''; curl -sS "$SERVER_BASE_URL/status" || true'
    $remoteRun = Invoke-SshCommand -Command $remoteCommand -Step "remote 4001 check"

    $proofOut = $remoteRun.Stdout
    $HasHealth = $proofOut -match '"status"\s*:\s*"(degraded|ok)"'
    $HasFeatures = $proofOut -match '"flags"\s*:'
    $HasPort4001 = $proofOut -match '127\.0\.0\.1:4001' -or $proofOut -match ':(4001)\b'

    Add-Result "Server health endpoint" ($(if ($HasHealth) { "PASS" } else { "FAIL" })) "Expected /health JSON on port 4001."
    Add-Result "Server features endpoint" ($(if ($HasFeatures) { "PASS" } else { "FAIL" })) "Expected /api/admin/features JSON."
    Add-Result "Server port 4001" ($(if ($HasPort4001) { "PASS" } else { "FAIL" })) "Expected listeners or URLs on 4001."
  }

  $Rows | Export-Csv -LiteralPath $CsvPath -NoTypeInformation -Encoding UTF8

  $finalStatus = if (-not $Apply) {
    "WATANYBOT_WHATSAPP_OTP_SERVER_LIVE_DEPLOY_DRY_RUN_READY"
  } elseif (@($Rows | Where-Object { $_.Status -eq "FAIL" }).Count -eq 0) {
    "WATANYBOT_WHATSAPP_OTP_SERVER_LIVE_DEPLOY_PASS"
  } else {
    "WATANYBOT_WHATSAPP_OTP_SERVER_LIVE_DEPLOY_FAIL"
  }

  $report = @"
# WatanyBot WhatsApp OTP Server Live Deploy

FinalStatus: $finalStatus
ServerHost: $ServerHost
ServerUser: $ServerUser
SenderPhone: $SenderPhone
RecipientPhone: $RecipientPhone
Apply: $Apply
RunRoot: $RunRoot
ReportPath: $ReportPath
CsvPath: $CsvPath
TranscriptPath: $TranscriptPath

Results:
$((@($Rows) | ForEach-Object { '- ' + $_.Status + ' | ' + $_.Step + ' | ' + $_.Detail }) -join "`r`n")
"@

  Set-Content -LiteralPath $ReportPath -Value $report -Encoding UTF8
  Write-Host "FinalStatus=$finalStatus"
  Write-Host "Report=$ReportPath"
  Write-Host "Csv=$CsvPath"

  if ($OpenReport) {
    Start-Process $ReportPath | Out-Null
  }

  if ($finalStatus -match "FAIL") {
    exit 1
  }
} finally {
  Stop-Transcript | Out-Null
}
