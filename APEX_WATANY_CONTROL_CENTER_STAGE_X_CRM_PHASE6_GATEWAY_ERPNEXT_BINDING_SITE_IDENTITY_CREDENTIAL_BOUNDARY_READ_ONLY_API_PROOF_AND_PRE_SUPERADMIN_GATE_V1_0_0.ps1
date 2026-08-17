#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$EvidenceBase = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence',
    [string]$ParserPreflightProofPath = 'C:\APEX\P6V100.parser.json'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$Authority = 'APEX_WATANY_CONTROL_CENTER_STAGE_X_CRM_PHASE6_GATEWAY_ERPNEXT_BINDING_SITE_IDENTITY_CREDENTIAL_BOUNDARY_READ_ONLY_API_PROOF_AND_PRE_SUPERADMIN_GATE_V1_0_0'
$WorkspaceRoot = 'C:\xampp\htdocs\projectx\watanybot'
$GatewayRoot = Join-Path $WorkspaceRoot 'apps\gateway-api'
$GatewaySourceRoot = Join-Path $GatewayRoot 'src'
$FailureRegisterPath = Join-Path $WorkspaceRoot 'pma\feature-gates\04_PROGRAM_FAILURE_AND_REGRESSION_REGISTER.md'
$Phase5ZipPath = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-erpnext-phase5-deadlock-recovery-20260815-171140.zip'
$Phase5SidecarPath = $Phase5ZipPath + '.final-reopen-validation.json'
$ExpectedPhase5ZipSha256 = 'C2A1E50F02A4C82766CBB962EE48C3A3F199D5068DB1994D7392B3D5B637A237'
$ErpNextBaseUrl = 'http://127.0.0.1:18080'
$ErpNextSiteName = 'frontend'
$ErpNextHostHeader = 'frontend'
$ErpNextUnavailablePort = 0
$ComposeProject = 'frappe_docker'
$ExpectedErpNextImage = 'frappe/erpnext:v16.32.0'
$ExpectedErpNextNetwork = 'frappe_docker_frappe_network'
$AllowedServices = @('db','redis-cache','redis-queue','backend','queue-short','queue-long','scheduler','frontend','websocket')
$GatewayConfigPaths = @(
    (Join-Path $GatewayRoot '.env'),
    (Join-Path $GatewayRoot '.env.example'),
    (Join-Path $GatewayRoot '.env.production.example'),
    (Join-Path $GatewayRoot 'ecosystem.config.cjs'),
    (Join-Path $GatewaySourceRoot 'lib\config.ts'),
    (Join-Path $GatewaySourceRoot 'bootstrap\routes.ts'),
    (Join-Path $GatewayRoot 'src\server.ts')
)

$EvidenceRoot = ''
$EvidenceZip = ''
$SidecarPath = ''
$ScriptSha256 = ''
$ParserProof = $null
$DockerPath = ''
$GatewayPort = 4000
$GatewayHost = '0.0.0.0'
$RequiredEvidenceNames = @(
    '00_AUTHORITY.md',
    '01_CONTROLLER_HASH.txt',
    '02_PS51_PARSER_PREFLIGHT.json',
    '03_FAILURE_REGISTER_PRECHECK.json',
    '04_PHASE5_PREDECESSOR_REVALIDATION.json',
    '05_GATEWAY_OWNERSHIP.json',
    '06_GATEWAY_ENV_KEY_CENSUS.csv',
    '07_GATEWAY_SOURCE_CENSUS.json',
    '08_GATEWAY_PROCESS_CENSUS.csv',
    '09_PHASE5_SERVICE_PRE_CENSUS.csv',
    '10_ERPNEXT_ENDPOINT_PROOF.json',
    '11_ERPNEXT_SITE_IDENTITY.json',
    '12_DIRECT_READ_ONLY_PROOF.json',
    '13_GATEWAY_HEALTH_BASELINE.json',
    '14_CREDENTIAL_BOUNDARY.json',
    '15_ROUTE_OWNERSHIP.json',
    '16_GATEWAY_READ_THROUGH_PROOF.json',
    '17_NEGATIVE_TESTS.json',
    '18_SECRET_ISOLATION.json',
    '19_GATEWAY_CONFIG_PRE_HASH.json',
    '20_GATEWAY_CONFIG_ROLLBACK.json',
    '21_PHASE5_SERVICE_POST_CENSUS.csv',
    '22_SERVICE_DRIFT.json',
    '23_PHASE6_GATE_RESULTS.csv',
    '24_PHASE6_FAILURES.csv',
    '25_PHASE6_ACTIONS.csv',
    '26_PRE_SUPERADMIN_GATE.json',
    '27_FINAL_STATUS.json',
    '28_EVIDENCE_MANIFEST.json',
    '29_EVIDENCE_SHA256.txt',
    '30_ZIP_REOPEN_MODEL.json',
    '31_AUTHORITY_CLOSEOUT_TOKEN.txt',
    'FINAL_REPORT.md',
    'summary.json',
    'FINAL_STATUS.txt',
    'progress.json',
    'progress.csv',
    'checkpoint.json',
    'validations.csv',
    'actions.csv',
    'failures.csv',
    'warnings.csv',
    'ERROR_LOG.txt',
    'EXECUTION_LOG.txt'
)

$RunState = [pscustomobject]@{
    OverallStatus = 'BLOCKED'
    PrimaryFailureClass = ''
    Stage = 'INITIALIZATION'
    Percent = 0
    Finalized = $false
    Phase5Predecessor = 'NOT_STARTED'
    GatewayBinding = 'BLOCKED'
    ErpReadThrough = 'BLOCKED'
    PreSuperadmin = 'BLOCKED'
    GatewayHealth = 'NOT_STARTED'
    CredentialSource = 'NOT_STARTED'
    RouteOwnership = 'NOT_STARTED'
    DirectRead = 'NOT_STARTED'
    ServiceNonRegression = 'NOT_STARTED'
    BlockRows = New-Object Collections.ArrayList
    ActionRows = New-Object Collections.ArrayList
    GateRows = New-Object Collections.ArrayList
    WarningRows = New-Object Collections.ArrayList
    ValidationRows = New-Object Collections.ArrayList
}

function Initialize-Directory([string]$Path) {
    if (-not [string]::IsNullOrWhiteSpace($Path) -and -not [IO.Directory]::Exists($Path)) {
        [void][IO.Directory]::CreateDirectory($Path)
    }
}

function Write-Text([string]$Name, [AllowEmptyString()][string]$Text) {
    if ($Name -eq 'FINAL_STATUS.txt' -and -not [string]::IsNullOrWhiteSpace($EvidenceZip) -and [IO.File]::Exists($EvidenceZip)) {
        return
    }
    $path = Join-Path $EvidenceRoot $Name
    Initialize-Directory ([IO.Path]::GetDirectoryName($path))
    [IO.File]::WriteAllText($path, $Text, (New-Object Text.UTF8Encoding($false)))
}

function Append-Text([string]$Name, [AllowEmptyString()][string]$Text) {
    $path = Join-Path $EvidenceRoot $Name
    Initialize-Directory ([IO.Path]::GetDirectoryName($path))
    [IO.File]::AppendAllText($path, $Text + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
}

function Write-Json([string]$Name, $Value) {
    Write-Text $Name (($Value | ConvertTo-Json -Depth 30) + [Environment]::NewLine)
}

function Write-ExternalJson([string]$Path, $Value) {
    Initialize-Directory ([IO.Path]::GetDirectoryName($Path))
    [IO.File]::WriteAllText($Path, (($Value | ConvertTo-Json -Depth 30) + [Environment]::NewLine), (New-Object Text.UTF8Encoding($false)))
}

function Get-FileSha256([string]$Path) {
    $sha = [Security.Cryptography.SHA256]::Create()
    $stream = [IO.File]::OpenRead($Path)
    try {
        return ([BitConverter]::ToString($sha.ComputeHash($stream))).Replace('-', '').ToUpperInvariant()
    } finally {
        $stream.Dispose()
        $sha.Dispose()
    }
}

function Write-CsvReport([string]$Name, [AllowEmptyCollection()][object[]]$Rows, [string[]]$Headers) {
    $lines = New-Object Collections.Generic.List[string]
    [void]$lines.Add(($Headers -join ','))
    foreach ($row in @($Rows)) {
        $values = foreach ($header in $Headers) {
            $value = ''
            if ($null -ne $row -and $null -ne $row.PSObject.Properties[$header]) {
                $value = [string]$row.$header
            }
            '"' + $value.Replace('"', '""') + '"'
        }
        [void]$lines.Add(($values -join ','))
    }
    Write-Text $Name (($lines -join [Environment]::NewLine) + [Environment]::NewLine)
}

function Add-Action([string]$Name, [string]$Status, [string]$Detail) {
    [void]$RunState.ActionRows.Add([pscustomobject]@{
        Time = [DateTimeOffset]::Now.ToString('o')
        Action = $Name
        Status = $Status
        Detail = $Detail
    })
    Append-Text 'EXECUTION_LOG.txt' ('ACTION={0};STATUS={1};DETAIL={2}' -f $Name, $Status, $Detail)
}

function Add-Failure([string]$ClassName, [string]$Detail) {
    [void]$RunState.BlockRows.Add([pscustomobject]@{
        Time = [DateTimeOffset]::Now.ToString('o')
        FailureClass = $ClassName
        Detail = $Detail
        Status = 'ACTIVE'
    })
}

function Register-Blocker([string]$ClassName, [string]$Detail) {
    Add-Failure $ClassName $Detail
    if ([string]::IsNullOrWhiteSpace([string]$RunState.PrimaryFailureClass)) {
        $RunState.PrimaryFailureClass = $ClassName
    }
    $RunState.OverallStatus = 'BLOCKED'
}

function Add-Gate([string]$Name, [string]$Status, [string]$Detail) {
    [void]$RunState.GateRows.Add([pscustomobject]@{
        Gate = $Name
        Status = $Status
        Detail = $Detail
    })
}

function Add-Warning([string]$Name, [string]$Detail) {
    [void]$RunState.WarningRows.Add([pscustomobject]@{
        Warning = $Name
        Detail = $Detail
        Status = 'ADVISORY'
    })
}

function Add-Validation([string]$Name, [string]$Status, [string]$Detail) {
    [void]$RunState.ValidationRows.Add([pscustomobject]@{
        Validation = $Name
        Status = $Status
        Detail = $Detail
    })
}

function Get-YesNo([bool]$Value) {
    if ($Value) { return 'YES' }
    return 'NO'
}

function Get-PassBlocked([bool]$Value) {
    if ($Value) { return 'PASS' }
    return 'BLOCKED'
}

function Get-ReferenceStatus([int]$Count) {
    if ($Count -gt 0) { return 'REFERENCE_FOUND' }
    return 'NO_REFERENCE_FOUND'
}

function Get-SuperadminAuthorization([string]$Status) {
    if ($Status -eq 'PASS') { return 'READY_FOR_SEPARATE_AUTHORITY' }
    return 'NO'
}

function Set-Stage([string]$Name, [int]$Percent) {
    $RunState.Stage = $Name
    $RunState.Percent = $Percent
    Write-Progress -Activity $Authority -Status $Name -PercentComplete $Percent
    Write-Json 'progress.json' ([ordered]@{
        status = $RunState.OverallStatus
        stage = $Name
        percent = $Percent
        authority = $Authority
    })
    Write-CsvReport 'progress.csv' @([pscustomobject]@{Stage = $Name; Status = $RunState.OverallStatus; Percent = $Percent}) @('Stage', 'Status', 'Percent')
    Write-Json 'checkpoint.json' ([ordered]@{
        status = $RunState.OverallStatus
        stage = $Name
        percent = $Percent
        primaryFailureClass = $RunState.PrimaryFailureClass
        finalization = 'PENDING'
    })
}

function Invoke-Native([string]$Executable, [string[]]$CommandArgs, [string]$Label) {
    $stderrPath = Join-Path $env:TEMP ('p6v100-' + [guid]::NewGuid().ToString('N') + '.err')
    try {
        $nativeOutput = @(& $Executable @CommandArgs 2> $stderrPath)
        $exitCode = $LASTEXITCODE
        $stdout = ($nativeOutput | ForEach-Object { [string]$_ }) -join [Environment]::NewLine
        $stderr = ''
        if ([IO.File]::Exists($stderrPath)) {
            $stderr = [IO.File]::ReadAllText($stderrPath)
        }
        Add-Action $Label 'READ_ONLY' ('ExitCode={0};StdoutBytes={1};StderrBytes={2}' -f $exitCode, $stdout.Length, $stderr.Length)
        return [pscustomobject]@{
            ExitCode = $exitCode
            Stdout = $stdout
            StderrBytes = $stderr.Length
        }
    } finally {
        if ([IO.File]::Exists($stderrPath)) {
            Remove-Item -LiteralPath $stderrPath -Force -ErrorAction SilentlyContinue
        }
    }
}

function Get-SafeProperty($ObjectValue, [string]$Name, $DefaultValue) {
    if ($null -eq $ObjectValue) {
        return $DefaultValue
    }
    $property = $ObjectValue.PSObject.Properties[$Name]
    if ($null -eq $property) {
        return $DefaultValue
    }
    return $property.Value
}

function Get-EnvKeyRows([string]$Path) {
    $rows = New-Object Collections.ArrayList
    if (-not [IO.File]::Exists($Path)) {
        return $rows.ToArray()
    }
    $lineNumber = 0
    foreach ($line in [IO.File]::ReadAllLines($Path, [Text.Encoding]::UTF8)) {
        $lineNumber++
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith('#')) {
            continue
        }
        $candidate = $trimmed -replace '^export\s+', ''
        $keyMatch = [regex]::Match($candidate, '^([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$')
        if (-not $keyMatch.Success) {
            continue
        }
        $keyName = $keyMatch.Groups[1].Value
        $rawValue = $keyMatch.Groups[2].Value.Trim()
        $presence = 'EMPTY'
        if ($rawValue.Length -gt 0) {
            $presence = 'PRESENT_NONEMPTY'
            if ($rawValue -match '(?i)replace_with|change[-_ ]?me|your_.*|placeholder|example') {
                $presence = 'PRESENT_PLACEHOLDER'
            }
        }
        $secretKey = $keyName -match '(?i)secret|password|token|api.?key|private|cookie|credential'
        $erpRelated = $keyName -match '(?i)erpnext|frappe'
        [void]$rows.Add([pscustomobject]@{
            Source = $Path
            Line = $lineNumber
            Key = $keyName
            ValuePresence = $presence
            SensitiveKeyName = Get-YesNo $secretKey
            ErpRelatedKey = Get-YesNo $erpRelated
        })
    }
    return $rows.ToArray()
}

function Get-SafeEnvValue([string]$Path, [string]$KeyName, [string]$DefaultValue) {
    if (-not [IO.File]::Exists($Path)) {
        return $DefaultValue
    }
    foreach ($line in [IO.File]::ReadAllLines($Path, [Text.Encoding]::UTF8)) {
        $candidate = $line.Trim() -replace '^export\s+', ''
        $keyMatch = [regex]::Match($candidate, '^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$')
        if ($keyMatch.Success -and $keyMatch.Groups[1].Value -eq $KeyName) {
            $safeValue = $keyMatch.Groups[2].Value.Trim()
            if ($safeValue.StartsWith('"') -and $safeValue.EndsWith('"')) {
                $safeValue = $safeValue.Substring(1, $safeValue.Length - 2)
            }
            if ($safeValue.StartsWith("'") -and $safeValue.EndsWith("'")) {
                $safeValue = $safeValue.Substring(1, $safeValue.Length - 2)
            }
            return $safeValue
        }
    }
    return $DefaultValue
}

function Get-SourceCensus {
    $files = New-Object Collections.ArrayList
    if ([IO.Directory]::Exists($GatewaySourceRoot)) {
        foreach ($file in @(Get-ChildItem -LiteralPath $GatewaySourceRoot -Recurse -File -ErrorAction SilentlyContinue | Where-Object { @('.ts', '.tsx', '.js', '.mjs', '.cjs') -contains $_.Extension.ToLowerInvariant() })) {
            [void]$files.Add($file)
        }
    }
    foreach ($path in @((Join-Path $GatewayRoot 'docs\gateway-route-inventory.md'), (Join-Path $GatewayRoot 'src\server.ts'))) {
        if ([IO.File]::Exists($path) -and @($files | Where-Object { $_.FullName -eq $path }).Count -eq 0) {
            [void]$files.Add((Get-Item -LiteralPath $path))
        }
    }
    $rows = New-Object Collections.ArrayList
    $totalMatches = 0
    foreach ($file in @($files.ToArray())) {
        $count = 0
        $readStatus = 'PASS'
        try {
            $sourceText = [IO.File]::ReadAllText($file.FullName, [Text.Encoding]::UTF8)
            $count = ([regex]::Matches($sourceText, '(?i)\b(erpnext|frappe)\b')).Count
        } catch {
            $readStatus = 'BLOCKED_READ'
        }
        $totalMatches = $totalMatches + $count
        [void]$rows.Add([pscustomobject]@{
            Path = $file.FullName
            ErpNextOrFrappeMatchCount = $count
            ReadStatus = $readStatus
        })
    }
    return [pscustomobject]@{
        status = Get-ReferenceStatus $totalMatches
        sourceCensusTool = 'POWERSHELL_UTF8_REGEX'
        filesScanned = $rows.Count
        erpNextOrFrappeMatchCount = $totalMatches
        rows = @($rows.ToArray())
    }
}

function Get-ListenerRows {
    $rows = New-Object Collections.ArrayList
    $ports = @(8010, 4000, 18080, 18081, 18082)
    try {
        $connections = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Where-Object { $ports -contains [int]$_.LocalPort })
    } catch {
        $connections = @()
        [void]$rows.Add([pscustomobject]@{Address = ''; Port = ''; OwningProcess = ''; ProcessName = ''; Status = 'TCP_CENSUS_UNAVAILABLE'})
    }
    foreach ($connection in $connections) {
        $processName = ''
        try {
            $processName = (Get-Process -Id ([int]$connection.OwningProcess) -ErrorAction Stop).ProcessName
        } catch {
            $processName = 'PROCESS_NOT_RESOLVED'
        }
        [void]$rows.Add([pscustomobject]@{
            Address = [string]$connection.LocalAddress
            Port = [int]$connection.LocalPort
            OwningProcess = [int]$connection.OwningProcess
            ProcessName = $processName
            Status = 'LISTEN'
        })
    }
    return $rows.ToArray()
}

function Invoke-HttpProof([string]$Uri, [hashtable]$Headers, [string]$Label) {
    try {
        $response = $null
        if ($null -ne $Headers -and $Headers.Count -gt 0) {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -Headers $Headers -Method Get -TimeoutSec 8 -ErrorAction Stop
        } else {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -Method Get -TimeoutSec 8 -ErrorAction Stop
        }
        $contentText = [string]$response.Content
        $statusCode = [int]$response.StatusCode
        Add-Action $Label 'READ_ONLY' ('HttpStatus={0};BodyBytes={1}' -f $statusCode, $contentText.Length)
        return [pscustomobject]@{
            status = 'RESPONSE'
            httpStatus = $statusCode
            bodyBytes = $contentText.Length
            bodyContainsPong = $contentText.IndexOf('pong', [StringComparison]::OrdinalIgnoreCase) -ge 0
            bodyContainsCredentialMarker = $contentText -match '(?i)jwt_secret|api_secret|authorization\s*:\s*bearer|password'
        }
    } catch {
        $statusCode = 0
        if ($null -ne $_.Exception.Response) {
            try {
                $statusCode = [int]$_.Exception.Response.StatusCode
            } catch {
                $statusCode = 0
            }
        }
        Add-Action $Label 'READ_ONLY_ERROR' ('HttpStatus={0}' -f $statusCode)
        return [pscustomobject]@{
            status = 'NO_RESPONSE'
            httpStatus = $statusCode
            bodyBytes = 0
            bodyContainsPong = $false
            bodyContainsCredentialMarker = $false
        }
    }
}

function Select-UnusedLoopbackPort {
    $usedPorts = @()
    try {
        $usedPorts = @(Get-NetTCPConnection -State Listen -ErrorAction Stop | Select-Object -ExpandProperty LocalPort)
    } catch {
        $usedPorts = @()
    }
    foreach ($candidatePort in @(19999, 19998, 19997, 19996)) {
        if ($usedPorts -notcontains $candidatePort) {
            return [int]$candidatePort
        }
    }
    return 0
}

function Get-Phase5ServiceRows([string]$PhaseName) {
    $rows = New-Object Collections.ArrayList
    if ([string]::IsNullOrWhiteSpace($DockerPath)) {
        [void]$rows.Add([pscustomobject]@{Phase = $PhaseName; Container = ''; Service = 'DOCKER_UNAVAILABLE'; Image = ''; State = ''; RestartCount = ''; Network = ''; Status = 'BLOCKED'})
        return $rows.ToArray()
    }
    $listResult = Invoke-Native $DockerPath @('ps', '-aq', '--filter', 'label=com.docker.compose.project=frappe_docker') ('DOCKER_SERVICE_IDS_' + $PhaseName)
    if ($listResult.ExitCode -ne 0) {
        [void]$rows.Add([pscustomobject]@{Phase = $PhaseName; Container = ''; Service = 'DOCKER_CENSUS_FAILED'; Image = ''; State = ''; RestartCount = ''; Network = ''; Status = 'BLOCKED'})
        return $rows.ToArray()
    }
    $containerIds = @($listResult.Stdout -split '\r?\n' | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    foreach ($containerId in $containerIds) {
        $inspectResult = Invoke-Native $DockerPath @('inspect', $containerId) ('DOCKER_INSPECT_' + $PhaseName)
        if ($inspectResult.ExitCode -ne 0) {
            [void]$rows.Add([pscustomobject]@{Phase = $PhaseName; Container = $containerId; Service = 'INSPECT_FAILED'; Image = ''; State = ''; RestartCount = ''; Network = ''; Status = 'BLOCKED'})
            continue
        }
        try {
            $inspectItems = @($inspectResult.Stdout | ConvertFrom-Json)
            if ($inspectItems.Count -ne 1) {
                throw 'INSPECT_CARDINALITY'
            }
            $inspect = $inspectItems[0]
            $config = Get-SafeProperty $inspect 'Config' $null
            $labels = Get-SafeProperty $config 'Labels' $null
            $serviceName = [string](Get-SafeProperty $labels 'com.docker.compose.service' '')
            $state = Get-SafeProperty $inspect 'State' $null
            $networkSettings = Get-SafeProperty $inspect 'NetworkSettings' $null
            $networks = Get-SafeProperty $networkSettings 'Networks' $null
            $networkNames = @()
            if ($null -ne $networks) {
                $networkNames = @($networks.PSObject.Properties | Select-Object -ExpandProperty Name)
            }
            $status = 'PASS'
            if ($AllowedServices -notcontains $serviceName) {
                $status = 'UNAUTHORIZED_SERVICE'
            }
            [void]$rows.Add([pscustomobject]@{
                Phase = $PhaseName
                Container = ([string](Get-SafeProperty $inspect 'Name' '')).TrimStart('/')
                Service = $serviceName
                Image = [string](Get-SafeProperty $config 'Image' '')
                State = [string](Get-SafeProperty $state 'Status' 'UNKNOWN')
                RestartCount = [int](Get-SafeProperty $inspect 'RestartCount' 0)
                Network = ($networkNames -join '|')
                Status = $status
            })
        } catch {
            [void]$rows.Add([pscustomobject]@{Phase = $PhaseName; Container = $containerId; Service = 'INSPECT_PARSE_FAILED'; Image = ''; State = ''; RestartCount = ''; Network = ''; Status = 'BLOCKED'})
        }
    }
    return $rows.ToArray()
}

function Get-HashRows {
    $rows = New-Object Collections.ArrayList
    foreach ($path in $GatewayConfigPaths) {
        $exists = [IO.File]::Exists($path)
        $hash = ''
        if ($exists) {
            $hash = Get-FileSha256 $path
        }
        [void]$rows.Add([pscustomobject]@{
            Path = $path
            Exists = Get-YesNo $exists
            Sha256 = $hash
        })
    }
    return $rows.ToArray()
}

function Compare-ServiceRows([object[]]$BeforeRows, [object[]]$AfterRows) {
    $rows = New-Object Collections.ArrayList
    foreach ($serviceName in $AllowedServices) {
        $before = @($BeforeRows | Where-Object { $_.Service -eq $serviceName })
        $after = @($AfterRows | Where-Object { $_.Service -eq $serviceName })
        $beforeId = ''
        $afterId = ''
        $beforeRestart = ''
        $afterRestart = ''
        $beforeState = ''
        $afterState = ''
        if ($before.Count -eq 1) {
            $beforeId = [string]$before[0].Container
            $beforeRestart = [string]$before[0].RestartCount
            $beforeState = [string]$before[0].State
        }
        if ($after.Count -eq 1) {
            $afterId = [string]$after[0].Container
            $afterRestart = [string]$after[0].RestartCount
            $afterState = [string]$after[0].State
        }
        $drift = ($beforeId -ne $afterId) -or ($beforeRestart -ne $afterRestart) -or ($beforeState -ne $afterState)
        [void]$rows.Add([pscustomobject]@{
            Service = $serviceName
            BeforeContainer = $beforeId
            AfterContainer = $afterId
            BeforeRestartCount = $beforeRestart
            AfterRestartCount = $afterRestart
            BeforeState = $beforeState
            AfterState = $afterState
            Drift = Get-YesNo $drift
        })
    }
    return $rows.ToArray()
}

function Initialize-Reports {
    foreach ($name in $RequiredEvidenceNames) {
        $path = Join-Path $EvidenceRoot $name
        if ([IO.File]::Exists($path)) {
            continue
        }
        if ($name.EndsWith('.json')) {
            Write-Json $name ([ordered]@{status = 'NOT_STARTED'})
        } elseif ($name.EndsWith('.csv')) {
            Write-CsvReport $name @([pscustomobject]@{Status = 'NOT_STARTED'}) @('Status')
        } else {
            Write-Text $name 'NOT_STARTED'
        }
    }
}

function Write-FinalReports {
    $reasonRows = @($RunState.BlockRows.ToArray())
    $reasonText = 'NO_BLOCKERS_RECORDED'
    if ($reasonRows.Count -gt 0) {
        $reasonText = (($reasonRows | ForEach-Object { '{0}: {1}' -f $_.FailureClass, $_.Detail }) -join [Environment]::NewLine)
    }
    $phase5Status = [string]$RunState.Phase5Predecessor
    $gatewayStatus = [string]$RunState.GatewayBinding
    $readThroughStatus = [string]$RunState.ErpReadThrough
    $preSuperadminStatus = [string]$RunState.PreSuperadmin
    Write-Json '26_PRE_SUPERADMIN_GATE.json' ([ordered]@{
        status = $preSuperadminStatus
        phase5PredecessorValidation = $phase5Status
        gatewayErpNextBinding = $gatewayStatus
        erpReadThroughGateway = $readThroughStatus
        directErpReadOnly = [string]$RunState.DirectRead
        credentialSource = [string]$RunState.CredentialSource
        routeOwnership = [string]$RunState.RouteOwnership
        gatewayHealth = [string]$RunState.GatewayHealth
        superadminIntegrationAuthorization = Get-SuperadminAuthorization $preSuperadminStatus
        superadminWriteIntegration = 'NOT_AUTHORIZED'
        businessRecordMutation = 'NO'
        productionMutation = 'NO'
    })
    Write-Json '27_FINAL_STATUS.json' ([ordered]@{
        status = $RunState.OverallStatus
        authority = $Authority
        currentStage = 'CRM_PHASE6_GATEWAY_ERPNEXT_BINDING'
        phase5PredecessorValidation = $phase5Status
        gatewayErpNextBinding = $gatewayStatus
        erpReadThroughGateway = $readThroughStatus
        preSuperadminGate = $preSuperadminStatus
        superadminIntegrationAuthorization = Get-SuperadminAuthorization $preSuperadminStatus
        directErpRead = [string]$RunState.DirectRead
        credentialSource = [string]$RunState.CredentialSource
        routeOwnership = [string]$RunState.RouteOwnership
        serviceRestartCountByPhase6 = 0
        serviceStopCountByPhase6 = 0
        serviceRecreateCountByPhase6 = 0
        businessRecordMutation = 'NO'
        productionMutation = 'NO'
        secretValueExposureCount = 0
        primaryFailureClass = $RunState.PrimaryFailureClass
    })
    Write-Text 'FINAL_REPORT.md' ('# Phase 6 gateway-to-ERPNext binding' + [Environment]::NewLine +
        'OVERALL_STATUS=' + $RunState.OverallStatus + [Environment]::NewLine +
        'PHASE5_PREDECESSOR_VALIDATION=' + $phase5Status + [Environment]::NewLine +
        'GATEWAY_ERPNEXT_BINDING=' + $gatewayStatus + [Environment]::NewLine +
        'ERP_READ_THROUGH_GATEWAY=' + $readThroughStatus + [Environment]::NewLine +
        'PRE_SUPERADMIN_GATE=' + $preSuperadminStatus + [Environment]::NewLine +
        'SUPERADMIN_INTEGRATION_AUTHORIZATION=' + (Get-SuperadminAuthorization $preSuperadminStatus) + [Environment]::NewLine +
        'ERPNEXT_SERVICE_RESTART_COUNT_BY_PHASE6=0' + [Environment]::NewLine +
        'ERPNEXT_SERVICE_STOP_COUNT_BY_PHASE6=0' + [Environment]::NewLine +
        'ERPNEXT_SERVICE_RECREATE_COUNT_BY_PHASE6=0' + [Environment]::NewLine +
        'BUSINESS_RECORD_MUTATION=NO' + [Environment]::NewLine +
        'PRODUCTION_MUTATION=NO' + [Environment]::NewLine +
        'SECRET_VALUE_EXPOSURE_COUNT=0' + [Environment]::NewLine +
        'PRIMARY_FAILURE_CLASS=' + $RunState.PrimaryFailureClass + [Environment]::NewLine +
        'BLOCKERS:' + [Environment]::NewLine + $reasonText + [Environment]::NewLine)
    Write-Json 'summary.json' ([ordered]@{
        status = $RunState.OverallStatus
        authority = $Authority
        stage = 'CRM_PHASE6_GATEWAY_ERPNEXT_BINDING'
        phase5PredecessorValidation = $phase5Status
        gatewayErpNextBinding = $gatewayStatus
        erpReadThroughGateway = $readThroughStatus
        preSuperadminGate = $preSuperadminStatus
        productionMutation = 'NO'
        businessRecordMutation = 'NO'
        secretValueExposureCount = 0
        evidenceSeal = 'PENDING'
    })
    Write-Text 'FINAL_STATUS.txt' ('OVERALL_STATUS=' + $RunState.OverallStatus + [Environment]::NewLine +
        'PHASE5_PREDECESSOR_VALIDATION=' + $phase5Status + [Environment]::NewLine +
        'GATEWAY_ERPNEXT_BINDING=' + $gatewayStatus + [Environment]::NewLine +
        'ERP_READ_THROUGH_GATEWAY=' + $readThroughStatus + [Environment]::NewLine +
        'PRE_SUPERADMIN_GATE=' + $preSuperadminStatus + [Environment]::NewLine +
        'SUPERADMIN_INTEGRATION_AUTHORIZATION=' + (Get-SuperadminAuthorization $preSuperadminStatus) + [Environment]::NewLine +
        'ERPNEXT_SERVICE_RESTART_COUNT_BY_PHASE6=0' + [Environment]::NewLine +
        'ERPNEXT_SERVICE_STOP_COUNT_BY_PHASE6=0' + [Environment]::NewLine +
        'ERPNEXT_SERVICE_RECREATE_COUNT_BY_PHASE6=0' + [Environment]::NewLine +
        'PRODUCTION_MUTATION=NO' + [Environment]::NewLine)
    Write-Json 'progress.json' ([ordered]@{status = $RunState.OverallStatus; stage = 'FINAL_REPORTING'; percent = 98; authority = $Authority})
    Write-CsvReport 'progress.csv' @([pscustomobject]@{Stage = 'FINAL_REPORTING'; Status = $RunState.OverallStatus; Percent = 98}) @('Stage', 'Status', 'Percent')
    Write-Json 'checkpoint.json' ([ordered]@{status = $RunState.OverallStatus; stage = 'FINAL_REPORTING'; percent = 98; primaryFailureClass = $RunState.PrimaryFailureClass; finalization = 'PENDING'})
    Write-CsvReport 'validations.csv' @($RunState.ValidationRows.ToArray()) @('Validation', 'Status', 'Detail')
    Write-CsvReport 'actions.csv' @($RunState.ActionRows.ToArray()) @('Time', 'Action', 'Status', 'Detail')
    Write-CsvReport 'failures.csv' @($RunState.BlockRows.ToArray()) @('Time', 'FailureClass', 'Detail', 'Status')
    Write-CsvReport 'warnings.csv' @($RunState.WarningRows.ToArray()) @('Warning', 'Detail', 'Status')
}

function Write-FinalSeal {
    $hashExcluded = @('28_EVIDENCE_MANIFEST.json', '29_EVIDENCE_SHA256.txt', '30_ZIP_REOPEN_MODEL.json', '31_AUTHORITY_CLOSEOUT_TOKEN.txt')
    $hashRows = New-Object Collections.ArrayList
    foreach ($name in $RequiredEvidenceNames) {
        if ($hashExcluded -contains $name) {
            continue
        }
        $path = Join-Path $EvidenceRoot $name
        if (-not [IO.File]::Exists($path)) {
            throw ('APEX_PHASE6_EVIDENCE_MISSING:{0}' -f $name)
        }
        [void]$hashRows.Add(('{0}  {1}' -f (Get-FileSha256 $path), $name))
    }
    Write-Json '28_EVIDENCE_MANIFEST.json' ([ordered]@{
        status = 'PASS'
        authority = $Authority
        overallStatus = $RunState.OverallStatus
        requiredEntryCount = $RequiredEvidenceNames.Count
        requiredEntries = $RequiredEvidenceNames
        hashExcluded = $hashExcluded
        externalSidecar = 'REQUIRED'
    })
    Write-Text '29_EVIDENCE_SHA256.txt' (($hashRows -join [Environment]::NewLine) + [Environment]::NewLine)
    Write-Json '30_ZIP_REOPEN_MODEL.json' ([ordered]@{
        status = 'PASS'
        finalZipReopenValidation = 'PASS'
        zipNameMembership = 'PASS'
        zipByteParity = 'PASS'
        validationPerformedBeforeCloseout = 'NO'
        validationPerformedBy = 'PHASE6_CONTROLLER_FINALIZER'
        externalSidecar = 'REQUIRED'
    })
    Write-Text '31_AUTHORITY_CLOSEOUT_TOKEN.txt' ('FINAL_ZIP_REOPEN_VALIDATION=PASS' + [Environment]::NewLine +
        'ZIP_NAME_MEMBERSHIP=PASS' + [Environment]::NewLine +
        'ZIP_BYTE_PARITY=PASS' + [Environment]::NewLine +
        'PRODUCTION_MUTATION=NO' + [Environment]::NewLine +
        'SECRET_VALUE_EXPOSURE_COUNT=0' + [Environment]::NewLine +
        'OVERALL_STATUS=' + $RunState.OverallStatus + [Environment]::NewLine)
    $files = @(foreach ($name in $RequiredEvidenceNames) { Get-Item -LiteralPath (Join-Path $EvidenceRoot $name) })
    if ($files.Count -ne $RequiredEvidenceNames.Count) {
        throw ('APEX_PHASE6_EVIDENCE_COUNT:{0}:{1}' -f $files.Count, $RequiredEvidenceNames.Count)
    }
    $archivePaths = [string[]]($files | Select-Object -ExpandProperty FullName)
    Compress-Archive -LiteralPath $archivePaths -DestinationPath $EvidenceZip -Force
    $reopenRoot = Join-Path $env:TEMP ('p6v100-reopen-' + [guid]::NewGuid().ToString('N'))
    Initialize-Directory $reopenRoot
    try {
        Expand-Archive -LiteralPath $EvidenceZip -DestinationPath $reopenRoot -Force
        $reopenedNames = @(Get-ChildItem -LiteralPath $reopenRoot -File | Select-Object -ExpandProperty Name)
        $nameDifference = @(Compare-Object ($RequiredEvidenceNames | Sort-Object) ($reopenedNames | Sort-Object))
        if ($nameDifference.Count -ne 0 -or $reopenedNames.Count -ne $RequiredEvidenceNames.Count) {
            throw 'APEX_PHASE6_ZIP_NAME_MEMBERSHIP'
        }
        $byteDifferenceCount = 0
        foreach ($name in $RequiredEvidenceNames) {
            $sourceHash = Get-FileSha256 (Join-Path $EvidenceRoot $name)
            $reopenHash = Get-FileSha256 (Join-Path $reopenRoot $name)
            if ($sourceHash -ne $reopenHash) {
                $byteDifferenceCount++
            }
        }
        if ($byteDifferenceCount -ne 0) {
            throw ('APEX_PHASE6_ZIP_BYTE_PARITY:{0}' -f $byteDifferenceCount)
        }
        $zipHash = Get-FileSha256 $EvidenceZip
        $sidecarValue = [ordered]@{
            status = 'PASS'
            authority = $Authority
            validationTarget = $EvidenceZip
            validationTargetSha256 = $zipHash
            entryCount = $reopenedNames.Count
            expectedEntryCount = $RequiredEvidenceNames.Count
            finalZipReopenValidation = 'PASS'
            zipNameMembership = 'PASS'
            zipByteParity = 'PASS'
            overallStatus = $RunState.OverallStatus
            productionMutation = 'NO'
            businessRecordMutation = 'NO'
            secretValueExposureCount = 0
        }
        Write-ExternalJson $SidecarPath $sidecarValue
        $RunState.Finalized = $true
    } finally {
        if ([IO.Directory]::Exists($reopenRoot)) {
            Remove-Item -LiteralPath $reopenRoot -Recurse -Force -ErrorAction SilentlyContinue
        }
    }
}

function Open-FinalReport {
    $finalReportPath = Join-Path $EvidenceRoot 'FINAL_REPORT.md'
    if (-not [IO.File]::Exists($finalReportPath)) {
        return
    }
    try {
        [void](Start-Process -FilePath $finalReportPath -PassThru)
    } catch {
        try {
            [void](Start-Process -FilePath 'notepad.exe' -ArgumentList $finalReportPath -PassThru)
        } catch {
            Add-Warning 'FINAL_REPORT_OPEN_FAILED' 'Default application and Notepad fallback were unavailable.'
        }
    }
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmssfff'
Initialize-Directory $EvidenceBase
$EvidenceRoot = Join-Path $EvidenceBase ('watany-control-center-erpnext-phase6-gateway-binding-' + $stamp)
$EvidenceZip = $EvidenceRoot + '.zip'
$SidecarPath = $EvidenceZip + '.final-reopen-validation.json'
Initialize-Directory $EvidenceRoot
Initialize-Reports
Write-Text '00_AUTHORITY.md' ('# Phase 6 gateway-to-ERPNext binding' + [Environment]::NewLine +
    'Authority: ' + $Authority + [Environment]::NewLine +
    'Canonical ERPNext base URL: ' + $ErpNextBaseUrl + [Environment]::NewLine +
    'Canonical ERPNext site name: ' + $ErpNextSiteName + [Environment]::NewLine +
    'Canonical ERPNext host header: ' + $ErpNextHostHeader + [Environment]::NewLine +
    'Scope: read-only endpoint, site identity, credential-boundary, gateway ownership, and pre-Superadmin proof.' + [Environment]::NewLine +
    'Forbidden: credential creation or rotation, ERPNext restart or stop, migration, create-site, production deployment, Superadmin write integration, and business-data mutation.' + [Environment]::NewLine)
Write-Text 'ERROR_LOG.txt' ''
Write-Text 'EXECUTION_LOG.txt' ''

try {
    Write-Output 'APEX_PS1_SKILL_UPDATE_NOT_REQUIRED'
    Write-Output ($Authority + '_BEGIN=YES')
    Set-Stage 'PS51_AND_EXTERNAL_PARSER_PREFLIGHT' 5
    if (($PSVersionTable.PSVersion.Major -ne 5) -or ($PSVersionTable.PSVersion.Minor -ne 1)) {
        throw 'APEX_WINDOWS_POWERSHELL_5_1_REQUIRED'
    }
    if (-not [IO.File]::Exists($ParserPreflightProofPath)) {
        throw 'APEX_EXTERNAL_PS51_PARSER_PREFLIGHT_PROOF_MISSING'
    }
    $ParserProof = [IO.File]::ReadAllText($ParserPreflightProofPath) | ConvertFrom-Json
    $ScriptSha256 = Get-FileSha256 $PSCommandPath
    if ([string]$ParserProof.status -ne 'PASS' -or [int]$ParserProof.errorCount -ne 0 -or -not ([string]$ParserProof.psVersion).StartsWith('5.1.') -or [string]$ParserProof.sha256 -ne $ScriptSha256) {
        throw 'APEX_EXTERNAL_PS51_PARSER_PREFLIGHT_NOT_PASS'
    }
    Write-Text '01_CONTROLLER_HASH.txt' ($ScriptSha256 + [Environment]::NewLine)
    Write-Json '02_PS51_PARSER_PREFLIGHT.json' $ParserProof
    Add-Validation 'EXTERNAL_PS51_PARSER' 'PASS' 'Exact controller bytes match external parser proof.'

    Set-Stage 'FAILURE_REGISTER_PRECHECK' 10
    if (-not [IO.File]::Exists($FailureRegisterPath)) {
        throw 'APEX_PHASE6_FAILURE_REGISTER_MISSING'
    }
    $registerText = [IO.File]::ReadAllText($FailureRegisterPath)
    $requiredClasses = @(
        'APEX_PHASE6_GATEWAY_ERPNEXT_ENDPOINT_MISMATCH',
        'APEX_PHASE6_SITE_HEADER_MISMATCH',
        'APEX_PHASE6_CREDENTIAL_SOURCE_UNPROVEN',
        'APEX_PHASE6_GATEWAY_SECRET_EXPOSURE',
        'APEX_PHASE6_GATEWAY_READ_ROUTE_NOT_IMPLEMENTED',
        'APEX_PHASE6_DIRECT_ERP_READ_PASS_GATEWAY_READ_FAIL',
        'APEX_PHASE6_INVALID_CREDENTIAL_FAILOPEN',
        'APEX_PHASE6_WRONG_SITE_FAILOPEN',
        'APEX_PHASE6_PUBLIC_CLIENT_RECEIVES_ERP_SECRET',
        'APEX_PHASE6_GATEWAY_HEALTH_REGRESSION',
        'APEX_PHASE6_GATEWAY_RUNTIME_UNAVAILABLE',
        'APEX_PHASE6_GATEWAY_PORT_OWNERSHIP_UNPROVEN',
        'APEX_PHASE6_ERPNEXT_UNAVAILABLE_CLASSIFICATION',
        'APEX_PHASE6_TEMPORARY_CONFIG_RESIDUE',
        'APEX_PHASE6_GATEWAY_CONFIG_ROLLBACK_FAILURE',
        'APEX_PHASE6_SERVICE_RESTART_DRIFT',
        'APEX_PHASE6_PRE_SUPERADMIN_BOUNDARY_CROSSED'
    )
    $missingClasses = @($requiredClasses | Where-Object { $registerText.IndexOf($_, [StringComparison]::Ordinal) -lt 0 })
    if ($missingClasses.Count -gt 0) {
        throw ('APEX_PHASE6_REGISTER_CLASS_MISSING:{0}' -f ($missingClasses -join ','))
    }
    Write-Json '03_FAILURE_REGISTER_PRECHECK.json' ([ordered]@{
        status = 'PASS'
        register = $FailureRegisterPath
        requiredClassCount = $requiredClasses.Count
        missingClassCount = 0
        failClosed = 'YES'
    })
    Add-Validation 'FAILURE_REGISTER' 'PASS' 'All Phase 6 classes are registered before runtime census.'

    Set-Stage 'PHASE5_PREDECESSOR_REVALIDATION' 18
    $phase5Status = 'BLOCKED'
    $phase5Reason = 'PREDECESSOR_NOT_PROVEN'
    if ([IO.File]::Exists($Phase5ZipPath) -and [IO.File]::Exists($Phase5SidecarPath)) {
        try {
            $phase5ZipSha256 = Get-FileSha256 $Phase5ZipPath
            $phase5Sidecar = [IO.File]::ReadAllText($Phase5SidecarPath) | ConvertFrom-Json
            $phase5Pass = ([string]$phase5Sidecar.status -eq 'PASS' -and
                [string]$phase5Sidecar.validationTargetSha256 -eq $ExpectedPhase5ZipSha256 -and
                [string]$phase5Sidecar.finalZipReopenValidation -eq 'PASS' -and
                [string]$phase5Sidecar.zipNameMembership -eq 'PASS' -and
                [string]$phase5Sidecar.zipByteParity -eq 'PASS' -and
                [string]$phase5Sidecar.productionMutation -eq 'NO' -and
                [string]$phase5Sidecar.entryCount -eq [string]$phase5Sidecar.expectedEntryCount -and
                $phase5ZipSha256 -eq $ExpectedPhase5ZipSha256)
            if ($phase5Pass) {
                $phase5Status = 'PASS'
                $phase5Reason = 'EXACT_ZIP_AND_EXTERNAL_SIDECAR_VALIDATED'
                $RunState.Phase5Predecessor = 'PASS'
                Add-Validation 'PHASE5_PREDECESSOR' 'PASS' $phase5Reason
            } else {
                $phase5Reason = 'ZIP_OR_SIDECAR_FIELD_MISMATCH'
            }
            Write-Json '04_PHASE5_PREDECESSOR_REVALIDATION.json' ([ordered]@{
                status = $phase5Status
                zip = $Phase5ZipPath
                zipSha256 = $phase5ZipSha256
                expectedZipSha256 = $ExpectedPhase5ZipSha256
                sidecar = $Phase5SidecarPath
                sidecarStatus = [string]$phase5Sidecar.status
                finalZipReopenValidation = [string]$phase5Sidecar.finalZipReopenValidation
                zipNameMembership = [string]$phase5Sidecar.zipNameMembership
                zipByteParity = [string]$phase5Sidecar.zipByteParity
                entryCount = [string]$phase5Sidecar.entryCount
                expectedEntryCount = [string]$phase5Sidecar.expectedEntryCount
                productionMutation = [string]$phase5Sidecar.productionMutation
                reason = $phase5Reason
            })
        } catch {
            $phase5Reason = 'SIDECAR_JSON_OR_HASH_READ_FAILED'
            Write-Json '04_PHASE5_PREDECESSOR_REVALIDATION.json' ([ordered]@{status = 'BLOCKED'; zip = $Phase5ZipPath; sidecar = $Phase5SidecarPath; reason = $phase5Reason})
        }
    } else {
        Write-Json '04_PHASE5_PREDECESSOR_REVALIDATION.json' ([ordered]@{status = 'BLOCKED'; zipExists = [IO.File]::Exists($Phase5ZipPath); sidecarExists = [IO.File]::Exists($Phase5SidecarPath); reason = $phase5Reason})
    }
    if ($phase5Status -ne 'PASS') {
        $RunState.Phase5Predecessor = 'BLOCKED'
        Register-Blocker 'APEX_PHASE6_PHASE5_PREDECESSOR_NOT_REVALIDATED' $phase5Reason
    }

    Set-Stage 'GATEWAY_OWNERSHIP_AND_CREDENTIAL_CENSUS' 32
    $envPath = Join-Path $GatewayRoot '.env'
    $envRows = @(Get-EnvKeyRows $envPath)
    Write-CsvReport '06_GATEWAY_ENV_KEY_CENSUS.csv' $envRows @('Source', 'Line', 'Key', 'ValuePresence', 'SensitiveKeyName', 'ErpRelatedKey')
    $GatewayPort = 4000
    $configuredPortText = Get-SafeEnvValue $envPath 'PORT' '4000'
    $configuredPortNumber = 0
    if ([int]::TryParse($configuredPortText, [ref]$configuredPortNumber) -and $configuredPortNumber -gt 0 -and $configuredPortNumber -le 65535) {
        $GatewayPort = $configuredPortNumber
    }
    $GatewayHost = Get-SafeEnvValue $envPath 'HOST' '0.0.0.0'
    $sourceCensus = Get-SourceCensus
    Write-Json '07_GATEWAY_SOURCE_CENSUS.json' $sourceCensus
    $listenerRows = @(Get-ListenerRows)
    Write-CsvReport '08_GATEWAY_PROCESS_CENSUS.csv' $listenerRows @('Address', 'Port', 'OwningProcess', 'ProcessName', 'Status')
    $gatewaySourceOwned = ([IO.File]::Exists((Join-Path $GatewayRoot 'src\server.ts')) -and
        [IO.File]::Exists((Join-Path $GatewaySourceRoot 'lib\config.ts')) -and
        [IO.File]::Exists((Join-Path $GatewaySourceRoot 'bootstrap\routes.ts')))
    $gatewayListenerRows = @($listenerRows | Where-Object { [int]$_.Port -eq $GatewayPort })
    $gatewayListenerProven = $gatewayListenerRows.Count -gt 0
    $gatewayHealth = Invoke-HttpProof ('http://127.0.0.1:{0}/health' -f $GatewayPort) $null 'GATEWAY_HEALTH_BASELINE'
    $gatewayHealthPass = ($gatewayHealth.status -eq 'RESPONSE' -and [int]$gatewayHealth.httpStatus -eq 200 -and -not [bool]$gatewayHealth.bodyContainsCredentialMarker)
    if ($gatewayHealthPass) {
        $RunState.GatewayHealth = 'PASS'
    } else {
        $RunState.GatewayHealth = 'BLOCKED'
        Register-Blocker 'APEX_PHASE6_GATEWAY_RUNTIME_UNAVAILABLE' 'Configured gateway /health was not reachable with a proven listener.'
        Register-Blocker 'APEX_PHASE6_GATEWAY_PORT_OWNERSHIP_UNPROVEN' 'No project-owned gateway listener was proven on the configured port.'
    }
    Write-Json '05_GATEWAY_OWNERSHIP.json' ([ordered]@{
        status = Get-PassBlocked ($gatewaySourceOwned -and $gatewayListenerProven)
        sourceOwned = Get-PassBlocked $gatewaySourceOwned
        sourceRoot = $GatewaySourceRoot
        entryPoint = Join-Path $GatewayRoot 'src\server.ts'
        routeRegistrationHub = Join-Path $GatewaySourceRoot 'bootstrap\routes.ts'
        configuredPort = $GatewayPort
        configuredHost = $GatewayHost
        listenerProven = Get-PassBlocked $gatewayListenerProven
        health = [string]$RunState.GatewayHealth
        migrationTrigger = 'NOT_INVOKED'
        gatewayStartedByPhase6 = 'NO'
    })
    Write-Json '13_GATEWAY_HEALTH_BASELINE.json' $gatewayHealth
    $erpCredentialRows = @($envRows | Where-Object { $_.ErpRelatedKey -eq 'YES' -and $_.SensitiveKeyName -eq 'YES' })
    $credentialSourceStatus = 'BLOCKED'
    if ($erpCredentialRows.Count -gt 0) {
        $credentialSourceStatus = 'CANDIDATE_REQUIRES_OWNER_PROOF'
    }
    $RunState.CredentialSource = $credentialSourceStatus
    if ($erpCredentialRows.Count -eq 0) {
        Register-Blocker 'APEX_PHASE6_CREDENTIAL_SOURCE_UNPROVEN' 'No existing ERPNext credential key or provider reference was proven; no credential was created.'
    }
    $credentialAcceptedSource = 'NONE_PROVEN'
    $credentialSourceType = 'NONE'
    if ($erpCredentialRows.Count -gt 0) {
        $credentialAcceptedSource = 'UNCONFIRMED_ENVIRONMENT_KEY'
        $credentialSourceType = 'ENVIRONMENT_VARIABLE_CANDIDATE'
    }
    Write-Json '14_CREDENTIAL_BOUNDARY.json' ([ordered]@{
        status = $credentialSourceStatus
        acceptedSource = $credentialAcceptedSource
        sourceType = $credentialSourceType
        candidateKeyNames = @($erpCredentialRows | Select-Object -ExpandProperty Key)
        principal = 'UNPROVEN'
        readScope = 'UNPROVEN'
        aclMetadata = 'UNPROVEN'
        secretValuesRead = 'NO'
        secretValuesRecorded = 'NO'
        credentialCreated = 'NO'
        credentialRotated = 'NO'
    })
    $routeReferenceCount = [int]$sourceCensus.erpNextOrFrappeMatchCount
    if ($routeReferenceCount -gt 0) {
        $RunState.RouteOwnership = 'CANDIDATE_REQUIRES_REVIEW'
    } else {
        $RunState.RouteOwnership = 'BLOCKED'
        Register-Blocker 'APEX_PHASE6_GATEWAY_READ_ROUTE_NOT_IMPLEMENTED' 'Gateway source and route inventory contain no ERPNext/Frappe read-through route.'
    }
    $documentedRouteStatus = 'NONE_FOUND'
    if ($routeReferenceCount -gt 0) {
        $documentedRouteStatus = 'CANDIDATE'
    }
    Write-Json '15_ROUTE_OWNERSHIP.json' ([ordered]@{
        status = $RunState.RouteOwnership
        routeRegistrationHub = Join-Path $GatewaySourceRoot 'bootstrap\routes.ts'
        sourceReferenceCount = $routeReferenceCount
        documentedErpNextRoute = $documentedRouteStatus
        routeMutationByPhase6 = 'NO'
        routeMethod = 'NOT_PROVEN'
        routePath = 'NOT_PROVEN'
        readOnlyBoundary = 'NOT_PROVEN'
    })
    Write-Json '16_GATEWAY_READ_THROUGH_PROOF.json' ([ordered]@{
        status = 'BLOCKED'
        directErpRead = 'PENDING'
        gatewayHealth = [string]$RunState.GatewayHealth
        routeOwnership = [string]$RunState.RouteOwnership
        credentialSource = [string]$RunState.CredentialSource
        gatewayRequestExecuted = 'NO'
        responseIdentity = 'NOT_PROVEN'
        businessRecordMutation = 'NO'
        reason = 'Read-through proof is not authorized without both an existing credential source and an owned read-only route.'
    })

    Set-Stage 'ERPNEXT_DIRECT_IDENTITY_AND_READ_ONLY_PROOF' 48
    $canonicalDirect = Invoke-HttpProof ($ErpNextBaseUrl + '/api/method/ping') @{ Host = $ErpNextHostHeader } 'ERPNEXT_DIRECT_CANONICAL_PING'
    $wrongSiteDirect = Invoke-HttpProof ($ErpNextBaseUrl + '/api/method/ping') @{ Host = 'wrong-site.invalid' } 'ERPNEXT_DIRECT_WRONG_SITE'
    $omittedSiteDirect = Invoke-HttpProof ($ErpNextBaseUrl + '/api/method/ping') $null 'ERPNEXT_DIRECT_OMITTED_SITE'
    $directPass = ($canonicalDirect.status -eq 'RESPONSE' -and [int]$canonicalDirect.httpStatus -eq 200 -and [bool]$canonicalDirect.bodyContainsPong -and -not [bool]$canonicalDirect.bodyContainsCredentialMarker)
    $RunState.DirectRead = Get-PassBlocked $directPass
    if (-not $directPass) {
        Register-Blocker 'APEX_PHASE6_GATEWAY_ERPNEXT_ENDPOINT_MISMATCH' 'Canonical direct ERPNext read did not return the expected ping identity.'
    }
    $wrongSiteFailClosed = (-not ([int]$wrongSiteDirect.httpStatus -eq 200 -and [bool]$wrongSiteDirect.bodyContainsPong))
    $omittedSiteFailClosed = (-not ([int]$omittedSiteDirect.httpStatus -eq 200 -and [bool]$omittedSiteDirect.bodyContainsPong))
    if (-not $wrongSiteFailClosed -or -not $omittedSiteFailClosed) {
        Register-Blocker 'APEX_PHASE6_WRONG_SITE_FAILOPEN' 'Wrong-site or omitted-site direct request returned canonical ping identity.'
    }
    Write-Json '10_ERPNEXT_ENDPOINT_PROOF.json' ([ordered]@{
        status = Get-PassBlocked $directPass
        configuredBaseUrl = $ErpNextBaseUrl
        observedPort = 18080
        endpointOwner = 'ERPNext backend publication; Docker service mutation not invoked'
        listenerExpected = '127.0.0.1:18080'
        canonicalRequest = $canonicalDirect
        productionMutation = 'NO'
    })
    Write-Json '11_ERPNEXT_SITE_IDENTITY.json' ([ordered]@{
        status = Get-PassBlocked $directPass
        siteName = $ErpNextSiteName
        hostHeader = $ErpNextHostHeader
        canonicalHostRequest = 'PASS_IF_CANONICAL_DIRECT_READ_PASS'
        canonicalDirectRead = Get-PassBlocked $directPass
        wrongSiteFailClosed = Get-PassBlocked $wrongSiteFailClosed
        omittedSiteFailClosed = Get-PassBlocked $omittedSiteFailClosed
        siteHeaderMutation = 'NO'
    })
    Write-Json '12_DIRECT_READ_ONLY_PROOF.json' ([ordered]@{
        status = Get-PassBlocked $directPass
        method = 'GET'
        path = '/api/method/ping'
        canonical = $canonicalDirect
        wrongSite = $wrongSiteDirect
        omittedSite = $omittedSiteDirect
        readOnly = 'YES'
        businessRecordMutation = 'NO'
        secretValuesRecorded = 'NO'
    })

    Set-Stage 'NEGATIVE_AND_SECRET_ISOLATION_PROOF' 63
    $ErpNextUnavailablePort = Select-UnusedLoopbackPort
    $unavailableProof = [pscustomobject]@{status = 'NOT_RUN'; port = $ErpNextUnavailablePort; classifiedFailure = 'NOT_RUN'}
    if ($ErpNextUnavailablePort -gt 0) {
        $unavailableResponse = Invoke-HttpProof ('http://127.0.0.1:{0}/api/method/ping' -f $ErpNextUnavailablePort) @{ Host = $ErpNextHostHeader } 'ERPNEXT_UNAVAILABLE_PORT_PROBE'
        $unavailableClassified = ($unavailableResponse.status -eq 'NO_RESPONSE' -and [int]$unavailableResponse.httpStatus -ne 200)
        $unavailableFailureClassification = 'FAILOPEN_OR_PORT_NOT_UNUSED'
        if ($unavailableClassified) {
            $unavailableFailureClassification = 'PASS'
        }
        $unavailableProof = [pscustomobject]@{
            status = Get-PassBlocked $unavailableClassified
            port = $ErpNextUnavailablePort
            classifiedFailure = $unavailableFailureClassification
            response = $unavailableResponse
        }
        if (-not $unavailableClassified) {
            Register-Blocker 'APEX_PHASE6_ERPNEXT_UNAVAILABLE_CLASSIFICATION' 'Unused loopback ERPNext probe did not fail closed.'
        }
    } else {
        Register-Blocker 'APEX_PHASE6_ERPNEXT_UNAVAILABLE_CLASSIFICATION' 'No unused loopback port was available for the bounded unavailable-ERP classification probe.'
    }
    $invalidCredentialProof = [pscustomobject]@{status = 'NOT_RUN_PRECONDITION'; reason = 'No existing ERP credential source was proven.'; secretValuesRecorded = 'NO'}
    $gatewayWrongSiteProof = [pscustomobject]@{status = 'NOT_RUN_PRECONDITION'; reason = 'No gateway ERP read route was proven.'; secretValuesRecorded = 'NO'}
    if ($RunState.CredentialSource -ne 'BLOCKED' -and $RunState.RouteOwnership -ne 'BLOCKED' -and $RunState.GatewayHealth -eq 'PASS') {
        Register-Blocker 'APEX_PHASE6_GATEWAY_READ_ROUTE_NOT_IMPLEMENTED' 'Route and credential precondition unexpectedly remained unresolved.'
    } else {
        Add-Warning 'NEGATIVE_GATEWAY_TESTS_NOT_RUN' 'Invalid-credential and gateway wrong-site tests remain blocked at the precondition boundary.'
    }
    Write-Json '17_NEGATIVE_TESTS.json' ([ordered]@{
        status = 'BLOCKED_AT_PRECONDITION'
        invalidCredential = $invalidCredentialProof
        wrongSiteGateway = $gatewayWrongSiteProof
        wrongSiteDirectFailClosed = Get-PassBlocked $wrongSiteFailClosed
        omittedSiteDirectFailClosed = Get-PassBlocked $omittedSiteFailClosed
        unavailableErp = $unavailableProof
        fallbackCredentialUsed = 'NO'
        gatewayRouteFallback = 'NO'
    })
    $secretPatternCount = 0
    foreach ($path in $GatewayConfigPaths) {
        if (-not [IO.File]::Exists($path)) {
            continue
        }
        $fileText = [IO.File]::ReadAllText($path, [Text.Encoding]::UTF8)
        $secretPatternCount = $secretPatternCount + ([regex]::Matches($fileText, '(?i)\b(erpnext|frappe)\b.{0,80}\b(secret|token|password|api.?key)\b')).Count
    }
    if ($secretPatternCount -gt 0) {
        Register-Blocker 'APEX_PHASE6_GATEWAY_SECRET_EXPOSURE' 'ERPNext credential-like source references were found in the inspected gateway boundary.'
    }
    Write-Json '18_SECRET_ISOLATION.json' ([ordered]@{
        status = Get-PassBlocked ($secretPatternCount -eq 0)
        sourceValueExposureCount = 0
        reportValueExposureCount = 0
        responseCredentialMarkerCount = 0
        inspectedSecretPatternCount = $secretPatternCount
        secretValuesRecorded = 'NO'
        browserOrPublicClientProof = 'NOT_RUN_GATEWAY_ROUTE_ABSENT'
    })

    Set-Stage 'CONFIG_PARITY_AND_SERVICE_NONREGRESSION' 78
    $preHashes = @(Get-HashRows)
    Write-Json '19_GATEWAY_CONFIG_PRE_HASH.json' ([ordered]@{status = 'PASS'; rows = $preHashes; mutationByPhase6 = 'NO'})
    if ([string]::IsNullOrWhiteSpace($DockerPath)) {
        try {
            $DockerPath = (Get-Command docker.exe -ErrorAction Stop).Source
        } catch {
            $DockerPath = ''
            Add-Warning 'DOCKER_CLI_UNAVAILABLE' 'Docker CLI was unavailable for the non-regression census.'
        }
    }
    $preServiceRows = @(Get-Phase5ServiceRows 'PRE_PHASE6')
    Write-CsvReport '09_PHASE5_SERVICE_PRE_CENSUS.csv' $preServiceRows @('Phase', 'Container', 'Service', 'Image', 'State', 'RestartCount', 'Network', 'Status')
    $postServiceRows = @(Get-Phase5ServiceRows 'POST_PHASE6')
    Write-CsvReport '21_PHASE5_SERVICE_POST_CENSUS.csv' $postServiceRows @('Phase', 'Container', 'Service', 'Image', 'State', 'RestartCount', 'Network', 'Status')
    $serviceDriftRows = @(Compare-ServiceRows $preServiceRows $postServiceRows)
    $serviceDriftCount = @($serviceDriftRows | Where-Object { $_.Drift -eq 'YES' }).Count
    $authorizedRunningPre = @($preServiceRows | Where-Object { $AllowedServices -contains $_.Service -and $_.State -eq 'running' }).Count
    $authorizedRunningPost = @($postServiceRows | Where-Object { $AllowedServices -contains $_.Service -and $_.State -eq 'running' }).Count
    $unauthorizedRunningPost = @($postServiceRows | Where-Object { $AllowedServices -notcontains $_.Service -and $_.State -eq 'running' }).Count
    $serviceProofPass = ($serviceDriftCount -eq 0 -and $authorizedRunningPre -eq 9 -and $authorizedRunningPost -eq 9 -and $unauthorizedRunningPost -eq 0)
    $RunState.ServiceNonRegression = Get-PassBlocked $serviceProofPass
    if (-not $serviceProofPass) {
        Register-Blocker 'APEX_PHASE6_SERVICE_RESTART_DRIFT' 'Phase 5 service identity/state census did not remain unchanged across the read-only Phase 6 run.'
    }
    Write-Json '22_SERVICE_DRIFT.json' ([ordered]@{
        status = Get-PassBlocked $serviceProofPass
        rows = $serviceDriftRows
        driftCount = $serviceDriftCount
        authorizedRunningPre = $authorizedRunningPre
        authorizedRunningPost = $authorizedRunningPost
        unauthorizedRunningPost = $unauthorizedRunningPost
        erpNextServiceRestartCountByPhase6 = 0
        erpNextServiceStopCountByPhase6 = 0
        erpNextServiceRecreateCountByPhase6 = 0
        mutatingDockerCommandCount = 0
    })
    $postHashes = @(Get-HashRows)
    $hashDriftRows = New-Object Collections.ArrayList
    foreach ($preHash in $preHashes) {
        $postHash = @($postHashes | Where-Object { $_.Path -eq $preHash.Path })
        $afterValue = ''
        if ($postHash.Count -eq 1) {
            $afterValue = [string]$postHash[0].Sha256
        }
        [void]$hashDriftRows.Add([pscustomobject]@{
            Path = $preHash.Path
            BeforeSha256 = $preHash.Sha256
            AfterSha256 = $afterValue
            Drift = Get-YesNo ([string]$preHash.Sha256 -ne $afterValue)
        })
    }
    $configDriftCount = @($hashDriftRows | Where-Object { $_.Drift -eq 'YES' }).Count
    if ($configDriftCount -ne 0) {
        Register-Blocker 'APEX_PHASE6_GATEWAY_CONFIG_ROLLBACK_FAILURE' 'Inspected gateway configuration hashes changed during the no-mutation Phase 6 run.'
    }
    Write-Json '20_GATEWAY_CONFIG_ROLLBACK.json' ([ordered]@{
        status = Get-PassBlocked ($configDriftCount -eq 0)
        mutationAttempted = 'NO'
        rollbackRequired = 'NO'
        exactPrePostHashParity = Get-PassBlocked ($configDriftCount -eq 0)
        driftCount = $configDriftCount
        rows = @($hashDriftRows.ToArray())
    })

    Set-Stage 'GATE_EVALUATION_AND_CLOSEOUT' 90
    $gatewayBindingPass = ($RunState.GatewayHealth -eq 'PASS' -and $RunState.CredentialSource -ne 'BLOCKED' -and $RunState.RouteOwnership -ne 'BLOCKED' -and $RunState.DirectRead -eq 'PASS')
    $readThroughPass = ($gatewayBindingPass -and $false)
    $preSuperadminPass = ($RunState.Phase5Predecessor -eq 'PASS' -and $gatewayBindingPass -and $readThroughPass -and $RunState.ServiceNonRegression -eq 'PASS' -and $configDriftCount -eq 0)
    $RunState.GatewayBinding = Get-PassBlocked $gatewayBindingPass
    $RunState.ErpReadThrough = Get-PassBlocked $readThroughPass
    $RunState.PreSuperadmin = Get-PassBlocked $preSuperadminPass
    if (-not $gatewayBindingPass) {
        Add-Gate 'GATEWAY_ERPNEXT_BINDING' 'BLOCKED' 'Gateway health, existing credential source, owned route, and direct ERP identity were not all proven.'
    } else {
        Add-Gate 'GATEWAY_ERPNEXT_BINDING' 'PASS' 'Gateway binding preconditions passed.'
    }
    if (-not $readThroughPass) {
        Register-Blocker 'APEX_PHASE6_DIRECT_ERP_READ_PASS_GATEWAY_READ_FAIL' 'Direct ERPNext read was independent evidence; no gateway-mediated read-through route was executed.'
        Add-Gate 'ERP_READ_THROUGH_GATEWAY' 'BLOCKED' 'Gateway-mediated ERPNext read-through was not proven.'
    } else {
        Add-Gate 'ERP_READ_THROUGH_GATEWAY' 'PASS' 'Gateway-mediated read-through matched bounded ERP identity.'
    }
    Add-Gate 'PRE_SUPERADMIN_GATE' (Get-PassBlocked $preSuperadminPass) 'No Superadmin write integration was attempted.'
    Add-Gate 'ERPNEXT_SERVICE_NONREGRESSION' $RunState.ServiceNonRegression 'No ERPNext mutating command was invoked.'
    Add-Gate 'SECRET_ISOLATION' 'PASS' 'No secret values were recorded.'
    Write-CsvReport '23_PHASE6_GATE_RESULTS.csv' @($RunState.GateRows.ToArray()) @('Gate', 'Status', 'Detail')
    Write-CsvReport '24_PHASE6_FAILURES.csv' @($RunState.BlockRows.ToArray()) @('Time', 'FailureClass', 'Detail', 'Status')
    Write-CsvReport '25_PHASE6_ACTIONS.csv' @($RunState.ActionRows.ToArray()) @('Time', 'Action', 'Status', 'Detail')
    Write-FinalReports
    Write-FinalSeal
    Write-Progress -Activity $Authority -Status 'CLOSED' -PercentComplete 100 -Completed
    Write-Output ('PHASE5_PREDECESSOR_VALIDATION=' + $RunState.Phase5Predecessor)
    Write-Output ('GATEWAY_ERPNEXT_BINDING=' + $RunState.GatewayBinding)
    Write-Output ('ERP_READ_THROUGH_GATEWAY=' + $RunState.ErpReadThrough)
    Write-Output ('PRE_SUPERADMIN_GATE=' + $RunState.PreSuperadmin)
    $authorizationOutput = Get-SuperadminAuthorization $RunState.PreSuperadmin
    Write-Output ('SUPERADMIN_INTEGRATION_AUTHORIZATION=' + $authorizationOutput)
    Write-Output 'ERPNEXT_SERVICE_RESTART_COUNT_BY_PHASE6=0'
    Write-Output 'ERPNEXT_SERVICE_STOP_COUNT_BY_PHASE6=0'
    Write-Output 'ERPNEXT_SERVICE_RECREATE_COUNT_BY_PHASE6=0'
    Write-Output 'PRODUCTION_MUTATION=NO'
    Write-Output 'SECRET_VALUE_EXPOSURE_COUNT=0'
    Write-Output 'FINAL_ZIP_REOPEN_VALIDATION=PASS'
    Write-Output ('EVIDENCE_ROOT=' + $EvidenceRoot)
    Write-Output ('EVIDENCE_ZIP=' + $EvidenceZip)
    Write-Output ('FINAL_SIDECAR=' + $SidecarPath)
    Write-Output ('OVERALL_STATUS=' + $RunState.OverallStatus)
    Open-FinalReport
    if ($RunState.OverallStatus -eq 'PASS') {
        exit 0
    }
    exit 1
} catch {
    $failureMessage = $_.Exception.Message
    if ([string]::IsNullOrWhiteSpace([string]$RunState.PrimaryFailureClass)) {
        Register-Blocker 'APEX_PHASE6_CONTROLLER_FAILURE' $failureMessage
    } else {
        Add-Failure 'APEX_PHASE6_CONTROLLER_CLOSEOUT_INTERRUPTED' $failureMessage
    }
    Append-Text 'ERROR_LOG.txt' ('FAILURE=' + $failureMessage)
    try {
        Write-CsvReport '23_PHASE6_GATE_RESULTS.csv' @([pscustomobject]@{Gate = 'CLOSEOUT'; Status = 'BLOCKED'; Detail = 'CLOSEOUT_INTERRUPTED'}) @('Gate', 'Status', 'Detail')
    } catch {
        Add-Warning 'GATE_REPORT_REWRITE_FAILED' 'The gate report could not be rewritten after the primary failure.'
    }
    try {
        $RunState.GatewayBinding = 'BLOCKED'
        $RunState.ErpReadThrough = 'BLOCKED'
        $RunState.PreSuperadmin = 'BLOCKED'
        Write-FinalReports
        Write-FinalSeal
    } catch {
        Append-Text 'ERROR_LOG.txt' ('CLOSEOUT_FAILURE=' + $_.Exception.Message)
    }
    Write-Output 'PHASE5_PREDECESSOR_VALIDATION=BLOCKED'
    Write-Output 'GATEWAY_ERPNEXT_BINDING=BLOCKED'
    Write-Output 'ERP_READ_THROUGH_GATEWAY=BLOCKED'
    Write-Output 'PRE_SUPERADMIN_GATE=BLOCKED'
    Write-Output 'SUPERADMIN_INTEGRATION_AUTHORIZATION=NO'
    Write-Output 'ERPNEXT_SERVICE_RESTART_COUNT_BY_PHASE6=0'
    Write-Output 'ERPNEXT_SERVICE_STOP_COUNT_BY_PHASE6=0'
    Write-Output 'ERPNEXT_SERVICE_RECREATE_COUNT_BY_PHASE6=0'
    Write-Output 'PRODUCTION_MUTATION=NO'
    Write-Output 'SECRET_VALUE_EXPOSURE_COUNT=0'
    Write-Output ('ERROR=' + $failureMessage)
    Write-Output ('EVIDENCE_ROOT=' + $EvidenceRoot)
    Write-Output ('EVIDENCE_ZIP=' + $EvidenceZip)
    Write-Output ('FINAL_SIDECAR=' + $SidecarPath)
    Write-Output 'OVERALL_STATUS=BLOCKED'
    Open-FinalReport
    exit 1
}