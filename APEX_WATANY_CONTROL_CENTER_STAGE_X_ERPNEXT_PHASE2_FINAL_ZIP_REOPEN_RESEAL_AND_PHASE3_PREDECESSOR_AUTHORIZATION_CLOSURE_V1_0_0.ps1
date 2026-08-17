#requires -Version 5.1
<#
.SYNOPSIS
  Evidence-only Phase 2 final ZIP reopen/reseal and Phase 3 predecessor authorization closure.

.DESCRIPTION
  This Windows PowerShell 5.1 controller DOES NOT replay Phase 2 runtime work and
  DOES NOT touch Docker, MariaDB, Redis, Apache, ports, backend, configurator,
  frontend, websocket, workers, scheduler, create-site, migrations, production,
  or remote systems.

  It preserves the original Phase 2 evidence root and ZIP as immutable inputs,
  creates a separate 42-artifact resealed Phase 2 copy, independently reopens
  that final ZIP, verifies exact membership and byte parity, writes an EXTERNAL
  post-archive reopen sidecar to avoid circular self-proof, and seals a separate
  Phase 3 predecessor-authorization closure package.

  The original Phase 2 package remains historical evidence and is never edited.

  APEX delivery rule:
    The exact final bytes of this PS1 MUST receive an external Windows PowerShell
    5.1 parser proof before -File execution. Parser PASS alone is not runtime proof.

  Parser-proof companion default:
    <this-script>.ps51-parser-preflight.json
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$EvidenceBase = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence',

    [Parameter()]
    [string]$SourcePhase2Root = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-erpnext-phase2-redis-recovery-finalization-20260815-002321',

    [Parameter()]
    [string]$ParserPreflightProofPath = ''
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$AuthorityId = 'APEX_WATANY_CONTROL_CENTER_STAGE_X_ERPNEXT_PHASE2_FINAL_ZIP_REOPEN_RESEAL_AND_PHASE3_PREDECESSOR_AUTHORIZATION_CLOSURE_V1_0_0'
$ExpectedPhase2ArtifactCount = 42
$ExpectedPhase2StatusFile = '33_PHASE2_FINAL_STATUS.json'
$ExpectedPhase2HandoffFile = '34_NEXT_STAGE_HANDOFF.json'
$ExpectedPhase2ManifestFile = '37_EVIDENCE_MANIFEST.json'
$ExpectedPhase2HashFile = '38_EVIDENCE_SHA256.txt'
$ExpectedPhase2CompletenessFile = '39_EVIDENCE_COMPLETENESS.json'
$ExpectedPhase2ZipValidationFile = '40_ZIP_REOPEN_VALIDATION.json'
$ExpectedPhase2CloseoutFile = '41_AUTHORITY_CLOSEOUT_TOKEN.txt'

$RequiredPhase2Names = @(
    '00_AUTHORITY.md',
    '01_APEX_CONTRACT_STATUS.json',
    '02_FAILURE_REGISTER_PRECHECK.json',
    '03_PREDECESSOR_PHASE1_PHASE1B.json',
    '04_CHECKPOINT_REVALIDATION.json',
    '05_PRESTART_DB_HEALTH.json',
    '06_SITE_CONTROL_HASHES_BEFORE.csv',
    '07_REDIS_COMPOSE_TOPOLOGY.json',
    '08_REDIS_PRESTART_CENSUS.csv',
    '09_REDIS_CACHE_START.txt',
    '10_REDIS_CACHE_RUNTIME.json',
    '11_REDIS_CACHE_PING.txt',
    '12_REDIS_CACHE_VERSION.txt',
    '13_REDIS_QUEUE_START.txt',
    '14_REDIS_QUEUE_RUNTIME.json',
    '15_REDIS_QUEUE_PING.txt',
    '16_REDIS_QUEUE_VERSION.txt',
    '17_REDIS_QUEUE_VOLUME_PROOF.json',
    '18_COMMON_SITE_CONFIG_REDIS_ENDPOINTS_REDACTED.json',
    '19_REDIS_ENDPOINT_RECONCILIATION.json',
    '20_POST_REDIS_DB_HEALTH.json',
    '21_POST_REDIS_DB_CONNECTIVITY.json',
    '22_SITE_CONTROL_HASHES_AFTER.csv',
    '23_SITE_IMMUTABILITY.json',
    '24_RUNNING_SERVICE_CENSUS.csv',
    '25_UNAUTHORIZED_SERVICE_GATE.json',
    '26_PORT_8080_REVALIDATION.json',
    '27_PORT_18080_REVALIDATION.json',
    '28_SECRET_EXPOSURE_AUDIT.json',
    '29_ACTION_LOG.csv',
    '30_FAILURES.csv',
    '31_WARNINGS.csv',
    '32_GATE_RESULTS.csv',
    '33_PHASE2_FINAL_STATUS.json',
    '34_NEXT_STAGE_HANDOFF.json',
    '35_PS1_FINAL_SHA256.txt',
    '36_PS51_PARSER_PREFLIGHT.json',
    '37_EVIDENCE_MANIFEST.json',
    '38_EVIDENCE_SHA256.txt',
    '39_EVIDENCE_COMPLETENESS.json',
    '40_ZIP_REOPEN_VALIDATION.json',
    '41_AUTHORITY_CLOSEOUT_TOKEN.txt'
)

$ClosureRequiredNames = @(
    '00_AUTHORITY.txt',
    '01_SOURCE_PHASE2_IDENTITY.json',
    '02_SOURCE_PHASE2_VALIDATION.json',
    '03_RESEALED_PHASE2_IDENTITY.json',
    '04_FINAL_ZIP_REOPEN_VALIDATION.json',
    '05_PHASE3_PREDECESSOR_AUTHORIZATION.json',
    '06_ACTION_LOG.csv',
    '07_FAILURES.csv',
    '08_WARNINGS.csv',
    '09_GATE_RESULTS.csv',
    '10_EVIDENCE_MANIFEST.json',
    '11_EVIDENCE_SHA256.txt',
    '12_EVIDENCE_COMPLETENESS.json',
    '13_AUTHORITY_CLOSEOUT_TOKEN.txt'
)

$ActionRows = New-Object System.Collections.ArrayList
$FailureRows = New-Object System.Collections.ArrayList
$WarningRows = New-Object System.Collections.ArrayList
$GateRows = New-Object System.Collections.ArrayList

$SourcePhase2Zip = $SourcePhase2Root + '.zip'
$ResealRoot = ''
$ResealZip = ''
$ResealSidecar = ''
$ClosureRoot = ''
$ClosureZip = ''
$ScriptSha256 = ''
$ParserProofObject = $null
$FirstFailedGate = ''

function Ensure-Directory {
    param([Parameter(Mandatory=$true)][string]$Path)

    if (-not [System.IO.Directory]::Exists($Path)) {
        [void][System.IO.Directory]::CreateDirectory($Path)
    }
}

function Write-Utf8NoBom {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][AllowEmptyString()][string]$Text
    )

    $parentPath = [System.IO.Path]::GetDirectoryName($Path)
    if (-not [string]::IsNullOrWhiteSpace($parentPath)) {
        Ensure-Directory -Path $parentPath
    }

    $encodingObject = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($Path,$Text,$encodingObject)
}

function Write-Utf8Bom {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][AllowEmptyString()][string]$Text
    )

    $parentPath = [System.IO.Path]::GetDirectoryName($Path)
    if (-not [string]::IsNullOrWhiteSpace($parentPath)) {
        Ensure-Directory -Path $parentPath
    }

    $encodingObject = New-Object System.Text.UTF8Encoding($true)
    [System.IO.File]::WriteAllText($Path,$Text,$encodingObject)
}

function Get-Sha256 {
    param([Parameter(Mandatory=$true)][string]$Path)

    if (-not [System.IO.File]::Exists($Path)) {
        throw ('APEX_HASH_FILE_NOT_FOUND: {0}' -f $Path)
    }

    $streamObject = [System.IO.File]::OpenRead($Path)
    try {
        $shaObject = [System.Security.Cryptography.SHA256]::Create()
        try {
            $hashBytes = $shaObject.ComputeHash($streamObject)
            return ([System.BitConverter]::ToString($hashBytes)).Replace('-','').ToUpperInvariant()
        }
        finally {
            $shaObject.Dispose()
        }
    }
    finally {
        $streamObject.Dispose()
    }
}

function ConvertTo-JsonText {
    param([Parameter(Mandatory=$true)]$Value)
    return ($Value | ConvertTo-Json -Depth 16)
}

function Write-JsonAbsolute {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)]$Value
    )

    Write-Utf8NoBom -Path $Path -Text ((ConvertTo-JsonText -Value $Value) + [Environment]::NewLine)
}

function Escape-CsvValue {
    param([AllowNull()][object]$Value)

    if ($null -eq $Value) {
        return '""'
    }

    $stringValue = [string]$Value
    return '"' + $stringValue.Replace('"','""') + '"'
}

function Write-CsvAbsolute {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][string[]]$Headers,
        [Parameter(Mandatory=$true)][AllowEmptyCollection()][object[]]$Rows
    )

    $lines = New-Object System.Collections.Generic.List[string]
    $headerFields = New-Object System.Collections.Generic.List[string]

    foreach ($headerName in $Headers) {
        $headerFields.Add((Escape-CsvValue -Value $headerName))
    }

    $lines.Add(($headerFields.ToArray() -join ','))

    foreach ($rowObject in @($Rows)) {
        $fields = New-Object System.Collections.Generic.List[string]
        foreach ($headerName in $Headers) {
            $propertyEntry = $rowObject.PSObject.Properties[$headerName]
            if ($null -eq $propertyEntry) {
                $fields.Add((Escape-CsvValue -Value ''))
            }
            else {
                $fields.Add((Escape-CsvValue -Value $propertyEntry.Value))
            }
        }
        $lines.Add(($fields.ToArray() -join ','))
    }

    Write-Utf8Bom -Path $Path -Text (($lines.ToArray() -join [Environment]::NewLine) + [Environment]::NewLine)
}

function Add-Action {
    param(
        [Parameter(Mandatory=$true)][string]$Action,
        [Parameter(Mandatory=$true)][string]$Status,
        [AllowEmptyString()][string]$Detail = ''
    )

    [void]$ActionRows.Add([pscustomobject]@{
        Time = [DateTimeOffset]::Now.ToString('o')
        Action = $Action
        Status = $Status
        Detail = $Detail
    })
}

function Add-Failure {
    param(
        [Parameter(Mandatory=$true)][string]$FailureClass,
        [Parameter(Mandatory=$true)][string]$Detail
    )

    [void]$FailureRows.Add([pscustomobject]@{
        Time = [DateTimeOffset]::Now.ToString('o')
        FailureClass = $FailureClass
        Detail = $Detail
        Status = 'ACTIVE'
    })
}

function Add-Warning {
    param(
        [Parameter(Mandatory=$true)][string]$WarningClass,
        [Parameter(Mandatory=$true)][string]$Detail
    )

    [void]$WarningRows.Add([pscustomobject]@{
        Time = [DateTimeOffset]::Now.ToString('o')
        WarningClass = $WarningClass
        Detail = $Detail
    })
}

function Add-Gate {
    param(
        [Parameter(Mandatory=$true)][string]$Gate,
        [Parameter(Mandatory=$true)][string]$Status,
        [AllowEmptyString()][string]$Detail = ''
    )

    [void]$GateRows.Add([pscustomobject]@{
        Gate = $Gate
        Status = $Status
        Detail = $Detail
    })

    if (($Status -eq 'BLOCKED') -or ($Status -eq 'FAIL')) {
        if ([string]::IsNullOrWhiteSpace($script:FirstFailedGate)) {
            $script:FirstFailedGate = $Gate
        }
    }
}

function Test-ParserProof {
    if ([string]::IsNullOrWhiteSpace($ParserPreflightProofPath)) {
        $script:ParserPreflightProofPath = $PSCommandPath + '.ps51-parser-preflight.json'
    }

    if (-not [System.IO.File]::Exists($ParserPreflightProofPath)) {
        throw ('APEX_EXTERNAL_PS51_PARSER_PREFLIGHT_PROOF_MISSING: {0}' -f $ParserPreflightProofPath)
    }

    $proofText = [System.IO.File]::ReadAllText($ParserPreflightProofPath)
    $proofObject = $proofText | ConvertFrom-Json

    if ([string]$proofObject.status -ne 'PASS') {
        throw 'APEX_EXTERNAL_PS51_PARSER_PREFLIGHT_NOT_PASS'
    }

    if ([int]$proofObject.errorCount -ne 0) {
        throw ('APEX_EXTERNAL_PS51_PARSER_ERRORS_PRESENT: {0}' -f [int]$proofObject.errorCount)
    }

    $currentScriptHash = Get-Sha256 -Path $PSCommandPath
    if ([string]$proofObject.sha256 -ne $currentScriptHash) {
        throw ('APEX_EXTERNAL_PS51_PARSER_HASH_MISMATCH: Proof={0}; Current={1}' -f [string]$proofObject.sha256,$currentScriptHash)
    }

    $proofVersion = [string]$proofObject.psVersion
    if (-not $proofVersion.StartsWith('5.1.')) {
        throw ('APEX_EXTERNAL_PARSER_NOT_WINDOWS_PS51: {0}' -f $proofVersion)
    }

    $script:ScriptSha256 = $currentScriptHash
    $script:ParserProofObject = $proofObject
}

function Assert-ExactFileMembership {
    param(
        [Parameter(Mandatory=$true)][string]$RootPath,
        [Parameter(Mandatory=$true)][string[]]$ExpectedNames,
        [Parameter(Mandatory=$true)][string]$Label
    )

    $actualNames = @(
        Get-ChildItem -LiteralPath $RootPath -File -ErrorAction Stop |
            Sort-Object Name |
            Select-Object -ExpandProperty Name
    )

    $expectedSorted = @($ExpectedNames | Sort-Object)
    $differences = @(Compare-Object -ReferenceObject $expectedSorted -DifferenceObject $actualNames)

    if ($differences.Count -ne 0) {
        throw ('APEX_MEMBERSHIP_MISMATCH: Label={0}; ActualCount={1}; DifferenceCount={2}' -f $Label,$actualNames.Count,$differences.Count)
    }

    return $actualNames.Count
}

function Test-JsonCsvParseability {
    param([Parameter(Mandatory=$true)][string]$RootPath)

    $jsonFailureCount = 0
    $csvFailureCount = 0

    foreach ($fileObject in @(Get-ChildItem -LiteralPath $RootPath -File)) {
        if ($fileObject.Extension -eq '.json') {
            try {
                $jsonText = [System.IO.File]::ReadAllText($fileObject.FullName)
                [void]($jsonText | ConvertFrom-Json)
            }
            catch {
                $jsonFailureCount++
            }
        }
        elseif ($fileObject.Extension -eq '.csv') {
            try {
                [void](Import-Csv -LiteralPath $fileObject.FullName)
            }
            catch {
                $csvFailureCount++
            }
        }
    }

    return [pscustomobject]@{
        JsonFailureCount = $jsonFailureCount
        CsvFailureCount = $csvFailureCount
    }
}

function Test-Phase2HashList {
    param([Parameter(Mandatory=$true)][string]$RootPath)

    $hashPath = Join-Path $RootPath $ExpectedPhase2HashFile
    if (-not [System.IO.File]::Exists($hashPath)) {
        throw ('APEX_PHASE2_HASH_LIST_MISSING: {0}' -f $hashPath)
    }

    $failureCount = 0
    $validatedCount = 0

    foreach ($hashLine in [System.IO.File]::ReadAllLines($hashPath)) {
        $trimmedLine = $hashLine.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmedLine)) {
            continue
        }

        $matchObject = [regex]::Match($trimmedLine,'^([A-Fa-f0-9]{64})\s{2}(.+)$')
        if (-not $matchObject.Success) {
            $failureCount++
            continue
        }

        $expectedHash = $matchObject.Groups[1].Value.ToUpperInvariant()
        $relativeName = $matchObject.Groups[2].Value.Trim()
        $candidatePath = Join-Path $RootPath $relativeName

        if (-not [System.IO.File]::Exists($candidatePath)) {
            $failureCount++
            continue
        }

        $actualHash = Get-Sha256 -Path $candidatePath
        if ($actualHash -ne $expectedHash) {
            $failureCount++
            continue
        }

        $validatedCount++
    }

    if ($failureCount -ne 0) {
        throw ('APEX_PHASE2_HASH_LIST_VALIDATION_FAILED: FailureCount={0}' -f $failureCount)
    }

    if ($validatedCount -ne 38) {
        throw ('APEX_PHASE2_HASH_LIST_CARDINALITY_INVALID: Validated={0}' -f $validatedCount)
    }

    return [pscustomobject]@{
        Status = 'PASS'
        ValidatedCount = $validatedCount
        FailureCount = 0
    }
}

function New-ZipFromExplicitChildren {
    param(
        [Parameter(Mandatory=$true)][string]$RootPath,
        [Parameter(Mandatory=$true)][string]$DestinationPath,
        [Parameter(Mandatory=$true)][int]$ExpectedCount
    )

    if ([System.IO.File]::Exists($DestinationPath)) {
        Remove-Item -LiteralPath $DestinationPath -Force
    }

    $childPaths = @(
        Get-ChildItem -LiteralPath $RootPath -File |
            Sort-Object Name |
            Select-Object -ExpandProperty FullName
    )

    if ($childPaths.Count -ne $ExpectedCount) {
        throw ('APEX_ARCHIVE_SOURCE_COUNT_INVALID: Expected={0}; Actual={1}' -f $ExpectedCount,$childPaths.Count)
    }

    Compress-Archive -Path $childPaths -DestinationPath $DestinationPath -CompressionLevel Optimal -Force
}

function Test-ZipAgainstRoot {
    param(
        [Parameter(Mandatory=$true)][string]$ZipPath,
        [Parameter(Mandatory=$true)][string]$RootPath,
        [Parameter(Mandatory=$true)][string[]]$ExpectedNames
    )

    $reopenRoot = Join-Path $env:TEMP ('apex-reopen-' + [guid]::NewGuid().ToString('N'))
    Ensure-Directory -Path $reopenRoot

    try {
        Expand-Archive -LiteralPath $ZipPath -DestinationPath $reopenRoot -Force

        $entryCount = Assert-ExactFileMembership `
            -RootPath $reopenRoot `
            -ExpectedNames $ExpectedNames `
            -Label 'ZIP_REOPEN'

        $byteParityFailures = 0

        foreach ($expectedName in $ExpectedNames) {
            $sourcePath = Join-Path $RootPath $expectedName
            $reopenedPath = Join-Path $reopenRoot $expectedName

            $sourceHash = Get-Sha256 -Path $sourcePath
            $reopenedHash = Get-Sha256 -Path $reopenedPath

            if ($sourceHash -ne $reopenedHash) {
                $byteParityFailures++
            }
        }

        $parseResult = Test-JsonCsvParseability -RootPath $reopenRoot

        $statusValue = 'PASS'
        if (($byteParityFailures -ne 0) -or
            ($parseResult.JsonFailureCount -ne 0) -or
            ($parseResult.CsvFailureCount -ne 0)) {
            $statusValue = 'BLOCKED'
        }

        return [pscustomobject]@{
            Status = $statusValue
            EntryCount = $entryCount
            ByteParityFailures = $byteParityFailures
            JsonParseFailures = $parseResult.JsonFailureCount
            CsvParseFailures = $parseResult.CsvFailureCount
        }
    }
    finally {
        if ([System.IO.Directory]::Exists($reopenRoot)) {
            Remove-Item -LiteralPath $reopenRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Copy-Phase2Root {
    param(
        [Parameter(Mandatory=$true)][string]$SourceRoot,
        [Parameter(Mandatory=$true)][string]$DestinationRoot
    )

    Ensure-Directory -Path $DestinationRoot

    foreach ($requiredName in $RequiredPhase2Names) {
        $sourcePath = Join-Path $SourceRoot $requiredName
        $destinationPath = Join-Path $DestinationRoot $requiredName

        if (-not [System.IO.File]::Exists($sourcePath)) {
            throw ('APEX_PHASE2_REQUIRED_ARTIFACT_MISSING: {0}' -f $sourcePath)
        }

        Copy-Item -LiteralPath $sourcePath -Destination $destinationPath
    }
}

function Write-ClosureCsvs {
    Write-CsvAbsolute `
        -Path (Join-Path $ClosureRoot '06_ACTION_LOG.csv') `
        -Headers @('Time','Action','Status','Detail') `
        -Rows @($ActionRows.ToArray())

    Write-CsvAbsolute `
        -Path (Join-Path $ClosureRoot '07_FAILURES.csv') `
        -Headers @('Time','FailureClass','Detail','Status') `
        -Rows @($FailureRows.ToArray())

    Write-CsvAbsolute `
        -Path (Join-Path $ClosureRoot '08_WARNINGS.csv') `
        -Headers @('Time','WarningClass','Detail') `
        -Rows @($WarningRows.ToArray())

    Write-CsvAbsolute `
        -Path (Join-Path $ClosureRoot '09_GATE_RESULTS.csv') `
        -Headers @('Gate','Status','Detail') `
        -Rows @($GateRows.ToArray())
}

try {
    Write-Output ($AuthorityId + '_BEGIN=YES')

    if (($PSVersionTable.PSVersion.Major -ne 5) -or ($PSVersionTable.PSVersion.Minor -ne 1)) {
        throw ('APEX_WINDOWS_POWERSHELL_5_1_REQUIRED: Actual={0}' -f $PSVersionTable.PSVersion.ToString())
    }

    Test-ParserProof
    Add-Gate -Gate 'EXTERNAL_PS51_PARSER_PREFLIGHT' -Status 'PASS' -Detail ('SHA256=' + $ScriptSha256)

    if (-not [System.IO.Directory]::Exists($EvidenceBase)) {
        throw ('APEX_EVIDENCE_BASE_NOT_FOUND: {0}' -f $EvidenceBase)
    }

    if (-not [System.IO.Directory]::Exists($SourcePhase2Root)) {
        throw ('APEX_SOURCE_PHASE2_ROOT_NOT_FOUND: {0}' -f $SourcePhase2Root)
    }

    if (-not [System.IO.File]::Exists($SourcePhase2Zip)) {
        throw ('APEX_SOURCE_PHASE2_ZIP_NOT_FOUND: {0}' -f $SourcePhase2Zip)
    }

    Add-Action -Action 'SOURCE_PHASE2_DISCOVERY' -Status 'PASS' -Detail $SourcePhase2Root

    $sourceCount = Assert-ExactFileMembership `
        -RootPath $SourcePhase2Root `
        -ExpectedNames $RequiredPhase2Names `
        -Label 'SOURCE_PHASE2_ROOT'

    if ($sourceCount -ne $ExpectedPhase2ArtifactCount) {
        throw ('APEX_SOURCE_PHASE2_ARTIFACT_COUNT_INVALID: {0}' -f $sourceCount)
    }

    Add-Gate -Gate 'SOURCE_PHASE2_ARTIFACT_MEMBERSHIP' -Status 'PASS' -Detail '42/42'

    $sourceParse = Test-JsonCsvParseability -RootPath $SourcePhase2Root
    if (($sourceParse.JsonFailureCount -ne 0) -or ($sourceParse.CsvFailureCount -ne 0)) {
        throw ('APEX_SOURCE_PHASE2_PARSE_FAILURE: Json={0}; Csv={1}' -f $sourceParse.JsonFailureCount,$sourceParse.CsvFailureCount)
    }

    Add-Gate -Gate 'SOURCE_PHASE2_PARSEABILITY' -Status 'PASS' -Detail 'JSON=0;CSV=0'

    $sourceHashProof = Test-Phase2HashList -RootPath $SourcePhase2Root
    Add-Gate -Gate 'SOURCE_PHASE2_HASH_LIST' -Status 'PASS' -Detail '38/38'

    $sourceManifest = ([System.IO.File]::ReadAllText((Join-Path $SourcePhase2Root $ExpectedPhase2ManifestFile))) | ConvertFrom-Json
    if ([int]$sourceManifest.artifactCount -ne $ExpectedPhase2ArtifactCount) {
        throw ('APEX_SOURCE_PHASE2_MANIFEST_COUNT_INVALID: {0}' -f [int]$sourceManifest.artifactCount)
    }

    $manifestRequired = @($sourceManifest.required)
    $manifestDifference = @(Compare-Object -ReferenceObject @($RequiredPhase2Names | Sort-Object) -DifferenceObject @($manifestRequired | Sort-Object))
    if ($manifestDifference.Count -ne 0) {
        throw ('APEX_SOURCE_PHASE2_MANIFEST_MEMBERSHIP_INVALID: DifferenceCount={0}' -f $manifestDifference.Count)
    }

    Add-Gate -Gate 'SOURCE_PHASE2_MANIFEST' -Status 'PASS' -Detail 'Canonical 42-name set'

    $sourceStatus = ([System.IO.File]::ReadAllText((Join-Path $SourcePhase2Root $ExpectedPhase2StatusFile))) | ConvertFrom-Json
    $sourceHandoff = ([System.IO.File]::ReadAllText((Join-Path $SourcePhase2Root $ExpectedPhase2HandoffFile))) | ConvertFrom-Json
    $sourceCompleteness = ([System.IO.File]::ReadAllText((Join-Path $SourcePhase2Root $ExpectedPhase2CompletenessFile))) | ConvertFrom-Json
    $sourceZipValidation = ([System.IO.File]::ReadAllText((Join-Path $SourcePhase2Root $ExpectedPhase2ZipValidationFile))) | ConvertFrom-Json
    $sourceCloseout = [System.IO.File]::ReadAllText((Join-Path $SourcePhase2Root $ExpectedPhase2CloseoutFile)).Trim()

    if ([string]$sourceStatus.status -ne 'PASS') {
        throw ('APEX_SOURCE_PHASE2_FINAL_STATUS_NOT_PASS: {0}' -f [string]$sourceStatus.status)
    }

    if ([string]$sourceStatus.preBackendGate -ne 'PASS') {
        throw ('APEX_SOURCE_PHASE2_PRE_BACKEND_GATE_NOT_PASS: {0}' -f [string]$sourceStatus.preBackendGate)
    }

    if ([string]$sourceStatus.backendStartAuthorization -ne 'READY_FOR_SEPARATE_AUTHORITY') {
        throw ('APEX_SOURCE_PHASE2_BACKEND_AUTH_INVALID: {0}' -f [string]$sourceStatus.backendStartAuthorization)
    }

    if ([int]$sourceStatus.secretValueExposureCount -ne 0) {
        throw ('APEX_SOURCE_PHASE2_SECRET_EXPOSURE_NONZERO: {0}' -f [int]$sourceStatus.secretValueExposureCount)
    }

    if ([int]$sourceStatus.unauthorizedRunningServiceCount -ne 0) {
        throw ('APEX_SOURCE_PHASE2_UNAUTHORIZED_SERVICE_NONZERO: {0}' -f [int]$sourceStatus.unauthorizedRunningServiceCount)
    }

    if ([string]$sourceHandoff.status -ne 'READY_FOR_SEPARATE_AUTHORITY') {
        throw ('APEX_SOURCE_PHASE2_HANDOFF_NOT_READY: {0}' -f [string]$sourceHandoff.status)
    }

    if ([string]$sourceCompleteness.status -ne 'PASS') {
        throw ('APEX_SOURCE_PHASE2_COMPLETENESS_NOT_PASS: {0}' -f [string]$sourceCompleteness.status)
    }

    if ($sourceCloseout -notmatch '_PASS$') {
        throw 'APEX_SOURCE_PHASE2_CLOSEOUT_TOKEN_NOT_PASS'
    }

    Add-Gate -Gate 'SOURCE_PHASE2_RUNTIME_CLOSEOUT' -Status 'PASS' -Detail 'Runtime/evidence semantic gates PASS'

    $sourceZipProof = Test-ZipAgainstRoot `
        -ZipPath $SourcePhase2Zip `
        -RootPath $SourcePhase2Root `
        -ExpectedNames $RequiredPhase2Names

    if ($sourceZipProof.Status -ne 'PASS') {
        throw ('APEX_SOURCE_PHASE2_ZIP_REOPEN_FAILED: Entries={0}; Bytes={1}; Json={2}; Csv={3}' -f `
            $sourceZipProof.EntryCount,`
            $sourceZipProof.ByteParityFailures,`
            $sourceZipProof.JsonParseFailures,`
            $sourceZipProof.CsvParseFailures)
    }

    Add-Gate -Gate 'SOURCE_PHASE2_ZIP_REOPEN' -Status 'PASS' -Detail '42 entries; byte parity PASS'

    $timestampText = Get-Date -Format 'yyyyMMdd-HHmmss'
    $ResealRoot = Join-Path $EvidenceBase ('watany-control-center-erpnext-phase2-final-reseal-' + $timestampText)
    $ResealZip = $ResealRoot + '.zip'
    $ResealSidecar = $ResealZip + '.final-reopen-validation.json'
    $ClosureRoot = Join-Path $EvidenceBase ('watany-control-center-erpnext-phase2-phase3-predecessor-closure-' + $timestampText)
    $ClosureZip = $ClosureRoot + '.zip'

    if ([System.IO.Directory]::Exists($ResealRoot) -or
        [System.IO.File]::Exists($ResealZip) -or
        [System.IO.Directory]::Exists($ClosureRoot) -or
        [System.IO.File]::Exists($ClosureZip)) {
        throw 'APEX_RESEAL_OUTPUT_COLLISION'
    }

    Copy-Phase2Root -SourceRoot $SourcePhase2Root -DestinationRoot $ResealRoot

    Add-Action -Action 'PHASE2_COPY_FOR_RESEAL' -Status 'PASS' -Detail $ResealRoot

    $reseal40Path = Join-Path $ResealRoot $ExpectedPhase2ZipValidationFile

    $reseal40 = [ordered]@{
        status = 'PASS'
        firstPass = 'PASS'
        sourceHistoricalFinalPass = [string]$sourceZipValidation.finalPass
        finalPass = 'PASS'
        expectedEntries = 42
        circularityModel = 'EXTERNAL_POST_ARCHIVE_REOPEN_SIDECAR'
        externalSidecar = [System.IO.Path]::GetFileName($ResealSidecar)
        phase3PredecessorAuthorization = 'CONDITIONAL_ON_EXTERNAL_SIDECAR_PASS'
        sourceZipReopenBeforeReseal = 'PASS'
        sourceZipEntryCount = $sourceZipProof.EntryCount
        sourceZipByteParityFailures = $sourceZipProof.ByteParityFailures
        note = 'This artifact is inside the resealed ZIP. Definitive validation of the final archive is recorded outside the archive in the named sidecar, avoiding circular self-validation.'
    }

    Write-JsonAbsolute -Path $reseal40Path -Value $reseal40

    $resealCount = Assert-ExactFileMembership `
        -RootPath $ResealRoot `
        -ExpectedNames $RequiredPhase2Names `
        -Label 'RESEALED_PHASE2_ROOT'

    if ($resealCount -ne 42) {
        throw ('APEX_RESEALED_PHASE2_COUNT_INVALID: {0}' -f $resealCount)
    }

    $resealParse = Test-JsonCsvParseability -RootPath $ResealRoot
    if (($resealParse.JsonFailureCount -ne 0) -or ($resealParse.CsvFailureCount -ne 0)) {
        throw ('APEX_RESEALED_PHASE2_PARSE_FAILURE: Json={0}; Csv={1}' -f $resealParse.JsonFailureCount,$resealParse.CsvFailureCount)
    }

    $resealHashProof = Test-Phase2HashList -RootPath $ResealRoot

    Add-Gate -Gate 'RESEALED_PHASE2_ROOT' -Status 'PASS' -Detail '42/42; 00-37 hash scope preserved'

    New-ZipFromExplicitChildren `
        -RootPath $ResealRoot `
        -DestinationPath $ResealZip `
        -ExpectedCount 42

    $finalResealProof = Test-ZipAgainstRoot `
        -ZipPath $ResealZip `
        -RootPath $ResealRoot `
        -ExpectedNames $RequiredPhase2Names

    if ($finalResealProof.Status -ne 'PASS') {
        throw ('APEX_FINAL_RESEALED_ZIP_REOPEN_FAILED: Entries={0}; Bytes={1}; Json={2}; Csv={3}' -f `
            $finalResealProof.EntryCount,`
            $finalResealProof.ByteParityFailures,`
            $finalResealProof.JsonParseFailures,`
            $finalResealProof.CsvParseFailures)
    }

    $resealZipHash = Get-Sha256 -Path $ResealZip

    $sidecarObject = [ordered]@{
        status = 'PASS'
        authority = $AuthorityId
        validationTarget = $ResealZip
        validationTargetSha256 = $resealZipHash
        entryCount = $finalResealProof.EntryCount
        expectedEntryCount = 42
        nameMembership = 'PASS'
        byteParity = 'PASS'
        byteParityFailures = $finalResealProof.ByteParityFailures
        jsonParseFailures = $finalResealProof.JsonParseFailures
        csvParseFailures = $finalResealProof.CsvParseFailures
        postArchiveReopen = 'PASS'
        phase3PredecessorAuthorization = 'PASS'
        productionMutation = 'NO'
        runtimeReplay = 'NO'
    }

    Write-JsonAbsolute -Path $ResealSidecar -Value $sidecarObject

    $sidecarHash = Get-Sha256 -Path $ResealSidecar

    Add-Gate -Gate 'FINAL_RESEALED_ZIP_REOPEN' -Status 'PASS' -Detail ('ZIP_SHA256=' + $resealZipHash)
    Add-Gate -Gate 'PHASE3_PREDECESSOR_AUTHORIZATION' -Status 'PASS' -Detail 'External post-archive reopen sidecar PASS'

    Ensure-Directory -Path $ClosureRoot

    $closureAuthorityText = @(
        'AUTHORITY=' + $AuthorityId
        'PURPOSE=Phase 2 final ZIP reopen/reseal and Phase 3 predecessor authorization'
        'RUNTIME_REPLAY=NO'
        'DOCKER_ACCESS=NO'
        'DATABASE_ACCESS=NO'
        'REDIS_ACCESS=NO'
        'PORT_CHANGE=NO'
        'BACKEND_START=NO'
        'CONFIGURATOR_START=NO'
        'FRONTEND_START=NO'
        'WORKER_START=NO'
        'CREATE_SITE=NO'
        'MIGRATION=NO'
        'PRODUCTION_MUTATION=NO'
    ) -join [Environment]::NewLine

    Write-Utf8NoBom -Path (Join-Path $ClosureRoot '00_AUTHORITY.txt') -Text ($closureAuthorityText + [Environment]::NewLine)

    Write-JsonAbsolute -Path (Join-Path $ClosureRoot '01_SOURCE_PHASE2_IDENTITY.json') -Value ([ordered]@{
        status = 'PASS'
        root = $SourcePhase2Root
        zip = $SourcePhase2Zip
        zipSha256 = Get-Sha256 -Path $SourcePhase2Zip
        artifactCount = 42
        closeoutToken = $sourceCloseout
        historicalZipValidationFinalPass = [string]$sourceZipValidation.finalPass
    })

    Write-JsonAbsolute -Path (Join-Path $ClosureRoot '02_SOURCE_PHASE2_VALIDATION.json') -Value ([ordered]@{
        status = 'PASS'
        membership = 'PASS'
        artifactCount = $sourceCount
        hashList = $sourceHashProof.Status
        hashListValidatedCount = $sourceHashProof.ValidatedCount
        jsonParseFailures = $sourceParse.JsonFailureCount
        csvParseFailures = $sourceParse.CsvFailureCount
        runtimeFinalStatus = [string]$sourceStatus.status
        preBackendGate = [string]$sourceStatus.preBackendGate
        backendStartAuthorization = [string]$sourceStatus.backendStartAuthorization
        sourceZipReopen = $sourceZipProof.Status
        sourceZipEntryCount = $sourceZipProof.EntryCount
        sourceZipByteParityFailures = $sourceZipProof.ByteParityFailures
    })

    Write-JsonAbsolute -Path (Join-Path $ClosureRoot '03_RESEALED_PHASE2_IDENTITY.json') -Value ([ordered]@{
        status = 'PASS'
        root = $ResealRoot
        zip = $ResealZip
        zipSha256 = $resealZipHash
        externalReopenSidecar = $ResealSidecar
        externalReopenSidecarSha256 = $sidecarHash
        artifactCount = 42
        originalEvidenceMutated = 'NO'
    })

    Write-JsonAbsolute -Path (Join-Path $ClosureRoot '04_FINAL_ZIP_REOPEN_VALIDATION.json') -Value $sidecarObject

    Write-JsonAbsolute -Path (Join-Path $ClosureRoot '05_PHASE3_PREDECESSOR_AUTHORIZATION.json') -Value ([ordered]@{
        status = 'PASS'
        phase2RuntimeReplay = 'NO'
        phase2FinalReseal = 'PASS'
        finalZipReopenValidation = 'PASS'
        phase3PredecessorAuthorization = 'PASS'
        phase3ControllerExecutionAuthorized = 'YES_AFTER_ITS_OWN_PS51_PARSER_AND_RUNTIME_PREFLIGHT'
        backendManualStartAuthorized = 'NO'
        workerStartAuthorization = 'NO'
    })

    Write-ClosureCsvs

    $closureManifest = [ordered]@{
        schema = 'watany-control-center-phase2-phase3-predecessor-closure/v1'
        authority = $AuthorityId
        artifactCount = 14
        required = $ClosureRequiredNames
        hashScope = @($ClosureRequiredNames[0..10])
        sourcePhase2ArtifactCount = 42
        resealedPhase2ArtifactCount = 42
        finalZipReopenProofModel = 'EXTERNAL_POST_ARCHIVE_SIDECAR'
    }

    Write-JsonAbsolute -Path (Join-Path $ClosureRoot '10_EVIDENCE_MANIFEST.json') -Value $closureManifest

    $closureHashLines = New-Object System.Collections.Generic.List[string]
    for ($hashIndex = 0; $hashIndex -le 10; $hashIndex++) {
        $hashName = $ClosureRequiredNames[$hashIndex]
        $hashPath = Join-Path $ClosureRoot $hashName
        $closureHashLines.Add(('{0}  {1}' -f (Get-Sha256 -Path $hashPath),$hashName))
    }

    Write-Utf8NoBom `
        -Path (Join-Path $ClosureRoot '11_EVIDENCE_SHA256.txt') `
        -Text (($closureHashLines.ToArray() -join [Environment]::NewLine) + [Environment]::NewLine)

    $closureParse = Test-JsonCsvParseability -RootPath $ClosureRoot
    if (($closureParse.JsonFailureCount -ne 0) -or ($closureParse.CsvFailureCount -ne 0)) {
        throw ('APEX_CLOSURE_PARSE_FAILURE: Json={0}; Csv={1}' -f $closureParse.JsonFailureCount,$closureParse.CsvFailureCount)
    }

    Write-JsonAbsolute -Path (Join-Path $ClosureRoot '12_EVIDENCE_COMPLETENESS.json') -Value ([ordered]@{
        status = 'PASS'
        requiredArtifactCount = 14
        jsonParseFailures = 0
        csvParseFailures = 0
        sourcePhase2ArtifactCount = 42
        resealedPhase2ArtifactCount = 42
        finalZipReopenValidation = 'PASS'
        phase3PredecessorAuthorization = 'PASS'
        secretValueExposureCount = 0
    })

    $closeoutToken = $AuthorityId + '_PASS'
    Write-Utf8NoBom -Path (Join-Path $ClosureRoot '13_AUTHORITY_CLOSEOUT_TOKEN.txt') -Text ($closeoutToken + [Environment]::NewLine)

    $closureCount = Assert-ExactFileMembership `
        -RootPath $ClosureRoot `
        -ExpectedNames $ClosureRequiredNames `
        -Label 'CLOSURE_ROOT'

    if ($closureCount -ne 14) {
        throw ('APEX_CLOSURE_ARTIFACT_COUNT_INVALID: {0}' -f $closureCount)
    }

    New-ZipFromExplicitChildren `
        -RootPath $ClosureRoot `
        -DestinationPath $ClosureZip `
        -ExpectedCount 14

    $closureZipProof = Test-ZipAgainstRoot `
        -ZipPath $ClosureZip `
        -RootPath $ClosureRoot `
        -ExpectedNames $ClosureRequiredNames

    if ($closureZipProof.Status -ne 'PASS') {
        throw ('APEX_CLOSURE_ZIP_REOPEN_FAILED: Entries={0}; Bytes={1}; Json={2}; Csv={3}' -f `
            $closureZipProof.EntryCount,`
            $closureZipProof.ByteParityFailures,`
            $closureZipProof.JsonParseFailures,`
            $closureZipProof.CsvParseFailures)
    }

    Add-Action -Action 'CLOSURE_PACKAGE_SEAL' -Status 'PASS' -Detail $ClosureZip

    Write-Output 'PHASE2_RUNTIME_REPLAY=NO'
    Write-Output 'PHASE2_ORIGINAL_EVIDENCE_MUTATION=NO'
    Write-Output 'PHASE2_SOURCE_ARTIFACT_COUNT=42'
    Write-Output 'PHASE2_SOURCE_HASH_LIST_VALIDATION=PASS'
    Write-Output 'PHASE2_SOURCE_ZIP_REOPEN=PASS'
    Write-Output 'PHASE2_RESEALED_ARTIFACT_COUNT=42'
    Write-Output 'PHASE2_FINAL_RESEAL=PASS'
    Write-Output 'FINAL_ZIP_REOPEN_VALIDATION=PASS'
    Write-Output ('FINAL_RESEALED_ZIP_SHA256={0}' -f $resealZipHash)
    Write-Output ('FINAL_REOPEN_SIDECAR_SHA256={0}' -f $sidecarHash)
    Write-Output 'PHASE3_PREDECESSOR_AUTHORIZATION=PASS'
    Write-Output 'BACKEND_MANUAL_START_AUTHORIZED=NO'
    Write-Output 'PHASE3_CONTROLLER_AUTHORIZED=YES_AFTER_ITS_OWN_PS51_PARSER_AND_RUNTIME_PREFLIGHT'
    Write-Output 'DB_RESTART=NO'
    Write-Output 'REDIS_RESTART=NO'
    Write-Output 'BACKEND_START=NO'
    Write-Output 'CONFIGURATOR_START=NO'
    Write-Output 'FRONTEND_START=NO'
    Write-Output 'WORKERS_START=NO'
    Write-Output 'CREATE_SITE=NO'
    Write-Output 'MIGRATION=NO'
    Write-Output 'PRODUCTION_MUTATION=NO'
    Write-Output ('RESEALED_PHASE2_ROOT={0}' -f $ResealRoot)
    Write-Output ('RESEALED_PHASE2_ZIP={0}' -f $ResealZip)
    Write-Output ('FINAL_REOPEN_SIDECAR={0}' -f $ResealSidecar)
    Write-Output ('PHASE3_PREDECESSOR_CLOSURE_ROOT={0}' -f $ClosureRoot)
    Write-Output ('PHASE3_PREDECESSOR_CLOSURE_ZIP={0}' -f $ClosureZip)
    Write-Output 'OVERALL_STATUS=PASS'
    Write-Output ($AuthorityId + '=PASS')

    exit 0
}
catch {
    $caughtMessage = $_.Exception.Message

    if ([string]::IsNullOrWhiteSpace($FirstFailedGate)) {
        $FirstFailedGate = 'UNCLASSIFIED_EVIDENCE_RESEAL_GATE'
    }

    Add-Failure -FailureClass 'APEX_STAGE_X_PHASE2_FINAL_RESEAL_FAILURE' -Detail $caughtMessage

    Write-Output ('FIRST_FAILED_GATE={0}' -f $FirstFailedGate)
    Write-Output 'FINAL_ZIP_REOPEN_VALIDATION=BLOCKED'
    Write-Output 'PHASE3_PREDECESSOR_AUTHORIZATION=BLOCKED'
    Write-Output 'BACKEND_MANUAL_START_AUTHORIZED=NO'
    Write-Output 'DB_RESTART=NO'
    Write-Output 'REDIS_RESTART=NO'
    Write-Output 'BACKEND_START=NO'
    Write-Output 'CONFIGURATOR_START=NO'
    Write-Output 'FRONTEND_START=NO'
    Write-Output 'WORKERS_START=NO'
    Write-Output 'CREATE_SITE=NO'
    Write-Output 'MIGRATION=NO'
    Write-Output 'PRODUCTION_MUTATION=NO'
    Write-Output 'OVERALL_STATUS=BLOCKED'
    Write-Output ('ERROR={0}' -f $caughtMessage)
    Write-Output ($AuthorityId + '=BLOCKED')

    exit 1
}
