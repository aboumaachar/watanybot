#requires -Version 5.1
[CmdletBinding()]
param(
	[string]$EvidenceRoot = 'C:\APEX\P8-evidence',
	[string]$ZipPath = 'C:\APEX\P8-evidence.zip'
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Invoke-P8Reseal {
	param([string]$Root = $EvidenceRoot, [string]$Archive = $ZipPath)
	if (-not (Test-Path -LiteralPath $Root -PathType Container)) { throw ('Evidence root missing: ' + $Root) }
	Add-Type -AssemblyName System.IO.Compression
	Add-Type -AssemblyName System.IO.Compression.FileSystem
	if (Test-Path -LiteralPath $Archive) { Remove-Item -LiteralPath $Archive -Force }
	[IO.Compression.ZipFile]::CreateFromDirectory($Root, $Archive)
	$archiveHash = (Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToUpperInvariant()
	$zip = [IO.Compression.ZipFile]::OpenRead($Archive)
	try {
		$entries = @($zip.Entries | Select-Object -ExpandProperty FullName)
		$required = @('FINAL_STATUS.txt', 'AUTHORITY_CLOSEOUT_TOKEN.txt', 'evidence-manifest.json')
		$missing = @($required | Where-Object { $_ -notin $entries })
		$status = if ($missing.Count -eq 0) { 'PASS' } else { 'BLOCKED' }
	} finally { $zip.Dispose() }
	$sidecar = $Archive + '.final-reopen-validation.json'
	[IO.File]::WriteAllText($sidecar, (($([pscustomobject]@{ zip = $Archive; sha256 = $archiveHash; zipReopen = $status; entryMembership = if ($missing.Count -eq 0) { 'PASS' } else { 'BLOCKED' }; missing = $missing } | ConvertTo-Json -Depth 10)) + [Environment]::NewLine), (New-Object Text.UTF8Encoding($false)))
	return [pscustomobject]@{ archive = $Archive; sha256 = $archiveHash; status = $status; sidecar = $sidecar }
}