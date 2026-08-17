#requires -Version 5.1
[CmdletBinding()]
param()
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Get-P8ErpReadiness {
	$baseUrlText = if ([string]::IsNullOrWhiteSpace($env:ERPNEXT_BASE_URL)) { 'http://127.0.0.1:18080' } else { $env:ERPNEXT_BASE_URL.Trim() }
	$siteName = if ([string]::IsNullOrWhiteSpace($env:ERPNEXT_SITE_NAME)) { 'frontend' } else { $env:ERPNEXT_SITE_NAME.Trim() }
	$credentialFile = if ([string]::IsNullOrWhiteSpace($env:ERPNEXT_CREDENTIAL_FILE)) { 'C:\Users\User\AppData\Local\WatanyControlCenter\secrets\erpnext-gateway.local.json' } else { $env:ERPNEXT_CREDENTIAL_FILE.Trim() }
	$endpointResolved = $false
	$portReachable = $false
	$authRead = 'BLOCKED'
	$principalPresent = $false
	$httpStatus = 0
	$uri = $null
	try {
		$uri = New-Object Uri($baseUrlText)
		$endpointResolved = ($uri.Scheme -in @('http', 'https') -and $uri.Host -ne '' -and $uri.Port -gt 0)
	} catch {
		$endpointResolved = $false
	}
	if ($endpointResolved) {
		$client = New-Object Net.Sockets.TcpClient
		try {
			$connect = $client.BeginConnect($uri.Host, $uri.Port, $null, $null)
			$portReachable = $connect.AsyncWaitHandle.WaitOne(2000)
			if ($portReachable) { $client.EndConnect($connect) }
		} catch {
			$portReachable = $false
		} finally {
			$client.Dispose()
		}
	}
	$credentialPresent = ($credentialFile -ne '' -and (Test-Path -LiteralPath $credentialFile -PathType Leaf))
	if ($portReachable -and $credentialPresent) {
		try {
			$credential = Get-Content -LiteralPath $credentialFile -Raw -Encoding UTF8 | ConvertFrom-Json
			$request = [Net.HttpWebRequest]::Create((New-Object Uri($baseUrlText + '/api/method/frappe.auth.get_logged_user')))
			$request.Method = 'GET'
			$request.Accept = 'application/json'
			$request.Host = $siteName
			$request.Timeout = 5000
			$request.Headers['Authorization'] = 'token ' + [string]$credential.apiKey + ':' + [string]$credential.apiSecret
			$response = $request.GetResponse()
			$httpStatus = [int]$response.StatusCode
			$reader = New-Object IO.StreamReader($response.GetResponseStream())
			$body = $reader.ReadToEnd()
			$reader.Dispose()
			$response.Dispose()
			$payload = $body | ConvertFrom-Json
			$principalPresent = ($httpStatus -ge 200 -and $httpStatus -lt 300 -and -not [string]::IsNullOrWhiteSpace([string]$payload.message))
			if ($principalPresent) { $authRead = 'PASS' }
		} catch {
			$authRead = 'BLOCKED'
		}
	}
	$status = 'BLOCKED'
	if ($endpointResolved -and $portReachable -and $credentialPresent -and $authRead -eq 'PASS') { $status = 'PASS' }
	return [pscustomobject]@{
		endpoint = $baseUrlText
		site = $siteName
		endpointResolved = $endpointResolved
		tcpReachability = if ($portReachable) { 'PASS' } else { 'BLOCKED' }
		credentialSourcePresent = if ($credentialPresent) { 'YES' } else { 'NO' }
		credentialValueExposed = 'NO'
		authenticatedRead = $authRead
		authenticatedPrincipalPresent = if ($principalPresent) { 'YES' } else { 'NO' }
		httpStatus = $httpStatus
		status = $status
	}
}