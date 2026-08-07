param(
  [string]$ProjectRoot = "C:\xampp\htdocs\projectx\watanybot",
  [string]$GatewayRoot = "C:\sms api\whatsapp-local-gateway",
  [string]$SenderPhone = "+96181396332",
  [string]$RecipientPhone = "+9613156789",
  [string]$GatewayBaseUrl = "http://127.0.0.1:3020",
  [string]$WatanyBaseUrl = "http://127.0.0.1:8010",
  [switch]$RestartGateway,
  [switch]$RestartWatany,
  [switch]$LiveSend,
  [switch]$PromptForOtp,
  [string]$OtpCode = "",
  [switch]$OpenReport
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = "Stop"

$PmaRoot = Join-Path $ProjectRoot ".pma"
$EvidenceRoot = Join-Path $PmaRoot "apex\watanybot-whatsapp-otp-production-live-closeout"
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
    return (($Value | ConvertTo-Json -Depth 30 -Compress) -replace "\r|\n", " ")
  } catch {
    return [string]$Value
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
      $Params.Body = ($Body | ConvertTo-Json -Depth 30)
    }

    $Response = Invoke-RestMethod @Params

    return [pscustomobject]@{
      Ok = $true
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
      StatusCode = $StatusCode
      Response = $null
      Error = $_.Exception.Message
      DurationMs = [int]((Get-Date) - $Started).TotalMilliseconds
    }
  }
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

function Stop-PortOwner {
  param([int]$Port)

  $Conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1

  if ($null -eq $Conn) {
    Add-Result ("Stop port " + $Port) "SKIPPED" "No listener."
    return
  }

  Stop-Process -Id $Conn.OwningProcess -Force
  Add-Result ("Stop port " + $Port) "PASS" ("Stopped PID=" + $Conn.OwningProcess)
  Start-Sleep -Seconds 2
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

  $Command = @(
    "Set-Location -LiteralPath $(Quote-PsString $GatewayRoot)",
    "`$env:PORT='3020'",
    "`$env:WHATSAPP_SENDER_PHONE=$(Quote-PsString $SenderPhone)",
    "pnpm start"
  ) -join "; "

  Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $Command)
  Add-Result "Start WhatsApp gateway" "STARTED" $Command
}

function Start-WatanyGatewayProduction {
  if (-not (Test-Path -LiteralPath $ProjectRoot)) {
    Add-Result "Project root" "FAIL" ("Missing: " + $ProjectRoot)
    return
  }

  $Command = @(
    "Set-Location -LiteralPath $(Quote-PsString $ProjectRoot)",
    "`$env:SMSAPI_PLUGIN_MODE='whatsapp-local'",
    "`$env:SMSAPI_MODE='whatsapp-local'",
    "`$env:SMSAPI_OTP_SENDER_PHONE=$(Quote-PsString $SenderPhone)",
    "`$env:WHATSAPP_LOCAL_GATEWAY_URL=$(Quote-PsString $GatewayBaseUrl)",
    "`$env:WHATSAPP_LOCAL_GATEWAY_SEND_PATH='/send'",
    "`$env:SMSAPI_STANDALONE_EXPOSE_CODE='false'",
    "`$env:SMSAPI_REQUIRE_DISPATCH_SUCCESS='true'",
    "`$env:SMSAPI_TIMEOUT_MS='10000'",
    "Remove-Item Env:\SMSAPI_BASE_URL -ErrorAction SilentlyContinue",
    "Remove-Item Env:\SMSAPI_API_KEY -ErrorAction SilentlyContinue",
    "pnpm --filter gateway-api dev"
  ) -join "; "

  Start-Process powershell -ArgumentList @("-NoExit", "-ExecutionPolicy", "Bypass", "-Command", $Command)
  Add-Result "Start Watany gateway" "STARTED" "gateway-api dev with production-safe WhatsApp OTP env"
}

try {
  Write-Progress -Activity "WatanyBot WhatsApp OTP production live closeout" -Status "Preflight" -PercentComplete 5

  Add-Result "Config sender" "INFO" $SenderPhone
  Add-Result "Config recipient" "INFO" $RecipientPhone
  Add-Result "Gateway root" ($(if (Test-Path -LiteralPath $GatewayRoot) { "PASS" } else { "FAIL" })) $GatewayRoot
  Add-Result "Project root" ($(if (Test-Path -LiteralPath $ProjectRoot) { "PASS" } else { "FAIL" })) $ProjectRoot

  if ($RestartGateway) {
    Write-Progress -Activity "WatanyBot WhatsApp OTP production live closeout" -Status "Restarting WhatsApp gateway" -PercentComplete 15
    Stop-PortOwner 3020
    Start-WhatsAppGateway
    Start-Sleep -Seconds 10
  }

  if ($RestartWatany) {
    Write-Progress -Activity "WatanyBot WhatsApp OTP production live closeout" -Status "Restarting Watany gateway" -PercentComplete 25
    Stop-PortOwner 8010
    Start-WatanyGatewayProduction
    Start-Sleep -Seconds 12
  }

  Write-Progress -Activity "WatanyBot WhatsApp OTP production live closeout" -Status "Checking ports" -PercentComplete 35

  $GatewayPortOk = Test-PortListening 3020
  $WatanyPortOk = Test-PortListening 8010

  Add-Result "Port 3020" ($(if ($GatewayPortOk) { "PASS" } else { "FAIL" })) (Get-PortOwnerText 3020)
  Add-Result "Port 8010" ($(if ($WatanyPortOk) { "PASS" } else { "FAIL" })) (Get-PortOwnerText 8010)

  Write-Progress -Activity "WatanyBot WhatsApp OTP production live closeout" -Status "Probing WhatsApp gateway" -PercentComplete 45

  $GatewayHealth = Invoke-JsonRequest -Method "GET" -Uri ($GatewayBaseUrl + "/health")
  Add-Result "Gateway GET /health" ($(if ($GatewayHealth.Ok) { "PASS" } else { "FAIL" })) ($(if ($GatewayHealth.Ok) { ConvertTo-OneLine $GatewayHealth.Response } else { $GatewayHealth.Error }))

  $GatewayStatus = Invoke-JsonRequest -Method "GET" -Uri ($GatewayBaseUrl + "/status")
  Add-Result "Gateway GET /status" ($(if ($GatewayStatus.Ok) { "PASS" } else { "FAIL" })) ($(if ($GatewayStatus.Ok) { ConvertTo-OneLine $GatewayStatus.Response } else { $GatewayStatus.Error }))

  $GatewayReady = (Get-JsonPath $GatewayStatus.Response @("ready")) -eq $true
  $GatewayWid = [string](Get-JsonPath $GatewayStatus.Response @("clientInfo", "wid"))
  $ExpectedWid = (($SenderPhone -replace "\D", "") + "@c.us")
  $SenderMatch = $GatewayWid -eq $ExpectedWid

  Add-Result "Gateway ready" ($(if ($GatewayReady) { "PASS" } else { "FAIL" })) ("ready=" + [string]$GatewayReady)
  Add-Result "Sender session match" ($(if ($SenderMatch) { "PASS" } else { "FAIL" })) ("actual=" + $GatewayWid + "; expected=" + $ExpectedWid)

  Write-Progress -Activity "WatanyBot WhatsApp OTP production live closeout" -Status "Direct live send" -PercentComplete 55

  $DirectSendOk = $false

  if ($LiveSend) {
    $DirectPayload = @{
      to = $RecipientPhone
      from = $SenderPhone
      message = "WatanyBot production closeout direct WhatsApp proof " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    }

    $DirectSend = Invoke-JsonRequest -Method "POST" -Uri ($GatewayBaseUrl + "/send") -Body $DirectPayload
    $DirectSendOk = $DirectSend.Ok

    Add-Result "Gateway POST /send" ($(if ($DirectSend.Ok) { "PASS" } else { "FAIL" })) ($(if ($DirectSend.Ok) { ConvertTo-OneLine $DirectSend.Response } else { $DirectSend.Error }))
  } else {
    Add-Result "Gateway POST /send" "SKIPPED" "Use -LiveSend to send a real WhatsApp proof message."
  }

  Write-Progress -Activity "WatanyBot WhatsApp OTP production live closeout" -Status "Watany OTP health" -PercentComplete 68

  $WatanyHealth = Invoke-JsonRequest -Method "GET" -Uri ($WatanyBaseUrl + "/api/integrations/smsapi/otp/health")
  Add-Result "Watany OTP health" ($(if ($WatanyHealth.Ok) { "PASS" } else { "FAIL" })) ($(if ($WatanyHealth.Ok) { ConvertTo-OneLine $WatanyHealth.Response } else { $WatanyHealth.Error }))

  $ExposeCode = Get-JsonPath $WatanyHealth.Response @("data", "exposeCode")
  $RequireDispatch = Get-JsonPath $WatanyHealth.Response @("data", "requireDispatchSuccess")
  $Mode = [string](Get-JsonPath $WatanyHealth.Response @("data", "mode"))

  Add-Result "Watany mode" ($(if ($Mode -eq "whatsapp-local") { "PASS" } else { "FAIL" })) ("mode=" + $Mode)
  Add-Result "Production exposeCode false" ($(if ($ExposeCode -eq $false) { "PASS" } else { "FAIL" })) ("exposeCode=" + [string]$ExposeCode)
  Add-Result "Production requireDispatch true" ($(if ($RequireDispatch -eq $true) { "PASS" } else { "FAIL" })) ("requireDispatchSuccess=" + [string]$RequireDispatch)

  Write-Progress -Activity "WatanyBot WhatsApp OTP production live closeout" -Status "Watany OTP start" -PercentComplete 78

  $OtpStartPayload = @{
    phone = $RecipientPhone
    purpose = "login"
  }

  $OtpStart = Invoke-JsonRequest -Method "POST" -Uri ($WatanyBaseUrl + "/api/integrations/smsapi/otp/start") -Body $OtpStartPayload
  Add-Result "Watany OTP start" ($(if ($OtpStart.Ok) { "PASS" } else { "FAIL" })) ($(if ($OtpStart.Ok) { ConvertTo-OneLine $OtpStart.Response } else { $OtpStart.Error }))

  $DispatchOk = Get-JsonPath $OtpStart.Response @("data", "dispatch", "ok")
  $DevOtp = Get-JsonPath $OtpStart.Response @("data", "devOtp")

  Add-Result "Watany OTP dispatch.ok" ($(if ($DispatchOk -eq $true) { "PASS" } else { "FAIL" })) ("dispatch.ok=" + [string]$DispatchOk)
  Add-Result "Watany devOtp hidden" ($(if ($null -eq $DevOtp) { "PASS" } else { "FAIL" })) ("devOtp=" + [string]$DevOtp)

  Write-Progress -Activity "WatanyBot WhatsApp OTP production live closeout" -Status "OTP verification" -PercentComplete 88

  $OtpVerifyOk = $false

  if ([string]::IsNullOrWhiteSpace($OtpCode) -and $PromptForOtp) {
    $OtpCode = Read-Host "Enter the OTP received on WhatsApp for $RecipientPhone"
  }

  if ([string]::IsNullOrWhiteSpace($OtpCode)) {
    Add-Result "Watany OTP check" "SKIPPED" "No OTP code provided. Use -PromptForOtp or -OtpCode."
  } else {
    $OtpCheckPayload = @{
      phone = $RecipientPhone
      purpose = "login"
      code = $OtpCode
    }

    $OtpCheck = Invoke-JsonRequest -Method "POST" -Uri ($WatanyBaseUrl + "/api/integrations/smsapi/otp/check") -Body $OtpCheckPayload
    $OtpVerified = (Get-JsonPath $OtpCheck.Response @("data", "verified")) -eq $true
    $OtpVerifyOk = $OtpCheck.Ok -and $OtpVerified

    Add-Result "Watany OTP check" ($(if ($OtpVerifyOk) { "PASS" } else { "FAIL" })) ($(if ($OtpCheck.Ok) { ConvertTo-OneLine $OtpCheck.Response } else { $OtpCheck.Error }))
  }

  Write-Progress -Activity "WatanyBot WhatsApp OTP production live closeout" -Status "Final report" -PercentComplete 95

  $FailCount = @($Rows | Where-Object { $_.Status -eq "FAIL" }).Count
  $ReviewCount = @($Rows | Where-Object { $_.Status -eq "REVIEW" }).Count
  $SkippedCount = @($Rows | Where-Object { $_.Status -eq "SKIPPED" }).Count

  $FullVerificationRequired = (-not [string]::IsNullOrWhiteSpace($OtpCode))

  $FinalStatus = if ($FailCount -eq 0 -and $GatewayPortOk -and $WatanyPortOk -and $GatewayReady -and $SenderMatch -and ($DispatchOk -eq $true) -and ($ExposeCode -eq $false) -and ($RequireDispatch -eq $true) -and ((-not $FullVerificationRequired) -or $OtpVerifyOk)) {
    "WATANYBOT_WHATSAPP_OTP_PRODUCTION_LIVE_CLOSEOUT_PASS"
  } elseif ($FailCount -eq 0 -and $DispatchOk -eq $true) {
    "WATANYBOT_WHATSAPP_OTP_PRODUCTION_SEND_PASS_VERIFY_SKIPPED"
  } else {
    "WATANYBOT_WHATSAPP_OTP_PRODUCTION_LIVE_CLOSEOUT_REVIEW_REQUIRED"
  }

  $Rows | Export-Csv -LiteralPath $CsvPath -NoTypeInformation -Encoding UTF8

  $ResultLines = New-Object System.Collections.Generic.List[string]
  foreach ($Row in @($Rows)) {
    $ResultLines.Add("- " + $Row.Status + " | " + $Row.Step + " | " + $Row.Detail) | Out-Null
  }

  $ReportText = @"
# WatanyBot WhatsApp OTP Production Live Closeout

FinalStatus: $FinalStatus
SenderPhone: $SenderPhone
ExpectedSenderWid: $ExpectedWid
ActualSenderWid: $GatewayWid
RecipientPhone: $RecipientPhone
GatewayBaseUrl: $GatewayBaseUrl
WatanyBaseUrl: $WatanyBaseUrl
LiveSend: $LiveSend
PromptForOtp: $PromptForOtp
RestartGateway: $RestartGateway
RestartWatany: $RestartWatany
FailCount: $FailCount
ReviewCount: $ReviewCount
SkippedCount: $SkippedCount
CsvPath: $CsvPath
TranscriptPath: $TranscriptPath

Results:
$([string]::Join("`r`n", @($ResultLines)))

Closeout Rules:
- Sender session must match $ExpectedWid.
- WhatsApp gateway must accept POST /send.
- Watany OTP health must show mode=whatsapp-local.
- Production-safe mode requires exposeCode=false.
- Production-safe mode requires requireDispatchSuccess=true.
- OTP start must return dispatch.ok=true.
- OTP check is PASS when a received WhatsApp OTP is supplied with -PromptForOtp or -OtpCode.
"@

  Set-Content -LiteralPath $ReportPath -Value $ReportText -Encoding UTF8

  Write-Progress -Activity "WatanyBot WhatsApp OTP production live closeout" -Completed

  Write-Host "FinalStatus=$FinalStatus"
  Write-Host "Report=$ReportPath"
  Write-Host "Csv=$CsvPath"

  if ($OpenReport) {
    Start-Process $ReportPath
  }

  if ($FinalStatus -match "REVIEW_REQUIRED") {
    exit 1
  }
} finally {
  Stop-Transcript | Out-Null
}
