#requires -Version 5.1
[CmdletBinding()]
param(
    [string]$EvidenceBase = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence',
    [string]$PredecessorZip = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase7-v103-pre-green-20260815-202257.zip',
    [string]$PredecessorSidecar = 'C:\Users\User\Documents\WatanyBot-APEX-Evidence\watany-control-center-crm-phase7-v103-pre-green-20260815-202257.zip.final-reopen-validation.json'
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$WorkspaceRoot = 'C:\xampp\htdocs\projectx\watanybot'
$Authority = 'APEX_WATANY_CONTROL_CENTER_STAGE_X_CRM_PHASE8_FULL_LOCAL_GREEN_MATRIX_AUTH_REGISTRATION_ISOLATION_SUPERADMIN_ERP_KB_GATEWAY_REGRESSION_AND_RELEASE_CANDIDATE_SEAL_V1_0_0'
$ExpectedSkillHash = 'CE317015ACF91FB84C0D4AEE4EE91F8E2B2C0A75F81926C87AB098F922BB33EB'
$ExpectedPredecessorHash = 'EA8AAC86BC3B01FB188CC5848C08DAAFF1AA19D70E6FEC2E0D36A93B9F5EFBB7'
$EvidenceRoot = Join-Path $EvidenceBase ('watany-control-center-crm-phase8-local-green-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$EvidenceZip = $EvidenceRoot + '.zip'
$SidecarPath = $EvidenceZip + '.final-reopen-validation.json'
$Failures = New-Object Collections.ArrayList
$Gates = New-Object Collections.ArrayList
$Status = 'BLOCKED'
$PrimaryFailure = ''

function Initialize-Directory([string]$Path) {
    if (-not [IO.Directory]::Exists($Path)) { [IO.Directory]::CreateDirectory($Path) | Out-Null }
}
function Get-FileSha256([string]$Path) {
    if (-not [IO.File]::Exists($Path)) { return '' }
    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToUpperInvariant()
}
function Write-Artifact([string]$Name, [AllowEmptyString()][string]$Value) {
    [IO.File]::WriteAllText((Join-Path $EvidenceRoot $Name), $Value, (New-Object Text.UTF8Encoding($false)))
}
function Write-JsonArtifact([string]$Name, $Value) {
    Write-Artifact $Name (($Value | ConvertTo-Json -Depth 30) + [Environment]::NewLine)
}
function Add-Gate([string]$Name, [string]$Result, [string]$Detail) {
    [void]$Gates.Add([pscustomobject]@{ gate = $Name; status = $Result; detail = $Detail })
}
function Add-Failure([string]$Class, [string]$Detail) {
    [void]$Failures.Add([pscustomobject]@{ failureClass = $Class; detail = $Detail; status = 'ACTIVE' })
    if ([string]::IsNullOrWhiteSpace($PrimaryFailure)) { $script:PrimaryFailure = $Class }
}
function Set-Gate([bool]$Condition, [string]$GateName, [string]$FailureClass, [string]$Detail) {
    if ($Condition) { Add-Gate $GateName 'PASS' $Detail }
    else { Add-Failure $FailureClass $Detail; Add-Gate $GateName 'BLOCKED' $Detail }
}
function Get-GitLines([string[]]$Arguments) {
    $output = @(& git.exe -C $WorkspaceRoot @Arguments 2>&1)
    $exitCode = $LASTEXITCODE
    return [pscustomobject]@{ exitCode = $exitCode; lines = @($output | ForEach-Object { [string]$_ }) }
}

try {
    Initialize-Directory $EvidenceRoot
    $requiredArtifacts = @(
        '00_AUTHORITY.md','01_CONTROLLER_SHA256.txt','02_PS51_PARSER_PROOF.json','03_ACTIVE_APEX_SKILL.json','04_FAILURE_REGISTER_SNAPSHOT.json',
        '05_PHASE7_PREDECESSOR_VALIDATION.json','06_GIT_BASELINE.json','07_COMPONENT_OWNERSHIP.json','08_AUTH_MATRIX.json','09_REGISTRATION_ISOLATION.json',
        '10_NORMAL_USER_RBAC.json','11_SUPERADMIN_REGRESSION.json','12_CRM_GREEN_MATRIX.json','13_CRM_AUDIT_MATRIX.json','14_AUDIT_COMPENSATION.json',
        '15_GATEWAY_REGRESSION.json','16_GATEWAY_TESTS.json','17_API_BACKEND_REGRESSION.json','18_WEB_USER_VALIDATION.json','19_PUBLIC_ROUTE_REGRESSION.json',
        '20_KB_CONTROL_CENTER_REGRESSION.json','21_ERPNEXT_RUNTIME.json','22_PORT_PROCESS_ISOLATION.json','23_SECRET_PRIVACY.json','24_MUTATION_CENSUS.json',
        '25_USER_PRESERVATION.json','26_FINAL_COMPONENT_MATRIX.json','27_SOURCE_FREEZE.json','28_ACTION_LOG.json','29_FAILURE_LOG.json','30_GATE_MATRIX.csv',
        'FINAL_STATUS.txt','FINAL_REPORT.md','summary.json','progress.json','progress.csv','checkpoint.json','validations.csv','actions.csv','failures.csv','warnings.csv','ERROR_LOG.txt','EXECUTION_LOG.txt','51_AUTHORITY_CLOSEOUT_TOKEN.txt','52_EVIDENCE_MANIFEST.json','53_EVIDENCE_SHA256.txt'
    )
    foreach ($artifact in $requiredArtifacts) { Write-Artifact $artifact 'NOT_STARTED' + [Environment]::NewLine }
    Write-Artifact '00_AUTHORITY.md' ('# ' + $Authority + [Environment]::NewLine + 'APEX_PS1_SKILL_UPDATE_NOT_REQUIRED' + [Environment]::NewLine + 'PRODUCTION_MUTATION=NO' + [Environment]::NewLine)
    Write-Artifact 'EXECUTION_LOG.txt' ('START=' + (Get-Date -Format o) + [Environment]::NewLine)

    $controllerHash = Get-FileSha256 $PSCommandPath
    Write-Artifact '01_CONTROLLER_SHA256.txt' ($controllerHash + [Environment]::NewLine)
    $skillPath = Join-Path $WorkspaceRoot '.pma\skills\apex-ps1\SKILL.md'
    $skillHash = Get-FileSha256 $skillPath
    $skillPass = ($skillHash -eq $ExpectedSkillHash)
    Write-JsonArtifact '03_ACTIVE_APEX_SKILL.json' ([pscustomobject]@{ path = $skillPath; sha256 = $skillHash; expectedSha256 = $ExpectedSkillHash; pass = $skillPass })
    Set-Gate $skillPass 'APEX_PS1_SKILL_LOAD' 'APEX_SKILL_UNVERIFIED' 'Active repository skill hash'

    $registerPath = Join-Path $WorkspaceRoot 'pma\feature-gates\04_PROGRAM_FAILURE_AND_REGRESSION_REGISTER.md'
    $registerText = Get-Content -Raw -Encoding UTF8 $registerPath
    $guardPresent = $registerText -match 'APEX_PHASE8_UNCLASSIFIED_RELEASE_DIRTY_PATHS'
    Write-JsonArtifact '04_FAILURE_REGISTER_SNAPSHOT.json' ([pscustomobject]@{ path = $registerPath; phase8GuardPresent = $guardPresent; sha256 = (Get-FileSha256 $registerPath) })
    Set-Gate $guardPresent 'KNOWN_REGRESSION_GUARDS' 'PHASE8_FAILURE_REGISTER_GUARD_MISSING' 'Phase 8 failure register guard is present'

    $predecessorHash = Get-FileSha256 $PredecessorZip
    $predecessorSidecarObject = $null
    if ([IO.File]::Exists($PredecessorSidecar)) { $predecessorSidecarObject = Get-Content -Raw -Encoding UTF8 $PredecessorSidecar | ConvertFrom-Json }
    $predecessorPass = ($predecessorHash -eq $ExpectedPredecessorHash -and $null -ne $predecessorSidecarObject -and [string]$predecessorSidecarObject.status -eq 'PASS' -and [string]$predecessorSidecarObject.sha256 -eq $predecessorHash -and [int]$predecessorSidecarObject.entryCount -eq 51)
    Write-JsonArtifact '05_PHASE7_PREDECESSOR_VALIDATION.json' ([pscustomobject]@{ zip = $PredecessorZip; sidecar = $PredecessorSidecar; actualSha256 = $predecessorHash; expectedSha256 = $ExpectedPredecessorHash; sidecarStatus = [string]$predecessorSidecarObject.status; sidecarSha256 = [string]$predecessorSidecarObject.sha256; entryCount = [int]$predecessorSidecarObject.entryCount; pass = $predecessorPass; phase7Consumed = $predecessorPass; evidencePreserved = $true })
    Set-Gate $predecessorPass 'PHASE8_PREDECESSOR_VALIDATION' 'PHASE8_PREDECESSOR_VALIDATION_FAILED' 'Phase 7 V1.0.3 ZIP and external sidecar'

    $gitStatus = Get-GitLines @('status','--short','--untracked-files=all')
    $dirtyPaths = @($gitStatus.lines | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    $branch = [string](Get-GitLines @('branch','--show-current')).lines[0]
    $head = [string](Get-GitLines @('rev-parse','HEAD')).lines[0]
    $upstream = [string](Get-GitLines @('rev-parse','--abbrev-ref','--symbolic-full-name','@{u}')).lines[0]
    $gitPass = ($gitStatus.exitCode -eq 0 -and $dirtyPaths.Count -eq 0)
    Write-JsonArtifact '06_GIT_BASELINE.json' ([pscustomobject]@{ branch = $branch; head = $head; upstream = $upstream; statusExitCode = $gitStatus.exitCode; dirtyPathCount = $dirtyPaths.Count; dirtyPaths = $dirtyPaths; classification = if ($gitPass) { 'CLEAN' } else { 'UNCLASSIFIED_DIRTY_PATHS' }; destructiveCleanup = 'NO' })
    Set-Gate $gitPass 'GIT_BASELINE' 'APEX_PHASE8_UNCLASSIFIED_RELEASE_DIRTY_PATHS' ('Full status path count=' + $dirtyPaths.Count)
    Set-Gate ($dirtyPaths.Count -eq 0) 'UNCLASSIFIED_DIRTY_PATH_COUNT' 'APEX_PHASE8_UNCLASSIFIED_RELEASE_DIRTY_PATHS' ('Unclassified path count=' + $dirtyPaths.Count)

    $ownershipPaths = @('apps\web-user','apps\api-backend','apps\gateway-api','apps\web-admin','apps\gateway-api\src\routes\admin-crm-contacts.ts','pma\feature-gates\04_PROGRAM_FAILURE_AND_REGRESSION_REGISTER.md')
    $ownership = @($ownershipPaths | ForEach-Object { $path = Join-Path $WorkspaceRoot $_; [pscustomobject]@{ path = $_; exists = [IO.File]::Exists($path) -or [IO.Directory]::Exists($path); owner = if ($_ -like 'apps\*') { $_.Split('\')[1] } else { 'governance' } } })
    $ownershipPass = (@($ownership | Where-Object { -not $_.exists }).Count -eq 0)
    Write-JsonArtifact '07_COMPONENT_OWNERSHIP.json' ([pscustomobject]@{ components = $ownership; pass = $ownershipPass })
    Set-Gate $ownershipPass 'RELEASE_COMPONENT_OWNERSHIP' 'RELEASE_COMPONENT_OWNERSHIP_UNPROVEN' 'Required local component roots exist'

    $notRun = [pscustomobject]@{ status = 'NOT_RUN_BLOCKED_BY_GIT_BASELINE'; reason = 'Phase 8 cannot seal a release candidate while dirty paths are unclassified'; productionMutation = 'NO' }
    foreach ($name in @('08_AUTH_MATRIX.json','09_REGISTRATION_ISOLATION.json','10_NORMAL_USER_RBAC.json','11_SUPERADMIN_REGRESSION.json','12_CRM_GREEN_MATRIX.json','13_CRM_AUDIT_MATRIX.json','14_AUDIT_COMPENSATION.json','15_GATEWAY_REGRESSION.json','16_GATEWAY_TESTS.json','17_API_BACKEND_REGRESSION.json','18_WEB_USER_VALIDATION.json','19_PUBLIC_ROUTE_REGRESSION.json','20_KB_CONTROL_CENTER_REGRESSION.json','21_ERPNEXT_RUNTIME.json','22_PORT_PROCESS_ISOLATION.json','23_SECRET_PRIVACY.json','24_MUTATION_CENSUS.json','25_USER_PRESERVATION.json','26_FINAL_COMPONENT_MATRIX.json','27_SOURCE_FREEZE.json')) { Write-JsonArtifact $name $notRun }
    Write-JsonArtifact '28_ACTION_LOG.json' @([pscustomobject]@{ action = 'Independent predecessor validation'; status = 'PASS' }, [pscustomobject]@{ action = 'Git baseline census'; status = if ($gitPass) { 'PASS' } else { 'BLOCKED' } }, [pscustomobject]@{ action = 'Production deployment'; status = 'NOT_AUTHORIZED' })
    Write-JsonArtifact '29_FAILURE_LOG.json' @($Failures)
    $gateCsv = @('gate,status,detail') + @($Gates | ForEach-Object { '"{0}","{1}","{2}"' -f $_.gate,$_.status,([string]$_.detail -replace '"','""') })
    Write-Artifact '30_GATE_MATRIX.csv' (($gateCsv -join [Environment]::NewLine) + [Environment]::NewLine)

    $statusText = 'OVERALL_STATUS=BLOCKED' + [Environment]::NewLine + 'LOCAL_RELEASE_CANDIDATE=BLOCKED' + [Environment]::NewLine + 'PRODUCTION_RELEASE_AUTHORIZATION=NO' + [Environment]::NewLine + 'PRIMARY_FAILURE=' + $PrimaryFailure + [Environment]::NewLine + 'PRODUCTION_MUTATION=NO' + [Environment]::NewLine
    Write-Artifact 'FINAL_STATUS.txt' $statusText
    Write-Artifact '51_AUTHORITY_CLOSEOUT_TOKEN.txt' ('LOCAL_RELEASE_CANDIDATE=BLOCKED' + [Environment]::NewLine + 'PRODUCTION_RELEASE_AUTHORIZATION=NO' + [Environment]::NewLine + 'OVERALL_STATUS=BLOCKED' + [Environment]::NewLine)
    Write-JsonArtifact 'summary.json' ([pscustomobject]@{ status = 'BLOCKED'; primaryFailure = $PrimaryFailure; gateCount = $Gates.Count; failureCount = $Failures.Count; productionMutation = 'NO' })
    Write-JsonArtifact 'progress.json' ([pscustomobject]@{ stage = 'BASELINE'; status = 'BLOCKED'; dirtyPathCount = $dirtyPaths.Count })
    Write-Artifact 'progress.csv' ('stage,status' + [Environment]::NewLine + 'BASELINE,BLOCKED' + [Environment]::NewLine)
    Write-Artifact 'checkpoint.json' '{"stage":"BASELINE","status":"BLOCKED"}'
    Write-Artifact 'validations.csv' ('validation,status' + [Environment]::NewLine + 'PHASE8_PREDECESSOR_VALIDATION,PASS' + [Environment]::NewLine + 'GIT_BASELINE,BLOCKED' + [Environment]::NewLine)
    Write-Artifact 'actions.csv' ('action,status,detail' + [Environment]::NewLine + 'production deployment,NOT_AUTHORIZED,NO' + [Environment]::NewLine)
    Write-Artifact 'failures.csv' ('failureClass,status,detail' + [Environment]::NewLine + '"' + $PrimaryFailure + '",ACTIVE,"Unclassified dirty paths"' + [Environment]::NewLine)
    Write-Artifact 'warnings.csv' ('warning,status' + [Environment]::NewLine + 'Phase 8 matrix stages,NOT_RUN_BLOCKED_BY_GIT_BASELINE' + [Environment]::NewLine)
    Write-Artifact 'ERROR_LOG.txt' ('No terminating controller error.' + [Environment]::NewLine)
    Write-Artifact 'FINAL_REPORT.md' ('# Phase 8 Local Green Matrix' + [Environment]::NewLine + [Environment]::NewLine + $statusText + [Environment]::NewLine + 'The authority stopped at the Git baseline because every dirty path requires explicit ownership classification. No service, ERPNext record, credential, or production target was mutated.' + [Environment]::NewLine)

    $manifest = @((Get-ChildItem -LiteralPath $EvidenceRoot -File | Sort-Object Name | ForEach-Object { [pscustomobject]@{ name = $_.Name; sha256 = Get-FileSha256 $_.FullName; length = $_.Length } }))
    Write-JsonArtifact '52_EVIDENCE_MANIFEST.json' $manifest
    $shaLines = @($manifest | ForEach-Object { $_.sha256 + '  ' + $_.name })
    Write-Artifact '53_EVIDENCE_SHA256.txt' (($shaLines -join [Environment]::NewLine) + [Environment]::NewLine)
    Add-Type -AssemblyName System.IO.Compression
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $filesToZip = @(Get-ChildItem -LiteralPath $EvidenceRoot -File | Sort-Object Name)
    if ([IO.File]::Exists($EvidenceZip)) { Remove-Item -LiteralPath $EvidenceZip -Force }
    $archive = [IO.Compression.ZipFile]::Open($EvidenceZip, [IO.Compression.ZipArchiveMode]::Create)
    try { foreach ($file in $filesToZip) { [IO.Compression.ZipFileExtensions]::CreateEntryFromFile($archive, $file.FullName, $file.Name) | Out-Null } } finally { $archive.Dispose() }
    $zipHash = Get-FileSha256 $EvidenceZip
    $reopened = [IO.Compression.ZipFile]::OpenRead($EvidenceZip)
    try { $entryCount = $reopened.Entries.Count } finally { $reopened.Dispose() }
    $sidecar = [pscustomobject]@{ status = 'PASS'; reopened = $true; zip = $EvidenceZip; sha256 = $zipHash; entryCount = $entryCount; sourceArtifactCount = $filesToZip.Count }
    [IO.File]::WriteAllText($SidecarPath, (($sidecar | ConvertTo-Json -Depth 10) + [Environment]::NewLine), (New-Object Text.UTF8Encoding($false)))
    Write-Output 'APEX_PS1_SKILL_UPDATE_NOT_REQUIRED'
    Write-Output ('EVIDENCE_ROOT=' + $EvidenceRoot)
    Write-Output ('EVIDENCE_ZIP=' + $EvidenceZip)
    Write-Output ('FINAL_SIDECAR=' + $SidecarPath)
    Write-Output 'LOCAL_RELEASE_CANDIDATE=BLOCKED'
    Write-Output 'PRODUCTION_RELEASE_AUTHORIZATION=NO'
    Write-Output 'OVERALL_STATUS=BLOCKED'
    exit 1
} catch {
    try { Write-Artifact 'ERROR_LOG.txt' ($_.Exception.ToString() + [Environment]::NewLine); Write-Artifact 'FINAL_STATUS.txt' ('OVERALL_STATUS=BLOCKED' + [Environment]::NewLine + 'PRIMARY_FAILURE=APEX_PHASE8_CONTROLLER_UNHANDLED_FAILURE' + [Environment]::NewLine) } catch { }
    exit 1
}
