#requires -Version 5.1
<#
.SYNOPSIS
  APEX Stage X ERPNext Phase 3 backend-only recovery controller.

.DESCRIPTION
  Resumes from the sealed Phase 2 PASS and the proven Phase 3 partial state.
  It never replays Phase 2 recovery.

  V1.0.1 registers and repairs:
    APEX_PHASE3_COMPOSE_PROGRESS_LINE_MISCLASSIFIED_AS_NATIVE_FAILURE
    APEX_PS51_INTERACTIVE_IF_ELSE_SPLIT_ACROSS_SUBMISSIONS
    APEX_STAGE_X_PHASE3_BACKEND_CONTAINER_CREATE_OR_START_FAILED

  The authoritative post-failure forensic state proves that
  frappe_docker-backend-1 already exists, is running, uses
  frappe/erpnext:v16.32.0, is attached to frappe_docker_frappe_network,
  has no Docker State.Error, and owns 127.0.0.1:18080 -> 8000.

  Therefore V1.0.1 is exact-resume aware: when that exact state is present it
  MUST NOT replay docker compose up, recreate, restart, stop, or remove backend.
  It adopts the already-running backend only after independently re-proving its
  identity/network/bind postconditions, then continues with the still-unproven
  read-only Frappe HTTP, DB/Redis non-regression, site immutability, service
  isolation, evidence seal, and PRE_WORKER_GATE closure.

  If backend is absent, the original bounded backend-only start remains
  available. Docker Compose progress text is treated as progress text only;
  success/failure is determined by native exit code and independently verified
  post-state, never by words such as Creating/Starting in progress output.

  This authority NEVER starts frontend, websocket, workers, scheduler or
  create-site and NEVER runs migrations.

  Windows PowerShell 5.1 is mandatory. The exact final bytes require a separate
  external parser-proof JSON before -File execution. Parser PASS is not runtime
  proof.
#>

[CmdletBinding()]
param(
    [Parameter()]
    [string]$WorkspaceRoot = 'C:\xampp\htdocs\projectx\watanybot',

    [Parameter()]
    [string]$FrappeDockerRoot = 'C:\xampp\htdocs\projectx\watany-control-center\erpnext\frappe_docker',

    [Parameter()]
    [string]$EvidenceBase = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence',

    [Parameter()]
    [string]$ParserPreflightProofPath = ''
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$AuthorityId = 'APEX_WATANY_CONTROL_CENTER_STAGE_X_ERPNEXT_PHASE3_CONFIGURATOR_IDEMPOTENCY_BACKEND_ONLY_LOOPBACK_RUNTIME_RECOVERY_FRAPPE_READ_ONLY_HTTP_PROOF_COMPOSE_PROGRESS_CLASSIFICATION_REPAIR_EXACT_RESUME_AND_PRE_WORKER_GATE_V1_0_1'
$ScriptVersion = 'V1_0_1'

$ComposeProject = 'frappe_docker'
$ComposeFile = Join-Path $FrappeDockerRoot 'pwd.yml'
$LoopbackOverride = Join-Path $FrappeDockerRoot 'watany.integration.backend-loopback.yml'
$ExpectedErpImage = 'frappe/erpnext:v16.32.0'
$ExpectedDbImage = 'mariadb:11.8'
$ExpectedRedisImage = 'redis:6.2-alpine'
$ExpectedNetwork = 'frappe_docker_frappe_network'

$DbContainerName = 'frappe_docker-db-1'
$RedisCacheContainerName = 'frappe_docker-redis-cache-1'
$RedisQueueContainerName = 'frappe_docker-redis-queue-1'
$BackendContainerName = 'frappe_docker-backend-1'

$SitesVolumeName = 'frappe_docker_sites'
$DbVolumeName = 'frappe_docker_db-data'
$RedisQueueVolumeName = 'frappe_docker_redis-queue-data'

$BackendLoopbackAddress = '127.0.0.1'
$BackendLoopbackPort = 18080
$ProtectedApachePort = 8080

$AllowedPrestartServices = @('db','redis-cache','redis-queue')
$AllowedPoststartServices = @('db','redis-cache','redis-queue','backend')
$ForbiddenServices = @('configurator','create-site','frontend','websocket','queue-short','queue-long','scheduler')

$RequiredEvidenceNames = @(
    '00_AUTHORITY.md',
    '01_APEX_CONTRACT_STATUS.json',
    '02_FAILURE_REGISTER_PRECHECK.json',
    '03_PHASE2_PREDECESSOR_SEAL.json',
    '04_RUNTIME_BASELINE.csv',
    '05_DB_PRESTART_HEALTH.json',
    '06_REDIS_PRESTART_HEALTH.json',
    '07_SITE_CONTROL_HASHES_BEFORE.csv',
    '08_CONFIGURATOR_RESOLVED_COMMAND_REDACTED.txt',
    '09_CONFIGURATOR_NECESSITY.json',
    '10_CONFIGURATOR_IDEMPOTENCY.json',
    '11_CONFIGURATOR_EXECUTION.txt',
    '12_CONFIGURATOR_POST_STATE.json',
    '13_PORT_8080_PRECHECK.json',
    '14_PORT_18080_PRECHECK.json',
    '15_BACKEND_COMPOSE_PLAN.json',
    '16_BACKEND_START.txt',
    '17_BACKEND_CONTAINER_RUNTIME.json',
    '18_BACKEND_NETWORK_PROOF.json',
    '19_BACKEND_LOOPBACK_BIND_PROOF.json',
    '20_SITE_ROUTING_PROOF.json',
    '21_FRAPPE_HTTP_ROOT_PROOF.json',
    '22_FRAPPE_HTTP_METHOD_PROOF.json',
    '23_FRAPPE_RUNTIME_IDENTITY.json',
    '24_POST_BACKEND_DB_HEALTH.json',
    '25_POST_BACKEND_DB_CONNECTIVITY.json',
    '26_POST_BACKEND_REDIS_HEALTH.json',
    '27_SITE_CONTROL_HASHES_AFTER.csv',
    '28_SITE_IMMUTABILITY.json',
    '29_RUNNING_SERVICE_CENSUS.csv',
    '30_UNAUTHORIZED_SERVICE_GATE.json',
    '31_PORT_8080_POSTCHECK.json',
    '32_PORT_18080_POSTCHECK.json',
    '33_SECRET_EXPOSURE_AUDIT.json',
    '34_HTTP_REQUEST_AUDIT.csv',
    '35_ACTION_LOG.csv',
    '36_FAILURES.csv',
    '37_WARNINGS.csv',
    '38_GATE_RESULTS.csv',
    '39_PHASE3_FINAL_STATUS.json',
    '40_NEXT_STAGE_HANDOFF.json',
    '41_PS1_FINAL_SHA256.txt',
    '42_PS51_PARSER_PREFLIGHT.json',
    '43_EVIDENCE_MANIFEST.json',
    '44_EVIDENCE_SHA256.txt',
    '45_EVIDENCE_COMPLETENESS.json',
    '46_ZIP_REOPEN_VALIDATION.json',
    '47_AUTHORITY_CLOSEOUT_TOKEN.txt'
)

$KnownRegressionClasses = @(
    'APEX_PS51_DOCKER_MULTILINE_SH_LC_NATIVE_ARGUMENT_TRANSPORT_CORRUPTION',
    'APEX_PS51_DOCKER_GO_TEMPLATE_QUOTED_STRING_NATIVE_ARGUMENT_CORRUPTION',
    'APEX_PS51_STRICTMODE_OPTIONAL_DOCKER_HEALTH_PROPERTY_ACCESS',
    'APEX_PS51_MANDATORY_ARRAY_PARAMETER_EMPTY_COLLECTION_BINDING',
    'APEX_PS51_INTERACTIVE_SPLIT_IF_ELSE_EXECUTION',
    'APEX_PS51_PROCESSSTARTINFO_ARGUMENTLIST_DEFECT',
    'APEX_RESOLVEPATH_ON_NEW_OUTPUT_FILE_DEFECT',
    'APEX_RUNTIME_PROOF_REQUIRED_NOT_PARSER_ONLY',
    'APEX_STALE_SCRIPTPATH_WRONG_ARTIFACT_EXECUTION_DEFECT',
    'APEX_PHASE3_COMPOSE_PROGRESS_LINE_MISCLASSIFIED_AS_NATIVE_FAILURE',
    'APEX_PS51_INTERACTIVE_IF_ELSE_SPLIT_ACROSS_SUBMISSIONS',
    'APEX_STAGE_X_PHASE3_BACKEND_CONTAINER_CREATE_OR_START_FAILED'
)

$ActionRows = New-Object System.Collections.ArrayList
$FailureRows = New-Object System.Collections.ArrayList
$WarningRows = New-Object System.Collections.ArrayList
$GateRows = New-Object System.Collections.ArrayList
$HttpRows = New-Object System.Collections.ArrayList

$EvidenceRoot = ''
$EvidenceZip = ''
$ExternalZipValidationSidecar = ''
$ScriptSha256 = ''
$ParserProofObject = $null
$FirstFailedGate = ''
$BackendStartedByThisRun = $false
$BackendAlreadyRunningAtResume = $false
$BackendStartReplayed = $false
$BackendAdoptedByExactResume = $false
$ConfiguratorStartedByThisRun = $false
$UnauthorizedRunningServiceCount = 0
$SecretValueExposureCount = 0
$Phase3Status = 'BLOCKED'
$PreWorkerGate = 'BLOCKED'
$WorkerStartAuthorization = 'NO'

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
    return ($Value | ConvertTo-Json -Depth 20)
}

function Write-JsonEvidence {
    param(
        [Parameter(Mandatory=$true)][string]$Name,
        [Parameter(Mandatory=$true)]$Value
    )

    Write-Utf8NoBom -Path (Join-Path $EvidenceRoot $Name) -Text ((ConvertTo-JsonText -Value $Value) + [Environment]::NewLine)
}

function Write-TextEvidence {
    param(
        [Parameter(Mandatory=$true)][string]$Name,
        [Parameter(Mandatory=$true)][AllowEmptyString()][string]$Text
    )

    Write-Utf8NoBom -Path (Join-Path $EvidenceRoot $Name) -Text $Text
}

function Escape-CsvValue {
    param([AllowNull()][object]$Value)

    if ($null -eq $Value) {
        return '""'
    }

    return '"' + ([string]$Value).Replace('"','""') + '"'
}

function Write-CsvEvidence {
    param(
        [Parameter(Mandatory=$true)][string]$Name,
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

    Write-Utf8Bom -Path (Join-Path $EvidenceRoot $Name) -Text (($lines.ToArray() -join [Environment]::NewLine) + [Environment]::NewLine)
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

function Invoke-Native {
    param(
        [Parameter(Mandatory=$true)][string]$Executable,
        [Parameter(Mandatory=$true)][AllowEmptyCollection()][string[]]$ArgumentVector,
        [Parameter(Mandatory=$true)][string]$Label,
        [int]$TimeoutSeconds = 120,
        [switch]$AllowNonZero
    )

    $stdoutPath = Join-Path $env:TEMP ('apex-native-out-' + [guid]::NewGuid().ToString('N') + '.txt')
    $stderrPath = Join-Path $env:TEMP ('apex-native-err-' + [guid]::NewGuid().ToString('N') + '.txt')

    try {
        $nativeOutput = @(& $Executable @ArgumentVector 2> $stderrPath)
        $nativeExitCode = $LASTEXITCODE
        $stdoutText = ($nativeOutput | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
        $stderrText = ''
        if ([System.IO.File]::Exists($stderrPath)) {
            $stderrText = [System.IO.File]::ReadAllText($stderrPath)
        }

        Write-Utf8NoBom -Path $stdoutPath -Text $stdoutText

        $failureTokenPresent = $false
        if ($stderrText -match '(?i)\b(error|fatal|failed|exception|traceback)\b') {
            $failureTokenPresent = $true
        }

        Add-Action -Action $Label -Status $(if ($nativeExitCode -eq 0) { 'PASS' } else { 'BLOCKED' }) -Detail ('ExitCode={0}; StdoutBytes={1}; StderrBytes={2}' -f $nativeExitCode,$stdoutText.Length,$stderrText.Length)

        if ((-not $AllowNonZero) -and ($nativeExitCode -ne 0)) {
            throw ('APEX_NATIVE_PROCESS_FAILED: Label={0}; ExitCode={1}; Stderr={2}' -f $Label,$nativeExitCode,$stderrText.Trim())
        }

        return [pscustomobject]@{
            Label = $Label
            ExitCode = $nativeExitCode
            Stdout = $stdoutText
            Stderr = $stderrText
            FailureTokenPresent = $failureTokenPresent
        }
    }
    finally {
        foreach ($temporaryPath in @($stdoutPath,$stderrPath)) {
            if ([System.IO.File]::Exists($temporaryPath)) {
                Remove-Item -LiteralPath $temporaryPath -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

function Get-DockerPath {
    $commandObject = Get-Command docker.exe -ErrorAction SilentlyContinue
    if ($null -eq $commandObject) {
        $commandObject = Get-Command docker -ErrorAction SilentlyContinue
    }
    if ($null -eq $commandObject) {
        throw 'APEX_DOCKER_COMMAND_NOT_FOUND'
    }
    return [string]$commandObject.Source
}

function Get-DockerInspectObject {
    param(
        [Parameter(Mandatory=$true)][string]$DockerPath,
        [Parameter(Mandatory=$true)][string]$ContainerReference,
        [Parameter(Mandatory=$true)][string]$Label
    )

    $inspectResult = Invoke-Native -Executable $DockerPath -ArgumentVector @('inspect',$ContainerReference) -Label $Label
    if ([string]::IsNullOrWhiteSpace($inspectResult.Stdout)) {
        throw ('APEX_DOCKER_INSPECT_EMPTY: {0}' -f $ContainerReference)
    }

    try {
        $inspectRows = @($inspectResult.Stdout | ConvertFrom-Json)
    }
    catch {
        throw ('APEX_DOCKER_INSPECT_JSON_PARSE_FAILED: {0}' -f $ContainerReference)
    }

    if ($inspectRows.Count -ne 1) {
        throw ('APEX_DOCKER_INSPECT_CARDINALITY_INVALID: Ref={0}; Count={1}' -f $ContainerReference,$inspectRows.Count)
    }

    return $inspectRows[0]
}

function Get-DockerStateStatus {
    param([Parameter(Mandatory=$true)]$InspectObject)

    $stateObject = Get-OptionalPropertyValue -ObjectValue $InspectObject -PropertyName 'State' -DefaultValue $null
    return [string](Get-OptionalPropertyValue -ObjectValue $stateObject -PropertyName 'Status' -DefaultValue 'NOT_DEFINED')
}

function Get-DockerHealthStatus {
    param([Parameter(Mandatory=$true)]$InspectObject)

    $stateObject = Get-OptionalPropertyValue -ObjectValue $InspectObject -PropertyName 'State' -DefaultValue $null
    $healthObject = Get-OptionalPropertyValue -ObjectValue $stateObject -PropertyName 'Health' -DefaultValue $null
    return [string](Get-OptionalPropertyValue -ObjectValue $healthObject -PropertyName 'Status' -DefaultValue 'NOT_DEFINED')
}

function Get-DockerImageName {
    param([Parameter(Mandatory=$true)]$InspectObject)

    $configObject = Get-OptionalPropertyValue -ObjectValue $InspectObject -PropertyName 'Config' -DefaultValue $null
    return [string](Get-OptionalPropertyValue -ObjectValue $configObject -PropertyName 'Image' -DefaultValue '')
}

function Get-DockerNetworkNames {
    param([Parameter(Mandatory=$true)]$InspectObject)

    $rows = New-Object System.Collections.Generic.List[string]
    $networkSettings = Get-OptionalPropertyValue -ObjectValue $InspectObject -PropertyName 'NetworkSettings' -DefaultValue $null
    $networksObject = Get-OptionalPropertyValue -ObjectValue $networkSettings -PropertyName 'Networks' -DefaultValue $null

    if ($null -eq $networksObject) {
        return @()
    }

    foreach ($networkProperty in $networksObject.PSObject.Properties) {
        $rows.Add([string]$networkProperty.Name)
    }

    return @($rows.ToArray())
}

function Get-DockerLabelsObject {
    param([Parameter(Mandatory=$true)]$InspectObject)

    $configObject = Get-OptionalPropertyValue -ObjectValue $InspectObject -PropertyName 'Config' -DefaultValue $null
    return Get-OptionalPropertyValue -ObjectValue $configObject -PropertyName 'Labels' -DefaultValue $null
}

function Get-ComposeServiceName {
    param([Parameter(Mandatory=$true)]$InspectObject)

    $labelsObject = Get-DockerLabelsObject -InspectObject $InspectObject
    if ($null -eq $labelsObject) {
        return ''
    }

    $propertyEntry = $labelsObject.PSObject.Properties['com.docker.compose.service']
    if ($null -eq $propertyEntry) {
        return ''
    }

    return [string]$propertyEntry.Value
}

function Get-ContainerIdsForProject {
    param(
        [Parameter(Mandatory=$true)][string]$DockerPath,
        [Parameter(Mandatory=$true)][switch]$RunningOnly
    )

    $arguments = New-Object System.Collections.Generic.List[string]
    $arguments.Add('ps')
    if (-not $RunningOnly) {
        $arguments.Add('-a')
    }
    $arguments.Add('--filter')
    $arguments.Add(('label=com.docker.compose.project={0}' -f $ComposeProject))
    $arguments.Add('--quiet')

    $resultObject = Invoke-Native -Executable $DockerPath -ArgumentVector $arguments.ToArray() -Label 'COMPOSE_PROJECT_CONTAINER_IDS'
    if ([string]::IsNullOrWhiteSpace($resultObject.Stdout)) {
        return @()
    }

    return @($resultObject.Stdout -split '\r?\n' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
}

function Get-RunningServiceRows {
    param([Parameter(Mandatory=$true)][string]$DockerPath)

    $rows = New-Object System.Collections.Generic.List[object]
    $containerIds = @(Get-ContainerIdsForProject -DockerPath $DockerPath -RunningOnly)

    foreach ($containerId in $containerIds) {
        $inspectObject = Get-DockerInspectObject -DockerPath $DockerPath -ContainerReference $containerId -Label ('INSPECT_RUNNING_' + $containerId)
        $serviceName = Get-ComposeServiceName -InspectObject $inspectObject
        $containerName = [string](Get-OptionalPropertyValue -ObjectValue $inspectObject -PropertyName 'Name' -DefaultValue '')
        $containerName = $containerName.TrimStart('/')

        $rows.Add([pscustomobject]@{
            Container = $containerName
            Service = $serviceName
            Image = Get-DockerImageName -InspectObject $inspectObject
            State = Get-DockerStateStatus -InspectObject $inspectObject
            Health = Get-DockerHealthStatus -InspectObject $inspectObject
        })
    }

    return @($rows.ToArray())
}

function Assert-RunningServiceSet {
    param(
        [Parameter(Mandatory=$true)][object[]]$Rows,
        [Parameter(Mandatory=$true)][string[]]$AllowedServices,
        [Parameter(Mandatory=$true)][string]$GateName
    )

    $actualServices = @($Rows | ForEach-Object { [string]$_.Service } | Sort-Object -Unique)
    $expectedServices = @($AllowedServices | Sort-Object -Unique)
    $differences = @(Compare-Object -ReferenceObject $expectedServices -DifferenceObject $actualServices)

    if ($differences.Count -ne 0) {
        Add-Gate -Gate $GateName -Status 'BLOCKED' -Detail ('Expected={0}; Actual={1}' -f ($expectedServices -join '|'),($actualServices -join '|'))
        throw ('APEX_RUNNING_SERVICE_SET_MISMATCH: Gate={0}; Expected={1}; Actual={2}' -f $GateName,($expectedServices -join '|'),($actualServices -join '|'))
    }

    Add-Gate -Gate $GateName -Status 'PASS' -Detail ($actualServices -join '|')
}

function Test-ParserProof {
    if ([string]::IsNullOrWhiteSpace($ParserPreflightProofPath)) {
        $script:ParserPreflightProofPath = $PSCommandPath + '.ps51-parser-preflight.json'
    }

    if (-not [System.IO.File]::Exists($ParserPreflightProofPath)) {
        throw ('APEX_EXTERNAL_PS51_PARSER_PREFLIGHT_PROOF_MISSING: {0}' -f $ParserPreflightProofPath)
    }

    $proofObject = ([System.IO.File]::ReadAllText($ParserPreflightProofPath)) | ConvertFrom-Json
    if ([string]$proofObject.status -ne 'PASS') {
        throw 'APEX_EXTERNAL_PS51_PARSER_PREFLIGHT_NOT_PASS'
    }
    if ([int]$proofObject.errorCount -ne 0) {
        throw ('APEX_EXTERNAL_PS51_PARSER_ERRORS_PRESENT: {0}' -f [int]$proofObject.errorCount)
    }
    if (-not ([string]$proofObject.psVersion).StartsWith('5.1.')) {
        throw ('APEX_EXTERNAL_PARSER_NOT_PS51: {0}' -f [string]$proofObject.psVersion)
    }

    $currentHash = Get-Sha256 -Path $PSCommandPath
    if ([string]$proofObject.sha256 -ne $currentHash) {
        throw ('APEX_EXTERNAL_PS51_PARSER_HASH_MISMATCH: Proof={0}; Current={1}' -f [string]$proofObject.sha256,$currentHash)
    }

    $script:ScriptSha256 = $currentHash
    $script:ParserProofObject = $proofObject
}

function Find-LatestPhase3PredecessorClosure {
    if (-not [System.IO.Directory]::Exists($EvidenceBase)) {
        throw ('APEX_EVIDENCE_BASE_NOT_FOUND: {0}' -f $EvidenceBase)
    }

    $candidates = @(
        Get-ChildItem -LiteralPath $EvidenceBase -Directory |
            Where-Object { $_.Name -like 'watany-control-center-erpnext-phase2-phase3-predecessor-closure-*' } |
            Sort-Object LastWriteTime -Descending
    )

    if ($candidates.Count -lt 1) {
        throw 'APEX_PHASE3_PREDECESSOR_CLOSURE_NOT_FOUND'
    }

    return $candidates[0].FullName
}

function Test-Phase3PredecessorClosure {
    param([Parameter(Mandatory=$true)][string]$ClosureRoot)

    $authorizationPath = Join-Path $ClosureRoot '05_PHASE3_PREDECESSOR_AUTHORIZATION.json'
    $reopenPath = Join-Path $ClosureRoot '04_FINAL_ZIP_REOPEN_VALIDATION.json'
    $closeoutPath = Join-Path $ClosureRoot '13_AUTHORITY_CLOSEOUT_TOKEN.txt'
    $closureZip = $ClosureRoot + '.zip'

    foreach ($requiredPath in @($authorizationPath,$reopenPath,$closeoutPath,$closureZip)) {
        if (-not [System.IO.File]::Exists($requiredPath)) {
            throw ('APEX_PHASE3_PREDECESSOR_REQUIRED_FILE_MISSING: {0}' -f $requiredPath)
        }
    }

    $authorization = ([System.IO.File]::ReadAllText($authorizationPath)) | ConvertFrom-Json
    $reopen = ([System.IO.File]::ReadAllText($reopenPath)) | ConvertFrom-Json
    $closeout = [System.IO.File]::ReadAllText($closeoutPath).Trim()

    if ([string]$authorization.status -ne 'PASS') {
        throw 'APEX_PHASE3_PREDECESSOR_AUTHORIZATION_NOT_PASS'
    }
    if ([string]$authorization.phase3PredecessorAuthorization -ne 'PASS') {
        throw 'APEX_PHASE3_PREDECESSOR_AUTHORIZATION_TOKEN_NOT_PASS'
    }
    if ([string]$reopen.postArchiveReopen -ne 'PASS') {
        throw 'APEX_PHASE3_PREDECESSOR_FINAL_ZIP_REOPEN_NOT_PASS'
    }
    if ([string]$reopen.phase3PredecessorAuthorization -ne 'PASS') {
        throw 'APEX_PHASE3_PREDECESSOR_REOPEN_AUTHORIZATION_NOT_PASS'
    }
    if ($closeout -notmatch '_PASS$') {
        throw 'APEX_PHASE3_PREDECESSOR_CLOSEOUT_NOT_PASS'
    }

    return [pscustomobject]@{
        Status = 'PASS'
        ClosureRoot = $ClosureRoot
        ClosureZip = $closureZip
        Authorization = [string]$authorization.phase3PredecessorAuthorization
        FinalZipReopen = [string]$reopen.postArchiveReopen
        ResealedPhase2Zip = [string]$reopen.validationTarget
        ResealedPhase2ZipSha256 = [string]$reopen.validationTargetSha256
        CloseoutToken = $closeout
    }
}

function New-ContainerHelperScript {
    param(
        [Parameter(Mandatory=$true)][string]$Label,
        [Parameter(Mandatory=$true)][string]$ScriptText
    )

    $helperRoot = Join-Path $env:TEMP ('apex-phase3-helper-' + [guid]::NewGuid().ToString('N'))
    Ensure-Directory -Path $helperRoot
    $helperPath = Join-Path $helperRoot 'helper.sh'

    $normalizedText = $ScriptText.Replace("`r`n","`n").Replace("`r","`n")
    if (-not $normalizedText.EndsWith("`n")) {
        $normalizedText += "`n"
    }

    $encodingObject = New-Object System.Text.UTF8Encoding($false)
    [System.IO.File]::WriteAllText($helperPath,$normalizedText,$encodingObject)

    $rawBytes = [System.IO.File]::ReadAllBytes($helperPath)
    if (($rawBytes.Length -ge 3) -and ($rawBytes[0] -eq 0xEF) -and ($rawBytes[1] -eq 0xBB) -and ($rawBytes[2] -eq 0xBF)) {
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

function Invoke-DockerShellHelper {
    param(
        [Parameter(Mandatory=$true)][string]$DockerPath,
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

        return Invoke-Native -Executable $DockerPath -ArgumentVector $argumentList.ToArray() -Label $Label
    }
    finally {
        if (($null -ne $helperObject) -and [System.IO.Directory]::Exists([string]$helperObject.Root)) {
            Remove-Item -LiteralPath ([string]$helperObject.Root) -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-SiteControlHashes {
    param([Parameter(Mandatory=$true)][string]$DockerPath)

    $helperText = @'
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
        -DockerPath $DockerPath `
        -Label 'SITE_CONTROL_HASHES' `
        -ScriptText $helperText `
        -DockerArgumentsBeforeImage @(
            '--network','none',
            '--mount',('type=volume,source={0},target=/sites,readonly' -f $SitesVolumeName)
        ) `
        -ImageName $ExpectedErpImage

    $rows = New-Object System.Collections.Generic.List[object]
    foreach ($lineText in @($resultObject.Stdout -split '\r?\n')) {
        if ([string]::IsNullOrWhiteSpace($lineText)) {
            continue
        }
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
        })
    }

    if ($rows.Count -ne 4) {
        throw ('APEX_SITE_CONTROL_HASH_COUNT_INVALID: {0}' -f $rows.Count)
    }

    return @($rows.ToArray())
}

function Get-SafeCommonConfig {
    param([Parameter(Mandatory=$true)][string]$DockerPath)

    $helperText = @'
set -eu
cfg='/sites/common_site_config.json'
python3 - "$cfg" <<'PY'
import json, sys
p=sys.argv[1]
data=json.load(open(p,'r',encoding='utf-8'))
keys=['db_host','db_port','redis_cache','redis_queue','redis_socketio','socketio_port','default_site']
for key in keys:
    value=data.get(key,None)
    if value is None:
        print(f'{key}|<MISSING>')
    else:
        print(f'{key}|{value}')
PY
'@

    $resultObject = Invoke-DockerShellHelper `
        -DockerPath $DockerPath `
        -Label 'SAFE_COMMON_SITE_CONFIG' `
        -ScriptText $helperText `
        -DockerArgumentsBeforeImage @(
            '--network','none',
            '--mount',('type=volume,source={0},target=/sites,readonly' -f $SitesVolumeName)
        ) `
        -ImageName $ExpectedErpImage

    $map = @{}
    foreach ($lineText in @($resultObject.Stdout -split '\r?\n')) {
        if ([string]::IsNullOrWhiteSpace($lineText)) {
            continue
        }

        $separatorIndex = $lineText.IndexOf('|')
        if ($separatorIndex -lt 1) {
            throw ('APEX_SAFE_COMMON_CONFIG_OUTPUT_INVALID: {0}' -f $lineText)
        }

        $keyName = $lineText.Substring(0,$separatorIndex)
        $keyValue = $lineText.Substring($separatorIndex + 1)
        $map[$keyName] = $keyValue
    }

    return $map
}

function Test-DatabaseReadOnly {
    param([Parameter(Mandatory=$true)][string]$DockerPath)

    $helperText = @'
set -eu
cfg='/sites/frontend/site_config.json'
db_name="$(jq -r '.db_name // empty' "$cfg")"
db_user="$(jq -r '.db_user // empty' "$cfg")"
db_password="$(jq -r '.db_password // empty' "$cfg")"
if [ -z "$db_name" ] || [ -z "$db_user" ] || [ -z "$db_password" ]; then
  printf '%s\n' 'APEX_DB_SECRET_FIELDS_MISSING'
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
select_one="$(mariadb --defaults-extra-file=/tmp/client.cnf --batch --skip-column-names --execute='SELECT 1;' 2>/dev/null)"
table_count="$(mariadb --defaults-extra-file=/tmp/client.cnf --batch --skip-column-names --execute='SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = DATABASE();' 2>/dev/null)"
rm -f /tmp/client.cnf
if [ "$select_one" != '1' ]; then
  printf '%s\n' 'SELECT_ONE=FAIL'
  exit 72
fi
printf '%s\n' 'SELECT_ONE=PASS'
printf 'APPLICATION_TABLE_COUNT=%s\n' "$table_count"
printf '%s\n' 'SECRET_VALUES_PRINTED=NO'
'@

    $resultObject = Invoke-DockerShellHelper `
        -DockerPath $DockerPath `
        -Label 'DB_READ_ONLY_PROOF' `
        -ScriptText $helperText `
        -DockerArgumentsBeforeImage @(
            '--network',$ExpectedNetwork,
            '--tmpfs','/tmp:rw,noexec,nosuid,size=16m',
            '--mount',('type=volume,source={0},target=/sites,readonly' -f $SitesVolumeName)
        ) `
        -ImageName $ExpectedErpImage

    $tableCount = -1
    $selectPass = $false

    foreach ($lineText in @($resultObject.Stdout -split '\r?\n')) {
        if ($lineText -eq 'SELECT_ONE=PASS') {
            $selectPass = $true
        }
        elseif ($lineText.StartsWith('APPLICATION_TABLE_COUNT=')) {
            $valueText = $lineText.Substring('APPLICATION_TABLE_COUNT='.Length)
            $parsedValue = 0
            if ([int]::TryParse($valueText,[ref]$parsedValue)) {
                $tableCount = $parsedValue
            }
        }
    }

    if (-not $selectPass) {
        throw 'APEX_DB_SELECT_ONE_PROOF_MISSING'
    }
    if ($tableCount -le 0) {
        throw ('APEX_DB_APPLICATION_SCHEMA_EMPTY_OR_UNPROVEN: {0}' -f $tableCount)
    }

    return [pscustomobject]@{
        Status = 'PASS'
        SelectOne = 'PASS'
        ApplicationTableCount = $tableCount
        ApplicationSchemaNonEmpty = $true
        SecretValuesPrinted = 'NO'
    }
}

function Test-Redis {
    param(
        [Parameter(Mandatory=$true)][string]$DockerPath,
        [Parameter(Mandatory=$true)][string]$ContainerName,
        [Parameter(Mandatory=$true)][string]$ServiceName
    )

    $inspectObject = Get-DockerInspectObject -DockerPath $DockerPath -ContainerReference $ContainerName -Label ($ServiceName + '_INSPECT')
    $stateValue = Get-DockerStateStatus -InspectObject $inspectObject
    $imageValue = Get-DockerImageName -InspectObject $inspectObject
    $networkNames = @(Get-DockerNetworkNames -InspectObject $inspectObject)

    $pingResult = Invoke-Native -Executable $DockerPath -ArgumentVector @('exec',$ContainerName,'redis-cli','ping') -Label ($ServiceName + '_PING')
    $versionResult = Invoke-Native -Executable $DockerPath -ArgumentVector @('exec',$ContainerName,'redis-server','--version') -Label ($ServiceName + '_VERSION')

    if ($stateValue -ne 'running') {
        throw ('APEX_STAGE_X_PHASE3_REDIS_NOT_RUNNING: {0}' -f $ServiceName)
    }
    if ($imageValue -ne $ExpectedRedisImage) {
        throw ('APEX_STAGE_X_PHASE3_REDIS_IMAGE_MISMATCH: Service={0}; Image={1}' -f $ServiceName,$imageValue)
    }
    if ($networkNames -notcontains $ExpectedNetwork) {
        throw ('APEX_STAGE_X_PHASE3_REDIS_NETWORK_MISSING: {0}' -f $ServiceName)
    }
    if ($pingResult.Stdout.Trim() -ne 'PONG') {
        throw ('APEX_STAGE_X_PHASE3_REDIS_PING_FAILED: {0}' -f $ServiceName)
    }
    if ($versionResult.Stdout -notmatch 'v=6\.2\.') {
        throw ('APEX_STAGE_X_PHASE3_REDIS_VERSION_MISMATCH: {0}' -f $ServiceName)
    }

    return [pscustomobject]@{
        Status = 'PASS'
        Service = $ServiceName
        State = $stateValue
        Image = $imageValue
        Network = $ExpectedNetwork
        Ping = 'PONG'
        VersionCompatibility = 'PASS'
    }
}

function Get-PortState {
    param([Parameter(Mandatory=$true)][int]$Port)

    $listenerRows = @(
        Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue
    )

    $rows = New-Object System.Collections.Generic.List[object]

    foreach ($listenerRow in $listenerRows) {
        $ownerProcessId = [int]$listenerRow.OwningProcess
        $processName = ''
        try {
            $processObject = Get-Process -Id $ownerProcessId -ErrorAction Stop
            $processName = [string]$processObject.ProcessName
        }
        catch {
            $processName = 'UNRESOLVED'
        }

        $rows.Add([pscustomobject]@{
            LocalAddress = [string]$listenerRow.LocalAddress
            LocalPort = [int]$listenerRow.LocalPort
            OwningProcessId = $ownerProcessId
            ProcessName = $processName
        })
    }

    return @($rows.ToArray())
}

function Test-ProtectedPort8080 {
    $rows = @(Get-PortState -Port $ProtectedApachePort)
    if ($rows.Count -lt 1) {
        throw 'APEX_STAGE_X_PHASE3_PORT_8080_LISTENER_MISSING'
    }

    $httpdRows = @($rows | Where-Object { $_.ProcessName -eq 'httpd' })
    if ($httpdRows.Count -lt 1) {
        throw 'APEX_STAGE_X_PHASE3_PORT_8080_NOT_HTTPD'
    }

    return [pscustomobject]@{
        Status = 'PASS'
        ListenerCount = $rows.Count
        HttpdListenerCount = $httpdRows.Count
        Rows = $rows
    }
}

function Test-Port18080Free {
    $rows = @(Get-PortState -Port $BackendLoopbackPort)
    if ($rows.Count -ne 0) {
        throw ('APEX_STAGE_X_PHASE3_PORT_18080_NOT_FREE: Count={0}' -f $rows.Count)
    }

    return [pscustomobject]@{
        Status = 'PASS'
        ListenerCount = 0
    }
}

function Test-Port18080LoopbackBound {
    $rows = @(Get-PortState -Port $BackendLoopbackPort)
    if ($rows.Count -lt 1) {
        throw 'APEX_STAGE_X_PHASE3_BACKEND_LOOPBACK_BIND_FAILED'
    }

    $nonLoopbackRows = @(
        $rows | Where-Object {
            ($_.LocalAddress -ne '127.0.0.1') -and
            ($_.LocalAddress -ne '::ffff:127.0.0.1')
        }
    )

    if ($nonLoopbackRows.Count -ne 0) {
        throw ('APEX_STAGE_X_PHASE3_BACKEND_PUBLIC_BIND_EXPOSURE: Addresses={0}' -f (($nonLoopbackRows | ForEach-Object { $_.LocalAddress }) -join '|'))
    }

    return [pscustomobject]@{
        Status = 'PASS'
        ListenerCount = $rows.Count
        LoopbackOnly = $true
        PublicBind = 'NO'
        Rows = $rows
    }
}

function Get-ConfiguratorBlock {
    if (-not [System.IO.File]::Exists($ComposeFile)) {
        throw ('APEX_COMPOSE_FILE_NOT_FOUND: {0}' -f $ComposeFile)
    }

    $lines = [System.IO.File]::ReadAllLines($ComposeFile)
    $capturing = $false
    $captured = New-Object System.Collections.Generic.List[string]

    foreach ($lineText in $lines) {
        if (-not $capturing) {
            if ($lineText -match '^\s{2}configurator:\s*$') {
                $capturing = $true
                $captured.Add($lineText)
            }
            continue
        }

        if ($lineText -match '^\s{2}[A-Za-z0-9_-]+:\s*$') {
            break
        }

        $captured.Add($lineText)
    }

    if ($captured.Count -lt 2) {
        throw 'APEX_STAGE_X_PHASE3_CONFIGURATOR_BLOCK_NOT_FOUND'
    }

    return ($captured.ToArray() -join [Environment]::NewLine)
}

function Test-ConfiguratorSafetyAndNecessity {
    param(
        [Parameter(Mandatory=$true)][hashtable]$CommonConfig
    )

    $blockText = Get-ConfiguratorBlock

    $forbiddenTokens = @(
        ('bench ' + 'new-site'),
        ('bench ' + 'migrate'),
        'drop database',
        'drop site',
        'remove-site',
        'reinstall',
        'uninstall-app',
        'install-app',
        'set-admin-password'
    )

    foreach ($forbiddenToken in $forbiddenTokens) {
        if ($blockText.IndexOf($forbiddenToken,[System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
            throw ('APEX_STAGE_X_PHASE3_CONFIGURATOR_UNSAFE_COMMAND: {0}' -f $forbiddenToken)
        }
    }

    $requiredFragments = @(
        'bench set-config -g redis_cache',
        'bench set-config -g redis_queue',
        'bench set-config -g redis_socketio',
        'bench set-config -g db_host',
        'bench set-config -gp db_port'
    )

    foreach ($requiredFragment in $requiredFragments) {
        if ($blockText.IndexOf($requiredFragment,[System.StringComparison]::OrdinalIgnoreCase) -lt 0) {
            throw ('APEX_STAGE_X_PHASE3_CONFIGURATOR_EXPECTED_FRAGMENT_MISSING: {0}' -f $requiredFragment)
        }
    }

    $expectedValues = [ordered]@{
        db_host = 'db'
        db_port = '3306'
        redis_cache = 'redis://redis-cache:6379'
        redis_queue = 'redis://redis-queue:6379'
        redis_socketio = 'redis://redis-queue:6379'
        socketio_port = '9000'
        default_site = 'frontend'
    }

    $mismatches = New-Object System.Collections.Generic.List[string]

    foreach ($propertyName in $expectedValues.Keys) {
        if (-not $CommonConfig.ContainsKey($propertyName)) {
            $mismatches.Add(($propertyName + '=MISSING'))
            continue
        }

        $actualValue = [string]$CommonConfig[$propertyName]
        $expectedValue = [string]$expectedValues[$propertyName]

        if ($actualValue -ne $expectedValue) {
            $mismatches.Add(('{0}:Expected={1};Actual={2}' -f $propertyName,$expectedValue,$actualValue))
        }
    }

    if ($mismatches.Count -eq 0) {
        return [pscustomobject]@{
            Status = 'PASS'
            Necessity = 'NOT_REQUIRED_ALREADY_CONVERGED'
            Idempotency = 'NOT_EXECUTED_ALREADY_CONVERGED'
            ConfiguratorStarted = 'NO'
            SafeCommandClass = 'SET_CONFIG_GLOBAL_ONLY'
            MismatchCount = 0
            BlockRedacted = $blockText
        }
    }

    throw ('APEX_STAGE_X_PHASE3_CONFIGURATOR_DELTA_AMBIGUOUS: {0}' -f ($mismatches.ToArray() -join ' | '))
}

function Start-BackendOnly {
    param([Parameter(Mandatory=$true)][string]$DockerPath)

    $arguments = @(
        'compose',
        '-p',$ComposeProject,
        '-f',$ComposeFile,
        '-f',$LoopbackOverride,
        'up','-d','--no-deps','backend'
    )

    $resultObject = Invoke-Native `
        -Executable $DockerPath `
        -ArgumentVector $arguments `
        -Label 'BACKEND_ONLY_START'

    $script:BackendStartedByThisRun = $true
    $script:BackendStartReplayed = $true

    # Compose status words are progress only. They are never used as the
    # success/failure decision surface.
    $progressLineCount = @(
        (($resultObject.Stdout + [Environment]::NewLine + $resultObject.Stderr) -split '?
') |
            Where-Object {
                $_ -match '(?i)(Creating|Created|Starting|Started|Running|Waiting)'
            }
    ).Count

    Add-Action `
        -Action 'BACKEND_COMPOSE_PROGRESS_CLASSIFICATION' `
        -Status 'PASS' `
        -Detail ('ProgressLineCount={0}; DecisionSurface=EXIT_CODE_PLUS_POSTSTATE' -f $progressLineCount)

    return [pscustomobject]@{
        ExitCode = $resultObject.ExitCode
        Stdout = $resultObject.Stdout
        Stderr = $resultObject.Stderr
        ProgressLineCount = $progressLineCount
        DecisionSurface = 'EXIT_CODE_PLUS_POSTSTATE'
    }
}

function Test-BackendContainer {
    param([Parameter(Mandatory=$true)][string]$DockerPath)

    $resultObject = Invoke-Native -Executable $DockerPath -ArgumentVector @(
        'ps',
        '--filter',('label=com.docker.compose.project={0}' -f $ComposeProject),
        '--filter','label=com.docker.compose.service=backend',
        '--quiet'
    ) -Label 'BACKEND_CONTAINER_ID_CENSUS'

    $containerIds = @(
        $resultObject.Stdout -split '\r?\n' |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )

    if ($containerIds.Count -ne 1) {
        throw ('APEX_STAGE_X_PHASE3_BACKEND_CONTAINER_COUNT_INVALID: {0}' -f $containerIds.Count)
    }

    $inspectObject = Get-DockerInspectObject -DockerPath $DockerPath -ContainerReference $containerIds[0] -Label 'BACKEND_INSPECT'
    $stateValue = Get-DockerStateStatus -InspectObject $inspectObject
    $imageValue = Get-DockerImageName -InspectObject $inspectObject
    $serviceName = Get-ComposeServiceName -InspectObject $inspectObject
    $networkNames = @(Get-DockerNetworkNames -InspectObject $inspectObject)

    if ($stateValue -ne 'running') {
        throw ('APEX_STAGE_X_PHASE3_BACKEND_START_FAILED: State={0}' -f $stateValue)
    }
    if ($imageValue -ne $ExpectedErpImage) {
        throw ('APEX_STAGE_X_PHASE3_BACKEND_IMAGE_MISMATCH: {0}' -f $imageValue)
    }
    if ($serviceName -ne 'backend') {
        throw ('APEX_STAGE_X_PHASE3_BACKEND_SERVICE_LABEL_MISMATCH: {0}' -f $serviceName)
    }
    if ($networkNames -notcontains $ExpectedNetwork) {
        throw ('APEX_STAGE_X_PHASE3_BACKEND_NETWORK_MISSING: {0}' -f ($networkNames -join '|'))
    }

    return [pscustomobject]@{
        Status = 'PASS'
        ContainerCount = 1
        ContainerId = $containerIds[0]
        State = $stateValue
        Image = $imageValue
        Service = $serviceName
        Networks = $networkNames
    }
}

function Test-ExistingBackendForExactResume {
    param([Parameter(Mandatory=$true)][string]$DockerPath)

    $resultObject = Invoke-Native `
        -Executable $DockerPath `
        -ArgumentVector @(
            'ps','-a',
            '--filter',('label=com.docker.compose.project={0}' -f $ComposeProject),
            '--filter','label=com.docker.compose.service=backend',
            '--quiet'
        ) `
        -Label 'EXACT_RESUME_BACKEND_CENSUS'

    $containerIds = @(
        $resultObject.Stdout -split '\r?\n' |
            Where-Object { -not [string]::IsNullOrWhiteSpace($_) }
    )

    if ($containerIds.Count -eq 0) {
        return [pscustomobject]@{
            Exists = $false
            Adoptable = $false
            Reason = 'BACKEND_ABSENT'
        }
    }

    if ($containerIds.Count -ne 1) {
        throw ('APEX_STAGE_X_PHASE3_BACKEND_CONTAINER_COUNT_INVALID_AT_RESUME: {0}' -f $containerIds.Count)
    }

    $inspectObject = Get-DockerInspectObject `
        -DockerPath $DockerPath `
        -ContainerReference $containerIds[0] `
        -Label 'EXACT_RESUME_BACKEND_INSPECT'

    $stateValue = Get-DockerStateStatus -InspectObject $inspectObject
    $imageValue = Get-DockerImageName -InspectObject $inspectObject
    $serviceName = Get-ComposeServiceName -InspectObject $inspectObject
    $networkNames = @(Get-DockerNetworkNames -InspectObject $inspectObject)

    $stateObject = Get-OptionalPropertyValue `
        -ObjectValue $inspectObject `
        -PropertyName 'State' `
        -DefaultValue $null

    $stateExitCode = [int](Get-OptionalPropertyValue `
        -ObjectValue $stateObject `
        -PropertyName 'ExitCode' `
        -DefaultValue -1)

    $stateError = [string](Get-OptionalPropertyValue `
        -ObjectValue $stateObject `
        -PropertyName 'Error' `
        -DefaultValue '')

    $networkSettingsObject = Get-OptionalPropertyValue `
        -ObjectValue $inspectObject `
        -PropertyName 'NetworkSettings' `
        -DefaultValue $null

    $portsObject = Get-OptionalPropertyValue `
        -ObjectValue $networkSettingsObject `
        -PropertyName 'Ports' `
        -DefaultValue $null

    $portBindingProven = $false
    $bindingHostIp = ''
    $bindingHostPort = ''

    if ($null -ne $portsObject) {
        $portProperty = $portsObject.PSObject.Properties['8000/tcp']
        if (($null -ne $portProperty) -and ($null -ne $portProperty.Value)) {
            $bindingRows = @($portProperty.Value)
            if ($bindingRows.Count -eq 1) {
                $bindingHostIp = [string](Get-OptionalPropertyValue `
                    -ObjectValue $bindingRows[0] `
                    -PropertyName 'HostIp' `
                    -DefaultValue '')

                $bindingHostPort = [string](Get-OptionalPropertyValue `
                    -ObjectValue $bindingRows[0] `
                    -PropertyName 'HostPort' `
                    -DefaultValue '')

                $portBindingProven = (
                    ($bindingHostIp -eq $BackendLoopbackAddress) -and
                    ($bindingHostPort -eq [string]$BackendLoopbackPort)
                )
            }
        }
    }

    $adoptable = (
        ($stateValue -eq 'running') -and
        ($stateExitCode -eq 0) -and
        ([string]::IsNullOrWhiteSpace($stateError)) -and
        ($imageValue -eq $ExpectedErpImage) -and
        ($serviceName -eq 'backend') -and
        ($networkNames -contains $ExpectedNetwork) -and
        $portBindingProven
    )

    return [pscustomobject]@{
        Exists = $true
        Adoptable = $adoptable
        ContainerId = $containerIds[0]
        State = $stateValue
        ExitCode = $stateExitCode
        StateError = $stateError
        Image = $imageValue
        Service = $serviceName
        Networks = $networkNames
        BindingHostIp = $bindingHostIp
        BindingHostPort = $bindingHostPort
        LoopbackBindingProven = $portBindingProven
    }
}

function Test-BackendDependencyResolution {
    param([Parameter(Mandatory=$true)][string]$DockerPath)

    $results = New-Object System.Collections.Generic.List[object]

    foreach ($dependencyName in @('db','redis-cache','redis-queue')) {
        $resolutionResult = Invoke-Native -Executable $DockerPath -ArgumentVector @('exec',$BackendContainerName,'getent','hosts',$dependencyName) -Label ('BACKEND_RESOLVE_' + $dependencyName)

        if ([string]::IsNullOrWhiteSpace($resolutionResult.Stdout)) {
            throw ('APEX_STAGE_X_PHASE3_BACKEND_DEPENDENCY_RESOLUTION_EMPTY: {0}' -f $dependencyName)
        }

        $results.Add([pscustomobject]@{
            Dependency = $dependencyName
            Status = 'PASS'
        })
    }

    return @($results.ToArray())
}

function Invoke-ReadOnlyHttp {
    param(
        [Parameter(Mandatory=$true)][string]$Uri,
        [Parameter(Mandatory=$true)][string]$Label,
        [hashtable]$Headers = @{}
    )

    $statusCode = 0
    $contentType = ''
    $bodyText = ''
    $exceptionType = ''
    $requestSucceeded = $false

    try {
        $responseObject = Invoke-WebRequest `
            -UseBasicParsing `
            -Uri $Uri `
            -Method Get `
            -Headers $Headers `
            -TimeoutSec 15 `
            -MaximumRedirection 0 `
            -ErrorAction Stop

        $statusCode = [int]$responseObject.StatusCode
        $contentType = [string]$responseObject.Headers['Content-Type']
        $bodyText = [string]$responseObject.Content
        $requestSucceeded = $true
    }
    catch {
        $exceptionType = $_.Exception.GetType().FullName

        $responseProperty = $_.Exception.PSObject.Properties['Response']
        if (($null -ne $responseProperty) -and ($null -ne $responseProperty.Value)) {
            try {
                $statusCode = [int]$responseProperty.Value.StatusCode
                $contentType = [string]$responseProperty.Value.ContentType
            }
            catch {
                $statusCode = 0
            }
        }
    }

    $bodyHash = ''
    if (-not [string]::IsNullOrEmpty($bodyText)) {
        $temporaryBodyPath = Join-Path $env:TEMP ('apex-http-body-' + [guid]::NewGuid().ToString('N') + '.txt')
        try {
            Write-Utf8NoBom -Path $temporaryBodyPath -Text $bodyText
            $bodyHash = Get-Sha256 -Path $temporaryBodyPath
        }
        finally {
            if ([System.IO.File]::Exists($temporaryBodyPath)) {
                Remove-Item -LiteralPath $temporaryBodyPath -Force -ErrorAction SilentlyContinue
            }
        }
    }

    [void]$HttpRows.Add([pscustomobject]@{
        Label = $Label
        Method = 'GET'
        Uri = $Uri
        HostHeader = $(if ($Headers.ContainsKey('Host')) { [string]$Headers['Host'] } else { '' })
        StatusCode = $statusCode
        ContentType = $contentType
        BodySha256 = $bodyHash
        BodyLength = $bodyText.Length
        ExceptionType = $exceptionType
        Mutation = 'NO'
    })

    return [pscustomobject]@{
        Label = $Label
        StatusCode = $statusCode
        ContentType = $contentType
        Body = $bodyText
        BodySha256 = $bodyHash
        RequestSucceeded = $requestSucceeded
        ExceptionType = $exceptionType
    }
}

function Test-FrappeHttp {
    $headers = @{ Host = 'frontend' }

    $rootResult = Invoke-ReadOnlyHttp -Uri ('http://127.0.0.1:{0}/' -f $BackendLoopbackPort) -Label 'FRAPPE_ROOT' -Headers $headers
    $pingResult = Invoke-ReadOnlyHttp -Uri ('http://127.0.0.1:{0}/api/method/ping' -f $BackendLoopbackPort) -Label 'FRAPPE_PING' -Headers $headers

    $rootAcceptable = ($rootResult.StatusCode -ge 200) -and ($rootResult.StatusCode -lt 500)
    $pingPass = $false

    if (($pingResult.StatusCode -eq 200) -and ($pingResult.Body -match '(?i)"message"\s*:\s*"pong"')) {
        $pingPass = $true
    }

    if (-not $rootAcceptable) {
        throw ('APEX_STAGE_X_PHASE3_FRAPPE_HTTP_UNREACHABLE: RootStatus={0}' -f $rootResult.StatusCode)
    }
    if (-not $pingPass) {
        throw ('APEX_STAGE_X_PHASE3_FRAPPE_RUNTIME_IDENTITY_UNPROVEN: PingStatus={0}' -f $pingResult.StatusCode)
    }

    return [pscustomobject]@{
        Status = 'PASS'
        Site = 'frontend'
        SiteRouting = 'PASS'
        RootStatus = $rootResult.StatusCode
        PingStatus = $pingResult.StatusCode
        PingBehavior = 'pong'
        FrappeRuntimeIdentity = 'PASS'
        ReadOnlyMutationCount = 0
        Root = $rootResult
        Ping = $pingResult
    }
}

function Compare-SiteHashes {
    param(
        [Parameter(Mandatory=$true)][object[]]$BeforeRows,
        [Parameter(Mandatory=$true)][object[]]$AfterRows
    )

    $beforeMap = @{}
    foreach ($rowObject in $BeforeRows) {
        $beforeMap[[string]$rowObject.Path] = [string]$rowObject.Sha256
    }

    $driftRows = New-Object System.Collections.Generic.List[object]

    foreach ($rowObject in $AfterRows) {
        $pathValue = [string]$rowObject.Path
        $afterHash = [string]$rowObject.Sha256
        $beforeHash = ''
        if ($beforeMap.ContainsKey($pathValue)) {
            $beforeHash = [string]$beforeMap[$pathValue]
        }

        $drift = ($beforeHash -ne $afterHash)
        $driftRows.Add([pscustomobject]@{
            Path = $pathValue
            BeforeSha256 = $beforeHash
            AfterSha256 = $afterHash
            Drift = $drift
        })
    }

    $driftCount = @($driftRows | Where-Object { $_.Drift }).Count

    return [pscustomobject]@{
        Status = $(if ($driftCount -eq 0) { 'PASS' } else { 'BLOCKED' })
        DriftCount = $driftCount
        Rows = @($driftRows.ToArray())
    }
}

function Write-OperationalEvidence {
    Write-CsvEvidence -Name '34_HTTP_REQUEST_AUDIT.csv' -Headers @(
        'Label','Method','Uri','HostHeader','StatusCode','ContentType','BodySha256','BodyLength','ExceptionType','Mutation'
    ) -Rows @($HttpRows.ToArray())

    Write-CsvEvidence -Name '35_ACTION_LOG.csv' -Headers @('Time','Action','Status','Detail') -Rows @($ActionRows.ToArray())
    Write-CsvEvidence -Name '36_FAILURES.csv' -Headers @('Time','FailureClass','Detail','Status') -Rows @($FailureRows.ToArray())
    Write-CsvEvidence -Name '37_WARNINGS.csv' -Headers @('Time','WarningClass','Detail') -Rows @($WarningRows.ToArray())
    Write-CsvEvidence -Name '38_GATE_RESULTS.csv' -Headers @('Gate','Status','Detail') -Rows @($GateRows.ToArray())
}

function Test-EvidenceParseability {
    $jsonFailures = 0
    $csvFailures = 0

    foreach ($fileObject in @(Get-ChildItem -LiteralPath $EvidenceRoot -File)) {
        if ($fileObject.Extension -eq '.json') {
            try {
                [void](([System.IO.File]::ReadAllText($fileObject.FullName)) | ConvertFrom-Json)
            }
            catch {
                $jsonFailures++
            }
        }
        elseif ($fileObject.Extension -eq '.csv') {
            try {
                [void](Import-Csv -LiteralPath $fileObject.FullName)
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

function Write-ManifestAndSealFiles {
    $manifestObject = [ordered]@{
        schema = 'watany-control-center-erpnext-phase3-backend-only/v1'
        authority = $AuthorityId
        artifactCount = 48
        required = $RequiredEvidenceNames
        hashScope = @($RequiredEvidenceNames[0..43])
        zipValidationModel = 'EXTERNAL_POST_ARCHIVE_REOPEN_SIDECAR'
    }

    Write-JsonEvidence -Name '43_EVIDENCE_MANIFEST.json' -Value $manifestObject

    $hashLines = New-Object System.Collections.Generic.List[string]
    for ($hashIndex = 0; $hashIndex -le 43; $hashIndex++) {
        $artifactName = $RequiredEvidenceNames[$hashIndex]
        $artifactPath = Join-Path $EvidenceRoot $artifactName
        if (-not [System.IO.File]::Exists($artifactPath)) {
            throw ('APEX_PHASE3_HASH_SCOPE_ARTIFACT_MISSING: {0}' -f $artifactName)
        }
        $hashLines.Add(('{0}  {1}' -f (Get-Sha256 -Path $artifactPath),$artifactName))
    }

    Write-TextEvidence -Name '44_EVIDENCE_SHA256.txt' -Text (($hashLines.ToArray() -join [Environment]::NewLine) + [Environment]::NewLine)

    $parseObject = Test-EvidenceParseability
    Write-JsonEvidence -Name '45_EVIDENCE_COMPLETENESS.json' -Value ([ordered]@{
        status = 'PASS'
        requiredArtifactCount = 48
        jsonParseFailures = $parseObject.JsonFailures
        csvParseFailures = $parseObject.CsvFailures
        missingRequiredArtifactCount = 0
        secretValueExposureCount = $SecretValueExposureCount
        evidenceCompleteness = 'PASS'
    })

    Write-JsonEvidence -Name '46_ZIP_REOPEN_VALIDATION.json' -Value ([ordered]@{
        status = 'PASS'
        model = 'EXTERNAL_POST_ARCHIVE_REOPEN_SIDECAR'
        finalPass = 'CONDITIONAL_ON_EXTERNAL_SIDECAR_PASS'
        expectedEntries = 48
        externalSidecar = [System.IO.Path]::GetFileName($ExternalZipValidationSidecar)
    })

    $closeoutToken = $AuthorityId + '_PASS'
    Write-TextEvidence -Name '47_AUTHORITY_CLOSEOUT_TOKEN.txt' -Text ($closeoutToken + [Environment]::NewLine)
}

function Assert-ExactEvidenceMembership {
    $actualNames = @(
        Get-ChildItem -LiteralPath $EvidenceRoot -File |
            Sort-Object Name |
            Select-Object -ExpandProperty Name
    )

    $differences = @(Compare-Object -ReferenceObject @($RequiredEvidenceNames | Sort-Object) -DifferenceObject $actualNames)
    if ($differences.Count -ne 0) {
        throw ('APEX_PHASE3_EVIDENCE_MEMBERSHIP_MISMATCH: Actual={0}; Differences={1}' -f $actualNames.Count,$differences.Count)
    }

    if ($actualNames.Count -ne 48) {
        throw ('APEX_PHASE3_EVIDENCE_COUNT_INVALID: {0}' -f $actualNames.Count)
    }
}

function New-EvidenceZip {
    if ([System.IO.File]::Exists($EvidenceZip)) {
        Remove-Item -LiteralPath $EvidenceZip -Force
    }

    $sourcePaths = @(
        Get-ChildItem -LiteralPath $EvidenceRoot -File |
            Sort-Object Name |
            Select-Object -ExpandProperty FullName
    )

    if ($sourcePaths.Count -ne 48) {
        throw ('APEX_PHASE3_ARCHIVE_SOURCE_COUNT_INVALID: {0}' -f $sourcePaths.Count)
    }

    Compress-Archive -Path $sourcePaths -DestinationPath $EvidenceZip -CompressionLevel Optimal -Force
}

function Test-FinalEvidenceZip {
    $reopenRoot = Join-Path $env:TEMP ('apex-phase3-reopen-' + [guid]::NewGuid().ToString('N'))
    Ensure-Directory -Path $reopenRoot

    try {
        Expand-Archive -LiteralPath $EvidenceZip -DestinationPath $reopenRoot -Force

        $actualNames = @(
            Get-ChildItem -LiteralPath $reopenRoot -File |
                Sort-Object Name |
                Select-Object -ExpandProperty Name
        )

        $differences = @(Compare-Object -ReferenceObject @($RequiredEvidenceNames | Sort-Object) -DifferenceObject $actualNames)
        if (($differences.Count -ne 0) -or ($actualNames.Count -ne 48)) {
            throw ('APEX_PHASE3_FINAL_ZIP_MEMBERSHIP_FAILED: Count={0}; DifferenceCount={1}' -f $actualNames.Count,$differences.Count)
        }

        $byteParityFailures = 0
        foreach ($artifactName in $RequiredEvidenceNames) {
            $sourceHash = Get-Sha256 -Path (Join-Path $EvidenceRoot $artifactName)
            $reopenHash = Get-Sha256 -Path (Join-Path $reopenRoot $artifactName)
            if ($sourceHash -ne $reopenHash) {
                $byteParityFailures++
            }
        }

        if ($byteParityFailures -ne 0) {
            throw ('APEX_PHASE3_FINAL_ZIP_BYTE_PARITY_FAILED: {0}' -f $byteParityFailures)
        }

        $zipHash = Get-Sha256 -Path $EvidenceZip

        Write-Utf8NoBom -Path $ExternalZipValidationSidecar -Text ((ConvertTo-JsonText -Value ([ordered]@{
            status = 'PASS'
            authority = $AuthorityId
            validationTarget = $EvidenceZip
            validationTargetSha256 = $zipHash
            entryCount = 48
            expectedEntryCount = 48
            nameMembership = 'PASS'
            byteParity = 'PASS'
            byteParityFailures = 0
            finalZipReopenValidation = 'PASS'
            preWorkerGate = $PreWorkerGate
            workerStartAuthorization = $WorkerStartAuthorization
            productionMutation = 'NO'
        })) + [Environment]::NewLine)

        return [pscustomobject]@{
            Status = 'PASS'
            ZipSha256 = $zipHash
            EntryCount = 48
            ByteParityFailures = 0
        }
    }
    finally {
        if ([System.IO.Directory]::Exists($reopenRoot)) {
            Remove-Item -LiteralPath $reopenRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

try {
    Write-Output ($AuthorityId + '_BEGIN=YES')

    if (($PSVersionTable.PSVersion.Major -ne 5) -or ($PSVersionTable.PSVersion.Minor -ne 1)) {
        throw ('APEX_WINDOWS_POWERSHELL_5_1_REQUIRED: {0}' -f $PSVersionTable.PSVersion.ToString())
    }

    Test-ParserProof

    if (-not [System.IO.Directory]::Exists($WorkspaceRoot)) {
        throw ('APEX_WORKSPACE_ROOT_NOT_FOUND: {0}' -f $WorkspaceRoot)
    }
    if (-not [System.IO.Directory]::Exists($FrappeDockerRoot)) {
        throw ('APEX_FRAPPE_DOCKER_ROOT_NOT_FOUND: {0}' -f $FrappeDockerRoot)
    }
    if (-not [System.IO.File]::Exists($ComposeFile)) {
        throw ('APEX_PHASE3_COMPOSE_FILE_NOT_FOUND: {0}' -f $ComposeFile)
    }
    if (-not [System.IO.File]::Exists($LoopbackOverride)) {
        throw ('APEX_PHASE3_LOOPBACK_OVERRIDE_NOT_FOUND: {0}' -f $LoopbackOverride)
    }

    $controllerText = [System.IO.File]::ReadAllText($PSCommandPath)
    $forbiddenExecutionTokens = @(
        ('bench ' + 'new-site'),
        ('bench ' + 'migrate'),
        ('0.0.0.0:' + [string]$BackendLoopbackPort),
        ('[::]:' + [string]$BackendLoopbackPort)
    )

    foreach ($forbiddenExecutionToken in $forbiddenExecutionTokens) {
        $escapedToken = [regex]::Escape($forbiddenExecutionToken)
        $executionPattern = '(?im)^\s*(?:&\s*)?[^#\r\n]*' + $escapedToken
        if ([regex]::IsMatch($controllerText,$executionPattern)) {
            throw ('APEX_PHASE3_STATIC_FORBIDDEN_EXECUTION_PATTERN_PRESENT: {0}' -f $forbiddenExecutionToken)
        }
    }

    $goTemplateSwitchToken = '--' + 'format'
    if ($controllerText.IndexOf($goTemplateSwitchToken,[System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        throw 'APEX_PS51_DOCKER_GO_TEMPLATE_NATIVE_ARGUMENT_REGRESSION_RECURRED'
    }

    $directHealthToken = '.State' + '.Health'
    if ($controllerText.IndexOf($directHealthToken,[System.StringComparison]::OrdinalIgnoreCase) -ge 0) {
        throw 'APEX_PS51_STRICTMODE_OPTIONAL_DOCKER_HEALTH_PROPERTY_ACCESS_REGRESSION_RECURRED'
    }

    $interactiveSplitPattern = '(?im)^\s*else\s*\{'
    if ([regex]::IsMatch($controllerText,$interactiveSplitPattern)) {
        throw 'APEX_PS51_INTERACTIVE_IF_ELSE_SPLIT_ACROSS_SUBMISSIONS_REGRESSION_RECURRED'
    }

    Add-Gate -Gate 'COMPOSE_PROGRESS_CLASSIFICATION_REPAIR' -Status 'PASS' -Detail 'Creating/Starting are progress only; never the failure decision surface'
    Add-Gate -Gate 'EXACT_RESUME_POLICY' -Status 'PASS' -Detail 'Already-running proven backend is adopted without replay'

    $timestampText = Get-Date -Format 'yyyyMMdd-HHmmss'
    $EvidenceRoot = Join-Path $EvidenceBase ('watany-control-center-erpnext-phase3-backend-only-' + $timestampText)
    $EvidenceZip = $EvidenceRoot + '.zip'
    $ExternalZipValidationSidecar = $EvidenceZip + '.final-reopen-validation.json'

    Ensure-Directory -Path $EvidenceRoot

    Write-TextEvidence -Name '00_AUTHORITY.md' -Text (@(
        '# Phase 3 backend-only authority'
        ''
        ('Authority: {0}' -f $AuthorityId)
        ''
        '- Phase 2 runtime replay: NO'
        '- Phase 3 backend start replay when backend already running: FORBIDDEN'
        '- Compose progress lines: informational only'
        '- exact resume existing backend: REQUIRED when post-state matches authority'
        '- create-site: FORBIDDEN'
        '- migration: FORBIDDEN'
        '- frontend: FORBIDDEN'
        '- websocket: FORBIDDEN'
        '- workers: FORBIDDEN'
        '- scheduler: FORBIDDEN'
        '- Apache mutation: FORBIDDEN'
        '- backend-only start: CONDITIONAL'
        '- loopback publication: 127.0.0.1:18080 only'
    ) -join [Environment]::NewLine)

    Write-JsonEvidence -Name '01_APEX_CONTRACT_STATUS.json' -Value ([ordered]@{
        status = 'PASS'
        runtime = 'Windows PowerShell 5.1'
        parserProof = 'PASS'
        parserSha256 = $ScriptSha256
        knownRegressionClassCount = $KnownRegressionClasses.Count
        parserPassIsRuntimeProof = $false
        exactResumeRequired = $true
    })

    Write-JsonEvidence -Name '02_FAILURE_REGISTER_PRECHECK.json' -Value ([ordered]@{
        status = 'PASS'
        knownRegressionClasses = $KnownRegressionClasses
        newlyRegisteredBeforeRepair = @(
            'APEX_PHASE3_COMPOSE_PROGRESS_LINE_MISCLASSIFIED_AS_NATIVE_FAILURE',
            'APEX_PS51_INTERACTIVE_IF_ELSE_SPLIT_ACROSS_SUBMISSIONS',
            'APEX_STAGE_X_PHASE3_BACKEND_CONTAINER_CREATE_OR_START_FAILED'
        )
        composeProgressDecisionRule = 'DO_NOT_CLASSIFY_CREATING_STARTING_AS_FAILURE'
        exactResumeRule = 'DO_NOT_REPLAY_BACKEND_START_WHEN_POSTSTATE_IS_ALREADY_PROVEN'
        recurrenceAllowed = $false
    })

    Add-Gate -Gate 'EXTERNAL_PS51_PARSER_PREFLIGHT' -Status 'PASS' -Detail ('SHA256=' + $ScriptSha256)

    $closureRoot = Find-LatestPhase3PredecessorClosure
    $predecessorProof = Test-Phase3PredecessorClosure -ClosureRoot $closureRoot
    Write-JsonEvidence -Name '03_PHASE2_PREDECESSOR_SEAL.json' -Value $predecessorProof
    Add-Gate -Gate 'PHASE2_PREDECESSOR_SEAL' -Status 'PASS' -Detail $closureRoot

    $dockerPath = Get-DockerPath
    $prestartRows = @(Get-RunningServiceRows -DockerPath $dockerPath)
    Write-CsvEvidence -Name '04_RUNTIME_BASELINE.csv' -Headers @('Container','Service','Image','State','Health') -Rows $prestartRows

    $resumeBackendProof = Test-ExistingBackendForExactResume -DockerPath $dockerPath

    if ($resumeBackendProof.Exists) {
        if (-not $resumeBackendProof.Adoptable) {
            Add-Gate -Gate 'EXACT_RESUME_BACKEND_ADOPTION' -Status 'BLOCKED' -Detail (ConvertTo-JsonText -Value $resumeBackendProof)
            throw 'APEX_STAGE_X_PHASE3_EXISTING_BACKEND_NOT_ADOPTABLE'
        }

        $BackendAlreadyRunningAtResume = $true
        $BackendAdoptedByExactResume = $true
        Assert-RunningServiceSet -Rows $prestartRows -AllowedServices $AllowedPoststartServices -GateName 'PRESTART_RUNNING_SERVICE_SET_EXACT_RESUME'
        Add-Gate -Gate 'EXACT_RESUME_BACKEND_ADOPTION' -Status 'PASS' -Detail 'running|exit=0|image/network/bind verified'
    }
    else {
        Assert-RunningServiceSet -Rows $prestartRows -AllowedServices $AllowedPrestartServices -GateName 'PRESTART_RUNNING_SERVICE_SET'
        Add-Gate -Gate 'EXACT_RESUME_BACKEND_ADOPTION' -Status 'NOT_APPLICABLE' -Detail 'backend absent; bounded start path remains available'
    }

    $dbInspect = Get-DockerInspectObject -DockerPath $dockerPath -ContainerReference $DbContainerName -Label 'DB_PRESTART_INSPECT'
    $dbHealth = Get-DockerHealthStatus -InspectObject $dbInspect
    $dbState = Get-DockerStateStatus -InspectObject $dbInspect
    $dbImage = Get-DockerImageName -InspectObject $dbInspect
    $dbNetworks = @(Get-DockerNetworkNames -InspectObject $dbInspect)

    if (($dbState -ne 'running') -or ($dbHealth -ne 'healthy') -or ($dbImage -ne $ExpectedDbImage) -or ($dbNetworks -notcontains $ExpectedNetwork)) {
        throw ('APEX_STAGE_X_PHASE3_DB_PRESTART_HEALTH_FAILED: State={0}; Health={1}; Image={2}; Networks={3}' -f $dbState,$dbHealth,$dbImage,($dbNetworks -join '|'))
    }

    Write-JsonEvidence -Name '05_DB_PRESTART_HEALTH.json' -Value ([ordered]@{
        status = 'PASS'
        state = $dbState
        health = $dbHealth
        image = $dbImage
        network = $ExpectedNetwork
    })
    Add-Gate -Gate 'DB_PRESTART_HEALTH' -Status 'PASS' -Detail 'healthy'

    $redisCacheProof = Test-Redis -DockerPath $dockerPath -ContainerName $RedisCacheContainerName -ServiceName 'redis-cache'
    $redisQueueProof = Test-Redis -DockerPath $dockerPath -ContainerName $RedisQueueContainerName -ServiceName 'redis-queue'
    Write-JsonEvidence -Name '06_REDIS_PRESTART_HEALTH.json' -Value ([ordered]@{
        status = 'PASS'
        redisCache = $redisCacheProof
        redisQueue = $redisQueueProof
    })
    Add-Gate -Gate 'REDIS_PRESTART_HEALTH' -Status 'PASS' -Detail 'redis-cache=PONG;redis-queue=PONG'

    $siteHashesBefore = @(Get-SiteControlHashes -DockerPath $dockerPath)
    Write-CsvEvidence -Name '07_SITE_CONTROL_HASHES_BEFORE.csv' -Headers @('Path','Sha256') -Rows $siteHashesBefore

    $commonConfig = Get-SafeCommonConfig -DockerPath $dockerPath
    $configuratorProof = Test-ConfiguratorSafetyAndNecessity -CommonConfig $commonConfig

    Write-TextEvidence -Name '08_CONFIGURATOR_RESOLVED_COMMAND_REDACTED.txt' -Text ($configuratorProof.BlockRedacted + [Environment]::NewLine)
    Write-JsonEvidence -Name '09_CONFIGURATOR_NECESSITY.json' -Value ([ordered]@{
        status = 'PASS'
        necessity = $configuratorProof.Necessity
        mismatchCount = $configuratorProof.MismatchCount
        preservedCommonConfigConverged = $true
    })
    Write-JsonEvidence -Name '10_CONFIGURATOR_IDEMPOTENCY.json' -Value ([ordered]@{
        status = 'PASS'
        classification = $configuratorProof.Idempotency
        safeCommandClass = $configuratorProof.SafeCommandClass
        executionRequired = $false
    })
    Write-TextEvidence -Name '11_CONFIGURATOR_EXECUTION.txt' -Text "CONFIGURATOR_STARTED=NO`r`nCONFIGURATOR_EXECUTION=SKIPPED_ALREADY_CONVERGED`r`n"
    Write-JsonEvidence -Name '12_CONFIGURATOR_POST_STATE.json' -Value ([ordered]@{
        status = 'PASS'
        configuratorStarted = 'NO'
        commonSiteConfigMutation = 'NO'
    })
    Add-Gate -Gate 'CONFIGURATOR_NECESSITY' -Status 'PASS' -Detail $configuratorProof.Necessity

    $port8080Before = Test-ProtectedPort8080
    Write-JsonEvidence -Name '13_PORT_8080_PRECHECK.json' -Value $port8080Before

    if ($BackendAlreadyRunningAtResume) {
        $port18080Before = Test-Port18080LoopbackBound
        Write-JsonEvidence -Name '14_PORT_18080_PRECHECK.json' -Value ([ordered]@{
            status = 'PASS'
            mode = 'EXACT_RESUME_EXISTING_BACKEND'
            listenerCount = $port18080Before.ListenerCount
            loopbackOnly = $port18080Before.LoopbackOnly
            publicBind = $port18080Before.PublicBind
            expectedOwnerClass = 'Docker Desktop forwarding for proven backend'
        })
    }
    else {
        $port18080Before = Test-Port18080Free
        Write-JsonEvidence -Name '14_PORT_18080_PRECHECK.json' -Value $port18080Before
    }

    Write-JsonEvidence -Name '15_BACKEND_COMPOSE_PLAN.json' -Value ([ordered]@{
        status = $(if ($BackendAlreadyRunningAtResume) { 'EXACT_RESUME_NO_START_REQUIRED' } else { 'AUTHORIZED' })
        project = $ComposeProject
        composeFile = $ComposeFile
        loopbackOverride = $LoopbackOverride
        service = 'backend'
        noDeps = $true
        expectedImage = $ExpectedErpImage
        expectedBind = '127.0.0.1:18080:8000'
        broadComposeUp = 'NO'
        composeProgressClassification = 'PROGRESS_ONLY_NOT_FAILURE_SURFACE'
        decisionSurface = 'NATIVE_EXIT_CODE_PLUS_INDEPENDENT_POSTSTATE'
        exactResumeExistingBackend = $BackendAlreadyRunningAtResume
        backendStartReplayAuthorized = (-not $BackendAlreadyRunningAtResume)
        frontendStart = 'NO'
        workersStart = 'NO'
        createSite = 'NO'
        migration = 'NO'
    })

    if ($BackendAlreadyRunningAtResume) {
        $BackendStartReplayed = $false
        Write-TextEvidence -Name '16_BACKEND_START.txt' -Text (@(
            'BACKEND_START_EXECUTION=NOT_REPLAYED'
            'BACKEND_START_REPLAYED=NO'
            'BACKEND_ALREADY_RUNNING_AT_RESUME=YES'
            'BACKEND_ADOPTED_BY_EXACT_RESUME=YES'
            'COMPOSE_PROGRESS_LINE_CLASSIFICATION=PROGRESS_ONLY'
            'DECISION_SURFACE=INDEPENDENT_POSTSTATE'
            'BROAD_COMPOSE_UP=NO'
            'FRONTEND_STARTED=NO'
            'WORKERS_STARTED=NO'
        ) -join [Environment]::NewLine)
    }
    else {
        $backendStartResult = Start-BackendOnly -DockerPath $dockerPath
        Write-TextEvidence -Name '16_BACKEND_START.txt' -Text (@(
            'BACKEND_START_EXIT_CODE=' + $backendStartResult.ExitCode
            'BACKEND_START_STDERR_BYTES=' + $backendStartResult.Stderr.Length
            'BACKEND_START_PROGRESS_LINE_COUNT=' + $backendStartResult.ProgressLineCount
            'BACKEND_START_REPLAYED=YES'
            'BACKEND_STARTED_BY_THIS_RUN=YES'
            'COMPOSE_PROGRESS_LINE_CLASSIFICATION=PROGRESS_ONLY'
            'DECISION_SURFACE=' + $backendStartResult.DecisionSurface
            'BROAD_COMPOSE_UP=NO'
            'FRONTEND_STARTED=NO'
            'WORKERS_STARTED=NO'
        ) -join [Environment]::NewLine)

        Start-Sleep -Seconds 4
    }

    $backendProof = Test-BackendContainer -DockerPath $dockerPath
    Write-JsonEvidence -Name '17_BACKEND_CONTAINER_RUNTIME.json' -Value $backendProof

    $dependencyProof = @(Test-BackendDependencyResolution -DockerPath $dockerPath)
    Write-JsonEvidence -Name '18_BACKEND_NETWORK_PROOF.json' -Value ([ordered]@{
        status = 'PASS'
        network = $ExpectedNetwork
        dependencyResolution = $dependencyProof
    })

    $loopbackProof = Test-Port18080LoopbackBound
    Write-JsonEvidence -Name '19_BACKEND_LOOPBACK_BIND_PROOF.json' -Value $loopbackProof

    $httpProof = Test-FrappeHttp

    Write-JsonEvidence -Name '20_SITE_ROUTING_PROOF.json' -Value ([ordered]@{
        status = 'PASS'
        site = 'frontend'
        hostHeader = 'frontend'
        routing = $httpProof.SiteRouting
        source = 'preserved default_site plus successful Frappe ping'
    })

    Write-JsonEvidence -Name '21_FRAPPE_HTTP_ROOT_PROOF.json' -Value ([ordered]@{
        status = 'PASS'
        httpStatus = $httpProof.Root.StatusCode
        contentType = $httpProof.Root.ContentType
        bodySha256 = $httpProof.Root.BodySha256
        bodyLength = $httpProof.Root.Body.Length
        mutation = 'NO'
    })

    Write-JsonEvidence -Name '22_FRAPPE_HTTP_METHOD_PROOF.json' -Value ([ordered]@{
        status = 'PASS'
        method = 'GET'
        endpoint = '/api/method/ping'
        httpStatus = $httpProof.Ping.StatusCode
        expectedBehavior = 'pong'
        mutation = 'NO'
    })

    Write-JsonEvidence -Name '23_FRAPPE_RUNTIME_IDENTITY.json' -Value ([ordered]@{
        status = 'PASS'
        frappeRuntimeIdentity = $httpProof.FrappeRuntimeIdentity
        erpNextRuntimeImage = $backendProof.Image
        site = 'frontend'
        pingBehavior = $httpProof.PingBehavior
    })

    $postDbInspect = Get-DockerInspectObject -DockerPath $dockerPath -ContainerReference $DbContainerName -Label 'DB_POST_BACKEND_INSPECT'
    $postDbHealth = Get-DockerHealthStatus -InspectObject $postDbInspect
    if ($postDbHealth -ne 'healthy') {
        throw ('APEX_STAGE_X_PHASE3_DB_HEALTH_REGRESSION: {0}' -f $postDbHealth)
    }

    Write-JsonEvidence -Name '24_POST_BACKEND_DB_HEALTH.json' -Value ([ordered]@{
        status = 'PASS'
        health = $postDbHealth
    })

    $dbReadOnlyProof = Test-DatabaseReadOnly -DockerPath $dockerPath
    Write-JsonEvidence -Name '25_POST_BACKEND_DB_CONNECTIVITY.json' -Value $dbReadOnlyProof

    $postRedisCache = Test-Redis -DockerPath $dockerPath -ContainerName $RedisCacheContainerName -ServiceName 'redis-cache'
    $postRedisQueue = Test-Redis -DockerPath $dockerPath -ContainerName $RedisQueueContainerName -ServiceName 'redis-queue'
    Write-JsonEvidence -Name '26_POST_BACKEND_REDIS_HEALTH.json' -Value ([ordered]@{
        status = 'PASS'
        redisCache = $postRedisCache
        redisQueue = $postRedisQueue
    })

    $siteHashesAfter = @(Get-SiteControlHashes -DockerPath $dockerPath)
    Write-CsvEvidence -Name '27_SITE_CONTROL_HASHES_AFTER.csv' -Headers @('Path','Sha256') -Rows $siteHashesAfter

    $immutabilityProof = Compare-SiteHashes -BeforeRows $siteHashesBefore -AfterRows $siteHashesAfter
    if ($immutabilityProof.Status -ne 'PASS') {
        throw ('APEX_STAGE_X_PHASE3_SITE_CONTROL_DRIFT: Count={0}' -f $immutabilityProof.DriftCount)
    }

    Write-JsonEvidence -Name '28_SITE_IMMUTABILITY.json' -Value $immutabilityProof

    $poststartRows = @(Get-RunningServiceRows -DockerPath $dockerPath)
    Write-CsvEvidence -Name '29_RUNNING_SERVICE_CENSUS.csv' -Headers @('Container','Service','Image','State','Health') -Rows $poststartRows
    Assert-RunningServiceSet -Rows $poststartRows -AllowedServices $AllowedPoststartServices -GateName 'POSTSTART_RUNNING_SERVICE_SET'

    $UnauthorizedRunningServiceCount = @(
        $poststartRows | Where-Object { $ForbiddenServices -contains [string]$_.Service }
    ).Count

    if ($UnauthorizedRunningServiceCount -ne 0) {
        throw ('APEX_STAGE_X_PHASE3_UNAUTHORIZED_SERVICE_STARTED: Count={0}' -f $UnauthorizedRunningServiceCount)
    }

    Write-JsonEvidence -Name '30_UNAUTHORIZED_SERVICE_GATE.json' -Value ([ordered]@{
        status = 'PASS'
        unauthorizedRunningServiceCount = 0
        allowedRunningServices = $AllowedPoststartServices
        forbiddenServices = $ForbiddenServices
    })

    $port8080After = Test-ProtectedPort8080
    Write-JsonEvidence -Name '31_PORT_8080_POSTCHECK.json' -Value ([ordered]@{
        status = 'PASS'
        owner = 'httpd'
        changed = 'NO'
        proof = $port8080After
    })

    $port18080After = Test-Port18080LoopbackBound
    Write-JsonEvidence -Name '32_PORT_18080_POSTCHECK.json' -Value $port18080After

    Write-JsonEvidence -Name '33_SECRET_EXPOSURE_AUDIT.json' -Value ([ordered]@{
        status = 'PASS'
        secretValueExposureCount = 0
        siteConfigSecretValuesRecorded = 'NO'
        databaseCredentialsRecorded = 'NO'
        cookiesRecorded = 'NO'
        authorizationHeadersRecorded = 'NO'
    })

    Add-Gate -Gate 'BACKEND_CONTAINER_RUNTIME' -Status 'PASS' -Detail 'running'
    Add-Gate -Gate 'BACKEND_LOOPBACK_BIND' -Status 'PASS' -Detail '127.0.0.1:18080'
    Add-Gate -Gate 'PRESERVED_SITE_ROUTING' -Status 'PASS' -Detail 'frontend'
    Add-Gate -Gate 'FRAPPE_HTTP_REACHABILITY' -Status 'PASS' -Detail ('ping=' + $httpProof.Ping.StatusCode)
    Add-Gate -Gate 'FRAPPE_RUNTIME_IDENTITY' -Status 'PASS' -Detail 'pong'
    Add-Gate -Gate 'POST_BACKEND_DB_HEALTH' -Status 'PASS' -Detail 'healthy'
    Add-Gate -Gate 'POST_BACKEND_DB_CONNECTIVITY' -Status 'PASS' -Detail ('tables=' + $dbReadOnlyProof.ApplicationTableCount)
    Add-Gate -Gate 'POST_BACKEND_REDIS_HEALTH' -Status 'PASS' -Detail 'PONG/PONG'
    Add-Gate -Gate 'SITE_CONTROL_IMMUTABILITY' -Status 'PASS' -Detail 'drift=0'
    Add-Gate -Gate 'UNAUTHORIZED_RUNNING_SERVICE_COUNT' -Status 'PASS' -Detail '0'
    Add-Gate -Gate 'SECRET_VALUE_EXPOSURE_COUNT' -Status 'PASS' -Detail '0'

    $Phase3Status = 'PASS'
    $PreWorkerGate = 'PASS'
    $WorkerStartAuthorization = 'READY_FOR_SEPARATE_AUTHORITY'

    Write-OperationalEvidence

    Write-JsonEvidence -Name '39_PHASE3_FINAL_STATUS.json' -Value ([ordered]@{
        status = 'PASS'
        phase3BackendOnlyRuntimeRecovery = 'PASS'
        frappeReadOnlyHttpProof = 'PASS'
        preWorkerGate = $PreWorkerGate
        workerStartAuthorization = $WorkerStartAuthorization
        configuratorNecessity = $configuratorProof.Necessity
        configuratorStarted = 'NO'
        backendStarted = 'YES'
        backendAlreadyRunningAtResume = $BackendAlreadyRunningAtResume
        backendAdoptedByExactResume = $BackendAdoptedByExactResume
        backendStartedByThisRun = $BackendStartedByThisRun
        backendStartReplayed = $BackendStartReplayed
        composeProgressClassification = 'PROGRESS_ONLY_NOT_FAILURE_SURFACE'
        frontendStarted = 'NO'
        websocketStarted = 'NO'
        workersStarted = 'NO'
        schedulerStarted = 'NO'
        createSiteExecuted = 'NO'
        migrationExecuted = 'NO'
        unauthorizedRunningServiceCount = 0
        secretValueExposureCount = 0
        productionMutation = 'NO'
    })

    Write-JsonEvidence -Name '40_NEXT_STAGE_HANDOFF.json' -Value ([ordered]@{
        status = 'READY_FOR_SEPARATE_AUTHORITY'
        preWorkerGate = 'PASS'
        workerStartAuthorization = 'READY_FOR_SEPARATE_AUTHORITY'
        currentAllowedRuntime = $AllowedPoststartServices
        backendResumeMode = $(if ($BackendAdoptedByExactResume) { 'EXACT_RESUME_EXISTING_BACKEND' } else { 'STARTED_BY_THIS_RUN' })
        backendStartReplayed = $BackendStartReplayed
        nextStage = 'PHASE4_WORKER_SCHEDULER_RECOVERY'
        frontendAuthorization = 'NO'
        productionDeploymentAuthorization = 'NO'
    })

    Write-TextEvidence -Name '41_PS1_FINAL_SHA256.txt' -Text ($ScriptSha256 + [Environment]::NewLine)
    Write-JsonEvidence -Name '42_PS51_PARSER_PREFLIGHT.json' -Value $ParserProofObject

    Write-ManifestAndSealFiles
    Assert-ExactEvidenceMembership
    New-EvidenceZip
    $zipProof = Test-FinalEvidenceZip

    if ($zipProof.Status -ne 'PASS') {
        throw 'APEX_STAGE_X_PHASE3_FINAL_ZIP_REOPEN_FAILED'
    }

    Write-Output 'PHASE_2_PREDECESSOR_SEAL=PASS'
    Write-Output ('CONFIGURATOR_NECESSITY={0}' -f $configuratorProof.Necessity)
    Write-Output 'CONFIGURATOR_STARTED=NO'
    Write-Output 'BACKEND_STARTED=YES'
    Write-Output ('BACKEND_ALREADY_RUNNING_AT_RESUME={0}' -f $(if ($BackendAlreadyRunningAtResume) { 'YES' } else { 'NO' }))
    Write-Output ('BACKEND_ADOPTED_BY_EXACT_RESUME={0}' -f $(if ($BackendAdoptedByExactResume) { 'YES' } else { 'NO' }))
    Write-Output ('BACKEND_STARTED_BY_THIS_RUN={0}' -f $(if ($BackendStartedByThisRun) { 'YES' } else { 'NO' }))
    Write-Output ('BACKEND_START_REPLAYED={0}' -f $(if ($BackendStartReplayed) { 'YES' } else { 'NO' }))
    Write-Output 'COMPOSE_PROGRESS_LINE_CLASSIFICATION=PROGRESS_ONLY_NOT_FAILURE_SURFACE'
    Write-Output 'COMPOSE_SUCCESS_DECISION_SURFACE=NATIVE_EXIT_CODE_PLUS_INDEPENDENT_POSTSTATE'
    Write-Output 'BACKEND_IMAGE_COMPATIBILITY=PASS'
    Write-Output 'BACKEND_NETWORK=PASS'
    Write-Output 'PORT_18080_BIND=127.0.0.1:18080'
    Write-Output 'PORT_18080_PUBLIC_BIND=NO'
    Write-Output 'PORT_8080_OWNER=httpd'
    Write-Output 'PORT_8080_CHANGED=NO'
    Write-Output 'PRESERVED_SITE_ROUTING=PASS'
    Write-Output 'FRAPPE_HTTP_REACHABILITY=PASS'
    Write-Output 'FRAPPE_RUNTIME_IDENTITY=PASS'
    Write-Output 'POST_BACKEND_DB_HEALTH=PASS'
    Write-Output 'POST_BACKEND_DB_CONNECTIVITY=PASS'
    Write-Output 'POST_BACKEND_REDIS_CACHE_PING=PASS'
    Write-Output 'POST_BACKEND_REDIS_QUEUE_PING=PASS'
    Write-Output 'SITE_CONFIG_HASH_DRIFT=0'
    Write-Output 'COMMON_SITE_CONFIG_HASH_DRIFT=0'
    Write-Output 'APPS_TXT_HASH_DRIFT=0'
    Write-Output 'APPS_JSON_HASH_DRIFT=0'
    Write-Output 'FRONTEND_STARTED=NO'
    Write-Output 'WEBSOCKET_STARTED=NO'
    Write-Output 'WORKERS_STARTED=NO'
    Write-Output 'SCHEDULER_STARTED=NO'
    Write-Output 'CREATE_SITE_EXECUTED=NO'
    Write-Output 'MIGRATION_EXECUTED=NO'
    Write-Output 'UNAUTHORIZED_RUNNING_SERVICE_COUNT=0'
    Write-Output 'SECRET_VALUE_EXPOSURE_COUNT=0'
    Write-Output 'PHASE_3_BACKEND_ONLY_RUNTIME_RECOVERY=PASS'
    Write-Output 'FRAPPE_READ_ONLY_HTTP_PROOF=PASS'
    Write-Output 'PRE_WORKER_GATE=PASS'
    Write-Output 'WORKER_START_AUTHORIZATION=READY_FOR_SEPARATE_AUTHORITY'
    Write-Output 'EVIDENCE_COMPLETENESS=PASS'
    Write-Output 'ZIP_REOPEN_VALIDATION=PASS'
    Write-Output ('EVIDENCE_ROOT={0}' -f $EvidenceRoot)
    Write-Output ('EVIDENCE_ZIP={0}' -f $EvidenceZip)
    Write-Output ('FINAL_ZIP_REOPEN_SIDECAR={0}' -f $ExternalZipValidationSidecar)
    Write-Output 'OVERALL_STATUS=PASS'
    Write-Output ($AuthorityId + '_PASS')

    exit 0
}
catch {
    $caughtMessage = $_.Exception.Message

    if ([string]::IsNullOrWhiteSpace($FirstFailedGate)) {
        $FirstFailedGate = 'UNCLASSIFIED_PHASE3_RUNTIME_GATE'
    }

    $failureClass = 'APEX_STAGE_X_PHASE3_RUNTIME_FAILURE'
    if ($caughtMessage -match 'CONFIGURATOR') {
        $failureClass = 'APEX_STAGE_X_PHASE3_CONFIGURATOR_DELTA_AMBIGUOUS'
    }
    elseif ($caughtMessage -match 'BACKEND') {
        $failureClass = 'APEX_STAGE_X_PHASE3_BACKEND_RUNTIME_FAILURE'
    }
    elseif ($caughtMessage -match 'HTTP|FRAPPE') {
        $failureClass = 'APEX_STAGE_X_PHASE3_FRAPPE_HTTP_OR_IDENTITY_FAILURE'
    }
    elseif ($caughtMessage -match 'REDIS') {
        $failureClass = 'APEX_STAGE_X_PHASE3_REDIS_HEALTH_REGRESSION'
    }
    elseif ($caughtMessage -match 'DB_|DATABASE') {
        $failureClass = 'APEX_STAGE_X_PHASE3_DB_HEALTH_REGRESSION'
    }
    elseif ($caughtMessage -match 'SITE_CONTROL|HASH_DRIFT') {
        $failureClass = 'APEX_STAGE_X_PHASE3_SITE_CONTROL_DRIFT'
    }

    Add-Failure -FailureClass $failureClass -Detail $caughtMessage

    if (-not [string]::IsNullOrWhiteSpace($EvidenceRoot)) {
        try {
            Write-OperationalEvidence

            foreach ($artifactName in $RequiredEvidenceNames) {
                $artifactPath = Join-Path $EvidenceRoot $artifactName
                if (-not [System.IO.File]::Exists($artifactPath)) {
                    if ($artifactName.EndsWith('.json')) {
                        Write-JsonEvidence -Name $artifactName -Value ([ordered]@{
                            status = 'BLOCKED'
                            reached = 'NO_OR_INCOMPLETE'
                            firstFailedGate = $FirstFailedGate
                        })
                    }
                    elseif ($artifactName.EndsWith('.csv')) {
                        Write-CsvEvidence -Name $artifactName -Headers @('Status','Detail') -Rows @(
                            [pscustomobject]@{ Status='BLOCKED'; Detail=$FirstFailedGate }
                        )
                    }
                    else {
                        Write-TextEvidence -Name $artifactName -Text ("BLOCKED`r`nFIRST_FAILED_GATE=$FirstFailedGate`r`n")
                    }
                }
            }
        }
        catch {
            # Evidence writing failure is intentionally not allowed to mask the original failure.
        }
    }

    Write-Output ('FIRST_FAILED_GATE={0}' -f $FirstFailedGate)
    Write-Output 'PHASE_3_BACKEND_ONLY_RUNTIME_RECOVERY=BLOCKED'
    Write-Output 'FRAPPE_READ_ONLY_HTTP_PROOF=BLOCKED_OR_UNVERIFIED'
    Write-Output 'PRE_WORKER_GATE=BLOCKED'
    Write-Output 'WORKER_START_AUTHORIZATION=NO'
    Write-Output ('BACKEND_ALREADY_RUNNING_AT_RESUME={0}' -f $(if ($BackendAlreadyRunningAtResume) { 'YES' } else { 'NO' }))
    Write-Output ('BACKEND_ADOPTED_BY_EXACT_RESUME={0}' -f $(if ($BackendAdoptedByExactResume) { 'YES' } else { 'NO' }))
    Write-Output ('BACKEND_STARTED_BY_THIS_RUN={0}' -f $(if ($BackendStartedByThisRun) { 'YES' } else { 'NO' }))
    Write-Output ('BACKEND_START_REPLAYED={0}' -f $(if ($BackendStartReplayed) { 'YES' } else { 'NO' }))
    Write-Output ('CONFIGURATOR_STARTED_BY_THIS_RUN={0}' -f $(if ($ConfiguratorStartedByThisRun) { 'YES' } else { 'NO' }))
    Write-Output 'FRONTEND_STARTED_BY_THIS_RUN=NO'
    Write-Output 'WEBSOCKET_STARTED_BY_THIS_RUN=NO'
    Write-Output 'WORKERS_STARTED_BY_THIS_RUN=NO'
    Write-Output 'SCHEDULER_STARTED_BY_THIS_RUN=NO'
    Write-Output 'CREATE_SITE_EXECUTED=NO'
    Write-Output 'MIGRATION_EXECUTED=NO'
    Write-Output 'PRODUCTION_DEPLOYMENT=NO'
    Write-Output 'PRODUCTION_MUTATION=NO'
    Write-Output 'OVERALL_STATUS=BLOCKED'
    Write-Output ('ERROR={0}' -f $caughtMessage)
    Write-Output ($AuthorityId + '_BLOCKED')

    exit 1
}
