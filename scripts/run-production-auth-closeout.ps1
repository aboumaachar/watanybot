#!/usr/bin/env pwsh

param(
    [string]$ProjectRoot = (Split-Path -Parent $PSScriptRoot),
    [string]$GatewayBaseUrl = "http://127.0.0.1:8010",
    [string]$WebBaseUrl = "http://127.0.0.1:5174",
    [string]$DownloadsRoot = (Join-Path $env:USERPROFILE "Downloads"),
    [switch]$SkipGatewayRestart,
    [switch]$SkipDeepSmoke,
    [switch]$KeepGatewayRunning,
    [switch]$OpenApexReport
)

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$runDir = Join-Path $ProjectRoot ".pma\implementation\production-auth-closeout\$timestamp"
New-Item -ItemType Directory -Path $runDir -Force | Out-Null

function Write-Step([string]$Message) {
    Write-Host "[production-closeout] $Message" -ForegroundColor Cyan
}

function Invoke-NativeStep([string]$Name, [scriptblock]$Command) {
    Write-Step $Name
    & $Command
    if ($LASTEXITCODE -ne 0) {
        throw "$Name failed with exit code $LASTEXITCODE"
    }
}

function Stop-GatewayListener([int]$Port) {
    $connections = @()
    try {
        $connections = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop)
    } catch {
        $connections = @()
    }

    $processIds = @($connections | Select-Object -ExpandProperty OwningProcess -Unique)
    foreach ($processId in $processIds) {
        if (-not $processId) {
            continue
        }

        try {
            Stop-Process -Id $processId -Force -ErrorAction Stop
        } catch {
            Write-Warning ("Could not stop process {0} on port {1}: {2}" -f $processId, $Port, $_.Exception.Message)
        }
    }
}

function Start-FreshGateway([string]$Root, [string]$BaseUrl, [string]$OutputDir) {
    $gatewayUri = [Uri]$BaseUrl
    $port = $gatewayUri.Port
    Stop-GatewayListener -Port $port

    $stdoutPath = Join-Path $OutputDir "gateway_stdout.log"
    $stderrPath = Join-Path $OutputDir "gateway_stderr.log"
    $gatewayCommand = @"
`$ErrorActionPreference = 'Stop'
Set-Location '$Root'
`$env:DISABLE_AUTH = 'false'
Remove-Item Env:AUTH_BYPASS_FOR_TESTING -ErrorAction SilentlyContinue
if (-not `$env:JWT_SECRET) { `$env:JWT_SECRET = 'dev-local-secret-not-for-production' }
pnpm --dir apps/gateway-api start
"@

    $process = Start-Process -FilePath "powershell.exe" `
        -ArgumentList @("-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", $gatewayCommand) `
        -RedirectStandardOutput $stdoutPath `
        -RedirectStandardError $stderrPath `
        -PassThru

    $deadline = (Get-Date).AddSeconds(90)
    $healthUrl = "$($BaseUrl.TrimEnd('/'))/health"
    while ((Get-Date) -lt $deadline) {
        if ($process.HasExited) {
            $stderr = if (Test-Path $stderrPath) { Get-Content -Raw -LiteralPath $stderrPath } else { "" }
            throw "Gateway process exited before health check passed. $stderr"
        }

        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 5
            if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
                return $process
            }
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }

    throw "Gateway did not become ready at $healthUrl within 90 seconds."
}

function Stop-TemporaryGateway {
    param(
        [AllowNull()][System.Diagnostics.Process]$Process,
        [int]$Port
    )

    if ($null -ne $Process) {
        try {
            if (-not $Process.HasExited) {
                Stop-Process -Id $Process.Id -Force -ErrorAction Stop
            }
        } catch {
            Write-Warning ("Could not stop temporary gateway process {0}: {1}" -f $Process.Id, $_.Exception.Message)
        }
    }

    Stop-GatewayListener -Port $Port
}

function Get-DownloadedScriptPath([string]$Downloads, [string]$ExpectedName) {
    $path = Join-Path $Downloads $ExpectedName
    if (-not (Test-Path -LiteralPath $path -PathType Leaf)) {
        throw "Missing downloaded script: $path"
    }

    $errors = $null
    $scriptText = Get-Content -Raw -LiteralPath $path
    $null = [System.Management.Automation.PSParser]::Tokenize($scriptText, [ref]$errors)
    if (@($errors).Count -gt 0) {
        $errors | Format-List | Out-String | Write-Host
        throw "Parser preflight failed for $ExpectedName"
    }

    return $path
}

function Get-LatestDeepSmokeReport([string]$Root) {
    $reportsRoot = Join-Path $Root ".pma\implementation\api-endpoint-method-deep-smoke"
    if (-not (Test-Path -LiteralPath $reportsRoot -PathType Container)) {
        throw "Deep smoke reports root not found: $reportsRoot"
    }

    $report = Get-ChildItem -Path $reportsRoot -Filter "API_ENDPOINT_METHOD_DEEP_SMOKE_REPORT.md" -Recurse |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1

    if (-not $report) {
        throw "No deep smoke report found under $reportsRoot"
    }

    return $report.FullName
}

function Get-MarkdownFieldValue([string]$ReportPath, [string]$FieldName) {
    $content = Get-Content -Raw -LiteralPath $ReportPath
    $pattern = [regex]::Escape("| $FieldName |") + "\s*(.+?)\s*\|"
    $match = [regex]::Match($content, $pattern)
    if (-not $match.Success) {
        throw "Could not find field '$FieldName' in $ReportPath"
    }

    return $match.Groups[1].Value.Trim()
}

function Restore-IncidentalGeneratedFiles([string]$Root) {
    $paths = @(
        "apps/gateway-api/data/hybrid-kb/hybrid-kb-master-index.json",
        "apps/gateway-api/data/death-notices.jsonl"
    )

    foreach ($relativePath in $paths) {
        & git -C $Root diff --quiet -- $relativePath
        $hasDiff = $LASTEXITCODE -ne 0
        if (-not $hasDiff) {
            continue
        }

        Write-Step "Restore incidental generated file $relativePath"
        & git -C $Root restore --source=HEAD --worktree -- $relativePath
        if ($LASTEXITCODE -ne 0) {
            throw "Could not restore incidental generated file $relativePath"
        }
    }
}

Set-Location $ProjectRoot

$gatewayProcess = $null
$gatewayPort = ([Uri]$GatewayBaseUrl).Port
try {
    if (-not $SkipGatewayRestart) {
        Write-Step "Restarting gateway with auth bypass explicitly disabled"
        $gatewayProcess = Start-FreshGateway -Root $ProjectRoot -BaseUrl $GatewayBaseUrl -OutputDir $runDir
        Write-Step "Gateway ready on $GatewayBaseUrl (pid=$($gatewayProcess.Id))"
    }

    Invoke-NativeStep "Run gateway admin auth regression" {
        pnpm --dir apps/gateway-api test --run src/tests/admin-auth-hardening.test.ts
    }

    Invoke-NativeStep "Run address-network typecheck" {
        pnpm --dir packages/address-network typecheck
    }

    Invoke-NativeStep "Run web-user typecheck" {
        pnpm --dir apps/web-user typecheck
    }

    Invoke-NativeStep "Run workspace typecheck" {
        pnpm -r typecheck
    }

    if (-not $SkipDeepSmoke) {
        Write-Step "Run downloaded API endpoint deep smoke"
        $deepSmokePath = Get-DownloadedScriptPath -Downloads $DownloadsRoot -ExpectedName "APEX_WATANYBOT_API_ENDPOINT_METHOD_DEEP_SMOKE_v3_3.ps1"
        $arguments = @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", $deepSmokePath,
            "-ProjectRoot", $ProjectRoot,
            "-GatewayBaseUrl", $GatewayBaseUrl,
            "-WebBaseUrl", $WebBaseUrl,
            "-RunValidationCommands",
            "-RunBrowserSmoke"
        )
        if ($OpenApexReport) {
            $arguments += "-OpenReport"
        }

        & powershell.exe @arguments
        if ($LASTEXITCODE -ne 0) {
            throw "API endpoint deep smoke failed with exit code $LASTEXITCODE"
        }

        $reportPath = Get-LatestDeepSmokeReport -Root $ProjectRoot
        $finalStatus = Get-MarkdownFieldValue -ReportPath $reportPath -FieldName "FinalStatus"
        $authReviewNotes = [int](Get-MarkdownFieldValue -ReportPath $reportPath -FieldName "AuthReviewNotes")

        if ($authReviewNotes -ne 0 -or $finalStatus -match "AUTH_REVIEW_NOTES") {
            throw "Deep smoke still reports auth review notes ($authReviewNotes). Review: $reportPath"
        }

        Write-Step "Deep smoke closed cleanly: $finalStatus"
    }

    Restore-IncidentalGeneratedFiles -Root $ProjectRoot

    Invoke-NativeStep "Check git status" {
        git status -sb
    }

    $statusLines = @(git status --short)
    if ($LASTEXITCODE -ne 0) {
        throw "git status --short failed with exit code $LASTEXITCODE"
    }
    if ($statusLines.Count -gt 0) {
        throw "Repository is not clean after closeout: $($statusLines -join '; ')"
    }

    Write-Step "Production auth closeout completed successfully"
}
finally {
    if (-not $SkipGatewayRestart -and -not $KeepGatewayRunning) {
        Write-Step "Stopping temporary gateway"
        Stop-TemporaryGateway -Process $gatewayProcess -Port $gatewayPort
    }
}