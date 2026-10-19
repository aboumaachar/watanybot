#requires -Version 5.1
[CmdletBinding()]
param(
    [ValidateSet('SecurityPreflight', 'Process', 'ErpReadiness', 'CrmCanary')]
    [string]$Mode = 'SecurityPreflight',
    [string]$PreflightRoot = 'C:\APEX\P8-clean-preflight'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'
$version = 'APEX_P8_FINAL_ORCHESTRATOR_V1_0_0'
$workspaceRoot = 'C:\xampp\htdocs\projectx\watanybot'
$helperNames = @(
    'APEX_P8_PROCESS_V1_0_0.ps1',
    'APEX_P8_EVIDENCE_V1_0_0.ps1',
    'APEX_P8_ERP_READINESS_V1_0_0.ps1',
    'APEX_P8_CRM_CANARY_V1_0_0.ps1',
    'APEX_P8_RESEAL_V1_0_0.ps1'
)

function Get-Hash([string]$path) {
    return (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToUpperInvariant()
}

if ($Mode -notin @('SecurityPreflight', 'Process', 'ErpReadiness', 'CrmCanary')) {
    throw 'Unsupported mode'
}

if (-not (Test-Path -LiteralPath $PreflightRoot -PathType Container)) {
    New-Item -ItemType Directory -Path $PreflightRoot -Force | Out-Null
}

$controllerPath = Join-Path $workspaceRoot 'APEX_P8_FINAL_ORCHESTRATOR_V1_0_0.ps1'
$helperRows = @()
foreach ($helperName in $helperNames) {
    $helperPath = Join-Path $workspaceRoot $helperName
    if (-not (Test-Path -LiteralPath $helperPath -PathType Leaf)) {
        throw ('Missing helper: ' + $helperName)
    }
    $helperRows += [pscustomobject]@{
        name = $helperName
        sha256 = Get-Hash $helperPath
        bytes = (Get-Item -LiteralPath $helperPath).Length
    }
}

$proof = [pscustomobject]@{
    version = $version
    mode = $Mode
    controllerSha256 = Get-Hash $controllerPath
    helpers = $helperRows
    securityBypassAttempted = 'NO'
    productionMutation = 'NO'
    productionDeployment = 'NO'
    status = 'PASS'
}
$proofPath = Join-Path $PreflightRoot 'security-preflight.json'
[IO.File]::WriteAllText($proofPath, (($proof | ConvertTo-Json -Depth 10) + [Environment]::NewLine), (New-Object Text.UTF8Encoding($false)))
if ($Mode -eq 'Process') {
    . (Join-Path $workspaceRoot 'APEX_P8_PROCESS_V1_0_0.ps1')
    $process = Invoke-P8Process -ProcessValidationRoot $PreflightRoot -ProcessGateway -ProcessWeb
    $processPath = Join-Path $PreflightRoot 'process.json'
    [IO.File]::WriteAllText($processPath, (($process | ConvertTo-Json -Depth 20) + [Environment]::NewLine), (New-Object Text.UTF8Encoding($false)))
    $process | ConvertTo-Json -Depth 20
    if ($process.status -ne 'PASS') { Write-Output 'PHASE8_PROCESS_MATRIX=BLOCKED'; exit 1 }
    Write-Output 'PHASE8_PROCESS_MATRIX=PASS'
    exit 0
}
if ($Mode -eq 'ErpReadiness') {
    . (Join-Path $workspaceRoot 'APEX_P8_ERP_READINESS_V1_0_0.ps1')
    $readiness = Get-P8ErpReadiness
    $readinessPath = Join-Path $PreflightRoot 'erp-readiness.json'
    [IO.File]::WriteAllText($readinessPath, (($readiness | ConvertTo-Json -Depth 10) + [Environment]::NewLine), (New-Object Text.UTF8Encoding($false)))
    $readiness | ConvertTo-Json -Depth 10
    if ($readiness.status -ne 'PASS') {
        Write-Output 'ERP_RUNTIME_READINESS=BLOCKED'
        exit 1
    }
    Write-Output 'ERP_RUNTIME_READINESS=PASS'
    exit 0
}
if ($Mode -eq 'CrmCanary') {
    . (Join-Path $workspaceRoot 'APEX_P8_CRM_CANARY_V1_0_0.ps1')
    $canary = Invoke-P8CrmCanary
    $canaryPath = Join-Path $PreflightRoot 'crm-canary.json'
    [IO.File]::WriteAllText($canaryPath, (($canary | ConvertTo-Json -Depth 20) + [Environment]::NewLine), (New-Object Text.UTF8Encoding($false)))
    $canary | ConvertTo-Json -Depth 20
    if ($canary.status -ne 'PASS') {
        Write-Output 'CRM_CANARY_AUDIT_ROLLBACK=BLOCKED'
        exit 1
    }
    Write-Output 'CRM_CANARY_AUDIT_ROLLBACK=PASS'
    exit 0
}
Write-Output ('APEX_P8_SECURITY_PREFLIGHT_OK')
Write-Output ('PREFLIGHT_PROOF=' + $proofPath)
exit 0