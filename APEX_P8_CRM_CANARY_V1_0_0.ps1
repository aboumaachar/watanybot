#requires -Version 5.1
[CmdletBinding()]
param()
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Invoke-P8CrmHttp([string]$method, [string]$uri, $body) {
	$request = [Net.HttpWebRequest]::Create((New-Object Uri($uri)))
	$request.Method = $method
	$request.Accept = 'application/json'
	$request.ContentType = 'application/json'
	$request.Headers['x-watany-role'] = 'superadmin'
	$request.Headers['x-apex-canary-run-id'] = $script:CanaryRunId
	$request.Timeout = 15000
	if ($null -ne $body) {
		$bytes = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress))
		$request.ContentLength = $bytes.Length
		$stream = $request.GetRequestStream()
		$stream.Write($bytes, 0, $bytes.Length)
		$stream.Dispose()
	}
	try {
		$response = $request.GetResponse()
		$statusCode = [int]$response.StatusCode
		$reader = New-Object IO.StreamReader($response.GetResponseStream())
		$text = $reader.ReadToEnd()
		$reader.Dispose()
		$response.Dispose()
	} catch [Net.WebException] {
		$statusCode = 0
		$text = ''
		if ($null -ne $_.Exception.Response) {
			$errorResponse = [Net.HttpWebResponse]$_.Exception.Response
			$statusCode = [int]$errorResponse.StatusCode
			$reader = New-Object IO.StreamReader($errorResponse.GetResponseStream())
			$text = $reader.ReadToEnd()
			$reader.Dispose()
			$errorResponse.Dispose()
		}
	}
	$payload = [pscustomobject]@{}
	if (-not [string]::IsNullOrWhiteSpace($text)) {
		try { $payload = $text | ConvertFrom-Json } catch { $payload = [pscustomobject]@{} }
	}
	return [pscustomobject]@{ statusCode = $statusCode; payload = $payload }
}

function Get-P8Items($response) {
	if ($null -ne $response.payload -and $null -ne $response.payload.PSObject.Properties['items']) { return @($response.payload.items) }
	return @()
}

function Invoke-P8CrmCanary {
	$gateway = if ([string]::IsNullOrWhiteSpace($env:GATEWAY_BASE_URL)) { 'http://127.0.0.1:8010' } else { $env:GATEWAY_BASE_URL.TrimEnd('/') }
	$script:CanaryRunId = ('APEX-P8-FINAL-CANARY-' + [guid]::NewGuid().ToString('N')).Substring(0, 32)
	$prefix = 'APEX-P8-FINAL-CANARY-'
	$encodedName = ''
	$createdName = ''
	$created = $false
	$cleanup = 'NOT_REQUIRED'
	$events = @()
	try {
		$baseline = Invoke-P8CrmHttp 'GET' ($gateway + '/api/admin-authority/crm/contacts?limit=200') $null
		$baselineResidue = @(Get-P8Items $baseline | Where-Object { [string]$_.first_name -like ($prefix + '*') }).Count
		if ($baseline.statusCode -ne 200 -or $baselineResidue -ne 0) { throw 'baseline residue or list read blocked' }

		$create = Invoke-P8CrmHttp 'POST' ($gateway + '/api/admin-authority/crm/contacts/canary') @{ runId = $script:CanaryRunId; namespace = 'PHASE8' }
		$createdName = [string]$create.payload.item.name
		$created = ($create.statusCode -eq 201 -and [string]$create.payload.marker -like ($prefix + '*') -and $createdName -ne '')
		if (-not $created) { throw 'create blocked' }
		$encodedName = [Uri]::EscapeDataString($createdName)

		$read = Invoke-P8CrmHttp 'GET' ($gateway + '/api/admin-authority/crm/contacts/' + $encodedName) $null
		if ($read.statusCode -ne 200 -or [string]$read.payload.item.name -ne $createdName) { throw 'read blocked' }
		$update = Invoke-P8CrmHttp 'PATCH' ($gateway + '/api/admin-authority/crm/contacts/' + $encodedName) @{ last_name = 'APEX-P8-UPDATED' }
		if ($update.statusCode -ne 200) { throw 'update blocked' }
		$readback = Invoke-P8CrmHttp 'GET' ($gateway + '/api/admin-authority/crm/contacts/' + $encodedName) $null
		if ($readback.statusCode -ne 200 -or [string]$readback.payload.item.last_name -ne 'APEX-P8-UPDATED') { throw 'readback blocked' }

		$audit = Invoke-P8CrmHttp 'GET' ($gateway + '/api/admin-authority/audit-events?limit=200') $null
		$events = if ($null -ne $audit.payload -and $null -ne $audit.payload.PSObject.Properties['events']) { @($audit.payload.events) } else { @() }
		$auditMatch = @($events | Where-Object {
			$afterProperty = $_.PSObject.Properties['after']
			$after = if ($null -ne $afterProperty) { $afterProperty.Value } else { $null }
			$runIdProperty = if ($null -ne $after) { $after.PSObject.Properties['runId'] } else { $null }
			$namespaceProperty = if ($null -ne $after) { $after.PSObject.Properties['canaryNamespace'] } else { $null }
			$null -ne $runIdProperty -and $null -ne $namespaceProperty -and [string]$runIdProperty.Value -eq $script:CanaryRunId -and [string]$namespaceProperty.Value -eq 'PHASE8_OWNED'
		}).Count
		if ($audit.statusCode -ne 200 -or $auditMatch -lt 2) { throw 'audit correlation blocked' }

		$delete = Invoke-P8CrmHttp 'DELETE' ($gateway + '/api/admin-authority/crm/contacts/' + $encodedName) $null
		if ($delete.statusCode -ne 200) { throw 'delete blocked' }
		$created = $false
		$afterDelete = Invoke-P8CrmHttp 'GET' ($gateway + '/api/admin-authority/crm/contacts/' + $encodedName) $null
		if ($afterDelete.statusCode -notin @(404, 502)) { throw 'after-delete verification blocked' }
		$final = Invoke-P8CrmHttp 'GET' ($gateway + '/api/admin-authority/crm/contacts?limit=200') $null
		$finalResidue = @(Get-P8Items $final | Where-Object { [string]$_.first_name -like ($prefix + '*') }).Count
		if ($final.statusCode -ne 200 -or $finalResidue -ne 0) { throw 'final residue blocked' }
		return [pscustomobject]@{ runId = $script:CanaryRunId; markerPrefix = $prefix; baselineResidue = 0; create = 'PASS'; read = 'PASS'; update = 'PASS'; readback = 'PASS'; audit = 'PASS'; delete = 'PASS'; afterDelete = 'PASS'; finalResidue = 0; realBusinessRecordMutation = 'NO'; cleanup = 'NOT_REQUIRED'; status = 'PASS' }
	} catch {
		if ($created -and $createdName -ne '') {
			$cleanupResponse = Invoke-P8CrmHttp 'DELETE' ($gateway + '/api/admin-authority/crm/contacts/' + $encodedName) $null
			$cleanup = if ($cleanupResponse.statusCode -eq 200) { 'PASS' } else { 'BLOCKED' }
		}
		return [pscustomobject]@{ runId = $script:CanaryRunId; markerPrefix = $prefix; error = $_.Exception.Message; cleanup = $cleanup; realBusinessRecordMutation = 'NO'; status = 'BLOCKED' }
	}
}