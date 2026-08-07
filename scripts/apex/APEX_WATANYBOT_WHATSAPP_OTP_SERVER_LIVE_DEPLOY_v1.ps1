param(
  [Parameter(Mandatory=$true)]
  [string]$ServerHost,

  [string]$ServerUser = "root",
  [string]$SshKeyPath = "",

  [string]$ProjectRoot = "C:\xampp\htdocs\projectx\watanybot",
  [string]$GatewayRoot = "C:\sms api\whatsapp-local-gateway",

  [string]$RemoteProjectRoot = "/var/www/watanybot",
  [string]$RemoteGatewayRoot = "/opt/watanybot/whatsapp-local-gateway",

  [string]$SenderPhone = "+96181396332",
  [string]$RecipientPhone = "+9613156789",

  [switch]$Apply,
  [switch]$RestartServices,
  [switch]$LiveSend,
  [switch]$PromptForOtp,
  [string]$OtpCode = "",
  [switch]$OpenReport
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$EvidenceRoot = Join-Path $ProjectRoot ".pma\apex\watanybot-whatsapp-otp-server-live-deploy"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RunRoot = Join-Path $EvidenceRoot $Stamp
$ReportPath = Join-Path $RunRoot "report.md"
$CsvPath = Join-Path $RunRoot "results.csv"
$TranscriptPath = Join-Path $RunRoot "transcript.log"
$BundleRoot = Join-Path $RunRoot "bundle"
$GatewayStage = Join-Path $BundleRoot "whatsapp-local-gateway"
$GatewayZip = Join-Path $RunRoot "whatsapp-local-gateway.zip"
$RemoteDeployScript = Join-Path $RunRoot "remote-deploy.sh"
$RemoteProofScript = Join-Path $RunRoot "remote-proof.sh"

New-Item -ItemType Directory -Force -Path $RunRoot | Out-Null
New-Item -ItemType Directory -Force -Path $GatewayStage | Out-Null

Start-Transcript -LiteralPath $TranscriptPath -Force | Out-Null

$Rows = New-Object System.Collections.ArrayList

function Add-Result {
  param(
    [string]$Step,
    [string]$Status,
    [string]$Detail
  )

  [void]$script:Rows.Add([pscustomobject]@{
    Step = $Step
    Status = $Status
    Detail = $Detail
  })
}

function ConvertTo-OneLine {
  param([object]$Value)

  if ($null -eq $Value) {
    return ""
  }

  try {
    return (($Value | ConvertTo-Json -Depth 30 -Compress) -replace "\r|\n", " ")
  } catch {
    return [string]$Value
  }
}

function New-SshArgs {
  $ArgsList = New-Object System.Collections.Generic.List[string]

  if (-not [string]::IsNullOrWhiteSpace($SshKeyPath)) {
    $ArgsList.Add("-i") | Out-Null
    $ArgsList.Add($SshKeyPath) | Out-Null
  }

  $ArgsList.Add("-o") | Out-Null
  $ArgsList.Add("StrictHostKeyChecking=accept-new") | Out-Null
  $ArgsList.Add(($ServerUser + "@" + $ServerHost)) | Out-Null

  return @($ArgsList)
}

function New-ScpArgs {
  param(
    [string]$LocalPath,
    [string]$RemotePath
  )

  $ArgsList = New-Object System.Collections.Generic.List[string]

  if (-not [string]::IsNullOrWhiteSpace($SshKeyPath)) {
    $ArgsList.Add("-i") | Out-Null
    $ArgsList.Add($SshKeyPath) | Out-Null
  }

  $ArgsList.Add("-o") | Out-Null
  $ArgsList.Add("StrictHostKeyChecking=accept-new") | Out-Null
  $ArgsList.Add($LocalPath) | Out-Null
  $ArgsList.Add(($ServerUser + "@" + $ServerHost + ":" + $RemotePath)) | Out-Null

  return @($ArgsList)
}

function Invoke-Native {
  param(
    [string]$Exe,
    [string[]]$CommandArgs,
    [string]$Step
  )

  $Stdout = Join-Path $RunRoot (($Step -replace "[^A-Za-z0-9_.-]", "_") + ".stdout.log")
  $Stderr = Join-Path $RunRoot (($Step -replace "[^A-Za-z0-9_.-]", "_") + ".stderr.log")

  $Process = Start-Process -FilePath $Exe -ArgumentList $CommandArgs -NoNewWindow -Wait -PassThru -RedirectStandardOutput $Stdout -RedirectStandardError $Stderr

  $OutText = ""
  $ErrText = ""

  if (Test-Path -LiteralPath $Stdout) {
    $OutText = Get-Content -LiteralPath $Stdout -Raw -ErrorAction SilentlyContinue
  }

  if (Test-Path -LiteralPath $Stderr) {
    $ErrText = Get-Content -LiteralPath $Stderr -Raw -ErrorAction SilentlyContinue
  }

  $Detail = "ExitCode=" + $Process.ExitCode + "; stdout=" + $Stdout + "; stderr=" + $Stderr

  if ($Process.ExitCode -eq 0) {
    Add-Result $Step "PASS" $Detail
  } else {
    Add-Result $Step "FAIL" ($Detail + "; stderrText=" + (($ErrText -replace "\r|\n", " ") | Select-Object -First 1))
  }

  return [pscustomobject]@{
    ExitCode = $Process.ExitCode
    StdoutPath = $Stdout
    StderrPath = $Stderr
    Stdout = $OutText
    Stderr = $ErrText
  }
}

function Write-RemoteScript {
  param(
    [string]$Path,
    [string]$Content
  )

  Set-Content -LiteralPath $Path -Value $Content -Encoding UTF8
}

try {
  Write-Progress -Activity "WatanyBot WhatsApp OTP server deploy" -Status "Preflight" -PercentComplete 5

  Add-Result "ServerHost" "INFO" $ServerHost
  Add-Result "ServerUser" "INFO" $ServerUser
  Add-Result "Project root" ($(if (Test-Path -LiteralPath $ProjectRoot) { "PASS" } else { "FAIL" })) $ProjectRoot
  Add-Result "Gateway root" ($(if (Test-Path -LiteralPath $GatewayRoot) { "PASS" } else { "FAIL" })) $GatewayRoot

  $SshCmd = Get-Command ssh -ErrorAction SilentlyContinue
  $ScpCmd = Get-Command scp -ErrorAction SilentlyContinue

  Add-Result "ssh available" ($(if ($null -ne $SshCmd) { "PASS" } else { "FAIL" })) ($(if ($null -ne $SshCmd) { $SshCmd.Source } else { "ssh not found" }))
  Add-Result "scp available" ($(if ($null -ne $ScpCmd) { "PASS" } else { "FAIL" })) ($(if ($null -ne $ScpCmd) { $ScpCmd.Source } else { "scp not found" }))

  if (-not (Test-Path -LiteralPath (Join-Path $GatewayRoot "server.js"))) {
    Add-Result "Gateway server.js" "FAIL" "Missing server.js"
    throw "Missing gateway server.js"
  }

  Write-Progress -Activity "WatanyBot WhatsApp OTP server deploy" -Status "Packaging WhatsApp gateway" -PercentComplete 18

  $IncludeFiles = @("package.json", "pnpm-lock.yaml", "package-lock.json", "server.js", "qr-view.html")

  foreach ($FileName in $IncludeFiles) {
    $SourcePath = Join-Path $GatewayRoot $FileName
    if (Test-Path -LiteralPath $SourcePath) {
      Copy-Item -LiteralPath $SourcePath -Destination (Join-Path $GatewayStage $FileName) -Force
      Add-Result ("Package " + $FileName) "PASS" "Included"
    } else {
      Add-Result ("Package " + $FileName) "SKIPPED" "Not found"
    }
  }

  if (Test-Path -LiteralPath $GatewayZip) {
    Remove-Item -LiteralPath $GatewayZip -Force
  }

  Compress-Archive -Path (Join-Path $GatewayStage "*") -DestinationPath $GatewayZip -Force
  Add-Result "Gateway bundle" "PASS" $GatewayZip

  Write-Progress -Activity "WatanyBot WhatsApp OTP server deploy" -Status "Writing remote scripts" -PercentComplete 32

  $DeploySh = @"
#!/usr/bin/env bash
set -euo pipefail

REMOTE_PROJECT_ROOT='$RemoteProjectRoot'
REMOTE_GATEWAY_ROOT='$RemoteGatewayRoot'
SENDER_PHONE='$SenderPhone'

mkdir -p "\$REMOTE_GATEWAY_ROOT"
mkdir -p /tmp/watanybot-whatsapp-otp

if command -v unzip >/dev/null 2>&1; then
  unzip -o /tmp/watanybot-whatsapp-local-gateway.zip -d "\$REMOTE_GATEWAY_ROOT"
else
  python3 - <<'PY'
import zipfile
zipfile.ZipFile('/tmp/watanybot-whatsapp-local-gateway.zip').extractall('$RemoteGatewayRoot')
PY
fi

cd "\$REMOTE_GATEWAY_ROOT"

if command -v corepack >/dev/null 2>&1; then
  corepack enable || true
fi

if command -v pnpm >/dev/null 2>&1; then
  pnpm install --prod
else
  npm install --omit=dev
fi

if [ "$RestartServices" = "True" ]; then
  if command -v pm2 >/dev/null 2>&1; then
    pm2 delete watany-whatsapp-gateway >/dev/null 2>&1 || true
    PORT=3020 WHATSAPP_SENDER_PHONE="\$SENDER_PHONE" pm2 start server.js --name watany-whatsapp-gateway --update-env
    pm2 save || true
  else
    pkill -f "node.*server.js" >/dev/null 2>&1 || true
    PORT=3020 WHATSAPP_SENDER_PHONE="\$SENDER_PHONE" nohup node server.js > "\$REMOTE_GATEWAY_ROOT/gateway.log" 2>&1 &
  fi
fi

if [ -d "\$REMOTE_PROJECT_ROOT/.git" ]; then
  cd "\$REMOTE_PROJECT_ROOT"
  git pull --ff-only || true
fi

cd "\$REMOTE_PROJECT_ROOT"

if command -v corepack >/dev/null 2>&1; then
  corepack enable || true
fi

if command -v pnpm >/dev/null 2>&1; then
  pnpm install --frozen-lockfile || pnpm install
fi

if [ "$RestartServices" = "True" ]; then
  if command -v pm2 >/dev/null 2>&1; then
    pm2 delete watanybot-gateway-api >/dev/null 2>&1 || true
    SMSAPI_PLUGIN_MODE='whatsapp-local' \
    SMSAPI_MODE='whatsapp-local' \
    SMSAPI_OTP_SENDER_PHONE="\$SENDER_PHONE" \
    WHATSAPP_LOCAL_GATEWAY_URL='http://127.0.0.1:3020' \
    WHATSAPP_LOCAL_GATEWAY_SEND_PATH='/send' \
    SMSAPI_STANDALONE_EXPOSE_CODE='false' \
    SMSAPI_REQUIRE_DISPATCH_SUCCESS='true' \
    SMSAPI_TIMEOUT_MS='10000' \
    pm2 start pnpm --name watanybot-gateway-api -- --filter gateway-api dev
    pm2 save || true
  else
    pkill -f "tsx.*src/server.ts" >/dev/null 2>&1 || true
    SMSAPI_PLUGIN_MODE='whatsapp-local' \
    SMSAPI_MODE='whatsapp-local' \
    SMSAPI_OTP_SENDER_PHONE="\$SENDER_PHONE" \
    WHATSAPP_LOCAL_GATEWAY_URL='http://127.0.0.1:3020' \
    WHATSAPP_LOCAL_GATEWAY_SEND_PATH='/send' \
    SMSAPI_STANDALONE_EXPOSE_CODE='false' \
    SMSAPI_REQUIRE_DISPATCH_SUCCESS='true' \
    SMSAPI_TIMEOUT_MS='10000' \
    nohup pnpm --filter gateway-api dev > "\$REMOTE_PROJECT_ROOT/gateway-api.log" 2>&1 &
  fi
fi

sleep 8

echo "REMOTE_DEPLOY_DONE"
echo "Gateway root: \$REMOTE_GATEWAY_ROOT"
echo "Project root: \$REMOTE_PROJECT_ROOT"
"@

  Write-RemoteScript -Path $RemoteDeployScript -Content $DeploySh

  $ProofSh = @"
#!/usr/bin/env bash
set -euo pipefail

RECIPIENT_PHONE='$RecipientPhone'
SENDER_PHONE='$SenderPhone'
LIVE_SEND='$LiveSend'
OTP_CODE='$OtpCode'

echo '--- PORTS ---'
(ss -ltnp 2>/dev/null || netstat -ltnp 2>/dev/null || true) | grep -E ':(3020|8010)\b' || true

echo '--- GATEWAY HEALTH ---'
curl -sS http://127.0.0.1:3020/health || true
echo

echo '--- GATEWAY STATUS ---'
curl -sS http://127.0.0.1:3020/status || true
echo

echo '--- GATEWAY SESSION ---'
curl -sS http://127.0.0.1:3020/session || true
echo

if [ "\$LIVE_SEND" = "True" ]; then
  echo '--- DIRECT WHATSAPP SEND ---'
  curl -sS -X POST http://127.0.0.1:3020/send \
    -H 'Content-Type: application/json' \
    --data "{\"to\":\"\$RECIPIENT_PHONE\",\"from\":\"\$SENDER_PHONE\",\"message\":\"WatanyBot server direct WhatsApp proof \$(date -Iseconds)\"}" || true
  echo
fi

echo '--- WATANY OTP HEALTH ---'
curl -sS http://127.0.0.1:8010/api/integrations/smsapi/otp/health || true
echo

echo '--- WATANY OTP START ---'
curl -sS -X POST http://127.0.0.1:8010/api/integrations/smsapi/otp/start \
  -H 'Content-Type: application/json' \
  --data "{\"phone\":\"\$RECIPIENT_PHONE\",\"purpose\":\"login\"}" || true
echo

if [ -n "\$OTP_CODE" ]; then
  echo '--- WATANY OTP CHECK ---'
  curl -sS -X POST http://127.0.0.1:8010/api/integrations/smsapi/otp/check \
    -H 'Content-Type: application/json' \
    --data "{\"phone\":\"\$RECIPIENT_PHONE\",\"purpose\":\"login\",\"code\":\"\$OTP_CODE\"}" || true
  echo
else
  echo '--- WATANY OTP CHECK SKIPPED: no OTP_CODE supplied ---'
fi
"@

  Write-RemoteScript -Path $RemoteProofScript -Content $ProofSh

  if (-not $Apply) {
    Add-Result "Apply" "SKIPPED" "Dry run only. Re-run with -Apply to upload and execute."
  } else {
    Write-Progress -Activity "WatanyBot WhatsApp OTP server deploy" -Status "Testing SSH" -PercentComplete 45

    $SshArgs = @(New-SshArgs)
    $SshTestArgs = @($SshArgs + @("echo SSH_OK"))
    $SshTest = Invoke-Native -Exe "ssh" -CommandArgs $SshTestArgs -Step "ssh test"

    if ($SshTest.ExitCode -ne 0) {
      throw "SSH test failed."
    }

    Write-Progress -Activity "WatanyBot WhatsApp OTP server deploy" -Status "Uploading bundle and scripts" -PercentComplete 58

    $ScpBundle = Invoke-Native -Exe "scp" -CommandArgs @(New-ScpArgs -LocalPath $GatewayZip -RemotePath "/tmp/watanybot-whatsapp-local-gateway.zip") -Step "scp gateway bundle"
    $ScpDeploy = Invoke-Native -Exe "scp" -CommandArgs @(New-ScpArgs -LocalPath $RemoteDeployScript -RemotePath "/tmp/watanybot-whatsapp-remote-deploy.sh") -Step "scp deploy script"
    $ScpProof = Invoke-Native -Exe "scp" -CommandArgs @(New-ScpArgs -LocalPath $RemoteProofScript -RemotePath "/tmp/watanybot-whatsapp-remote-proof.sh") -Step "scp proof script"

    if ($ScpBundle.ExitCode -ne 0 -or $ScpDeploy.ExitCode -ne 0 -or $ScpProof.ExitCode -ne 0) {
      throw "Upload failed."
    }

    Write-Progress -Activity "WatanyBot WhatsApp OTP server deploy" -Status "Executing remote deployment" -PercentComplete 72

    $RemoteDeployCmd = "chmod +x /tmp/watanybot-whatsapp-remote-deploy.sh && /tmp/watanybot-whatsapp-remote-deploy.sh"
    $DeployRun = Invoke-Native -Exe "ssh" -CommandArgs @($SshArgs + @($RemoteDeployCmd)) -Step "remote deploy"

    Write-Progress -Activity "WatanyBot WhatsApp OTP server deploy" -Status "Executing remote proof" -PercentComplete 86

    if ([string]::IsNullOrWhiteSpace($OtpCode) -and $PromptForOtp) {
      $OtpCode = Read-Host "Enter OTP received on WhatsApp for $RecipientPhone, or press Enter to skip verify"
      $ProofText = Get-Content -LiteralPath $RemoteProofScript -Raw
      $ProofText = $ProofText -replace "OTP_CODE=''", ("OTP_CODE='" + ($OtpCode -replace "'", "'\''") + "'")
      Set-Content -LiteralPath $RemoteProofScript -Value $ProofText -Encoding UTF8
      Invoke-Native -Exe "scp" -CommandArgs @(New-ScpArgs -LocalPath $RemoteProofScript -RemotePath "/tmp/watanybot-whatsapp-remote-proof.sh") -Step "scp proof script with otp" | Out-Null
    }

    $RemoteProofCmd = "chmod +x /tmp/watanybot-whatsapp-remote-proof.sh && /tmp/watanybot-whatsapp-remote-proof.sh"
    $ProofRun = Invoke-Native -Exe "ssh" -CommandArgs @($SshArgs + @($RemoteProofCmd)) -Step "remote proof"

    $ProofOut = $ProofRun.Stdout

    $SenderDigits = $SenderPhone -replace "\D", ""
    $ExpectedWid = $SenderDigits + "@c.us"

    $HasExpectedSender = $ProofOut -match [regex]::Escape($ExpectedWid)
    $HasGatewaySendOk = $ProofOut -match '"ok"\s*:\s*true' -and $ProofOut -match "whatsapp-local-gateway"
    $HasOtpHealth = $ProofOut -match "whatsapp-local"
    $HasExposeFalse = $ProofOut -match '"exposeCode"\s*:\s*false'
    $HasRequireTrue = $ProofOut -match '"requireDispatchSuccess"\s*:\s*true'
    $HasDispatchOk = $ProofOut -match '"dispatch"\s*:' -and $ProofOut -match '"ok"\s*:\s*true'

    Add-Result "Server sender session" ($(if ($HasExpectedSender) { "PASS" } else { "FAIL" })) ("expected=" + $ExpectedWid)
    Add-Result "Server gateway send" ($(if ($HasGatewaySendOk) { "PASS" } else { "REVIEW" })) "Look at remote proof stdout."
    Add-Result "Server Watany mode" ($(if ($HasOtpHealth) { "PASS" } else { "FAIL" })) "Expected whatsapp-local."
    Add-Result "Server exposeCode false" ($(if ($HasExposeFalse) { "PASS" } else { "FAIL" })) "Expected devOtp hidden."
    Add-Result "Server requireDispatch true" ($(if ($HasRequireTrue) { "PASS" } else { "FAIL" })) "Expected dispatch required."
    Add-Result "Server OTP dispatch" ($(if ($HasDispatchOk) { "PASS" } else { "REVIEW" })) "Expected dispatch.ok=true in OTP start."
  }

  Write-Progress -Activity "WatanyBot WhatsApp OTP server deploy" -Status "Writing report" -PercentComplete 96

  $FailCount = @($Rows | Where-Object { $_.Status -eq "FAIL" }).Count
  $ReviewCount = @($Rows | Where-Object { $_.Status -eq "REVIEW" }).Count
  $SkippedCount = @($Rows | Where-Object { $_.Status -eq "SKIPPED" }).Count

  $FinalStatus = if (-not $Apply) {
    "WATANYBOT_WHATSAPP_OTP_SERVER_LIVE_DEPLOY_DRY_RUN_READY"
  } elseif ($FailCount -eq 0 -and $ReviewCount -eq 0) {
    "WATANYBOT_WHATSAPP_OTP_SERVER_LIVE_DEPLOY_PASS"
  } elseif ($FailCount -eq 0) {
    "WATANYBOT_WHATSAPP_OTP_SERVER_LIVE_DEPLOY_REVIEW_REQUIRED"
  } else {
    "WATANYBOT_WHATSAPP_OTP_SERVER_LIVE_DEPLOY_FAIL"
  }

  $Rows | Export-Csv -LiteralPath $CsvPath -NoTypeInformation -Encoding UTF8

  $Lines = New-Object System.Collections.Generic.List[string]
  foreach ($Row in @($Rows)) {
    $Lines.Add("- " + $Row.Status + " | " + $Row.Step + " | " + $Row.Detail) | Out-Null
  }

  $ReportText = @"
# WatanyBot WhatsApp OTP Server Live Deploy

FinalStatus: $FinalStatus
ServerHost: $ServerHost
ServerUser: $ServerUser
RemoteProjectRoot: $RemoteProjectRoot
RemoteGatewayRoot: $RemoteGatewayRoot
SenderPhone: $SenderPhone
RecipientPhone: $RecipientPhone
Apply: $Apply
RestartServices: $RestartServices
LiveSend: $LiveSend
PromptForOtp: $PromptForOtp
FailCount: $FailCount
ReviewCount: $ReviewCount
SkippedCount: $SkippedCount
GatewayZip: $GatewayZip
CsvPath: $CsvPath
TranscriptPath: $TranscriptPath

Results:
$([string]::Join("`r`n", @($Lines)))

Server Requirements:
- Node, pnpm or npm installed.
- pm2 preferred; nohup fallback is used if pm2 is missing.
- WhatsApp gateway must be logged in as $SenderPhone.
- If the server has no WhatsApp session yet, check remote gateway logs and scan QR with $SenderPhone.
- Production-safe values are enforced:
  SMSAPI_STANDALONE_EXPOSE_CODE=false
  SMSAPI_REQUIRE_DISPATCH_SUCCESS=true
"@

  Set-Content -LiteralPath $ReportPath -Value $ReportText -Encoding UTF8

  Write-Progress -Activity "WatanyBot WhatsApp OTP server deploy" -Completed

  Write-Host "FinalStatus=$FinalStatus"
  Write-Host "Report=$ReportPath"
  Write-Host "Csv=$CsvPath"

  if ($OpenReport) {
    Start-Process $ReportPath
  }

  if ($FinalStatus -match "FAIL") {
    exit 1
  }
} finally {
  Stop-Transcript | Out-Null
}
