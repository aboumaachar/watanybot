#requires -Version 5.1
<#
.SYNOPSIS
  APEX Stage X ERPNext Phase 2 Redis runtime recovery evidence finalizer V1.0.1.

.DESCRIPTION
  Resume-aware Windows PowerShell 5.1 controller for the already-recovered local
  ERPNext/Frappe deployment.

  This controller DOES NOT replay Redis startup when redis-cache and redis-queue
  are already running. It adopts the proven runtime, independently revalidates
  every Phase 2 gate, compares the preserved site control files against the
  pre-Redis recovery checkpoint, emits the required 42-artifact evidence package,
  creates and reopens the evidence ZIP, and only then opens the PRE_BACKEND_GATE.

  V1.0.1 permanently eliminated the V1.0.0 Windows PowerShell 5.1 multiline-shell
  native-argument transport failure class.

  V1.0.2 eliminated:
    APEX_PS51_DOCKER_GO_TEMPLATE_QUOTED_STRING_NATIVE_ARGUMENT_CORRUPTION

  V1.0.3 additionally eliminates:
    APEX_PS51_STRICTMODE_OPTIONAL_DOCKER_HEALTH_PROPERTY_ACCESS

  Docker inspect JSON is not schema-identical across containers. Containers
  without a Docker healthcheck omit State.Health entirely. Under Set-StrictMode,
  direct access to a missing property terminates execution. V1.0.3 therefore
  uses PSObject.Properties-based optional-property readers for Docker State,
  Health, Labels, Networks and Mounts, with explicit NOT_DEFINED semantics.

  Hard prohibitions:
    - no create-site
    - no migration execution
    - no configurator
    - no backend
    - no frontend
    - no websocket
    - no queue workers
    - no scheduler
    - no Apache stop/restart
    - no port mutation
    - no production deployment
    - no remote mutation

  IMPORTANT APEX DELIVERY RULE:
    The exact final bytes of this file MUST be externally parsed by Windows
    PowerShell 5.1 before -File execution. The controller requires the resulting
    parser-proof JSON and refuses substantive execution without it.

  Generate the parser proof from Windows PowerShell 5.1 BEFORE running this file:

    $scriptPath = '<FULL PATH TO THIS PS1>'
    $parseTokens = $null
    $parseErrors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile(
        $scriptPath,
        [ref]$parseTokens,
        [ref]$parseErrors
    )
    $sha = [System.Security.Cryptography.SHA256]::Create()
    try {
        $stream = [System.IO.File]::OpenRead($scriptPath)
        try {
            $scriptHash = ([System.BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '')
        }
        finally {
            $stream.Dispose()
        }
    }
    finally {
        $sha.Dispose()
    }
    $proof = [ordered]@{
        status = $(if (@($parseErrors).Count -eq 0) { 'PASS' } else { 'BLOCKED' })
        sha256 = $scriptHash
        errorCount = @($parseErrors).Count
        psVersion = $PSVersionTable.PSVersion.ToString()
        errors = @($parseErrors | ForEach-Object { $_.Message })
    }
    $proof | ConvertTo-Json -Depth 6 |
        Set-Content -LiteralPath ($scriptPath + '.ps51-parser-preflight.json') -Encoding UTF8

  Then execute:

    powershell.exe -NoProfile -ExecutionPolicy Bypass -File "<FULL PATH TO THIS PS1>"
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$WatanyBotRoot = 'C:\xampp\htdocs\projectx\watanybot',

    [Parameter()]
    [string]$ControlCenterRoot = 'C:\xampp\htdocs\projectx\watany-control-center',

    [Parameter()]
    [string]$EvidenceBase = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence',

    [Parameter()]
    [string]$ParserPreflightProofPath = ''
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$ScriptVersion = 'V1_0_3'
$AuthorityId = 'APEX_WATANY_CONTROL_CENTER_STAGE_X_ERPNEXT_PHASE2_REDIS_RUNTIME_RECOVERY_EVIDENCE_FINALIZATION_PS51_OPTIONAL_DOCKER_STATE_PROPERTY_NULL_SAFE_REPAIR_AND_PRE_BACKEND_GATE_CLOSURE_V1_0_3'
$ProjectName = 'frappe_docker'
$FrappeDockerRoot = Join-Path $ControlCenterRoot 'erpnext\frappe_docker'
$PwdFile = Join-Path $FrappeDockerRoot 'pwd.yml'
$DbContainerName = 'frappe_docker-db-1'
$RedisCacheContainerName = 'frappe_docker-redis-cache-1'
$RedisQueueContainerName = 'frappe_docker-redis-queue-1'
$SitesVolumeName = 'frappe_docker_sites'
$DbVolumeName = 'frappe_docker_db-data'
$RedisQueueVolumeName = 'frappe_docker_redis-queue-data'
$ExpectedNetworkName = 'frappe_docker_frappe_network'
$ExpectedRedisImage = 'redis:6.2-alpine'
$ExpectedDbImage = 'mariadb:11.8'
$ExpectedErpImage = 'frappe/erpnext:v16.32.0'
$ExpectedSiteName = 'frontend'
$StartedAt = [DateTimeOffset]::Now

$FailureRegisterPath = Join-Path $WatanyBotRoot 'pma\feature-gates\04_PROGRAM_FAILURE_AND_REGRESSION_REGISTER.md'
$ApexSkillCandidates = @(
    (Join-Path $WatanyBotRoot '.pma\skills\apex-ps1\SKILL.md'),
    (Join-Path $WatanyBotRoot '.github\skills\apex-ps1\SKILL.md')
)

$KnownPhase2FailureClasses = @(
    'APEX_STAGE_X_PHASE2_REDIS_CACHE_START_FAILED',
    'APEX_STAGE_X_PHASE2_REDIS_QUEUE_START_FAILED',
    'APEX_STAGE_X_PHASE2_REDIS_IMAGE_MISMATCH',
    'APEX_STAGE_X_PHASE2_REDIS_ALIAS_MISSING',
    'APEX_STAGE_X_PHASE2_REDIS_PING_FAILED',
    'APEX_STAGE_X_PHASE2_REDIS_VERSION_MISMATCH',
    'APEX_STAGE_X_PHASE2_REDIS_QUEUE_VOLUME_MISSING',
    'APEX_STAGE_X_PHASE2_REDIS_QUEUE_VOLUME_MOUNT_MISMATCH',
    'APEX_STAGE_X_PHASE2_REDIS_ENDPOINT_RECONCILIATION_FAILED',
    'APEX_STAGE_X_PHASE2_REDIS_UNAUTHORIZED_DEPENDENCY_STARTED',
    'APEX_STAGE_X_PHASE2_SITE_CONFIG_DRIFT',
    'APEX_STAGE_X_PHASE2_DB_HEALTH_REGRESSION',
    'APEX_STAGE_X_PHASE2_SECRET_EXPOSURE',
    'APEX_PS51_DOCKER_MULTILINE_SH_LC_NATIVE_ARGUMENT_TRANSPORT_CORRUPTION',
    'APEX_PS51_DOCKER_GO_TEMPLATE_QUOTED_STRING_NATIVE_ARGUMENT_CORRUPTION',
    'APEX_PS51_STRICTMODE_OPTIONAL_DOCKER_HEALTH_PROPERTY_ACCESS',
    'APEX_PS51_INTERACTIVE_SPLIT_IF_ELSE_EXECUTION'
)

$ForbiddenServiceNames = @(
    'configurator',
    'create-site',
    'backend',
    'frontend',
    'websocket',
    'queue-short',
    'queue-long',
    'scheduler'
)

$AllowedServiceNames = @(
    'db',
    'redis-cache',
    'redis-queue'
)

$RequiredEvidenceNames = @(
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

$ActionRows = New-Object System.Collections.ArrayList
$FailureRows = New-Object System.Collections.ArrayList
$WarningRows = New-Object System.Collections.ArrayList
$GateRows = New-Object System.Collections.ArrayList

$EvidenceRoot = ''
$EvidenceZipPath = ''
$FinalStatus = 'NOT_STARTED'
$FirstFailedGate = ''
$SecretExposureCount = 0
$UnauthorizedRunningServiceCount = 0
$SiteHashDriftCount = 0
$CheckpointRoot = ''
$ParserProofObject = $null
$ScriptSha256 = ''
$PreBackendGate = 'BLOCKED'
$BackendStartAuthorization = 'NO'

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
    [System.IO.File]::WriteAllText($Path, $Text, $encodingObject)
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
    [System.IO.File]::WriteAllText($Path, $Text, $encodingObject)
}

function New-ContainerHelperScript {
    param(
        [Parameter(Mandatory=$true)][string]$Label,
        [Parameter(Mandatory=$true)][string]$ScriptText
    )

    $helperRoot = Join-Path $env:TEMP ('apex-container-helper-' + [guid]::NewGuid().ToString('N'))
    Ensure-Directory -Path $helperRoot
    $helperPath = Join-Path $helperRoot 'helper.sh'

    # Docker/Linux shell helper requirements:
    # - UTF-8 without BOM
    # - LF only
    # - immutable/read-only bind mount during execution
    # - never passed as a multiline native argument
    $normalizedText = $ScriptText.Replace("`r`n","`n").Replace("`r","`n")
    if (-not $normalizedText.EndsWith("`n")) {
        $normalizedText = $normalizedText + "`n"
    }

    $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($helperPath, $normalizedText, $utf8NoBom)

    $rawBytes = [System.IO.File]::ReadAllBytes($helperPath)
    if ($rawBytes.Length -lt 1) {
        throw ('APEX_CONTAINER_HELPER_EMPTY: {0}' -f $Label)
    }

    if (($rawBytes.Length -ge 3) -and
        ($rawBytes[0] -eq 0xEF) -and
        ($rawBytes[1] -eq 0xBB) -and
        ($rawBytes[2] -eq 0xBF)) {
        throw ('APEX_CONTAINER_HELPER_UTF8_BOM_FORBIDDEN: {0}' -f $Label)
    }

    foreach ($byteValue in $rawBytes) {
        if ($byteValue -eq 0x0D) {
            throw ('APEX_CONTAINER_HELPER_CR_BYTE_FORBIDDEN: {0}' -f $Label)
        }
    }

    return [pscustomobject]@{
        Root = $helperRoot
        Path = $helperPath
        ContainerPath = '/apex/helper.sh'
        Sha256 = Get-Sha256 -Path $helperPath
    }
}

function Remove-ContainerHelperScript {
    param([AllowNull()]$HelperObject)

    if ($null -eq $HelperObject) {
        return
    }

    $helperRootValue = [string]$HelperObject.Root
    if ((-not [string]::IsNullOrWhiteSpace($helperRootValue)) -and
        [System.IO.Directory]::Exists($helperRootValue)) {
        Remove-Item -LiteralPath $helperRootValue -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Invoke-DockerShellHelper {
    param(
        [Parameter(Mandatory=$true)][string]$Label,
        [Parameter(Mandatory=$true)][string]$ScriptText,
        [Parameter(Mandatory=$true)][string[]]$DockerArgumentsBeforeImage,
        [Parameter(Mandatory=$true)][string]$ImageName
    )

    $helperObject = $null
    try {
        $helperObject = New-ContainerHelperScript -Label $Label -ScriptText $ScriptText

        $argumentList = New-Object System.Collections.Generic.List[string]
        $argumentList.Add('run')
        $argumentList.Add('--rm')

        foreach ($dockerArgument in $DockerArgumentsBeforeImage) {
            $argumentList.Add($dockerArgument)
        }

        $argumentList.Add('--mount')
        $argumentList.Add(('type=bind,source={0},target={1},readonly' -f $helperObject.Path,$helperObject.ContainerPath))
        $argumentList.Add('--entrypoint')
        $argumentList.Add('sh')
        $argumentList.Add($ImageName)
        $argumentList.Add($helperObject.ContainerPath)

        Add-ActionRow -Action ($Label + '_TRANSPORT') -Status 'PASS' -Detail (
            'Mode=READONLY_BIND_MOUNT; HelperSha256={0}; MultilineNativeArgument=NO' -f $helperObject.Sha256
        )

        return Get-DockerResult -ArgumentVector $argumentList.ToArray() -Label $Label
    }
    finally {
        Remove-ContainerHelperScript -HelperObject $helperObject
    }
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
            return ([System.BitConverter]::ToString($hashBytes)).Replace('-', '').ToUpperInvariant()
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

function Write-JsonFile {
    param(
        [Parameter(Mandatory=$true)][string]$Name,
        [Parameter(Mandatory=$true)]$Value
    )
    $targetPath = Join-Path $EvidenceRoot $Name
    Write-Utf8NoBom -Path $targetPath -Text ((ConvertTo-JsonText -Value $Value) + [Environment]::NewLine)
}

function Escape-CsvValue {
    param([AllowNull()][object]$Value)
    if ($null -eq $Value) {
        return '""'
    }
    $stringValue = [string]$Value
    return '"' + $stringValue.Replace('"', '""') + '"'
}

function Write-CsvFile {
    param(
        [Parameter(Mandatory=$true)][string]$Name,
        [Parameter(Mandatory=$true)][string[]]$Headers,
        [Parameter(Mandatory=$true)][object[]]$Rows
    )
    $lines = New-Object System.Collections.Generic.List[string]
    $headerFields = New-Object System.Collections.Generic.List[string]
    foreach ($headerName in $Headers) {
        $headerFields.Add((Escape-CsvValue -Value $headerName))
    }
    $lines.Add(($headerFields.ToArray() -join ','))

    foreach ($rowObject in $Rows) {
        $fields = New-Object System.Collections.Generic.List[string]
        foreach ($headerName in $Headers) {
            $propertyObject = $rowObject.PSObject.Properties[$headerName]
            if ($null -eq $propertyObject) {
                $fields.Add((Escape-CsvValue -Value ''))
            }
            else {
                $fields.Add((Escape-CsvValue -Value $propertyObject.Value))
            }
        }
        $lines.Add(($fields.ToArray() -join ','))
    }
    Write-Utf8Bom -Path (Join-Path $EvidenceRoot $Name) -Text (($lines.ToArray() -join [Environment]::NewLine) + [Environment]::NewLine)
}

function Add-ActionRow {
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

function Add-WarningRow {
    param(
        [Parameter(Mandatory=$true)][string]$Class,
        [Parameter(Mandatory=$true)][string]$Detail
    )
    [void]$WarningRows.Add([pscustomobject]@{
        Time = [DateTimeOffset]::Now.ToString('o')
        WarningClass = $Class
        Detail = $Detail
    })
}

function Add-GateRow {
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

function Register-FailureClass {
    param(
        [Parameter(Mandatory=$true)][string]$Class,
        [Parameter(Mandatory=$true)][string]$Detail
    )

    [void]$FailureRows.Add([pscustomobject]@{
        Time = [DateTimeOffset]::Now.ToString('o')
        FailureClass = $Class
        Detail = $Detail
        Status = 'ACTIVE'
    })

    if (-not [System.IO.File]::Exists($FailureRegisterPath)) {
        Add-WarningRow -Class 'APEX_FAILURE_REGISTER_NOT_FOUND' -Detail $FailureRegisterPath
        return
    }

    $registerText = [System.IO.File]::ReadAllText($FailureRegisterPath)
    if ($registerText.IndexOf($Class, [System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        return
    }

    $appendText = @(
        '',
        ('### {0}' -f $Class),
        '',
        ('- First seen: {0}' -f [DateTimeOffset]::Now.ToString('o')),
        '- Stage: Stage X ERPNext Phase 2 Redis finalization',
        ('- Detail: {0}' -f $Detail.Replace("`r",' ').Replace("`n",' ')),
        '- Required guard: register before replacement; full-chain revalidation required.',
        '- Status: ACTIVE',
        ''
    ) -join [Environment]::NewLine

    $utf8Bom = New-Object System.Text.UTF8Encoding($true)
    [System.IO.File]::AppendAllText($FailureRegisterPath, $appendText, $utf8Bom)
}

function Invoke-NativeCaptured {
    param(
        [Parameter(Mandatory=$true)][string]$FilePath,
        [Parameter()][string[]]$ArgumentVector = @(),
        [Parameter(Mandatory=$true)][string]$Label,
        [Parameter()][switch]$AllowStderr,
        [Parameter()][int[]]$AllowedExitCodes = @(0)
    )

    $tempRoot = Join-Path $env:TEMP ('apex-native-' + [guid]::NewGuid().ToString('N'))
    Ensure-Directory -Path $tempRoot
    $stdoutPath = Join-Path $tempRoot 'stdout.txt'
    $stderrPath = Join-Path $tempRoot 'stderr.txt'

    try {
        & $FilePath @ArgumentVector 1> $stdoutPath 2> $stderrPath
        $nativeExitCode = $LASTEXITCODE

        $stdoutText = ''
        $stderrText = ''
        if ([System.IO.File]::Exists($stdoutPath)) {
            $stdoutText = [System.IO.File]::ReadAllText($stdoutPath)
        }
        if ([System.IO.File]::Exists($stderrPath)) {
            $stderrText = [System.IO.File]::ReadAllText($stderrPath)
        }

        $exitAllowed = $false
        foreach ($allowedExitCode in $AllowedExitCodes) {
            if ($nativeExitCode -eq $allowedExitCode) {
                $exitAllowed = $true
                break
            }
        }

        if (-not $exitAllowed) {
            throw ('APEX_NATIVE_EXIT_FAILED: Label={0}; Exit={1}; Stderr={2}' -f $Label,$nativeExitCode,$stderrText.Trim())
        }

        if ((-not $AllowStderr) -and (-not [string]::IsNullOrWhiteSpace($stderrText))) {
            throw ('APEX_NATIVE_STDERR_FAILED: Label={0}; Stderr={1}' -f $Label,$stderrText.Trim())
        }

        Add-ActionRow -Action $Label -Status 'PASS' -Detail ('Exit={0}; StdoutBytes={1}; StderrBytes={2}' -f $nativeExitCode,$stdoutText.Length,$stderrText.Length)

        return [pscustomobject]@{
            Label = $Label
            ExitCode = $nativeExitCode
            Stdout = $stdoutText
            Stderr = $stderrText
        }
    }
    finally {
        if ([System.IO.Directory]::Exists($tempRoot)) {
            Remove-Item -LiteralPath $tempRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-DockerResult {
    param(
        [Parameter(Mandatory=$true)][string[]]$ArgumentVector,
        [Parameter(Mandatory=$true)][string]$Label,
        [Parameter()][switch]$AllowStderr
    )
    return Invoke-NativeCaptured -FilePath 'docker.exe' -ArgumentVector $ArgumentVector -Label $Label -AllowStderr:$AllowStderr
}

function Get-Lines {
    param([AllowEmptyString()][string]$Text)
    if ([string]::IsNullOrWhiteSpace($Text)) {
        return @()
    }
    $rawLines = $Text -split "`r?`n"
    $resultLines = New-Object System.Collections.Generic.List[string]
    foreach ($rawLine in $rawLines) {
        $trimmedLine = ([string]$rawLine).Trim()
        if (-not [string]::IsNullOrWhiteSpace($trimmedLine)) {
            $resultLines.Add($trimmedLine)
        }
    }
    return @($resultLines.ToArray())
}

function Get-OptionalPropertyValue {
    param(
        [AllowNull()]$ObjectValue,
        [Parameter(Mandatory=$true)][string]$PropertyName,
        [AllowNull()]$DefaultValue = $null
    )

    if ($null -eq $ObjectValue) {
        return $DefaultValue
    }

    $propertyCollection = $ObjectValue.PSObject.Properties
    if ($null -eq $propertyCollection) {
        return $DefaultValue
    }

    $propertyEntry = $propertyCollection[$PropertyName]
    if ($null -eq $propertyEntry) {
        return $DefaultValue
    }

    return $propertyEntry.Value
}

function Get-DockerStateHealthStatus {
    param([Parameter(Mandatory=$true)]$InspectObject)

    $stateObject = Get-OptionalPropertyValue `
        -ObjectValue $InspectObject `
        -PropertyName 'State' `
        -DefaultValue $null

    if ($null -eq $stateObject) {
        return 'NOT_DEFINED'
    }

    $healthObject = Get-OptionalPropertyValue `
        -ObjectValue $stateObject `
        -PropertyName 'Health' `
        -DefaultValue $null

    if ($null -eq $healthObject) {
        return 'NOT_DEFINED'
    }

    $statusValue = Get-OptionalPropertyValue `
        -ObjectValue $healthObject `
        -PropertyName 'Status' `
        -DefaultValue ''

    if ([string]::IsNullOrWhiteSpace([string]$statusValue)) {
        return 'NOT_DEFINED'
    }

    return [string]$statusValue
}

function Get-DockerStateStatus {
    param([Parameter(Mandatory=$true)]$InspectObject)

    $stateObject = Get-OptionalPropertyValue `
        -ObjectValue $InspectObject `
        -PropertyName 'State' `
        -DefaultValue $null

    if ($null -eq $stateObject) {
        return 'NOT_DEFINED'
    }

    $statusValue = Get-OptionalPropertyValue `
        -ObjectValue $stateObject `
        -PropertyName 'Status' `
        -DefaultValue ''

    if ([string]::IsNullOrWhiteSpace([string]$statusValue)) {
        return 'NOT_DEFINED'
    }

    return [string]$statusValue
}

function Get-DockerInspectObject {
    param(
        [Parameter(Mandatory=$true)][string]$ContainerReference,
        [Parameter(Mandatory=$true)][string]$Label
    )

    $inspectResult = Get-DockerResult `
        -ArgumentVector @('inspect',$ContainerReference) `
        -Label $Label

    if ([string]::IsNullOrWhiteSpace($inspectResult.Stdout)) {
        throw ('APEX_DOCKER_INSPECT_JSON_EMPTY: {0}' -f $ContainerReference)
    }

    try {
        $inspectArray = @($inspectResult.Stdout | ConvertFrom-Json)
    }
    catch {
        throw ('APEX_DOCKER_INSPECT_JSON_PARSE_FAILED: {0}' -f $ContainerReference)
    }

    if ($inspectArray.Count -ne 1) {
        throw ('APEX_DOCKER_INSPECT_CARDINALITY_INVALID: Ref={0}; Count={1}' -f $ContainerReference,$inspectArray.Count)
    }

    return $inspectArray[0]
}

function Get-NetworkNamesFromInspect {
    param([Parameter(Mandatory=$true)]$InspectObject)

    $names = New-Object System.Collections.Generic.List[string]

    $networkSettingsObject = Get-OptionalPropertyValue `
        -ObjectValue $InspectObject `
        -PropertyName 'NetworkSettings' `
        -DefaultValue $null

    $networksObject = Get-OptionalPropertyValue `
        -ObjectValue $networkSettingsObject `
        -PropertyName 'Networks' `
        -DefaultValue $null

    if ($null -eq $networksObject) {
        return @()
    }

    foreach ($networkProperty in $networksObject.PSObject.Properties) {
        $names.Add([string]$networkProperty.Name)
    }

    return @($names.ToArray())
}

function Get-NetworkAliasesFromInspect {
    param(
        [Parameter(Mandatory=$true)]$InspectObject,
        [Parameter(Mandatory=$true)][string]$NetworkName
    )

    $aliases = New-Object System.Collections.Generic.List[string]

    $networkSettingsObject = Get-OptionalPropertyValue `
        -ObjectValue $InspectObject `
        -PropertyName 'NetworkSettings' `
        -DefaultValue $null

    $networksObject = Get-OptionalPropertyValue `
        -ObjectValue $networkSettingsObject `
        -PropertyName 'Networks' `
        -DefaultValue $null

    if ($null -eq $networksObject) {
        return @()
    }

    $networkProperty = $networksObject.PSObject.Properties[$NetworkName]
    if ($null -eq $networkProperty) {
        return @()
    }

    $aliasValues = @(
        Get-OptionalPropertyValue `
            -ObjectValue $networkProperty.Value `
            -PropertyName 'Aliases' `
            -DefaultValue @()
    )

    foreach ($aliasValue in $aliasValues) {
        if (-not [string]::IsNullOrWhiteSpace([string]$aliasValue)) {
            $aliases.Add([string]$aliasValue)
        }
    }

    return @($aliases.ToArray())
}

function Get-MountRowsFromInspect {
    param([Parameter(Mandatory=$true)]$InspectObject)

    $rows = New-Object System.Collections.Generic.List[object]
    $mountCollection = @(
        Get-OptionalPropertyValue `
            -ObjectValue $InspectObject `
            -PropertyName 'Mounts' `
            -DefaultValue @()
    )

    foreach ($mountObject in $mountCollection) {
        $rows.Add([pscustomobject]@{
            Type = [string](Get-OptionalPropertyValue -ObjectValue $mountObject -PropertyName 'Type' -DefaultValue '')
            Name = [string](Get-OptionalPropertyValue -ObjectValue $mountObject -PropertyName 'Name' -DefaultValue '')
            Source = [string](Get-OptionalPropertyValue -ObjectValue $mountObject -PropertyName 'Source' -DefaultValue '')
            Destination = [string](Get-OptionalPropertyValue -ObjectValue $mountObject -PropertyName 'Destination' -DefaultValue '')
            ReadWrite = [bool](Get-OptionalPropertyValue -ObjectValue $mountObject -PropertyName 'RW' -DefaultValue $false)
        })
    }

    return @($rows.ToArray())
}

function Get-SiteControlHashesFromLiveVolume {
    param([Parameter(Mandatory=$true)][string]$LabelPrefix)

    $shellScript = @'
set -eu
for p in \
  /sites/frontend/site_config.json \
  /sites/common_site_config.json \
  /sites/apps.txt \
  /sites/apps.json
do
  if [ ! -f "$p" ]; then
    printf 'MISSING|%s\n' "$p"
    exit 61
  fi
  h="$(sha256sum "$p" | awk '{print $1}')"
  printf '%s|%s\n' "$p" "$h"
done
'@

    $resultObject = Invoke-DockerShellHelper `
        -Label ($LabelPrefix + '_LIVE_SITE_HASHES') `
        -ScriptText $shellScript `
        -DockerArgumentsBeforeImage @(
            '--network','none',
            '--mount',('type=volume,source={0},target=/sites,readonly' -f $SitesVolumeName)
        ) `
        -ImageName $ExpectedErpImage

    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($lineText in (Get-Lines -Text $resultObject.Stdout)) {
        if ($lineText.StartsWith('MISSING|')) {
            throw ('APEX_SITE_CONTROL_FILE_MISSING: {0}' -f $lineText)
        }
        $parts = $lineText.Split('|')
        if ($parts.Count -ne 2) {
            throw ('APEX_SITE_HASH_OUTPUT_INVALID: {0}' -f $lineText)
        }
        $rows.Add([pscustomobject]@{
            Path = $parts[0]
            Sha256 = $parts[1].ToUpperInvariant()
            Source = 'LIVE_READONLY_VOLUME'
        })
    }
    if ($rows.Count -ne 4) {
        throw ('APEX_SITE_HASH_CARDINALITY_INVALID: Count={0}' -f $rows.Count)
    }
    return @($rows.ToArray())
}

function Get-SiteControlHashesFromCheckpoint {
    param([Parameter(Mandatory=$true)][string]$CheckpointSitesArchive)

    $extractRoot = Join-Path $env:TEMP ('apex-checkpoint-sites-' + [guid]::NewGuid().ToString('N'))
    Ensure-Directory -Path $extractRoot

    try {
        [void](Invoke-NativeCaptured -FilePath 'tar.exe' -ArgumentVector @('-xf',$CheckpointSitesArchive,'-C',$extractRoot) -Label 'CHECKPOINT_SITES_TAR_EXTRACT')
        $relativePaths = @(
            'frontend\site_config.json',
            'common_site_config.json',
            'apps.txt',
            'apps.json'
        )
        $rows = New-Object System.Collections.Generic.List[object]
        foreach ($relativePath in $relativePaths) {
            $candidatePath = Join-Path $extractRoot $relativePath
            if (-not [System.IO.File]::Exists($candidatePath)) {
                throw ('APEX_CHECKPOINT_SITE_CONTROL_MISSING: {0}' -f $relativePath)
            }
            $rows.Add([pscustomobject]@{
                Path = ('/sites/' + ($relativePath.Replace('\','/')))
                Sha256 = Get-Sha256 -Path $candidatePath
                Source = 'PRE_REDIS_CHECKPOINT'
            })
        }
        return @($rows.ToArray())
    }
    finally {
        if ([System.IO.Directory]::Exists($extractRoot)) {
            Remove-Item -LiteralPath $extractRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-RedisRuntimeProof {
    param(
        [Parameter(Mandatory=$true)][string]$ContainerName,
        [Parameter(Mandatory=$true)][string]$ServiceName
    )

    $inspectObject = Get-DockerInspectObject `
        -ContainerReference $ContainerName `
        -Label ($ServiceName + '_INSPECT_JSON')
    $runningState = Get-DockerStateStatus -InspectObject $inspectObject

    $configObject = Get-OptionalPropertyValue -ObjectValue $inspectObject -PropertyName 'Config' -DefaultValue $null
    $imageName = [string](Get-OptionalPropertyValue -ObjectValue $configObject -PropertyName 'Image' -DefaultValue '')

    $healthText = Get-DockerStateHealthStatus -InspectObject $inspectObject

    $networkLines = @(Get-NetworkNamesFromInspect -InspectObject $inspectObject)
    $aliasLines = @(Get-NetworkAliasesFromInspect -InspectObject $inspectObject -NetworkName $ExpectedNetworkName)

    $pingResult = Get-DockerResult -ArgumentVector @('exec',$ContainerName,'redis-cli','ping') -Label ($ServiceName + '_PING')
    $pingValue = $pingResult.Stdout.Trim()

    $versionResult = Get-DockerResult -ArgumentVector @('exec',$ContainerName,'redis-server','--version') -Label ($ServiceName + '_VERSION')
    $versionValue = $versionResult.Stdout.Trim()

    if ($runningState -ne 'running') {
        throw ('APEX_STAGE_X_PHASE2_REDIS_RUNTIME_NOT_RUNNING: Service={0}; State={1}' -f $ServiceName,$runningState)
    }

    if ($imageName -ne $ExpectedRedisImage) {
        Register-FailureClass -Class 'APEX_STAGE_X_PHASE2_REDIS_IMAGE_MISMATCH' -Detail ('Service={0}; Image={1}' -f $ServiceName,$imageName)
        throw ('APEX_STAGE_X_PHASE2_REDIS_IMAGE_MISMATCH: Service={0}; Image={1}' -f $ServiceName,$imageName)
    }

    if ($pingValue -ne 'PONG') {
        Register-FailureClass -Class 'APEX_STAGE_X_PHASE2_REDIS_PING_FAILED' -Detail ('Service={0}; Response={1}' -f $ServiceName,$pingValue)
        throw ('APEX_STAGE_X_PHASE2_REDIS_PING_FAILED: Service={0}; Response={1}' -f $ServiceName,$pingValue)
    }

    if ($versionValue -notmatch 'v=6\.2\.') {
        Register-FailureClass -Class 'APEX_STAGE_X_PHASE2_REDIS_VERSION_MISMATCH' -Detail ('Service={0}; Version={1}' -f $ServiceName,$versionValue)
        throw ('APEX_STAGE_X_PHASE2_REDIS_VERSION_MISMATCH: Service={0}; Version={1}' -f $ServiceName,$versionValue)
    }

    if ($networkLines -notcontains $ExpectedNetworkName) {
        Register-FailureClass -Class 'APEX_STAGE_X_PHASE2_REDIS_ALIAS_MISSING' -Detail ('Service={0}; Network missing={1}' -f $ServiceName,$ExpectedNetworkName)
        throw ('APEX_STAGE_X_PHASE2_REDIS_NETWORK_MISSING: Service={0}' -f $ServiceName)
    }

    if ($aliasLines -notcontains $ServiceName) {
        Register-FailureClass -Class 'APEX_STAGE_X_PHASE2_REDIS_ALIAS_MISSING' -Detail ('Service={0}; Alias missing' -f $ServiceName)
        throw ('APEX_STAGE_X_PHASE2_REDIS_ALIAS_MISSING: Service={0}' -f $ServiceName)
    }

    return [pscustomobject]@{
        Service = $ServiceName
        Container = $ContainerName
        State = $runningState
        Image = $imageName
        Network = $ExpectedNetworkName
        AliasPresent = $true
        Health = $healthText
        Ping = $pingValue
        Version = $versionValue
        VersionCompatibility = 'PASS'
        MetadataTransport = 'DOCKER_INSPECT_JSON'
        GoTemplateFormatUsed = $false
    }
}

function Get-RedisEndpoints {
    $queryText = '{redis_cache,redis_queue,redis_socketio}'
    $resultObject = Get-DockerResult -ArgumentVector @(
        'run','--rm',
        '--network','none',
        '--mount',('type=volume,source={0},target=/sites,readonly' -f $SitesVolumeName),
        '--entrypoint','jq',
        $ExpectedErpImage,
        '-c',$queryText,
        '/sites/common_site_config.json'
    ) -Label 'COMMON_SITE_CONFIG_REDIS_ENDPOINTS'

    $jsonText = $resultObject.Stdout.Trim()
    if ([string]::IsNullOrWhiteSpace($jsonText)) {
        throw 'APEX_REDIS_ENDPOINT_JSON_EMPTY'
    }
    return ($jsonText | ConvertFrom-Json)
}

function Convert-RedisEndpointToSafeMetadata {
    param(
        [Parameter(Mandatory=$true)][string]$Name,
        [AllowEmptyString()][string]$Endpoint
    )

    if ([string]::IsNullOrWhiteSpace($Endpoint)) {
        return [pscustomobject]@{
            Name = $Name
            Present = $false
            Scheme = ''
            HostName = ''
            Port = 0
            HasSecretUserInfo = $false
            ValueRecorded = $false
        }
    }

    $uriObject = New-Object System.Uri($Endpoint)
    $hasSecretUserInfo = -not [string]::IsNullOrWhiteSpace($uriObject.UserInfo)
    if ($hasSecretUserInfo) {
        $script:SecretExposureCount++
        Register-FailureClass -Class 'APEX_STAGE_X_PHASE2_SECRET_EXPOSURE' -Detail ('Redis endpoint contains userinfo: {0}' -f $Name)
    }

    return [pscustomobject]@{
        Name = $Name
        Present = $true
        Scheme = $uriObject.Scheme
        HostName = $uriObject.Host
        Port = $uriObject.Port
        HasSecretUserInfo = $hasSecretUserInfo
        ValueRecorded = $false
    }
}

function Test-DbConnectivity {
    $helperScript = @'
set -eu
cfg='/sites/frontend/site_config.json'
db_name="$(jq -r '.db_name // empty' "$cfg")"
db_user="$(jq -r '.db_user // empty' "$cfg")"
db_password="$(jq -r '.db_password // empty' "$cfg")"
if [ -z "$db_name" ] || [ -z "$db_user" ] || [ -z "$db_password" ]; then
  printf '%s\n' 'APEX_DB_CONNECTIVITY_SECRET_FIELDS_MISSING'
  exit 71
fi
umask 077
cat > /tmp/client.cnf <<EOF
[client]
host=db
port=3306
user=$db_user
password=$db_password
database=$db_name
protocol=tcp
EOF
value="$(mariadb --defaults-extra-file=/tmp/client.cnf --batch --skip-column-names --execute='SELECT 1;' 2>/dev/null)"
rm -f /tmp/client.cnf
if [ "$value" != '1' ]; then
  printf '%s\n' 'APEX_DB_CONNECTIVITY_SELECT1_FAILED'
  exit 72
fi
printf '%s\n' 'APEX_DB_CONNECTIVITY_SELECT1_PASS'
printf '%s\n' 'SECRET_VALUES_PRINTED=NO'
'@

    $resultObject = Invoke-DockerShellHelper `
        -Label 'POST_REDIS_DB_CONNECTIVITY' `
        -ScriptText $helperScript `
        -DockerArgumentsBeforeImage @(
            '--network',$ExpectedNetworkName,
            '--tmpfs','/tmp:rw,noexec,nosuid,size=16m',
            '--mount',('type=volume,source={0},target=/sites,readonly' -f $SitesVolumeName)
        ) `
        -ImageName $ExpectedErpImage

    $outputText = $resultObject.Stdout
    if ($outputText.IndexOf('APEX_DB_CONNECTIVITY_SELECT1_PASS',[System.StringComparison]::Ordinal) -lt 0) {
        throw 'APEX_STAGE_X_PHASE2_DB_CONNECTIVITY_PROOF_MISSING'
    }
    return [pscustomobject]@{
        Status = 'PASS'
        SelectOne = 'PASS'
        SecretValuesPrinted = 'NO'
        NativeTransport = 'READONLY_BIND_MOUNT'
        MultilineNativeArgument = 'NO'
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

function Get-LatestCheckpoint {
    if (-not [System.IO.Directory]::Exists($EvidenceBase)) {
        throw ('APEX_EVIDENCE_BASE_NOT_FOUND: {0}' -f $EvidenceBase)
    }

    $checkpointDirectories = @(
        Get-ChildItem -LiteralPath $EvidenceBase -Directory -ErrorAction Stop |
            Where-Object { $_.Name -like 'erpnext-local-recovery-checkpoint-*' } |
            Sort-Object LastWriteTime -Descending
    )
    if ($checkpointDirectories.Count -lt 1) {
        throw 'APEX_RECOVERY_CHECKPOINT_NOT_FOUND'
    }
    return $checkpointDirectories[0].FullName
}

function Test-Checkpoint {
    param([Parameter(Mandatory=$true)][string]$RootPath)

    $requiredFiles = @(
        'frappe_docker_db-data.tar',
        'frappe_docker_sites.tar',
        'frappe_docker_logs.tar',
        'frappe_docker_redis-queue-data.tar',
        'SHA256SUMS.txt'
    )

    foreach ($requiredFile in $requiredFiles) {
        $candidatePath = Join-Path $RootPath $requiredFile
        if (-not [System.IO.File]::Exists($candidatePath)) {
            throw ('APEX_CHECKPOINT_REQUIRED_FILE_MISSING: {0}' -f $candidatePath)
        }
    }

    $hashLines = [System.IO.File]::ReadAllLines((Join-Path $RootPath 'SHA256SUMS.txt'))
    $hashFailureCount = 0
    foreach ($hashLine in $hashLines) {
        $trimmedHashLine = $hashLine.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmedHashLine)) {
            continue
        }
        $matchObject = [regex]::Match($trimmedHashLine,'^([A-Fa-f0-9]{64})\s{2}(.+)$')
        if (-not $matchObject.Success) {
            $hashFailureCount++
            continue
        }
        $expectedHash = $matchObject.Groups[1].Value.ToUpperInvariant()
        $relativeName = $matchObject.Groups[2].Value.Trim()
        $filePath = Join-Path $RootPath $relativeName
        if (-not [System.IO.File]::Exists($filePath)) {
            $hashFailureCount++
            continue
        }
        $actualHash = Get-Sha256 -Path $filePath
        if ($actualHash -ne $expectedHash) {
            $hashFailureCount++
        }
    }

    if ($hashFailureCount -ne 0) {
        throw ('APEX_CHECKPOINT_HASH_VALIDATION_FAILED: Count={0}' -f $hashFailureCount)
    }

    foreach ($tarName in @(
        'frappe_docker_db-data.tar',
        'frappe_docker_sites.tar',
        'frappe_docker_logs.tar',
        'frappe_docker_redis-queue-data.tar'
    )) {
        $tarResult = Invoke-NativeCaptured -FilePath 'tar.exe' -ArgumentVector @('-tf',(Join-Path $RootPath $tarName)) -Label ('CHECKPOINT_TAR_READ_' + $tarName)
        if (@(Get-Lines -Text $tarResult.Stdout).Count -lt 1) {
            throw ('APEX_CHECKPOINT_TAR_EMPTY: {0}' -f $tarName)
        }
    }

    return [pscustomobject]@{
        Status = 'PASS'
        Root = $RootPath
        HashFailureCount = 0
        RequiredFileCount = 5
        TarReadability = 'PASS'
    }
}

function Test-PortOwnership {
    param([Parameter(Mandatory=$true)][int]$PortNumber)

    $rows = @(
        Get-NetTCPConnection -State Listen -LocalPort $PortNumber -ErrorAction SilentlyContinue
    )

    if ($rows.Count -eq 0) {
        return [pscustomobject]@{
            Port = $PortNumber
            Listener = 'NO'
            ProcessId = 0
            ProcessName = ''
        }
    }

    if ($rows.Count -ne 1) {
        throw ('APEX_PORT_LISTENER_CARDINALITY_UNEXPECTED: Port={0}; Count={1}' -f $PortNumber,$rows.Count)
    }

    $ownerProcessId = [int]$rows[0].OwningProcess
    $processObject = Get-Process -Id $ownerProcessId -ErrorAction Stop

    return [pscustomobject]@{
        Port = $PortNumber
        Listener = 'YES'
        ProcessId = $ownerProcessId
        ProcessName = [string]$processObject.ProcessName
    }
}

function New-EvidenceRoot {
    $timestampText = Get-Date -Format 'yyyyMMdd-HHmmss'
    $rootPath = Join-Path $EvidenceBase ('watany-control-center-erpnext-phase2-redis-recovery-finalization-' + $timestampText)
    if ([System.IO.Directory]::Exists($rootPath)) {
        throw ('APEX_EVIDENCE_ROOT_ALREADY_EXISTS: {0}' -f $rootPath)
    }
    Ensure-Directory -Path $rootPath
    $script:EvidenceRoot = $rootPath
    $script:EvidenceZipPath = $rootPath + '.zip'
}

function Write-EarlyAuthorityArtifact {
    $authorityText = @'
# Stage X ERPNext Phase 2 Redis Runtime Recovery Evidence Finalization

This package finalizes the already-running Phase 2 Redis recovery.

Authorized runtime state:
- db
- redis-cache
- redis-queue

Prohibited:
- create-site
- migration
- configurator
- backend
- frontend
- websocket
- queue workers
- scheduler
- Apache mutation
- port mutation
- production deployment

The finalizer is resume-aware and does not replay successful Redis startup.
'@
    Write-Utf8NoBom -Path (Join-Path $EvidenceRoot '00_AUTHORITY.md') -Text $authorityText
}

function Write-RowEvidence {
    Write-CsvFile -Name '29_ACTION_LOG.csv' -Headers @('Time','Action','Status','Detail') -Rows @($ActionRows.ToArray())
    Write-CsvFile -Name '30_FAILURES.csv' -Headers @('Time','FailureClass','Detail','Status') -Rows @($FailureRows.ToArray())
    Write-CsvFile -Name '31_WARNINGS.csv' -Headers @('Time','WarningClass','Detail') -Rows @($WarningRows.ToArray())
    Write-CsvFile -Name '32_GATE_RESULTS.csv' -Headers @('Gate','Status','Detail') -Rows @($GateRows.ToArray())
}

function Test-EvidenceJsonCsv {
    $jsonFailures = 0
    $csvFailures = 0
    $evidenceFiles = @(Get-ChildItem -LiteralPath $EvidenceRoot -File)
    foreach ($evidenceFile in $evidenceFiles) {
        if ($evidenceFile.Extension -eq '.json') {
            try {
                $jsonText = [System.IO.File]::ReadAllText($evidenceFile.FullName)
                [void]($jsonText | ConvertFrom-Json)
            }
            catch {
                $jsonFailures++
            }
        }
        elseif ($evidenceFile.Extension -eq '.csv') {
            try {
                [void](Import-Csv -LiteralPath $evidenceFile.FullName)
            }
            catch {
                $csvFailures++
            }
        }
    }
    return [pscustomobject]@{
        JsonFailures = $jsonFailures
        CsvFailures = $csvFailures
    }
}

function New-EvidenceZip {
    param([Parameter(Mandatory=$true)][string]$DestinationPath)

    if ([System.IO.File]::Exists($DestinationPath)) {
        Remove-Item -LiteralPath $DestinationPath -Force
    }

    $childPaths = @(
        Get-ChildItem -LiteralPath $EvidenceRoot -File |
            Sort-Object Name |
            Select-Object -ExpandProperty FullName
    )

    if ($childPaths.Count -ne 42) {
        throw ('APEX_ZIP_SOURCE_ARTIFACT_COUNT_INVALID: Count={0}' -f $childPaths.Count)
    }

    Compress-Archive -Path $childPaths -DestinationPath $DestinationPath -CompressionLevel Optimal -Force
}

function Test-EvidenceZip {
    param([Parameter(Mandatory=$true)][string]$ZipPath)

    $reopenRoot = Join-Path $env:TEMP ('apex-phase2-reopen-' + [guid]::NewGuid().ToString('N'))
    Ensure-Directory -Path $reopenRoot
    try {
        Expand-Archive -LiteralPath $ZipPath -DestinationPath $reopenRoot -Force
        $reopenedNames = @(
            Get-ChildItem -LiteralPath $reopenRoot -File |
                Sort-Object Name |
                Select-Object -ExpandProperty Name
        )
        $expectedNames = @($RequiredEvidenceNames | Sort-Object)
        $differenceRows = @(Compare-Object -ReferenceObject $expectedNames -DifferenceObject $reopenedNames)
        if ($differenceRows.Count -ne 0) {
            return [pscustomobject]@{
                Status = 'BLOCKED'
                EntryCount = $reopenedNames.Count
                NameDifferenceCount = $differenceRows.Count
                ByteParityFailures = -1
            }
        }

        $byteParityFailures = 0
        foreach ($expectedName in $RequiredEvidenceNames) {
            $sourcePath = Join-Path $EvidenceRoot $expectedName
            $reopenedPath = Join-Path $reopenRoot $expectedName
            if ((Get-Sha256 -Path $sourcePath) -ne (Get-Sha256 -Path $reopenedPath)) {
                $byteParityFailures++
            }
        }

        $statusValue = 'PASS'
        if ($byteParityFailures -ne 0) {
            $statusValue = 'BLOCKED'
        }

        return [pscustomobject]@{
            Status = $statusValue
            EntryCount = $reopenedNames.Count
            NameDifferenceCount = 0
            ByteParityFailures = $byteParityFailures
        }
    }
    finally {
        if ([System.IO.Directory]::Exists($reopenRoot)) {
            Remove-Item -LiteralPath $reopenRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

try {
    Write-Output 'APEX_WATANY_CONTROL_CENTER_STAGE_X_ERPNEXT_PHASE2_FINALIZATION_BEGIN=YES'

    if ($PSVersionTable.PSVersion.Major -ne 5 -or $PSVersionTable.PSVersion.Minor -ne 1) {
        throw ('APEX_WINDOWS_POWERSHELL_5_1_REQUIRED: Actual={0}' -f $PSVersionTable.PSVersion.ToString())
    }

    Test-ParserProof
    New-EvidenceRoot
    Write-EarlyAuthorityArtifact

    Add-GateRow -Gate 'EXTERNAL_PS51_PARSER_PREFLIGHT' -Status 'PASS' -Detail ('Hash=' + $ScriptSha256)

    # Predecessor transport defects are registered before substantive Docker proof.
    $transportFailureClass = 'APEX_PS51_DOCKER_MULTILINE_SH_LC_NATIVE_ARGUMENT_TRANSPORT_CORRUPTION'
    if ([System.IO.File]::Exists($FailureRegisterPath)) {
        $failureRegisterText = [System.IO.File]::ReadAllText($FailureRegisterPath)
        if ($failureRegisterText.IndexOf($transportFailureClass,[System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
            $registrationText = @(
                '',
                ('### {0}' -f $transportFailureClass),
                '',
                ('- First formalized by: {0}' -f $AuthorityId),
                '- Predecessor: V1.0.0 Phase 2 evidence finalizer',
                '- Symptom: multiline sh -lc helper text was corrupted at the Windows PowerShell 5.1 native argv boundary and failed with `set: Illegal option -`.',
                '- Permanent guard: multiline shell programs MUST NOT be passed as docker native arguments; use UTF-8/LF helper-file read-only bind mount transport.',
                '- Status: ACTIVE regression guard',
                ''
            ) -join [Environment]::NewLine
            $registrationEncoding = New-Object System.Text.UTF8Encoding($true)
            [System.IO.File]::AppendAllText($FailureRegisterPath,$registrationText,$registrationEncoding)
        }
        Add-GateRow -Gate 'PS51_DOCKER_NATIVE_ARGUMENT_TRANSPORT_REGRESSION_REGISTER' -Status 'PASS' -Detail $transportFailureClass
    }
    else {
        Add-WarningRow -Class 'APEX_FAILURE_REGISTER_NOT_FOUND' -Detail $FailureRegisterPath
        Add-GateRow -Gate 'PS51_DOCKER_NATIVE_ARGUMENT_TRANSPORT_REGRESSION_REGISTER' -Status 'UNVERIFIED' -Detail $FailureRegisterPath
    }

    $goTemplateFailureClass = 'APEX_PS51_DOCKER_GO_TEMPLATE_QUOTED_STRING_NATIVE_ARGUMENT_CORRUPTION'
    if ([System.IO.File]::Exists($FailureRegisterPath)) {
        $failureRegisterText = [System.IO.File]::ReadAllText($FailureRegisterPath)
        if ($failureRegisterText.IndexOf($goTemplateFailureClass,[System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
            $registrationText = @(
                '',
                ('### {0}' -f $goTemplateFailureClass),
                '',
                ('- First formalized by: {0}' -f $AuthorityId),
                '- Predecessor: V1.0.1 Phase 2 evidence finalizer',
                '- Symptom: Docker Go-template quoted label string was corrupted at the Windows PowerShell 5.1 native argv boundary and Docker reported `function "com" not defined`.',
                '- Permanent guard: do not use Docker Go-template formatting for inspect/service metadata; use full docker inspect JSON and PowerShell-side parsing.',
                '- Status: ACTIVE regression guard',
                ''
            ) -join [Environment]::NewLine
            $registrationEncoding = New-Object System.Text.UTF8Encoding($true)
            [System.IO.File]::AppendAllText($FailureRegisterPath,$registrationText,$registrationEncoding)
        }
        Add-GateRow -Gate 'PS51_DOCKER_GO_TEMPLATE_TRANSPORT_REGRESSION_REGISTER' -Status 'PASS' -Detail $goTemplateFailureClass
    }
    else {
        Add-WarningRow -Class 'APEX_FAILURE_REGISTER_NOT_FOUND' -Detail $FailureRegisterPath
        Add-GateRow -Gate 'PS51_DOCKER_GO_TEMPLATE_TRANSPORT_REGRESSION_REGISTER' -Status 'UNVERIFIED' -Detail $FailureRegisterPath
    }

    $optionalHealthFailureClass = 'APEX_PS51_STRICTMODE_OPTIONAL_DOCKER_HEALTH_PROPERTY_ACCESS'
    if ([System.IO.File]::Exists($FailureRegisterPath)) {
        $failureRegisterText = [System.IO.File]::ReadAllText($FailureRegisterPath)
        if ($failureRegisterText.IndexOf($optionalHealthFailureClass,[System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
            $registrationText = @(
                '',
                ('### {0}' -f $optionalHealthFailureClass),
                '',
                ('- First formalized by: {0}' -f $AuthorityId),
                '- Predecessor: V1.0.2 Phase 2 evidence finalizer',
                '- Symptom: Set-StrictMode terminated when Docker inspect JSON omitted State.Health for a container with no Docker healthcheck.',
                '- Permanent guard: optional Docker JSON properties MUST be accessed through PSObject.Properties/null-safe helpers; direct State.Health access is forbidden.',
                '- Status: ACTIVE regression guard',
                ''
            ) -join [Environment]::NewLine
            $registrationEncoding = New-Object System.Text.UTF8Encoding($true)
            [System.IO.File]::AppendAllText($FailureRegisterPath,$registrationText,$registrationEncoding)
        }
        Add-GateRow -Gate 'PS51_OPTIONAL_DOCKER_HEALTH_PROPERTY_REGRESSION_REGISTER' -Status 'PASS' -Detail $optionalHealthFailureClass
    }
    else {
        Add-WarningRow -Class 'APEX_FAILURE_REGISTER_NOT_FOUND' -Detail $FailureRegisterPath
        Add-GateRow -Gate 'PS51_OPTIONAL_DOCKER_HEALTH_PROPERTY_REGRESSION_REGISTER' -Status 'UNVERIFIED' -Detail $FailureRegisterPath
    }

    $currentControllerText = [System.IO.File]::ReadAllText($PSCommandPath)
    if ([regex]::IsMatch($currentControllerText,"(?im)'?-lc'?\s*,\s*\$")) {
        throw 'APEX_PS51_DOCKER_MULTILINE_SH_LC_NATIVE_ARGUMENT_TRANSPORT_REGRESSION_RECURRED'
    }
    Add-GateRow -Gate 'MULTILINE_SH_LC_NATIVE_ARGUMENT_REGRESSION_SCAN' -Status 'PASS' -Detail 'No multiline shell program is passed through native argv'

    $dockerFormatSwitchToken = '--' + 'format'
    if ($currentControllerText.IndexOf($dockerFormatSwitchToken,[System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        throw 'APEX_PS51_DOCKER_GO_TEMPLATE_NATIVE_ARGUMENT_REGRESSION_RECURRED'
    }
    Add-GateRow -Gate 'DOCKER_GO_TEMPLATE_NATIVE_ARGUMENT_REGRESSION_SCAN' -Status 'PASS' -Detail 'No Docker Go-template formatting switch remains'

    $directHealthToken = '.State' + '.Health'
    if ($currentControllerText.IndexOf($directHealthToken,[System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        throw 'APEX_PS51_STRICTMODE_OPTIONAL_DOCKER_HEALTH_PROPERTY_ACCESS_REGRESSION_RECURRED'
    }
    Add-GateRow -Gate 'OPTIONAL_DOCKER_HEALTH_DIRECT_ACCESS_REGRESSION_SCAN' -Status 'PASS' -Detail 'No direct optional State Health access remains'

    if (-not [System.IO.File]::Exists($PwdFile)) {
        throw ('APEX_PWD_YML_NOT_FOUND: {0}' -f $PwdFile)
    }

    $skillRows = New-Object System.Collections.Generic.List[object]
    foreach ($skillPath in $ApexSkillCandidates) {
        $existsValue = [System.IO.File]::Exists($skillPath)
        $hashValue = ''
        if ($existsValue) {
            $hashValue = Get-Sha256 -Path $skillPath
        }
        $skillRows.Add([pscustomobject]@{
            Path = $skillPath
            Exists = $existsValue
            Sha256 = $hashValue
        })
    }

    Write-JsonFile -Name '01_APEX_CONTRACT_STATUS.json' -Value ([ordered]@{
        status = 'PASS'
        runtime = $PSVersionTable.PSVersion.ToString()
        parserPreflight = 'PASS'
        parserProofPath = $ParserPreflightProofPath
        scriptSha256 = $ScriptSha256
        skillCandidates = @($skillRows.ToArray())
        defaultRuntime = 'Windows PowerShell 5.1'
        parserPassIsRuntimeProof = $false
        ps51DockerMultilineTransportRepair = 'READONLY_BIND_MOUNT_HELPER'
        multilineShellNativeArgumentsAllowed = $false
        ps51DockerGoTemplateRepair = 'DOCKER_INSPECT_JSON_POWERSHELL_PARSE'
        dockerGoTemplateNativeArgumentsAllowed = $false
        strictModeOptionalDockerHealthRepair = 'PSOBJECT_PROPERTIES_NULL_SAFE'
        directDockerHealthPropertyAccessAllowed = $false
    })

    $registerExists = [System.IO.File]::Exists($FailureRegisterPath)
    $registerHash = ''
    $knownPresentCount = 0
    if ($registerExists) {
        $registerHash = Get-Sha256 -Path $FailureRegisterPath
        $registerText = [System.IO.File]::ReadAllText($FailureRegisterPath)
        foreach ($failureClassName in $KnownPhase2FailureClasses) {
            if ($registerText.IndexOf($failureClassName,[System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
                $knownPresentCount++
            }
        }
    }
    Write-JsonFile -Name '02_FAILURE_REGISTER_PRECHECK.json' -Value ([ordered]@{
        status = $(if ($registerExists) { 'PASS' } else { 'UNVERIFIED' })
        path = $FailureRegisterPath
        exists = $registerExists
        sha256 = $registerHash
        knownPhase2ClassCount = $KnownPhase2FailureClasses.Count
        knownAlreadyPresentCount = $knownPresentCount
    })

    $CheckpointRoot = Get-LatestCheckpoint
    $checkpointProof = Test-Checkpoint -RootPath $CheckpointRoot
    Add-GateRow -Gate 'CHECKPOINT_REVALIDATION' -Status 'PASS' -Detail $CheckpointRoot
    Write-JsonFile -Name '04_CHECKPOINT_REVALIDATION.json' -Value $checkpointProof

    $dbInspectObject = Get-DockerInspectObject -ContainerReference $DbContainerName -Label 'DB_INSPECT_PRECHECK'
    $dbState = Get-DockerStateStatus -InspectObject $dbInspectObject
    $dbHealth = Get-DockerStateHealthStatus -InspectObject $dbInspectObject
    $dbConfigObject = Get-OptionalPropertyValue -ObjectValue $dbInspectObject -PropertyName 'Config' -DefaultValue $null
    $dbImage = [string](Get-OptionalPropertyValue -ObjectValue $dbConfigObject -PropertyName 'Image' -DefaultValue '')
    $dbMountRows = @(Get-MountRowsFromInspect -InspectObject $dbInspectObject)
    $dbNetworkNames = @(Get-NetworkNamesFromInspect -InspectObject $dbInspectObject)

    if (($dbState -ne 'running') -or ($dbHealth -ne 'healthy') -or ($dbImage -ne $ExpectedDbImage)) {
        Register-FailureClass -Class 'APEX_STAGE_X_PHASE2_DB_HEALTH_REGRESSION' -Detail ('State={0}; Health={1}; Image={2}' -f $dbState,$dbHealth,$dbImage)
        throw 'APEX_STAGE_X_PHASE2_DB_PREDECESSOR_INVALID'
    }
    $dbPersistentVolumeFound = $false
    foreach ($dbMountRow in $dbMountRows) {
        if (([string]$dbMountRow.Name -eq $DbVolumeName) -and
            ([string]$dbMountRow.Destination -eq '/var/lib/mysql')) {
            $dbPersistentVolumeFound = $true
            break
        }
    }
    if (-not $dbPersistentVolumeFound) {
        throw 'APEX_DB_PERSISTENT_VOLUME_NOT_MOUNTED'
    }

    if ($dbNetworkNames -notcontains $ExpectedNetworkName) {
        throw 'APEX_DB_EXPECTED_NETWORK_MISSING'
    }

    Add-GateRow -Gate 'PREDECESSOR_DB_HEALTH' -Status 'PASS' -Detail 'running/healthy/mariadb:11.8'
    Write-JsonFile -Name '05_PRESTART_DB_HEALTH.json' -Value ([ordered]@{
        status = 'PASS'
        container = $DbContainerName
        state = $dbState
        health = $dbHealth
        image = $dbImage
        persistentVolume = $DbVolumeName
        network = $ExpectedNetworkName
    })

    $checkpointSiteArchive = Join-Path $CheckpointRoot 'frappe_docker_sites.tar'
    $checkpointHashRows = @(Get-SiteControlHashesFromCheckpoint -CheckpointSitesArchive $checkpointSiteArchive)
    Write-CsvFile -Name '06_SITE_CONTROL_HASHES_BEFORE.csv' -Headers @('Path','Sha256','Source') -Rows $checkpointHashRows

    $composeServicesResult = Get-DockerResult -ArgumentVector @('compose','-p',$ProjectName,'-f',$PwdFile,'config','--services') -Label 'COMPOSE_SERVICE_TOPOLOGY'
    $composeServiceLines = @(Get-Lines -Text $composeServicesResult.Stdout)

    $predecessorDbConnectivity = Test-DbConnectivity
    Add-GateRow -Gate 'PHASE_1B_DATABASE_CONNECTIVITY_REVALIDATION' -Status 'PASS' -Detail 'SELECT 1'
    Write-JsonFile -Name '03_PREDECESSOR_PHASE1_PHASE1B.json' -Value ([ordered]@{
        status = 'PASS'
        phase1DatabaseRuntimeRecovery = 'PASS'
        phase1bDatabaseConnectivity = $predecessorDbConnectivity.Status
        preservedSite = $ExpectedSiteName
        createSiteExecuted = 'NO'
        redisReplayRequired = 'NO'
    })

    $redisCacheProof = Get-RedisRuntimeProof -ContainerName $RedisCacheContainerName -ServiceName 'redis-cache'
    $redisQueueProof = Get-RedisRuntimeProof -ContainerName $RedisQueueContainerName -ServiceName 'redis-queue'

    Add-GateRow -Gate 'REDIS_CACHE_RUNTIME' -Status 'PASS' -Detail ($redisCacheProof.Version)
    Add-GateRow -Gate 'REDIS_QUEUE_RUNTIME' -Status 'PASS' -Detail ($redisQueueProof.Version)

    Write-JsonFile -Name '07_REDIS_COMPOSE_TOPOLOGY.json' -Value ([ordered]@{
        status = 'PASS'
        composeProject = $ProjectName
        composeFile = $PwdFile
        network = $ExpectedNetworkName
        expectedRedisImage = $ExpectedRedisImage
        services = $composeServiceLines
        resumeMode = 'ADOPT_ALREADY_RUNNING'
    })

    $resumeCensusRows = @(
        [pscustomobject]@{ Service='redis-cache'; Container=$RedisCacheContainerName; State=$redisCacheProof.State; Image=$redisCacheProof.Image; Disposition='ADOPTED_ALREADY_RUNNING' },
        [pscustomobject]@{ Service='redis-queue'; Container=$RedisQueueContainerName; State=$redisQueueProof.State; Image=$redisQueueProof.Image; Disposition='ADOPTED_ALREADY_RUNNING' }
    )
    Write-CsvFile -Name '08_REDIS_PRESTART_CENSUS.csv' -Headers @('Service','Container','State','Image','Disposition') -Rows $resumeCensusRows

    Write-Utf8NoBom -Path (Join-Path $EvidenceRoot '09_REDIS_CACHE_START.txt') -Text (
        "STATUS=ADOPTED_ALREADY_RUNNING`r`nSTART_REPLAYED=NO`r`nCONTAINER=$RedisCacheContainerName`r`n"
    )
    Write-JsonFile -Name '10_REDIS_CACHE_RUNTIME.json' -Value $redisCacheProof
    Write-Utf8NoBom -Path (Join-Path $EvidenceRoot '11_REDIS_CACHE_PING.txt') -Text ("PING_RESPONSE={0}`r`nSTATUS=PASS`r`n" -f $redisCacheProof.Ping)
    Write-Utf8NoBom -Path (Join-Path $EvidenceRoot '12_REDIS_CACHE_VERSION.txt') -Text ("VERSION={0}`r`nVERSION_COMPATIBILITY=PASS`r`n" -f $redisCacheProof.Version)

    Write-Utf8NoBom -Path (Join-Path $EvidenceRoot '13_REDIS_QUEUE_START.txt') -Text (
        "STATUS=ADOPTED_ALREADY_RUNNING`r`nSTART_REPLAYED=NO`r`nCONTAINER=$RedisQueueContainerName`r`n"
    )
    Write-JsonFile -Name '14_REDIS_QUEUE_RUNTIME.json' -Value $redisQueueProof
    Write-Utf8NoBom -Path (Join-Path $EvidenceRoot '15_REDIS_QUEUE_PING.txt') -Text ("PING_RESPONSE={0}`r`nSTATUS=PASS`r`n" -f $redisQueueProof.Ping)
    Write-Utf8NoBom -Path (Join-Path $EvidenceRoot '16_REDIS_QUEUE_VERSION.txt') -Text ("VERSION={0}`r`nVERSION_COMPATIBILITY=PASS`r`n" -f $redisQueueProof.Version)

    $queueInspectObject = Get-DockerInspectObject -ContainerReference $RedisQueueContainerName -Label 'REDIS_QUEUE_INSPECT_FOR_MOUNTS'
    $queueMountRows = @(Get-MountRowsFromInspect -InspectObject $queueInspectObject)
    $queueVolumeProven = $false
    foreach ($queueMountRow in $queueMountRows) {
        if (([string]$queueMountRow.Name -eq $RedisQueueVolumeName) -and
            ([string]$queueMountRow.Destination -eq '/data') -and
            ([bool]$queueMountRow.ReadWrite)) {
            $queueVolumeProven = $true
            break
        }
    }
    if (-not $queueVolumeProven) {
        Register-FailureClass -Class 'APEX_STAGE_X_PHASE2_REDIS_QUEUE_VOLUME_MOUNT_MISMATCH' -Detail 'Expected redis queue volume /data RW mount was not present in docker inspect JSON.'
        throw 'APEX_STAGE_X_PHASE2_REDIS_QUEUE_VOLUME_MOUNT_MISMATCH'
    }
    Add-GateRow -Gate 'REDIS_QUEUE_PERSISTENCE_VOLUME' -Status 'PASS' -Detail $RedisQueueVolumeName
    Write-JsonFile -Name '17_REDIS_QUEUE_VOLUME_PROOF.json' -Value ([ordered]@{
        status = 'PASS'
        volume = $RedisQueueVolumeName
        destination = '/data'
        readWrite = $true
        persistence = 'PROVEN'
    })

    $endpointObject = Get-RedisEndpoints
    $cacheEndpoint = Convert-RedisEndpointToSafeMetadata -Name 'redis_cache' -Endpoint ([string]$endpointObject.redis_cache)
    $queueEndpoint = Convert-RedisEndpointToSafeMetadata -Name 'redis_queue' -Endpoint ([string]$endpointObject.redis_queue)
    $socketEndpoint = Convert-RedisEndpointToSafeMetadata -Name 'redis_socketio' -Endpoint ([string]$endpointObject.redis_socketio)

    if ($SecretExposureCount -ne 0) {
        throw 'APEX_STAGE_X_PHASE2_REDIS_ENDPOINT_CONTAINS_SECRET'
    }

    Write-JsonFile -Name '18_COMMON_SITE_CONFIG_REDIS_ENDPOINTS_REDACTED.json' -Value ([ordered]@{
        status = 'PASS'
        valuesRecorded = $false
        redisCache = $cacheEndpoint
        redisQueue = $queueEndpoint
        redisSocketio = $socketEndpoint
    })

    $cacheEndpointPass = (
        $cacheEndpoint.Present -and
        ($cacheEndpoint.Scheme -eq 'redis') -and
        ($cacheEndpoint.HostName -eq 'redis-cache') -and
        ($cacheEndpoint.Port -eq 6379)
    )
    $queueEndpointPass = (
        $queueEndpoint.Present -and
        ($queueEndpoint.Scheme -eq 'redis') -and
        ($queueEndpoint.HostName -eq 'redis-queue') -and
        ($queueEndpoint.Port -eq 6379)
    )
    $socketEndpointPass = (
        $socketEndpoint.Present -and
        ($socketEndpoint.Scheme -eq 'redis') -and
        ($socketEndpoint.HostName -eq 'redis-queue') -and
        ($socketEndpoint.Port -eq 6379)
    )

    if (-not ($cacheEndpointPass -and $queueEndpointPass -and $socketEndpointPass)) {
        Register-FailureClass -Class 'APEX_STAGE_X_PHASE2_REDIS_ENDPOINT_RECONCILIATION_FAILED' -Detail 'One or more preserved Redis aliases/ports do not match runtime topology.'
        throw 'APEX_STAGE_X_PHASE2_REDIS_ENDPOINT_RECONCILIATION_FAILED'
    }

    Add-GateRow -Gate 'REDIS_ENDPOINT_RECONCILIATION' -Status 'PASS' -Detail 'cache/queue/socketio'
    Write-JsonFile -Name '19_REDIS_ENDPOINT_RECONCILIATION.json' -Value ([ordered]@{
        status = 'PASS'
        redisCache = 'PASS'
        redisQueue = 'PASS'
        redisSocketio = 'PASS'
        expectedCache = 'redis-cache:6379'
        expectedQueue = 'redis-queue:6379'
        expectedSocketio = 'redis-queue:6379'
    })

    $postRedisDbInspectObject = Get-DockerInspectObject -ContainerReference $DbContainerName -Label 'POST_REDIS_DB_INSPECT'
    $postRedisDbHealth = Get-DockerStateHealthStatus -InspectObject $postRedisDbInspectObject
    if ($postRedisDbHealth -ne 'healthy') {
        Register-FailureClass -Class 'APEX_STAGE_X_PHASE2_DB_HEALTH_REGRESSION' -Detail ('Post Redis health={0}' -f $postRedisDbHealth)
        throw 'APEX_STAGE_X_PHASE2_DB_HEALTH_REGRESSION'
    }
    Add-GateRow -Gate 'POST_REDIS_DB_HEALTH' -Status 'PASS' -Detail $postRedisDbHealth
    Write-JsonFile -Name '20_POST_REDIS_DB_HEALTH.json' -Value ([ordered]@{
        status = 'PASS'
        health = $postRedisDbHealth
        container = $DbContainerName
    })

    $postRedisDbConnectivity = Test-DbConnectivity
    Add-GateRow -Gate 'POST_REDIS_DB_CONNECTIVITY' -Status 'PASS' -Detail 'SELECT 1'
    Write-JsonFile -Name '21_POST_REDIS_DB_CONNECTIVITY.json' -Value $postRedisDbConnectivity

    $liveHashRows = @(Get-SiteControlHashesFromLiveVolume -LabelPrefix 'POST_REDIS')
    Write-CsvFile -Name '22_SITE_CONTROL_HASHES_AFTER.csv' -Headers @('Path','Sha256','Source') -Rows $liveHashRows

    $checkpointHashMap = @{}
    foreach ($checkpointHashRow in $checkpointHashRows) {
        $checkpointHashMap[[string]$checkpointHashRow.Path] = [string]$checkpointHashRow.Sha256
    }

    $driftRows = New-Object System.Collections.Generic.List[object]
    foreach ($liveHashRow in $liveHashRows) {
        $controlPath = [string]$liveHashRow.Path
        $beforeHash = ''
        if ($checkpointHashMap.ContainsKey($controlPath)) {
            $beforeHash = [string]$checkpointHashMap[$controlPath]
        }
        $afterHash = [string]$liveHashRow.Sha256
        $drift = ($beforeHash -ne $afterHash)
        if ($drift) {
            $SiteHashDriftCount++
        }
        $driftRows.Add([pscustomobject]@{
            Path = $controlPath
            BeforeSha256 = $beforeHash
            AfterSha256 = $afterHash
            Drift = $drift
        })
    }

    if ($SiteHashDriftCount -ne 0) {
        Register-FailureClass -Class 'APEX_STAGE_X_PHASE2_SITE_CONFIG_DRIFT' -Detail ('Control file drift count={0}' -f $SiteHashDriftCount)
        throw ('APEX_STAGE_X_PHASE2_SITE_CONFIG_DRIFT: Count={0}' -f $SiteHashDriftCount)
    }

    Add-GateRow -Gate 'PRESERVED_SITE_IMMUTABILITY' -Status 'PASS' -Detail 'Checkpoint-to-live hashes identical'
    Write-JsonFile -Name '23_SITE_IMMUTABILITY.json' -Value ([ordered]@{
        status = 'PASS'
        comparisonBasis = 'PRE_REDIS_CHECKPOINT_TO_CURRENT_LIVE_VOLUME'
        driftCount = $SiteHashDriftCount
        rows = @($driftRows.ToArray())
    })

    $serviceCensusResult = Get-DockerResult -ArgumentVector @(
        'ps',
        '--filter',('label=com.docker.compose.project={0}' -f $ProjectName),
        '--quiet'
    ) -Label 'RUNNING_SERVICE_ID_CENSUS'

    $serviceRows = New-Object System.Collections.Generic.List[object]
    $runningContainerIds = @(Get-Lines -Text $serviceCensusResult.Stdout)

    foreach ($runningContainerId in $runningContainerIds) {
        $runningInspectObject = Get-DockerInspectObject `
            -ContainerReference $runningContainerId `
            -Label ('RUNNING_SERVICE_INSPECT_' + $runningContainerId)

        $containerName = [string](Get-OptionalPropertyValue -ObjectValue $runningInspectObject -PropertyName 'Name' -DefaultValue '')
        $containerName = $containerName.TrimStart('/')

        $runningConfigObject = Get-OptionalPropertyValue -ObjectValue $runningInspectObject -PropertyName 'Config' -DefaultValue $null
        $containerImage = [string](Get-OptionalPropertyValue -ObjectValue $runningConfigObject -PropertyName 'Image' -DefaultValue '')
        $containerStatus = Get-DockerStateStatus -InspectObject $runningInspectObject

        $serviceName = ''
        $labelProperties = Get-OptionalPropertyValue -ObjectValue $runningConfigObject -PropertyName 'Labels' -DefaultValue $null
        if ($null -ne $labelProperties) {
            $serviceLabelProperty = $labelProperties.PSObject.Properties['com.docker.compose.service']
            if ($null -ne $serviceLabelProperty) {
                $serviceName = [string]$serviceLabelProperty.Value
            }
        }

        if ([string]::IsNullOrWhiteSpace($serviceName)) {
            Register-FailureClass -Class 'APEX_PS51_DOCKER_GO_TEMPLATE_QUOTED_STRING_NATIVE_ARGUMENT_CORRUPTION' -Detail ('Service label unavailable from inspect JSON for container {0}' -f $containerName)
            throw ('APEX_COMPOSE_SERVICE_LABEL_MISSING: Container={0}' -f $containerName)
        }

        $allowedValue = ($AllowedServiceNames -contains $serviceName)
        if (-not $allowedValue) {
            $UnauthorizedRunningServiceCount++
        }

        $serviceRows.Add([pscustomobject]@{
            Container = $containerName
            Image = $containerImage
            Status = $containerStatus
            Service = $serviceName
            Allowed = $allowedValue
        })
    }

    Write-CsvFile -Name '24_RUNNING_SERVICE_CENSUS.csv' -Headers @('Container','Image','Status','Service','Allowed') -Rows @($serviceRows.ToArray())

    if ($UnauthorizedRunningServiceCount -ne 0) {
        Register-FailureClass -Class 'APEX_STAGE_X_PHASE2_REDIS_UNAUTHORIZED_DEPENDENCY_STARTED' -Detail ('Unauthorized running services={0}' -f $UnauthorizedRunningServiceCount)
        throw ('APEX_STAGE_X_PHASE2_REDIS_UNAUTHORIZED_DEPENDENCY_STARTED: Count={0}' -f $UnauthorizedRunningServiceCount)
    }

    foreach ($requiredAllowedService in $AllowedServiceNames) {
        $foundAllowed = $false
        foreach ($serviceRow in $serviceRows) {
            if ([string]$serviceRow.Service -eq $requiredAllowedService) {
                $foundAllowed = $true
                break
            }
        }
        if (-not $foundAllowed) {
            throw ('APEX_REQUIRED_RUNNING_SERVICE_MISSING: {0}' -f $requiredAllowedService)
        }
    }

    Add-GateRow -Gate 'UNAUTHORIZED_RUNNING_SERVICE_GATE' -Status 'PASS' -Detail 'Only db, redis-cache, redis-queue'
    Write-JsonFile -Name '25_UNAUTHORIZED_SERVICE_GATE.json' -Value ([ordered]@{
        status = 'PASS'
        unauthorizedRunningServiceCount = $UnauthorizedRunningServiceCount
        allowedServices = $AllowedServiceNames
        forbiddenServices = $ForbiddenServiceNames
    })

    $port8080Proof = Test-PortOwnership -PortNumber 8080
    if (($port8080Proof.Listener -ne 'YES') -or ($port8080Proof.ProcessName -ne 'httpd')) {
        throw ('APEX_PORT_8080_OWNER_CHANGED: Listener={0}; Process={1}' -f $port8080Proof.Listener,$port8080Proof.ProcessName)
    }
    Add-GateRow -Gate 'PORT_8080_REVALIDATION' -Status 'PASS' -Detail 'httpd'
    Write-JsonFile -Name '26_PORT_8080_REVALIDATION.json' -Value ([ordered]@{
        status = 'PASS'
        port = 8080
        listener = $port8080Proof.Listener
        processId = $port8080Proof.ProcessId
        processName = $port8080Proof.ProcessName
        changed = 'NO'
    })

    $port18080Proof = Test-PortOwnership -PortNumber 18080
    if ($port18080Proof.Listener -ne 'NO') {
        throw ('APEX_PORT_18080_UNEXPECTEDLY_BOUND: Process={0}' -f $port18080Proof.ProcessName)
    }
    Add-GateRow -Gate 'PORT_18080_REVALIDATION' -Status 'PASS' -Detail 'UNBOUND'
    Write-JsonFile -Name '27_PORT_18080_REVALIDATION.json' -Value ([ordered]@{
        status = 'PASS'
        port = 18080
        listener = 'NO'
        bound = 'NO'
    })

    Write-JsonFile -Name '28_SECRET_EXPOSURE_AUDIT.json' -Value ([ordered]@{
        status = 'PASS'
        secretValueExposureCount = $SecretExposureCount
        dbPasswordPrinted = 'NO'
        encryptionKeyPrinted = 'NO'
        redisPasswordPrinted = 'NO'
        broadEnvironmentDump = 'NO'
    })

    $PreBackendGate = 'PASS'
    $BackendStartAuthorization = 'READY_FOR_SEPARATE_AUTHORITY'
    $FinalStatus = 'PASS'

    Add-GateRow -Gate 'PRE_BACKEND_GATE' -Status 'PASS' -Detail $BackendStartAuthorization

    Write-JsonFile -Name '33_PHASE2_FINAL_STATUS.json' -Value ([ordered]@{
        authority = $AuthorityId
        status = $FinalStatus
        phase2RedisRuntimeRecovery = 'PASS'
        preservedSiteDependencyReconciliation = 'PASS'
        preBackendGate = $PreBackendGate
        backendStartAuthorization = $BackendStartAuthorization
        redisCacheStarted = 'YES'
        redisQueueStarted = 'YES'
        redisStartReplay = 'NO'
        postRedisDbHealth = 'PASS'
        postRedisDbConnectivity = 'PASS'
        siteHashDriftCount = $SiteHashDriftCount
        unauthorizedRunningServiceCount = $UnauthorizedRunningServiceCount
        secretValueExposureCount = $SecretExposureCount
        configuratorStarted = 'NO'
        backendStarted = 'NO'
        frontendStarted = 'NO'
        websocketStarted = 'NO'
        workersStarted = 'NO'
        schedulerStarted = 'NO'
        createSiteExecuted = 'NO'
        port8080Changed = 'NO'
        port18080Bound = 'NO'
    })

    Write-JsonFile -Name '34_NEXT_STAGE_HANDOFF.json' -Value ([ordered]@{
        status = 'READY_FOR_SEPARATE_AUTHORITY'
        nextAuthorityScope = @(
            'configurator idempotency proof only if required',
            'backend-only startup',
            '127.0.0.1:18080 -> backend:8000',
            'site frontend',
            'read-only HTTP/API proof'
        )
        prohibited = @(
            'create-site',
            'migrate',
            'frontend startup',
            'worker startup',
            'scheduler startup',
            'production deployment'
        )
    })

    Write-Utf8NoBom -Path (Join-Path $EvidenceRoot '35_PS1_FINAL_SHA256.txt') -Text (
        "SCRIPT=$PSCommandPath`r`nSHA256=$ScriptSha256`r`n"
    )

    Write-JsonFile -Name '36_PS51_PARSER_PREFLIGHT.json' -Value ([ordered]@{
        status = 'PASS'
        proofPath = $ParserPreflightProofPath
        sha256 = [string]$ParserProofObject.sha256
        errorCount = [int]$ParserProofObject.errorCount
        psVersion = [string]$ParserProofObject.psVersion
        postPreflightBytesUnchanged = $true
        nativeHelperTransport = 'READONLY_BIND_MOUNT'
        multilineShLcNativeArgumentTransport = 'FORBIDDEN'
        dockerInspectMetadataTransport = 'JSON'
        dockerGoTemplateNativeArgumentTransport = 'FORBIDDEN'
        optionalDockerPropertyAccess = 'PSOBJECT_PROPERTIES_NULL_SAFE'
        missingHealthSemantics = 'NOT_DEFINED'
    })

    Write-RowEvidence

    $manifestObject = [ordered]@{
        schema = 'watany-control-center-phase2-evidence/v1'
        authority = $AuthorityId
        artifactCount = 42
        required = $RequiredEvidenceNames
        hashScope = @($RequiredEvidenceNames[0..37])
        nonCircularSealPolicy = [ordered]@{
            hashList = '38 hashes artifacts 00-37 only'
            completeness = '39 validates required-set presence and parseability'
            zipValidation = '40 records first-pass reopened archive; final archive is independently reopened after 40/41 are fixed'
            closeoutToken = '41'
        }
    }
    Write-JsonFile -Name '37_EVIDENCE_MANIFEST.json' -Value $manifestObject

    $hashLines = New-Object System.Collections.Generic.List[string]
    for ($hashIndex = 0; $hashIndex -le 37; $hashIndex++) {
        $hashName = $RequiredEvidenceNames[$hashIndex]
        $hashPath = Join-Path $EvidenceRoot $hashName
        $hashLines.Add(('{0}  {1}' -f (Get-Sha256 -Path $hashPath),$hashName))
    }
    Write-Utf8NoBom -Path (Join-Path $EvidenceRoot '38_EVIDENCE_SHA256.txt') -Text (($hashLines.ToArray() -join [Environment]::NewLine) + [Environment]::NewLine)

    $parseResult = Test-EvidenceJsonCsv
    if (($parseResult.JsonFailures -ne 0) -or ($parseResult.CsvFailures -ne 0)) {
        throw ('APEX_EVIDENCE_PARSE_VALIDATION_FAILED: Json={0}; Csv={1}' -f $parseResult.JsonFailures,$parseResult.CsvFailures)
    }

    Write-JsonFile -Name '39_EVIDENCE_COMPLETENESS.json' -Value ([ordered]@{
        status = 'PASS'
        requiredArtifactCount = 42
        currentArtifactCountBeforeZipSeal = 40
        jsonParseFailures = $parseResult.JsonFailures
        csvParseFailures = $parseResult.CsvFailures
        missingRequiredArtifactCount = 0
        secretValueExposureCount = $SecretExposureCount
        hashListValidation = 'PASS'
    })

    Write-JsonFile -Name '40_ZIP_REOPEN_VALIDATION.json' -Value ([ordered]@{
        status = 'PENDING_FIRST_PASS'
        firstPass = 'NOT_RUN'
        finalPass = 'VALIDATED_BY_CONTROLLER_AFTER_FINAL_SEAL'
        expectedEntries = 42
    })

    $passToken = $AuthorityId + '_PASS'
    Write-Utf8NoBom -Path (Join-Path $EvidenceRoot '41_AUTHORITY_CLOSEOUT_TOKEN.txt') -Text ($passToken + [Environment]::NewLine)

    $allFilesBeforeZip = @(Get-ChildItem -LiteralPath $EvidenceRoot -File)
    if ($allFilesBeforeZip.Count -ne 42) {
        throw ('APEX_EVIDENCE_ARTIFACT_COUNT_FAILED: Count={0}' -f $allFilesBeforeZip.Count)
    }

    New-EvidenceZip -DestinationPath $EvidenceZipPath
    $firstZipProof = Test-EvidenceZip -ZipPath $EvidenceZipPath
    if ($firstZipProof.Status -ne 'PASS') {
        throw ('APEX_EVIDENCE_FIRST_ZIP_REOPEN_FAILED: Entries={0}; Names={1}; Bytes={2}' -f $firstZipProof.EntryCount,$firstZipProof.NameDifferenceCount,$firstZipProof.ByteParityFailures)
    }

    Write-JsonFile -Name '40_ZIP_REOPEN_VALIDATION.json' -Value ([ordered]@{
        status = 'PASS'
        firstPass = 'PASS'
        firstPassEntryCount = $firstZipProof.EntryCount
        firstPassNameDifferenceCount = $firstZipProof.NameDifferenceCount
        firstPassByteParityFailures = $firstZipProof.ByteParityFailures
        finalPass = 'REQUIRED_AFTER_FINAL_REBUILD'
        expectedEntries = 42
    })

    New-EvidenceZip -DestinationPath $EvidenceZipPath
    $finalZipProof = Test-EvidenceZip -ZipPath $EvidenceZipPath
    if ($finalZipProof.Status -ne 'PASS') {
        Remove-Item -LiteralPath $EvidenceZipPath -Force -ErrorAction SilentlyContinue
        throw ('APEX_EVIDENCE_FINAL_ZIP_REOPEN_FAILED: Entries={0}; Names={1}; Bytes={2}' -f $finalZipProof.EntryCount,$finalZipProof.NameDifferenceCount,$finalZipProof.ByteParityFailures)
    }

    Write-Output 'PS51_DOCKER_NATIVE_ARGUMENT_TRANSPORT_REPAIR=PASS'
    Write-Output 'PS51_DOCKER_GO_TEMPLATE_TRANSPORT_REPAIR=PASS'
    Write-Output 'PS51_OPTIONAL_DOCKER_HEALTH_PROPERTY_REPAIR=PASS'
    Write-Output 'DIRECT_DOCKER_STATE_HEALTH_ACCESS=ELIMINATED'
    Write-Output 'MISSING_DOCKER_HEALTH_SEMANTICS=NOT_DEFINED'
    Write-Output 'DOCKER_GO_TEMPLATE_NATIVE_ARGUMENT_TRANSPORT=ELIMINATED'
    Write-Output 'DOCKER_METADATA_TRANSPORT=INSPECT_JSON_POWERSHELL_PARSE'
    Write-Output 'MULTILINE_SH_LC_NATIVE_ARGUMENT_TRANSPORT=ELIMINATED'
    Write-Output 'CONTAINER_HELPER_TRANSPORT=READONLY_BIND_MOUNT'
    Write-Output 'PHASE_1_DATABASE_RUNTIME_RECOVERY=PASS'
    Write-Output 'PHASE_1B_LIVE_DATABASE_SCHEMA_PROOF=PASS'
    Write-Output 'REDIS_CACHE_STARTED=YES'
    Write-Output 'REDIS_CACHE_START_REPLAYED=NO'
    Write-Output 'REDIS_CACHE_PING=PASS'
    Write-Output 'REDIS_CACHE_VERSION_COMPATIBILITY=PASS'
    Write-Output 'REDIS_QUEUE_STARTED=YES'
    Write-Output 'REDIS_QUEUE_START_REPLAYED=NO'
    Write-Output 'REDIS_QUEUE_PING=PASS'
    Write-Output 'REDIS_QUEUE_VERSION_COMPATIBILITY=PASS'
    Write-Output 'REDIS_QUEUE_PERSISTENCE_VOLUME=PROVEN'
    Write-Output 'PRESERVED_SITE_DEPENDENCY_RECONCILIATION=PASS'
    Write-Output 'POST_REDIS_DB_HEALTH=PASS'
    Write-Output 'POST_REDIS_DB_CONNECTIVITY=PASS'
    Write-Output 'SITE_CONFIG_HASH_DRIFT=0'
    Write-Output 'COMMON_SITE_CONFIG_HASH_DRIFT=0'
    Write-Output 'APPS_TXT_HASH_DRIFT=0'
    Write-Output 'APPS_JSON_HASH_DRIFT=0'
    Write-Output 'CONFIGURATOR_STARTED=NO'
    Write-Output 'BACKEND_STARTED=NO'
    Write-Output 'FRONTEND_STARTED=NO'
    Write-Output 'WEBSOCKET_STARTED=NO'
    Write-Output 'WORKERS_STARTED=NO'
    Write-Output 'SCHEDULER_STARTED=NO'
    Write-Output 'CREATE_SITE_EXECUTED=NO'
    Write-Output 'PORT_8080_CHANGED=NO'
    Write-Output 'PORT_18080_BOUND=NO'
    Write-Output ('SECRET_VALUE_EXPOSURE_COUNT={0}' -f $SecretExposureCount)
    Write-Output ('UNAUTHORIZED_RUNNING_SERVICE_COUNT={0}' -f $UnauthorizedRunningServiceCount)
    Write-Output 'PRE_BACKEND_GATE=PASS'
    Write-Output 'BACKEND_START_AUTHORIZATION=READY_FOR_SEPARATE_AUTHORITY'
    Write-Output 'EVIDENCE_COMPLETENESS=PASS'
    Write-Output 'ZIP_REOPEN_VALIDATION=PASS'
    Write-Output ('EVIDENCE_ROOT={0}' -f $EvidenceRoot)
    Write-Output ('EVIDENCE_ZIP={0}' -f $EvidenceZipPath)
    Write-Output 'OVERALL_STATUS=PASS'
    Write-Output ($AuthorityId + '=PASS')

    exit 0
}
catch {
    $caughtMessage = $_.Exception.Message
    if ([string]::IsNullOrWhiteSpace($FirstFailedGate)) {
        $FirstFailedGate = 'UNCLASSIFIED_RUNTIME_GATE'
    }

    if ($FailureRows.Count -eq 0) {
        try {
            Register-FailureClass -Class 'APEX_STAGE_X_PHASE2_FINALIZATION_RUNTIME_FAILURE' -Detail $caughtMessage
        }
        catch {
            # Preserve the primary failure even if register persistence also fails.
        }
    }

    if (-not [string]::IsNullOrWhiteSpace($EvidenceRoot)) {
        try {
            Add-GateRow -Gate $FirstFailedGate -Status 'BLOCKED' -Detail $caughtMessage
            Write-RowEvidence

            $blockedStatus = [ordered]@{
                authority = $AuthorityId
                status = 'BLOCKED'
                firstFailedGate = $FirstFailedGate
                message = $caughtMessage
                preBackendGate = 'BLOCKED'
                backendStartAuthorization = 'NO'
                createSiteExecuted = 'NO'
                backendStarted = 'NO'
                frontendStarted = 'NO'
                productionDeployment = 'NO'
            }
            Write-JsonFile -Name '33_PHASE2_FINAL_STATUS.json' -Value $blockedStatus
            Write-JsonFile -Name '34_NEXT_STAGE_HANDOFF.json' -Value ([ordered]@{
                status = 'BLOCKED'
                resumeAt = $FirstFailedGate
                backendStartAuthorization = 'NO'
            })
        }
        catch {
            # Do not mask the primary failure.
        }
    }

    Write-Output ('FIRST_FAILED_GATE={0}' -f $FirstFailedGate)
    Write-Output 'PRE_BACKEND_GATE=BLOCKED'
    Write-Output 'BACKEND_START_AUTHORIZATION=NO'
    Write-Output 'CREATE_SITE_EXECUTED=NO'
    Write-Output 'PRODUCTION_DEPLOYMENT=NO'
    Write-Output 'OVERALL_STATUS=BLOCKED'
    Write-Output ('ERROR={0}' -f $caughtMessage)
    Write-Output ($AuthorityId + '=BLOCKED')
    exit 1
}
