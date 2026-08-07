param(
  [string]$ProjectRoot = "C:\xampp\htdocs\projectx\watanybot",
  [string]$GatewayRoot = "C:\sms api\whatsapp-local-gateway",
  [string]$SenderPhone = "+96181396332",
  [string]$RecipientPhone = "+9613156789",
  [string]$GatewayBaseUrl = "http://127.0.0.1:3020",
  [string]$GatewaySendPath = "/send",
  [string]$WatanyBaseUrl = "http://127.0.0.1:8010",
  [switch]$StartGateway,
  [switch]$RestartWatany,
  [switch]$LiveSend,
  [switch]$OpenReport
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$EvidenceRoot = Join-Path $ProjectRoot ".pma\apex\watanybot-whatsapp-otp-live-validation"
$Stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$RunRoot = Join-Path $EvidenceRoot $Stamp
$ReportPath = Join-Path $RunRoot "report.md"
$CsvPath = Join-Path $RunRoot "results.csv"
$TranscriptPath = Join-Path $RunRoot "transcript.log"

New-Item -ItemType Directory -Force -Path $RunRoot | Out-Null
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
    return (($Value | ConvertTo-Json -Depth 20 -Compress) -replace "\r|\n", " ")
  } catch {
    return ([string]$Value)
  }
}

function Get-JsonPath {
  param(
    [object]$ObjectValue,
    [string[]]$Path
  )

  $Current = $ObjectValue
  foreach ($Segment in $Path) {
    if ($null -eq $Current) {
      return $null
    }

    $Prop = $Current.PSObject.Properties[$Segment]
    if ($null -eq $Prop) {
      return $null
    }

    $Current = $Prop.Value
  }

  return $Current
}

function Test-PortListening {
  param([int]$Port)

  $Connections = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
  return (@($Connections).Count -gt 0)
}

function Get-PortOwnerText {
  param([int]$Port)

  $Conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $Conn) {
    return "NONE"
  }

  $Proc = Get-CimInstance Win32_Process -Filter ("ProcessId=" + $Conn.OwningProcess) -ErrorAction SilentlyContinue
  if ($null -eq $Proc) {
    return "PID=" + $Conn.OwningProcess
  }

  return "PID=" + $Proc.ProcessId + "; CommandLine=" + $Proc.CommandLine
}

function Invoke-JsonRequest {
  param(
    [string]$Method,
    [string]$Uri,
    [object]$Body = $null
  )

  $Started = Get-Date
  try {
    $Params = @{
      Uri = $Uri
      Method = $Method
      ErrorAction = "Stop"
    }

    if ($null -ne $Body) {
      $Params.ContentType = "application/json"
      $Params.Body = ($Body | ConvertTo-Json -Depth 20)
    }

    $Response = Invoke-RestMethod @Params
    return [pscustomobject]@{
      Ok = $true
      Uri = $Uri
      Method = $Method
      StatusCode = 200
      Response = $Response
      Error = ""
      DurationMs = [int]((Get-Date) - $Started).TotalMilliseconds
    }
  } catch {
    $StatusCode = 0
    if ($null -ne $_.Exception.Response) {
      try {
        $StatusCode = [int]$_.Exception.Response.StatusCode
      } catch {
        $StatusCode = 0
      }
    }

    return [pscustomobject]@{
      Ok = $false
      Uri = $Uri
      Method = $Method
      StatusCode = $StatusCode
      Response = $null
      Error = $_.Exception.Message
      DurationMs = [int]((Get-Date) - $Started).TotalMilliseconds
    }
  }
}

function Quote-PsString {
  param([string]$Value)
  return "'" + ($Value -replace "'", "''") + "'"
}

function Start-WhatsAppGateway {
  if (-not (Test-Path -LiteralPath $GatewayRoot)) {
    Add-Result "Gateway root" "FAIL" ("Missing: " + $GatewayRoot)
    return
  }

  $PackagePath = Join-Path $GatewayRoot "package.json"
  if (-not (Test-Path -LiteralPath $PackagePath)) {
    Add-Result "Gateway package" "FAIL" ("Missing: " + $PackagePath)
    return
  }

  $Command = @(
    "Set-Location -LiteralPath $(Quote-PsString $GatewayRoot)",
    "`$env:PORT='3020'",
    "`$env:WHATSAPP_SENDER_PHONE=$(Quote-PsString $SenderPhone)",
    "pnpm start"
  ) -join "; "

  Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $Command)
  Add-Result "Gateway start" "STARTED" $Command
}

function Restart-WatanyGateway {
  $Existing = Get-NetTCPConnection -LocalPort 8010 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -ne $Existing) {
    Stop-Process -Id $Existing.OwningProcess -Force
    Add-Result "Watany restart" "STOPPED_EXISTING" ("PID=" + $Existing.OwningProcess)
    Start-Sleep -Seconds 2
  }

  $Command = @(
    "Set-Location -LiteralPath $(Quote-PsString $ProjectRoot)",
    "`$env:SMSAPI_PLUGIN_MODE='whatsapp-local'",
    "`$env:SMSAPI_OTP_SENDER_PHONE=$(Quote-PsString $SenderPhone)",
    "`$env:WHATSAPP_LOCAL_GATEWAY_URL=$(Quote-PsString $GatewayBaseUrl)",
    "`$env:WHATSAPP_LOCAL_GATEWAY_SEND_PATH=$(Quote-PsString $GatewaySendPath)",
    "`$env:SMSAPI_STANDALONE_EXPOSE_CODE='true'",
    "`$env:SMSAPI_REQUIRE_DISPATCH_SUCCESS='false'",
    "`$env:SMSAPI_TIMEOUT_MS='10000'",
    "Remove-Item Env:\SMSAPI_BASE_URL -ErrorAction SilentlyContinue",
    "Remove-Item Env:\SMSAPI_API_KEY -ErrorAction SilentlyContinue",
    "pnpm --filter gateway-api dev"
  ) -join "; "

  Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $Command)
  Add-Result "Watany start" "STARTED" "gateway-api dev in whatsapp-local mode"
}

try {
  Write-Progress -Activity "WhatsApp OTP live validation" -Status "Preflight" -PercentComplete 5

  Add-Result "Config sender" "INFO" $SenderPhone
  Add-Result "Config recipient" "INFO" $RecipientPhone
  Add-Result "Gateway root" ($(if (Test-Path -LiteralPath $GatewayRoot) { "PASS" } else { "FAIL" })) $GatewayRoot
  Add-Result "Project root" ($(if (Test-Path -LiteralPath $ProjectRoot) { "PASS" } else { "FAIL" })) $ProjectRoot

  if ($StartGateway -and -not (Test-PortListening 3020)) {
    Write-Progress -Activity "WhatsApp OTP live validation" -Status "Starting WhatsApp gateway" -PercentComplete 15
    Start-WhatsAppGateway
    Start-Sleep -Seconds 8
  }

  if ($RestartWatany) {
    Write-Progress -Activity "WhatsApp OTP live validation" -Status "Restarting Watany gateway" -PercentComplete 25
    Restart-WatanyGateway
    Start-Sleep -Seconds 10
  }

  Write-Progress -Activity "WhatsApp OTP live validation" -Status "Checking ports" -PercentComplete 35

  $GatewayPortOk = Test-PortListening 3020
  $WatanyPortOk = Test-PortListening 8010

  Add-Result "Port 3020" ($(if ($GatewayPortOk) { "PASS" } else { "FAIL" })) (Get-PortOwnerText 3020)
  Add-Result "Port 8010" ($(if ($WatanyPortOk) { "PASS" } else { "FAIL" })) (Get-PortOwnerText 8010)

  Write-Progress -Activity "WhatsApp OTP live validation" -Status "Probing WhatsApp gateway" -PercentComplete 45

  $GatewayHealth = Invoke-JsonRequest -Method "GET" -Uri ($GatewayBaseUrl + "/health")
  Add-Result "Gateway GET /health" ($(if ($GatewayHealth.Ok) { "PASS" } else { "FAIL" })) ($(if ($GatewayHealth.Ok) { ConvertTo-OneLine $GatewayHealth.Response } else { $GatewayHealth.Error }))

  $GatewayStatus = Invoke-JsonRequest -Method "GET" -Uri ($GatewayBaseUrl + "/status")
  Add-Result "Gateway GET /status" ($(if ($GatewayStatus.Ok) { "PASS" } else { "REVIEW" })) ($(if ($GatewayStatus.Ok) { ConvertTo-OneLine $GatewayStatus.Response } else { $GatewayStatus.Error }))

  $GatewaySession = Invoke-JsonRequest -Method "GET" -Uri ($GatewayBaseUrl + "/session")
  Add-Result "Gateway GET /session" ($(if ($GatewaySession.Ok) { "PASS" } else { "REVIEW" })) ($(if ($GatewaySession.Ok) { ConvertTo-OneLine $GatewaySession.Response } else { $GatewaySession.Error }))

  Write-Progress -Activity "WhatsApp OTP live validation" -Status "Testing direct WhatsApp send" -PercentComplete 58

  $DirectSendOk = $false
  if ($LiveSend) {
    $DirectPayload = @{
      to = $RecipientPhone
      phone = $RecipientPhone
      recipient = $RecipientPhone
      from = $SenderPhone
      sender = $SenderPhone
      senderPhone = $SenderPhone
      message = "WatanyBot live WhatsApp gateway proof " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
      text = "WatanyBot live WhatsApp gateway proof " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
      purpose = "live-proof"
      client = "watanybot-local"
    }

    $DirectSend = Invoke-JsonRequest -Method "POST" -Uri ($GatewayBaseUrl + $GatewaySendPath) -Body $DirectPayload
    $DirectSendOk = $DirectSend.Ok
    Add-Result "Gateway POST send live message" ($(if ($DirectSend.Ok) { "PASS" } else { "FAIL" })) ($(if ($DirectSend.Ok) { ConvertTo-OneLine $DirectSend.Response } else { $DirectSend.Error }))
  } else {
    Add-Result "Gateway POST send live message" "SKIPPED" "Run with -LiveSend to send a live WhatsApp test message."
  }

  Write-Progress -Activity "WhatsApp OTP live validation" -Status "Testing Watany health" -PercentComplete 68

  $WatanyHealth = Invoke-JsonRequest -Method "GET" -Uri ($WatanyBaseUrl + "/api/integrations/smsapi/otp/health")
  Add-Result "Watany OTP health" ($(if ($WatanyHealth.Ok) { "PASS" } else { "FAIL" })) ($(if ($WatanyHealth.Ok) { ConvertTo-OneLine $WatanyHealth.Response } else { $WatanyHealth.Error }))

  Write-Progress -Activity "WhatsApp OTP live validation" -Status "Testing Watany OTP start" -PercentComplete 78

  $OtpStartPayload = @{
    phone = $RecipientPhone
    purpose = "login"
  }

  $OtpStart = Invoke-JsonRequest -Method "POST" -Uri ($WatanyBaseUrl + "/api/integrations/smsapi/otp/start") -Body $OtpStartPayload
  Add-Result "Watany OTP start" ($(if ($OtpStart.Ok) { "PASS" } else { "FAIL" })) ($(if ($OtpStart.Ok) { ConvertTo-OneLine $OtpStart.Response } else { $OtpStart.Error }))

  $OtpDispatchOk = Get-JsonPath $OtpStart.Response @("data", "dispatch", "ok")
  $OtpDispatchReason = Get-JsonPath $OtpStart.Response @("data", "dispatch", "reason")
  $DevOtp = Get-JsonPath $OtpStart.Response @("data", "devOtp")

  Add-Result "Watany OTP dispatch.ok" ($(if ($OtpDispatchOk -eq $true) { "PASS" } else { "FAIL" })) ("dispatch.ok=" + [string]$OtpDispatchOk + "; reason=" + [string]$OtpDispatchReason)

  Write-Progress -Activity "WhatsApp OTP live validation" -Status "Testing Watany OTP check" -PercentComplete 88

  $OtpCheckOk = $false
  $OtpVerified = $false

  if ([string]::IsNullOrWhiteSpace([string]$DevOtp)) {
    Add-Result "Watany OTP check" "FAIL" "devOtp missing. For local proof, SMSAPI_STANDALONE_EXPOSE_CODE must be true."
  } else {
    $OtpCheckPayload = @{
      phone = $RecipientPhone
      purpose = "login"
      code = [string]$DevOtp
    }

    $OtpCheck = Invoke-JsonRequest -Method "POST" -Uri ($WatanyBaseUrl + "/api/integrations/smsapi/otp/check") -Body $OtpCheckPayload
    $OtpCheckOk = $OtpCheck.Ok
    $OtpVerified = (Get-JsonPath $OtpCheck.Response @("data", "verified")) -eq $true
    Add-Result "Watany OTP check" ($(if ($OtpCheckOk -and $OtpVerified) { "PASS" } else { "FAIL" })) ($(if ($OtpCheck.Ok) { ConvertTo-OneLine $OtpCheck.Response } else { $OtpCheck.Error }))
  }

  Write-Progress -Activity "WhatsApp OTP live validation" -Status "Finalizing" -PercentComplete 95

  $FailCount = @($Rows | Where-Object { $_.Status -eq "FAIL" }).Count
  $ReviewCount = @($Rows | Where-Object { $_.Status -eq "REVIEW" }).Count

  $FinalStatus = if ($LiveSend -and $GatewayPortOk -and $WatanyPortOk -and $DirectSendOk -and ($OtpDispatchOk -eq $true) -and $OtpCheckOk -and $OtpVerified -and $FailCount -eq 0) {
    "WATANYBOT_WHATSAPP_OTP_LIVE_VALIDATION_PASS"
  } elseif ($OtpCheckOk -and $OtpVerified -and ($OtpDispatchOk -ne $true)) {
    "WATANYBOT_OTP_VERIFY_PASS_WHATSAPP_DISPATCH_FAIL"
  } else {
    "WATANYBOT_WHATSAPP_OTP_LIVE_VALIDATION_REVIEW_REQUIRED"
  }

  $Rows | Export-Csv -LiteralPath $CsvPath -NoTypeInformation -Encoding UTF8

  $ResultLines = New-Object System.Collections.Generic.List[string]
  foreach ($Row in @($Rows)) {
    $ResultLines.Add("- " + $Row.Status + " | " + $Row.Step + " | " + $Row.Detail) | Out-Null
  }

  $ReportText = @"
# WatanyBot WhatsApp OTP Live Validation

FinalStatus: $FinalStatus
SenderPhone: $SenderPhone
RecipientPhone: $RecipientPhone
GatewayBaseUrl: $GatewayBaseUrl
WatanyBaseUrl: $WatanyBaseUrl
LiveSend: $LiveSend
StartGateway: $StartGateway
RestartWatany: $RestartWatany
FailCount: $FailCount
ReviewCount: $ReviewCount
CsvPath: $CsvPath
TranscriptPath: $TranscriptPath

Results:
$([string]::Join("`r`n", @($ResultLines)))

Interpretation:
- PASS requires a live WhatsApp send through the gateway, Watany OTP dispatch.ok=true, and OTP check verified=true.
- If OTP check passes but dispatch fails, Watany OTP logic is working but WhatsApp gateway/session/send endpoint is not fully functional.
- Production must use SMSAPI_STANDALONE_EXPOSE_CODE=false and SMSAPI_REQUIRE_DISPATCH_SUCCESS=true after local proof.
"@

  Set-Content -LiteralPath $ReportPath -Value $ReportText -Encoding UTF8

  Write-Progress -Activity "WhatsApp OTP live validation" -Completed

  Write-Host "FinalStatus=$FinalStatus"
  Write-Host "Report=$ReportPath"
  Write-Host "Csv=$CsvPath"

  if ($OpenReport) {
    Start-Process $ReportPath
  }

  if ($FinalStatus -ne "WATANYBOT_WHATSAPP_OTP_LIVE_VALIDATION_PASS") {
    exit 1
  }
} finally {
  Stop-Transcript | Out-Null
}
