[CmdletBinding()]
param(
    [string]$GatewayBaseUrl = 'http://127.0.0.1:8010'
)
$ErrorActionPreference = 'Stop'
$routes = @(
    @{ Method='GET'; Path='/api/admin-authority/proof/view'; Expected='401_OR_403_WITHOUT_AUTH' },
    @{ Method='POST'; Path='/api/admin-authority/proof/mutate'; Expected='401_OR_403_WITHOUT_AUTH' },
    @{ Method='GET'; Path='/api/admin-authority/proof/audit-events'; Expected='401_OR_403_WITHOUT_AUTH' },
    @{ Method='GET'; Path='/api/admin-authority/proof/approval-requests'; Expected='401_OR_403_WITHOUT_AUTH' }
)
foreach ($route in $routes) {
    $uri = $GatewayBaseUrl.TrimEnd('/') + $route.Path
    try {
        if ($route.Method -eq 'POST') {
            $response = Invoke-WebRequest -UseBasicParsing -Method POST -Uri $uri -ContentType 'application/json' -Body '{}' -ErrorAction Stop
        } else {
            $response = Invoke-WebRequest -UseBasicParsing -Method GET -Uri $uri -ErrorAction Stop
        }
        [pscustomobject]@{ Method=$route.Method; Uri=$uri; StatusCode=$response.StatusCode; Result='REVIEW_UNAUTH_RETURNED_SUCCESS' }
    } catch {
        $statusCode = ''
        try { $statusCode = [string]$_.Exception.Response.StatusCode.value__ } catch { $statusCode = '' }
        $result = 'REVIEW'
        if ($statusCode -eq '401' -or $statusCode -eq '403') { $result = 'PASS_BLOCKED_WITHOUT_AUTH' }
        [pscustomobject]@{ Method=$route.Method; Uri=$uri; StatusCode=$statusCode; Result=$result }
    }
}
