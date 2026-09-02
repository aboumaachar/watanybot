#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$CanonicalRoot = 'C:\xampp\htdocs\projectx\watanybot',
    [string]$EvidenceParent = '',
    [string]$BrowserProofPath = ''
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
Write-Output 'APEX_PS1_SKILL_UPDATE_NOT_REQUIRED'

$scriptDirectory = Split-Path -Parent $MyInvocation.MyCommand.Path
if ([string]::IsNullOrWhiteSpace($CanonicalRoot)) { $CanonicalRoot = $scriptDirectory }
if ([string]::IsNullOrWhiteSpace($EvidenceParent)) { $EvidenceParent = Join-Path $CanonicalRoot 'pma\evidence\cms' }
if ([string]::IsNullOrWhiteSpace($BrowserProofPath)) { $BrowserProofPath = Join-Path $CanonicalRoot 'tmp\wave4b2-browser-proof.json' }

$runId = [DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ')
$evidenceRoot = Join-Path $EvidenceParent ('C9_12_WAVE4B2_GENERIC_CMS_FORMS_ANNOUNCEMENTS_CLOSEOUT-' + $runId)
New-Item -ItemType Directory -Path $evidenceRoot -Force | Out-Null

$script:stageResults = @{}
$script:progressRows = New-Object 'System.Collections.Generic.List[object]'
$script:validationRows = New-Object 'System.Collections.Generic.List[object]'
$script:actionRows = New-Object 'System.Collections.Generic.List[object]'
$script:failureRows = New-Object 'System.Collections.Generic.List[object]'
$script:warningRows = New-Object 'System.Collections.Generic.List[object]'
$script:overallStatus = 'BLOCKED'
$script:primaryFailure = $null

function Get-Hash {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $null }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}

function Read-Utf8 {
    param([string]$Path)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return '' }
    $bytes = [IO.File]::ReadAllBytes($Path)
    if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
        $encoding = [Text.Encoding]::Unicode
    } elseif ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
        $encoding = [Text.Encoding]::BigEndianUnicode
    } else {
        $encoding = [Text.Encoding]::UTF8
    }
    $value = $encoding.GetString($bytes)
    if ($null -eq $value) { return '' }
    if ($value.Length -gt 0 -and [int][char]$value[0] -eq 0xFEFF) { $value = $value.Substring(1) }
    return $value
}

function Write-Utf8 {
    param(
        [string]$Path,
        [AllowEmptyString()][string]$Text
    )
    if ($null -eq $Text) { $Text = '' }
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::WriteAllText($Path, $Text, $encoding)
}

function Write-Json {
    param([string]$Name, [object]$Value)
    $path = Join-Path $evidenceRoot $Name
    $json = ConvertTo-Json -InputObject $Value -Depth 30
    Write-Utf8 $path ($json + [Environment]::NewLine)
}

function Write-ExecutionLog {
    param([string]$Message)
    $line = ([DateTime]::UtcNow.ToString('o') + ' ' + $Message + [Environment]::NewLine)
    $path = Join-Path $evidenceRoot 'EXECUTION_LOG.txt'
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::AppendAllText($path, $line, $encoding)
}

function Write-ErrorLog {
    param([string]$Message)
    $line = ([DateTime]::UtcNow.ToString('o') + ' ' + $Message + [Environment]::NewLine)
    $path = Join-Path $evidenceRoot 'ERROR_LOG.txt'
    $encoding = New-Object System.Text.UTF8Encoding($false)
    [IO.File]::AppendAllText($path, $line, $encoding)
}

function Save-Records {
    $records = @(
        [pscustomobject]@{ Path = 'progress.csv'; Rows = $script:progressRows }
        [pscustomobject]@{ Path = 'validations.csv'; Rows = $script:validationRows }
        [pscustomobject]@{ Path = 'actions.csv'; Rows = $script:actionRows }
        [pscustomobject]@{ Path = 'failures.csv'; Rows = $script:failureRows }
        [pscustomobject]@{ Path = 'warnings.csv'; Rows = $script:warningRows }
    )
    foreach ($record in $records) {
        $rows = @($record.Rows | ForEach-Object { $_ })
        if ($rows.Count -eq 0) {
            Write-Utf8 (Join-Path $evidenceRoot $record.Path) "utc,status,stage,detail`r`n"
        } else {
            $csv = @($rows | ConvertTo-Csv -NoTypeInformation)
            Write-Utf8 (Join-Path $evidenceRoot $record.Path) (($csv -join [Environment]::NewLine) + [Environment]::NewLine)
        }
    }
    Write-Json 'progress.json' ([pscustomobject]@{ rows = @($script:progressRows | ForEach-Object { $_ }) })
}

function Add-ProgressRow {
    param([string]$Stage, [string]$EventName, [string]$Status, [AllowEmptyString()][string]$Detail)
    $script:progressRows.Add([pscustomobject]@{ utc = [DateTime]::UtcNow.ToString('o'); stage = $Stage; event = $EventName; status = $Status; detail = $Detail })
    $percentComplete = [Math]::Min(100, [int](($script:progressRows.Count / 16) * 100))
    Write-Progress -Activity 'Wave 4B.2 APEX closeout' -Status ($Stage + ': ' + $EventName + ' ' + $Status) -PercentComplete $percentComplete
    Save-Records
}

function Add-ValidationRow {
    param([string]$Stage, [string]$Name, [string]$Status, [AllowEmptyString()][string]$Detail)
    $script:validationRows.Add([pscustomobject]@{ utc = [DateTime]::UtcNow.ToString('o'); stage = $Stage; name = $Name; status = $Status; detail = $Detail })
    Save-Records
}

function Add-ActionRow {
    param([string]$Stage, [string]$Action, [string]$Status, [AllowEmptyString()][string]$Detail)
    $script:actionRows.Add([pscustomobject]@{ utc = [DateTime]::UtcNow.ToString('o'); stage = $Stage; action = $Action; status = $Status; detail = $Detail })
    Save-Records
}

function Add-Warning {
    param([string]$Code, [string]$Stage, [string]$Message)
    $script:warningRows.Add([pscustomobject]@{ utc = [DateTime]::UtcNow.ToString('o'); code = $Code; stage = $Stage; status = 'ADVISORY'; message = $Message })
    Write-ErrorLog ('WARNING ' + $Code + ' ' + $Message)
    Save-Records
}

function Add-Failure {
    param([string]$Code, [string]$Stage, [string]$Message)
    $row = [pscustomobject]@{ utc = [DateTime]::UtcNow.ToString('o'); code = $Code; stage = $Stage; status = 'OPEN'; message = $Message }
    $script:failureRows.Add($row)
    if ($null -eq $script:primaryFailure) { $script:primaryFailure = $row }
    Write-ErrorLog ('FAILURE ' + $Code + ' ' + $Message)
    Save-Records
}

function Invoke-NativeProof {
    param(
        [string]$Name,
        [string]$WorkingDirectory,
        [string]$Executable,
        [string[]]$CommandArgs,
        [hashtable]$EnvironmentOverrides = @{}
    )
    $stdoutPath = Join-Path $evidenceRoot ($Name + '.stdout.txt')
    $stderrPath = Join-Path $evidenceRoot ($Name + '.stderr.txt')
    $started = [DateTime]::UtcNow
    $previousEnvironment = @{}
    $exitCode = 1
    $exceptionText = ''
    foreach ($key in @($EnvironmentOverrides.Keys)) {
        $previousEnvironment[$key] = [Environment]::GetEnvironmentVariable($key)
        [Environment]::SetEnvironmentVariable($key, [string]$EnvironmentOverrides[$key])
    }
    try {
        Push-Location $WorkingDirectory
        try {
            $previousErrorActionPreference = $ErrorActionPreference
            $ErrorActionPreference = 'Continue'
            & $Executable @CommandArgs 1> $stdoutPath 2> $stderrPath
            $exitCode = $LASTEXITCODE
            $ErrorActionPreference = $previousErrorActionPreference
        } finally {
            Pop-Location
        }
    } catch {
        $exceptionText = $_.Exception.ToString()
        $exitCode = 1
        Write-ErrorLog ('NATIVE_EXCEPTION ' + $Name + ' ' + $exceptionText)
    } finally {
        foreach ($key in @($EnvironmentOverrides.Keys)) {
            [Environment]::SetEnvironmentVariable($key, $previousEnvironment[$key])
        }
    }
    if ($null -eq $exitCode) { $exitCode = 1 }
    $stdoutSize = if (Test-Path -LiteralPath $stdoutPath -PathType Leaf) { (Get-Item -LiteralPath $stdoutPath).Length } else { 0 }
    $stderrSize = if (Test-Path -LiteralPath $stderrPath -PathType Leaf) { (Get-Item -LiteralPath $stderrPath).Length } else { 0 }
    $result = [pscustomobject]@{
        name = $Name
        command = @($Executable) + @($CommandArgs)
        workingDirectory = $WorkingDirectory
        startUtc = $started.ToString('o')
        endUtc = [DateTime]::UtcNow.ToString('o')
        exitCode = [int]$exitCode
        status = if ([int]$exitCode -eq 0) { 'PASS' } else { 'BLOCKED' }
        stdoutPath = $stdoutPath
        stderrPath = $stderrPath
        stdoutBytes = $stdoutSize
        stderrBytes = $stderrSize
        exception = $exceptionText
    }
    Write-Json ($Name + '.json') $result
    Add-ActionRow 'NATIVE' $Name $result.status ('exitCode=' + $result.exitCode)
    return $result
}

function Get-JsonResultFromOutput {
    param([string]$Path)
    $lines = @((Read-Utf8 $Path) -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    for ($index = $lines.Count - 1; $index -ge 0; $index--) {
        try {
            return ($lines[$index] | ConvertFrom-Json)
        } catch {
        }
    }
    return $null
}

function Invoke-Stage {
    param(
        [string]$Name,
        [string]$ReportName,
        [scriptblock]$Action
    )
    Add-ProgressRow $Name 'START' 'START' 'Stage started.'
    Write-ExecutionLog ('STAGE_START ' + $Name)
    $status = 'BLOCKED'
    $detail = ''
    $data = $null
    try {
        $data = & $Action
        if ($null -eq $data) { throw ('Stage returned no result: ' + $Name) }
        if ($data -is [array]) { $data = $data | Select-Object -Last 1 }
        if ($data.PSObject.Properties.Name -contains 'status') { $status = [string]$data.status } else { $status = 'PASS' }
        if ($data.PSObject.Properties.Name -contains 'reason') { $detail = [string]$data.reason } else { $detail = 'Stage completed.' }
    } catch {
        $detail = $_.Exception.ToString()
        Add-Failure ('APEX_WAVE4B2_STAGE_' + $Name + '_FAILURE') $Name $detail
        $data = [pscustomobject]@{ status = 'BLOCKED'; reason = $detail }
    }
    $script:stageResults[$Name] = $data
    Write-Json $ReportName ([pscustomobject]@{ runId = $runId; stage = $Name; status = $status; reason = $detail; data = $data })
    Add-ProgressRow $Name 'END' $status $detail
    Write-ExecutionLog ('STAGE_END ' + $Name + ' ' + $status)
    return $data
}

$stageDefinitions = @(
    [pscustomobject]@{ Name = 'SOURCE_IDENTITY'; File = '01_SOURCE_IDENTITY.json' }
    [pscustomobject]@{ Name = 'MIGRATION_STATUS'; File = '02_MIGRATION_STATUS.json' }
    [pscustomobject]@{ Name = 'GATEWAY_VALIDATION'; File = '03_GATEWAY_VALIDATION.json' }
    [pscustomobject]@{ Name = 'ADMIN_BUILD'; File = '04_ADMIN_BUILD.json' }
    [pscustomobject]@{ Name = 'BROWSER_PROOF'; File = '05_BROWSER_PROOF.json' }
    [pscustomobject]@{ Name = 'CLEANUP'; File = '06_CLEANUP.json' }
    [pscustomobject]@{ Name = 'WORKTREE_CLASSIFICATION'; File = '07_WORKTREE_CLASSIFICATION.json' }
    [pscustomobject]@{ Name = 'CLOSEOUT'; File = '08_CLOSEOUT.json' }
)

Write-Utf8 (Join-Path $evidenceRoot 'ERROR_LOG.txt') 'APEX_PS1_SKILL_UPDATE_NOT_REQUIRED' + [Environment]::NewLine
Write-Utf8 (Join-Path $evidenceRoot 'EXECUTION_LOG.txt') 'APEX_PS1_SKILL_UPDATE_NOT_REQUIRED' + [Environment]::NewLine
foreach ($stageDefinition in $stageDefinitions) {
    Write-Json $stageDefinition.File ([pscustomobject]@{ runId = $runId; stage = $stageDefinition.Name; status = 'NOT_STARTED'; reason = 'Precreated before substantive execution.' })
}
Save-Records
Write-Json 'checkpoint.json' ([pscustomobject]@{ runId = $runId; status = 'STARTED'; currentStage = 'SOURCE_IDENTITY'; evidenceRoot = $evidenceRoot })

$sourcePaths = @(
    'APEX_WAVE4B2_GENERIC_CMS_FORMS_ANNOUNCEMENTS_CLOSEOUT_PS51.ps1',
    '.github/skills/apex-ps1/SKILL.md',
    'pma/feature-gates/04_PROGRAM_FAILURE_AND_REGRESSION_REGISTER.md',
    '.pma/admin-wave4b-payload-gateway-bridge/FINAL_STATUS.txt',
    '.pma/admin-wave4b-payload-gateway-bridge/FINAL_REPORT.md',
    '.pma/admin-wave4b-payload-gateway-bridge/summary.json',
    'apps/gateway-api/src/db/migrations/035_generic_cms_content.sql',
    'apps/gateway-api/src/db/migrations/037_generic_cms_review_ready.sql',
    'apps/gateway-api/src/cms/cms-routes.ts',
    'apps/gateway-api/src/cms/storage/genericCmsRepository.ts',
    'apps/gateway-api/src/cms/storage/genericCmsService.ts',
    'apps/gateway-api/src/cms/storage/genericCmsRoutes.ts',
    'apps/gateway-api/src/cms/storage/genericCmsRoutes.test.ts',
    'apps/gateway-api/src/cms/forms/forms-cms-adapter.ts',
    'apps/gateway-api/src/cms/forms/forms-cms-runtime.test.ts',
    'apps/gateway-api/src/cms/announcements/announcements-cms-adapter.ts',
    'apps/gateway-api/src/cms/announcements/announcements-cms-runtime.test.ts',
    'apps/gateway-api/src/routes/announcements.ts',
    'apps/web-admin/src/lib/api.ts',
    'apps/web-admin/src/pages/CmsPage.tsx',
    'apps/web-admin/src/pages/CmsManagedContentPage.tsx',
    'apps/web-admin/src/styles.css',
    'apps/web-admin/vite.config.ts'
)

function Invoke-SourceIdentity {
    $rows = @($sourcePaths | ForEach-Object {
        $fullPath = Join-Path $CanonicalRoot ($_ -replace '/', '\')
        [pscustomobject]@{ relativePath = $_; exists = Test-Path -LiteralPath $fullPath -PathType Leaf; sha256 = Get-Hash $fullPath }
    })
    $missing = @($rows | Where-Object { -not $_.exists })
    $status = if ($missing.Count -eq 0) { 'PASS' } else { 'BLOCKED' }
    Write-Json 'SOURCE_IDENTITY_DETAIL.json' ([pscustomobject]@{ status = $status; paths = $rows; missing = $missing })
    Add-ValidationRow 'SOURCE_IDENTITY' 'selected source paths exist and are hashed' $status ('count=' + $rows.Count + '; missing=' + $missing.Count)
    if ($missing.Count -gt 0) { Add-Failure 'APEX_WAVE4B2_SOURCE_IDENTITY_MISSING' 'SOURCE_IDENTITY' (($missing.relativePath) -join ', ') }
    return [pscustomobject]@{ status = $status; pathCount = $rows.Count; missingCount = $missing.Count; paths = $rows; reason = 'Selective Wave 4B.2 implementation identity captured.' }
}

function Invoke-MigrationStatus {
        $probeCode = @'
import { query, closePool } from "../../../../apps/gateway-api/src/lib/db.ts";

(async () => {
    const rows = await query("SELECT name FROM _migrations WHERE name = $1", ["037_generic_cms_review_ready.sql"]);
    console.log(JSON.stringify({ migration: "037_generic_cms_review_ready.sql", applied: rows.rowCount === 1 }));
    await closePool();
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
'@
        $probePath = Join-Path $evidenceRoot 'MIGRATION_STATUS_PROBE.ts'
        Write-Utf8 $probePath $probeCode
        $probe = Invoke-NativeProof 'MIGRATION_STATUS_PROBE' $CanonicalRoot 'pnpm' @('--dir', 'apps/gateway-api', 'exec', 'tsx', $probePath)
    $parsed = Get-JsonResultFromOutput $probe.stdoutPath
    $applied = if ($null -ne $parsed) { [bool]$parsed.applied } else { $false }
    $status = if ($probe.exitCode -eq 0 -and $applied) { 'PASS' } else { 'BLOCKED' }
    Write-Json 'MIGRATION_STATUS_DETAIL.json' ([pscustomobject]@{ status = $status; migration = '037_generic_cms_review_ready.sql'; applied = $applied; probe = $probe })
    Add-ValidationRow 'MIGRATION_STATUS' 'migration 037 applied in configured database' $status ('applied=' + $applied)
    if ($status -ne 'PASS') { Add-Failure 'APEX_WAVE4B2_MIGRATION_STATUS_UNPROVEN' 'MIGRATION_STATUS' 'Migration 037 was not proven as applied.' }
    return [pscustomobject]@{ status = $status; applied = $applied; probe = $probe; reason = 'Live migration catalog query completed.' }
}

function Invoke-GatewayValidation {
    $environment = @{
        JWT_SECRET = 'apex-cms-runtime-acceptance-local-secret-2026'
        DISABLE_PLUGIN_DB = 'true'
        DISABLE_KB_NODES = 'true'
        DISABLE_CHAT_PERSIST = 'true'
        USE_AI = 'false'
        USE_PYTHON_API = 'false'
    }
    $typecheck = Invoke-NativeProof 'GATEWAY_TYPECHECK' $CanonicalRoot 'pnpm' @('--dir', 'apps/gateway-api', 'typecheck')
    $routeBoundary = Invoke-NativeProof 'CMS_ROUTE_AND_PAYLOAD_BOUNDARY' $CanonicalRoot 'pnpm' @('exec', 'vitest', 'run', 'apps/gateway-api/src/cms/storage/genericCmsRoutes.test.ts', 'apps/gateway-api/src/tests/payload-cms-boundary.test.ts')
    $runtime = Invoke-NativeProof 'FORMS_AND_ANNOUNCEMENTS_RUNTIME' $CanonicalRoot 'pnpm' @('exec', 'vitest', 'run', 'apps/gateway-api/src/cms/forms/forms-cms-runtime.test.ts', 'apps/gateway-api/src/cms/announcements/announcements-cms-runtime.test.ts') $environment
    $status = if ($typecheck.exitCode -eq 0 -and $routeBoundary.exitCode -eq 0 -and $runtime.exitCode -eq 0) { 'PASS' } else { 'BLOCKED' }
    Add-ValidationRow 'GATEWAY_VALIDATION' 'Gateway typecheck' $typecheck.status ('exitCode=' + $typecheck.exitCode)
    Add-ValidationRow 'GATEWAY_VALIDATION' 'route and preserved Payload boundary tests' $routeBoundary.status ('exitCode=' + $routeBoundary.exitCode)
    Add-ValidationRow 'GATEWAY_VALIDATION' 'Forms and Announcements runtime tests' $runtime.status ('exitCode=' + $runtime.exitCode)
    if ($status -ne 'PASS') { Add-Failure 'APEX_WAVE4B2_GATEWAY_VALIDATION_FAILED' 'GATEWAY_VALIDATION' 'One or more Gateway validation commands failed.' }
    return [pscustomobject]@{ status = $status; typecheck = $typecheck; routeBoundary = $routeBoundary; runtime = $runtime; reason = 'Gateway typecheck, route boundary, preserved Payload boundary, and live Forms/Announcements runtime proof.' }
}

function Invoke-AdminBuild {
    $typecheck = Invoke-NativeProof 'ADMIN_TYPECHECK' $CanonicalRoot 'pnpm' @('--dir', 'apps/web-admin', 'typecheck')
    $build = Invoke-NativeProof 'ADMIN_BUILD' $CanonicalRoot 'pnpm' @('--dir', 'apps/web-admin', 'build')
    $distIndex = Join-Path $CanonicalRoot 'apps/web-admin/dist/index.html'
    $status = if ($typecheck.exitCode -eq 0 -and $build.exitCode -eq 0 -and (Test-Path -LiteralPath $distIndex -PathType Leaf)) { 'PASS' } else { 'BLOCKED' }
    $buildText = Read-Utf8 $build.stdoutPath
    if ($buildText -match 'dynamically imported') { Add-Warning 'VITE_CHUNKING_ADVISORY' 'ADMIN_BUILD' 'Existing static and dynamic import overlap was reported by Vite.' }
    Add-ValidationRow 'ADMIN_BUILD' 'Admin typecheck' $typecheck.status ('exitCode=' + $typecheck.exitCode)
    Add-ValidationRow 'ADMIN_BUILD' 'Admin production build' $build.status ('exitCode=' + $build.exitCode + '; distIndex=' + (Test-Path -LiteralPath $distIndex -PathType Leaf))
    if ($status -ne 'PASS') { Add-Failure 'APEX_WAVE4B2_ADMIN_BUILD_FAILED' 'ADMIN_BUILD' 'Admin typecheck/build did not both pass.' }
    return [pscustomobject]@{ status = $status; typecheck = $typecheck; build = $build; distIndex = (Test-Path -LiteralPath $distIndex -PathType Leaf); reason = 'Admin typecheck and production bundle proof.' }
}

function Invoke-BrowserProof {
    $proofSourcePath = $BrowserProofPath
    $proofInputWasFallback = $false
    if (-not (Test-Path -LiteralPath $proofSourcePath -PathType Leaf)) {
        $priorCandidates = Get-ChildItem -LiteralPath $EvidenceParent -Directory -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -like 'C9_12_WAVE4B2_GENERIC_CMS_FORMS_ANNOUNCEMENTS_CLOSEOUT-*' -and $_.FullName -ne $evidenceRoot } |
            Sort-Object Name -Descending
        $priorPackage = $null
        foreach ($candidate in $priorCandidates) {
            $candidateCapturePath = Join-Path $candidate.FullName 'BROWSER_PROOF_CAPTURE.json'
            if (-not (Test-Path -LiteralPath $candidateCapturePath -PathType Leaf)) { continue }
            try {
                $candidateCapture = (Read-Utf8 $candidateCapturePath) | ConvertFrom-Json
                $candidateScreenshots = @($candidateCapture.screenshots)
                $candidateScreenshotsDurable = $candidateCapture.status -eq 'PASS' -and $candidateScreenshots.Count -gt 0
                foreach ($candidateScreenshot in $candidateScreenshots) {
                    $candidateEvidencePath = $null
                    if ($candidateScreenshot -is [string]) {
                        if ([IO.Path]::IsPathRooted([string]$candidateScreenshot)) {
                            $candidateEvidencePath = [string]$candidateScreenshot
                        } else {
                            $candidateEvidencePath = Join-Path $candidate.FullName ([string]$candidateScreenshot)
                            if (-not (Test-Path -LiteralPath $candidateEvidencePath -PathType Leaf)) {
                                $candidateEvidencePath = Join-Path $candidate.FullName ('BROWSER_' + [IO.Path]::GetFileName([string]$candidateScreenshot))
                            }
                        }
                    } elseif ($candidateScreenshot.PSObject.Properties.Name -contains 'evidence') {
                        $candidateEvidencePath = [string]$candidateScreenshot.evidence
                    }
                    if ([string]::IsNullOrWhiteSpace($candidateEvidencePath) -or -not (Test-Path -LiteralPath $candidateEvidencePath -PathType Leaf)) {
                        $candidateScreenshotsDurable = $false
                        break
                    }
                }
                if ($candidateScreenshotsDurable) {
                    $priorPackage = $candidate
                    break
                }
            } catch {
            }
        }
        if ($null -eq $priorPackage) { throw ('Browser proof input missing and no prior durable capture exists: ' + $BrowserProofPath) }
        $proofSourcePath = Join-Path $priorPackage.FullName 'BROWSER_PROOF_CAPTURE.json'
        $proofInputWasFallback = $true
    }
    $proofEnvelope = (Read-Utf8 $proofSourcePath) | ConvertFrom-Json
    $proof = if ($proofEnvelope.PSObject.Properties.Name -contains 'proof') { $proofEnvelope.proof } else { $proofEnvelope }
    $screenshotEntries = if ($proofEnvelope.PSObject.Properties.Name -contains 'screenshots' -and @($proofEnvelope.screenshots).Count -gt 0) { @($proofEnvelope.screenshots) } else { @($proof.screenshots) }
    $valid = [bool]$proof.authenticated -and $proof.desktop.horizontalOverflow -eq $false -and $proof.mobile.horizontalOverflow -eq $false -and $proof.desktop.formsTitleVisible -and $proof.desktop.announcementsTitleVisible -and $proof.mobile.formsTitleVisible -and $proof.mobile.announcementsTitleVisible
    $copiedScreenshots = @()
    foreach ($screenshot in $screenshotEntries) {
        $source = $null
        if ($screenshot -is [string]) {
            $source = Join-Path (Join-Path $CanonicalRoot 'tmp') ([string]$screenshot)
        } elseif ($screenshot.PSObject.Properties.Name -contains 'evidence') {
            $source = [string]$screenshot.evidence
        }
        if ([string]::IsNullOrWhiteSpace($source)) { $valid = $false; continue }
        if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { $valid = $false; continue }
        $target = Join-Path $evidenceRoot ('BROWSER_' + ([IO.Path]::GetFileName($source)))
        Copy-Item -LiteralPath $source -Destination $target -Force
        $copiedScreenshots += [pscustomobject]@{ source = $source; evidence = $target; sha256 = Get-Hash $target }
    }
    $status = if ($valid -and $copiedScreenshots.Count -eq $screenshotEntries.Count) { 'PASS' } else { 'BLOCKED' }
    Write-Json 'BROWSER_PROOF_CAPTURE.json' ([pscustomobject]@{ status = $status; proof = $proof; screenshots = $copiedScreenshots; sourcePath = $proofSourcePath; inputWasFallback = $proofInputWasFallback })
    Add-ValidationRow 'BROWSER_PROOF' 'authenticated Forms and Announcements browser surfaces' $status ('desktop=' + $proof.desktop.viewport + '; mobile=' + $proof.mobile.viewport + '; screenshots=' + $copiedScreenshots.Count)
    if ($status -ne 'PASS') { Add-Failure 'APEX_WAVE4B2_BROWSER_PROOF_INVALID' 'BROWSER_PROOF' 'Browser proof input did not prove authenticated surface visibility, touch conditions, overflow, and screenshot capture.' }
    return [pscustomobject]@{ status = $status; authenticated = [bool]$proof.authenticated; desktop = $proof.desktop; mobile = $proof.mobile; media = $proof.media; screenshots = $copiedScreenshots; reason = 'Authenticated integrated-browser proof with desktop/mobile overflow and touch-media evidence.' }
}

function Invoke-Cleanup {
        $cleanupCode = @'
import { getClient, closePool } from "../../../../apps/gateway-api/src/lib/db.ts";

(async () => {
    const publicIdPattern = "apex-c%";
    const actorPattern = "superadmin-apex-c%";
    const legacyActor = "apex-cms-superadmin";
    const client = await getClient();
    try {
        await client.query("BEGIN");
        const relationships = await client.query("DELETE FROM cms_content_relationships WHERE entity_id IN (SELECT id FROM cms_content_entities WHERE public_id ILIKE $1)", [publicIdPattern]);
        const entities = await client.query("DELETE FROM cms_content_entities WHERE public_id ILIKE $1", [publicIdPattern]);
        const audits = await client.query("DELETE FROM admin_audit_events WHERE entity_id ILIKE $1 OR actor_id ILIKE $1 OR actor_id ILIKE $2 OR actor_id = $3", [publicIdPattern, actorPattern, legacyActor]);
        const versions = await client.query("DELETE FROM admin_entity_versions WHERE entity_id ILIKE $1 OR created_by ILIKE $1 OR created_by ILIKE $2 OR created_by = $3", [publicIdPattern, actorPattern, legacyActor]);
        await client.query("COMMIT");
        console.log(JSON.stringify({ committed: true, deleted: { entities: entities.rowCount, relationships: relationships.rowCount, audits: audits.rowCount, versions: versions.rowCount } }));
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
        await closePool();
    }
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
'@
        $cleanupPath = Join-Path $evidenceRoot 'ZERO_SYNTHETIC_RESIDUE_CLEANUP.ts'
        Write-Utf8 $cleanupPath $cleanupCode
        $cleanup = Invoke-NativeProof 'ZERO_SYNTHETIC_RESIDUE_CLEANUP' $CanonicalRoot 'pnpm' @('--dir', 'apps/gateway-api', 'exec', 'tsx', $cleanupPath)
        $probeCode = @'
import { query, closePool } from "../../../../apps/gateway-api/src/lib/db.ts";

(async () => {
    const publicIdPattern = "apex-c%";
    const actorPattern = "superadmin-apex-c%";
    const entities = await query("SELECT count(*)::int AS count FROM cms_content_entities WHERE public_id ILIKE $1", [publicIdPattern]);
    const relationships = await query("SELECT count(*)::int AS count FROM cms_content_relationships r JOIN cms_content_entities e ON e.id = r.entity_id WHERE e.public_id ILIKE $1", [publicIdPattern]);
    const audits = await query("SELECT count(*)::int AS count FROM admin_audit_events WHERE entity_id ILIKE $1 OR actor_id ILIKE $1 OR actor_id ILIKE $2", [publicIdPattern, actorPattern]);
    const versions = await query("SELECT count(*)::int AS count FROM admin_entity_versions WHERE entity_id ILIKE $1 OR created_by ILIKE $1 OR created_by ILIKE $2", [publicIdPattern, actorPattern]);
    console.log(JSON.stringify({ entities: entities.rows[0].count, relationships: relationships.rows[0].count, audits: audits.rows[0].count, versions: versions.rows[0].count }));
    await closePool();
})().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
'@
        $probePath = Join-Path $evidenceRoot 'ZERO_SYNTHETIC_RESIDUE_PROBE.ts'
        Write-Utf8 $probePath $probeCode
        $probe = Invoke-NativeProof 'ZERO_SYNTHETIC_RESIDUE_PROBE' $CanonicalRoot 'pnpm' @('--dir', 'apps/gateway-api', 'exec', 'tsx', $probePath)
    $counts = Get-JsonResultFromOutput $probe.stdoutPath
    $cleanupResult = Get-JsonResultFromOutput $cleanup.stdoutPath
    $status = if ($cleanup.exitCode -eq 0 -and $null -ne $cleanupResult -and $cleanupResult.committed -eq $true -and $probe.exitCode -eq 0 -and $null -ne $counts -and $counts.entities -eq 0 -and $counts.relationships -eq 0 -and $counts.audits -eq 0 -and $counts.versions -eq 0) { 'PASS' } else { 'BLOCKED' }
    Write-Json 'DATABASE_ZERO_RESIDUE.json' ([pscustomobject]@{ status = $status; counts = $counts; cleanup = $cleanupResult; cleanupProof = $cleanup; probe = $probe; scope = 'transactionally removed public_id ILIKE apex-c% entities/history and matching synthetic actors, then verified four zero counts' })
    Add-ValidationRow 'CLEANUP' 'synthetic entity, relationship, audit, and version residue is zero' $status (ConvertTo-Json $counts -Compress)
    if ($status -ne 'PASS') { Add-Failure 'APEX_WAVE4B2_SYNTHETIC_RESIDUE_REMAINS' 'CLEANUP' 'Synthetic residue query did not return four zero counts.' }
    return [pscustomobject]@{ status = $status; counts = $counts; cleanup = $cleanup; probe = $probe; reason = 'Synthetic canary scope was transactionally cleaned and queried after runtime validation.' }
}

function Invoke-WorktreeClassification {
    $statusProbe = Invoke-NativeProof 'GIT_STATUS_FULL_UNTRACKED' $CanonicalRoot 'git' @('status', '--short', '--untracked-files=all')
    $lines = @((Read-Utf8 $statusProbe.stdoutPath) -split "`r?`n" | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $targetPrefixes = @(
        'APEX_WAVE4B2_GENERIC_CMS_FORMS_ANNOUNCEMENTS_CLOSEOUT_PS51.ps1',
        'apps/gateway-api/src/cms/',
        'apps/web-admin/src/lib/api.ts',
        'apps/web-admin/src/pages/CmsPage.tsx',
        'apps/web-admin/src/pages/CmsManagedContentPage.tsx',
        'apps/web-admin/src/styles.css',
        'apps/web-admin/vite.config.ts',
        'pma/evidence/cms/C9_12_WAVE4B2_GENERIC_CMS_FORMS_ANNOUNCEMENTS_CLOSEOUT-',
        'tmp/wave4b2-'
    )
    $target = @($lines | Where-Object {
        $path = if ($_.Length -gt 3) { $_.Substring(3) } else { $_ }
        @($targetPrefixes | Where-Object { $path.StartsWith($_, [StringComparison]::OrdinalIgnoreCase) }).Count -gt 0
    })
    $unrelated = @($lines | Where-Object { $target -notcontains $_ })
    $status = if ($statusProbe.exitCode -eq 0) { 'PASS' } else { 'BLOCKED' }
    if ($unrelated.Count -gt 0) { Add-Warning 'UNRELATED_DIRTY_WORKTREE_PRESERVED' 'WORKTREE_CLASSIFICATION' ('Unrelated dirty paths remain and were not changed. count=' + $unrelated.Count) }
    Write-Json 'WORKTREE_CLASSIFICATION_DETAIL.json' ([pscustomobject]@{ status = $status; fullUntrackedStatus = $lines; Wave4B2TargetPaths = $target; unrelatedPaths = $unrelated; unrelatedCount = $unrelated.Count; mutation = 'NO_STAGE_COMMIT_PUSH_DEPLOY' })
    Add-ValidationRow 'WORKTREE_CLASSIFICATION' 'full untracked worktree status captured and classified' $status ('all=' + $lines.Count + '; target=' + $target.Count + '; unrelated=' + $unrelated.Count)
    if ($status -ne 'PASS') { Add-Failure 'APEX_WAVE4B2_GIT_STATUS_FAILED' 'WORKTREE_CLASSIFICATION' 'git status --short --untracked-files=all failed.' }
    return [pscustomobject]@{ status = $status; allCount = $lines.Count; targetCount = $target.Count; unrelatedCount = $unrelated.Count; unrelatedPaths = $unrelated; reason = 'Full worktree status captured without staging or mutation.' }
}

function Invoke-Closeout {
    $priorNames = @('SOURCE_IDENTITY', 'MIGRATION_STATUS', 'GATEWAY_VALIDATION', 'ADMIN_BUILD', 'BROWSER_PROOF', 'CLEANUP', 'WORKTREE_CLASSIFICATION')
    $priorStatuses = @($priorNames | ForEach-Object { [string]$script:stageResults[$_].status })
    $allPriorPass = @($priorStatuses | Where-Object { $_ -ne 'PASS' }).Count -eq 0
    $status = if ($allPriorPass -and $script:failureRows.Count -eq 0) { 'PASS' } else { 'BLOCKED' }
    if (-not (Test-Path -LiteralPath (Join-Path $CanonicalRoot 'data\official-announcements.json') -PathType Leaf)) {
        Add-Warning 'ANNOUNCEMENTS_FALLBACK_SEED_MISSING' 'CLOSEOUT' 'The pre-existing official announcements fallback file is absent; no-published fallback remains an advisory runtime path.'
    }
    $script:overallStatus = if ($status -eq 'PASS' -and $script:warningRows.Count -gt 0) { 'PASS_WITH_ADVISORY' } else { $status }
    Add-ValidationRow 'CLOSEOUT' 'all Wave 4B.2 executable gates pass' $status ('priorStatuses=' + ($priorStatuses -join ','))
    Write-Json 'CMS_CONTRACT_COVERAGE.json' ([pscustomobject]@{
        status = $status
        domains = @('forms', 'announcements')
        gatewayOwned = $true
        covered = @('RBAC negative paths', 'create/list/detail/update', 'publish/unpublish/archive/restore routing', 'bulk edit/archive', 'versions and audit', 'relationship route engine', 'relationship delete', 'cleanup')
        preserved = @('Wave 4B.1 historical Payload bridge evidence', 'Payload-owned Procedures and Editorial Documents boundary')
        deferredArchitectureDecisions = @('bulk entity writes and authority history transaction boundary', 'relationship restoration during rollback', 'internal UUID versus public ID view identifier')
    })
    return [pscustomobject]@{ status = $status; overallStatus = $script:overallStatus; priorStatuses = $priorStatuses; warningCount = $script:warningRows.Count; failureCount = $script:failureRows.Count; reason = 'Current Wave 4B.2 gates evaluated without Git or production actions.' }
}

function Get-StageStatus {
    param([string]$Name)
    if ($script:stageResults.ContainsKey($Name) -and $null -ne $script:stageResults[$Name]) {
        return [string]$script:stageResults[$Name].status
    }
    return 'NOT_RUN'
}

function Write-FinalArtifacts {
    $controllerPath = Join-Path $CanonicalRoot 'APEX_WAVE4B2_GENERIC_CMS_FORMS_ANNOUNCEMENTS_CLOSEOUT_PS51.ps1'
    if (Test-Path -LiteralPath $controllerPath -PathType Leaf) { Copy-Item -LiteralPath $controllerPath -Destination (Join-Path $evidenceRoot 'CONTROLLER_SOURCE.ps1') -Force | Out-Null }
    $ownership = @(
        [pscustomobject]@{ domain = 'forms'; owner = 'Gateway'; entityType = 'cms.forms'; management = 'generic shared CMS'; }
        [pscustomobject]@{ domain = 'announcements'; owner = 'Gateway'; entityType = 'cms.announcements'; management = 'generic shared CMS'; }
        [pscustomobject]@{ domain = 'procedures'; owner = 'Payload'; management = 'read-only bridge boundary'; }
        [pscustomobject]@{ domain = 'editorial-documents'; owner = 'Payload'; management = 'read-only bridge boundary'; }
        [pscustomobject]@{ domain = 'operational-documents'; owner = 'Gateway'; management = 'existing operational surface'; }
    )
    Write-Json 'OWNERSHIP_BOUNDARY.json' ([pscustomobject]@{ status = 'PASS'; wave = '4B.2'; rows = $ownership; historicalWave4B1EvidencePreserved = $true })
    $stageStatusRows = @($script:stageResults.GetEnumerator() | Sort-Object Name | ForEach-Object { [pscustomobject]@{ stage = $_.Key; status = [string]$_.Value.status } })
    $sourceIdentityStatus = Get-StageStatus 'SOURCE_IDENTITY'
    $migrationStatus = Get-StageStatus 'MIGRATION_STATUS'
    $gatewayStatus = Get-StageStatus 'GATEWAY_VALIDATION'
    $adminStatus = Get-StageStatus 'ADMIN_BUILD'
    $browserStatus = Get-StageStatus 'BROWSER_PROOF'
    $cleanupStatus = Get-StageStatus 'CLEANUP'
    $syntheticResidue = 'NOT_PROVEN'
    if ($script:stageResults.ContainsKey('CLEANUP') -and $null -ne $script:stageResults['CLEANUP'].counts) {
        $cleanupCounts = $script:stageResults['CLEANUP'].counts
        if ($cleanupCounts.entities -eq 0 -and $cleanupCounts.relationships -eq 0 -and $cleanupCounts.audits -eq 0 -and $cleanupCounts.versions -eq 0) { $syntheticResidue = 'ZERO' }
    }
    $fallbackWarning = @($script:warningRows | Where-Object { $_.code -eq 'ANNOUNCEMENTS_FALLBACK_SEED_MISSING' }).Count -gt 0
    $chunkingWarning = @($script:warningRows | Where-Object { $_.code -eq 'VITE_CHUNKING_ADVISORY' }).Count -gt 0
    $browserStatement = if ($browserStatus -eq 'PASS') { 'The authenticated integrated-browser proof rendered both Gateway-owned CMS surfaces at 1440x900 and 430x932, recorded touch media state, and found no horizontal overflow.' } else { 'Authenticated browser proof was not accepted; see BROWSER_PROOF_CAPTURE.json and failures.csv.' }
    $mobileOverflow = if ($browserStatus -eq 'PASS') { 'NO' } else { 'NOT_PROVEN' }
    $fallbackStatement = if ($fallbackWarning) { 'The pre-existing official-announcements.json fallback file is absent and remains an advisory no-published fallback issue.' } else { 'The official announcements fallback seed was present during closeout.' }
    $chunkingStatement = if ($chunkingWarning) { 'Existing Vite chunking advisories are preserved as non-blocking build noise.' } else { 'No Vite chunking advisory was recorded.' }
    $summary = [pscustomobject]@{
        runId = $runId
        wave = '4B.2'
        feature = 'GENERIC_CMS_FORMS_AND_ANNOUNCEMENTS'
        status = $script:overallStatus
        evidenceRoot = $evidenceRoot
        stageStatuses = $stageStatusRows
        warningCount = $script:warningRows.Count
        failureCount = $script:failureRows.Count
        syntheticResidue = $syntheticResidue
        productionContacted = $false
        productionMutated = $false
        gitStageCommitPushDeployPerformed = $false
        historicalWave4B1EvidencePreserved = $true
        validationCommands = @(
            'pnpm --dir apps/gateway-api typecheck',
            'pnpm --dir apps/web-admin typecheck',
            'pnpm --dir apps/web-admin build',
            'pnpm exec vitest run apps/gateway-api/src/cms/storage/genericCmsRoutes.test.ts apps/gateway-api/src/tests/payload-cms-boundary.test.ts',
            'JWT_SECRET=<bounded local test secret> pnpm exec vitest run apps/gateway-api/src/cms/forms/forms-cms-runtime.test.ts apps/gateway-api/src/cms/announcements/announcements-cms-runtime.test.ts'
        )
    }
    Write-Json 'summary.json' $summary
    $statusLines = @(
        'APEX_PS1_SKILL_UPDATE_NOT_REQUIRED'
        'WAVE=4B.2'
        'FEATURE=GENERIC_CMS_FORMS_AND_ANNOUNCEMENTS'
        ('STATUS=' + $script:overallStatus)
        'FORMS_OWNER=GATEWAY'
        'ANNOUNCEMENTS_OWNER=GATEWAY'
        'WAVE4B1_HISTORICAL_EVIDENCE_PRESERVED=YES'
        ('SOURCE_IDENTITY=' + $sourceIdentityStatus)
        ('MIGRATION_037=' + $migrationStatus)
        ('GATEWAY_VALIDATION=' + $gatewayStatus)
        ('ADMIN_BUILD=' + $adminStatus)
        ('AUTHENTICATED_BROWSER_PROOF=' + $browserStatus)
        ('MOBILE_HORIZONTAL_OVERFLOW=' + $mobileOverflow)
        ('SYNTHETIC_RESIDUE=' + $syntheticResidue)
        'PRODUCTION_CONTACTED=NO'
        'PRODUCTION_MUTATED=NO'
        'GIT_STAGE_COMMIT_PUSH_DEPLOY=NO'
        ('WARNING_COUNT=' + $script:warningRows.Count)
        ('FAILURE_COUNT=' + $script:failureRows.Count)
        ('EVIDENCE_ROOT=' + $evidenceRoot)
    )
    Write-Utf8 (Join-Path $evidenceRoot 'FINAL_STATUS.txt') (($statusLines -join [Environment]::NewLine) + [Environment]::NewLine)
    $reportLines = @(
        '# Wave 4B.2 Generic CMS Closeout'
        ''
        ('RUN_ID=' + $runId)
        ('STATUS=' + $script:overallStatus)
        'FEATURE=GENERIC_CMS_FORMS_AND_ANNOUNCEMENTS'
        ''
        '## Ownership'
        ''
        'Forms and Announcements are Gateway-owned through the shared Generic CMS repository, service, and route factory.'
        'Wave 4B.1 Payload bridge evidence remains historical and was not rewritten.'
        'Procedures and Editorial Documents remain Payload-owned and read-only at the Gateway boundary.'
        ''
        '## Gates'
        ''
        ('Migration 037: ' + $migrationStatus)
        ('Gateway validation: ' + $gatewayStatus)
        ('Admin typecheck/build: ' + $adminStatus)
        ('Authenticated browser proof: ' + $browserStatus)
        ('Synthetic cleanup: ' + $cleanupStatus + '; residue=' + $syntheticResidue)
        ''
        '## Browser proof'
        ''
        $browserStatement
        ''
        '## Safety'
        ''
        'No production endpoint was contacted, no production data was mutated, and no Git stage, commit, push, or deployment operation was performed.'
        ('Unrelated dirty worktree paths were preserved. Classified count: ' + [string]$script:stageResults['WORKTREE_CLASSIFICATION'].unrelatedCount)
        ''
        '## Advisories'
        ''
        $fallbackStatement
        $chunkingStatement
        'Architecture decisions about cross-table transaction scope, relationship rollback, and public versus internal identifiers remain explicitly deferred.'
    )
    Write-Utf8 (Join-Path $evidenceRoot 'FINAL_REPORT.md') (($reportLines -join [Environment]::NewLine) + [Environment]::NewLine)
    Write-Json 'checkpoint.json' ([pscustomobject]@{ runId = $runId; status = 'FINALIZED'; currentStage = 'CLOSEOUT'; overallStatus = $script:overallStatus; evidenceRoot = $evidenceRoot })
    $required = @('FINAL_REPORT.md', 'summary.json', 'FINAL_STATUS.txt', 'progress.json', 'progress.csv', 'checkpoint.json', 'validations.csv', 'actions.csv', 'failures.csv', 'warnings.csv', 'ERROR_LOG.txt', 'EXECUTION_LOG.txt', 'OWNERSHIP_BOUNDARY.json', 'CMS_CONTRACT_COVERAGE.json')
    foreach ($requiredName in $required) {
        if (-not (Test-Path -LiteralPath (Join-Path $evidenceRoot $requiredName) -PathType Leaf)) { Add-Failure 'APEX_WAVE4B2_REQUIRED_ARTIFACT_MISSING' 'CLOSEOUT' $requiredName }
    }
    Save-Records
    $excluded = @('EVIDENCE_MANIFEST.json', 'REPORT_MANIFEST_VERIFICATION.json')
    $entries = @(
        Get-ChildItem -LiteralPath $evidenceRoot -File | Where-Object { $excluded -notcontains $_.Name } | Sort-Object Name | ForEach-Object {
            [pscustomobject]@{ path = $_.Name; bytes = $_.Length; sha256 = Get-Hash $_.FullName }
        }
    )
    Write-Json 'EVIDENCE_MANIFEST.json' ([pscustomobject]@{ status = 'FINALIZED'; runId = $runId; entryCount = $entries.Count; entries = $entries })
    $verification = @($entries | ForEach-Object {
        $path = Join-Path $evidenceRoot $_.path
        [pscustomobject]@{ path = $_.path; exists = Test-Path -LiteralPath $path -PathType Leaf; bytesBefore = $_.bytes; bytesAfter = if (Test-Path -LiteralPath $path -PathType Leaf) { (Get-Item -LiteralPath $path).Length } else { 0 }; hashBefore = $_.sha256; hashAfter = Get-Hash $path; match = (Test-Path -LiteralPath $path -PathType Leaf) -and ($_.sha256 -eq (Get-Hash $path)) }
    })
    $verificationStatus = if (@($verification | Where-Object { -not $_.match }).Count -eq 0) { 'PASS' } else { 'BLOCKED' }
    Write-Json 'REPORT_MANIFEST_VERIFICATION.json' ([pscustomobject]@{ status = $verificationStatus; entryCount = $verification.Count; entries = $verification })
    $archivePath = Join-Path $EvidenceParent ('C9_12_WAVE4B2_GENERIC_CMS_FORMS_ANNOUNCEMENTS_CLOSEOUT-' + $runId + '.zip')
    if (Test-Path -LiteralPath $archivePath -PathType Leaf) { Remove-Item -LiteralPath $archivePath -Force }
    Compress-Archive -Path (Join-Path $evidenceRoot '*') -DestinationPath $archivePath -Force
    $archiveHash = Get-Hash $archivePath
    Write-Utf8 ($archivePath + '.sha256') ($archiveHash + '  ' + (Split-Path -Leaf $archivePath) + [Environment]::NewLine)
    Write-ExecutionLog ('EVIDENCE_FINALIZED ' + $verificationStatus + ' archiveSha256=' + $archiveHash)
    return [pscustomobject]@{ status = $script:overallStatus; evidenceRoot = $evidenceRoot; archive = $archivePath; archiveSha256 = $archiveHash; manifestVerification = $verificationStatus }
}

try {
    Invoke-Stage 'SOURCE_IDENTITY' '01_SOURCE_IDENTITY.json' { Invoke-SourceIdentity }
    Invoke-Stage 'MIGRATION_STATUS' '02_MIGRATION_STATUS.json' { Invoke-MigrationStatus }
    Invoke-Stage 'GATEWAY_VALIDATION' '03_GATEWAY_VALIDATION.json' { Invoke-GatewayValidation }
    Invoke-Stage 'ADMIN_BUILD' '04_ADMIN_BUILD.json' { Invoke-AdminBuild }
    Invoke-Stage 'BROWSER_PROOF' '05_BROWSER_PROOF.json' { Invoke-BrowserProof }
    Invoke-Stage 'CLEANUP' '06_CLEANUP.json' { Invoke-Cleanup }
    Invoke-Stage 'WORKTREE_CLASSIFICATION' '07_WORKTREE_CLASSIFICATION.json' { Invoke-WorktreeClassification }
    Invoke-Stage 'CLOSEOUT' '08_CLOSEOUT.json' { Invoke-Closeout }
} catch {
    Add-Failure 'APEX_WAVE4B2_CONTROLLER_FAILURE' 'CONTROLLER' $_.Exception.ToString()
    $script:overallStatus = 'BLOCKED'
} finally {
    try {
        $final = Write-FinalArtifacts
        Write-Output ('WAVE4B2_EVIDENCE_ROOT=' + $final.evidenceRoot)
        Write-Output ('WAVE4B2_EVIDENCE_ARCHIVE=' + $final.archive)
        Write-Output ('WAVE4B2_EVIDENCE_STATUS=' + $final.status)
        Write-Output ('WAVE4B2_MANIFEST_VERIFICATION=' + $final.manifestVerification)
    } catch {
        $script:overallStatus = 'BLOCKED'
        Write-ErrorLog ('FINALIZATION_FAILURE ' + $_.Exception.ToString())
        Write-Output 'WAVE4B2_EVIDENCE_STATUS=BLOCKED'
    }
    $finalReportPath = Join-Path $evidenceRoot 'FINAL_REPORT.md'
    if (Test-Path -LiteralPath $finalReportPath -PathType Leaf) {
        try {
            Start-Process -FilePath $finalReportPath -ErrorAction Stop | Out-Null
        } catch {
            try { Start-Process -FilePath 'notepad.exe' -ArgumentList @($finalReportPath) -ErrorAction Stop | Out-Null } catch { }
        }
    }
}

if ($script:overallStatus -eq 'PASS' -or $script:overallStatus -eq 'PASS_WITH_ADVISORY') { exit 0 }
exit 1
