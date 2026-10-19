#requires -Version 5.1
[CmdletBinding()]
param(
	[string]$EvidenceRoot = 'C:\APEX\P8-evidence',
	[string]$Status = 'BLOCKED',
	[string]$Blocker = 'Mandatory Phase 8 evidence gates are incomplete'
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Write-P8Evidence {
	param([string]$Root = $EvidenceRoot, [string]$FinalStatus = $Status, [string]$Reason = $Blocker)
	New-Item -ItemType Directory -Path $Root -Force | Out-Null
	$statusText = @(
		'PHASE8_EVIDENCE_STATUS=' + $FinalStatus
		'REASON=' + $Reason
		'PRODUCTION_DEPLOYMENT=NO'
		'PRODUCTION_MUTATION=NO'
	) -join [Environment]::NewLine
	[IO.File]::WriteAllText((Join-Path $Root 'FINAL_STATUS.txt'), $statusText + [Environment]::NewLine, (New-Object Text.UTF8Encoding($false)))
	[IO.File]::WriteAllText((Join-Path $Root 'AUTHORITY_CLOSEOUT_TOKEN.txt'), ('PHASE8_CLOSEOUT=' + $FinalStatus + [Environment]::NewLine), (New-Object Text.UTF8Encoding($false)))
	[IO.File]::WriteAllText((Join-Path $Root 'evidence-manifest.json'), ((Get-ChildItem -LiteralPath $Root -File | Select-Object -ExpandProperty Name | ConvertTo-Json) + [Environment]::NewLine), (New-Object Text.UTF8Encoding($false)))
	return [pscustomobject]@{ root = $Root; status = $FinalStatus; blocker = $Reason; artifactCount = @(Get-ChildItem -LiteralPath $Root -File).Count }
}