param(
  [string]$GatewayBaseUrl = "http://127.0.0.1:8010",
  [string]$AdminToken = ""
)

$ErrorActionPreference = "Stop"
$headers = @{}
if ($AdminToken -ne "") { $headers["Authorization"] = "Bearer $AdminToken" }
$uri = ($GatewayBaseUrl.TrimEnd("/") + "/api/admin/opportunities/crawl-runs/daily")
Invoke-RestMethod -Method Post -Uri $uri -Headers $headers | ConvertTo-Json -Depth 8