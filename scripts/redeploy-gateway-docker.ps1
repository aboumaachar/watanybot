Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Get-ContainerEnvMap {
  param(
    [Parameter(Mandatory = $true)]
    [string] $ContainerName
  )

  $lines = docker inspect $ContainerName --format "{{range .Config.Env}}{{println .}}{{end}}" 2>$null
  if ($LASTEXITCODE -ne 0 -or -not $lines) {
    return @{}
  }

  $map = @{}
  foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) {
      continue
    }

    $parts = $line -split "=", 2
    if ($parts.Count -eq 2) {
      $map[$parts[0]] = $parts[1]
    }
  }

  return $map
}

function Get-RedisPassword {
  $raw = docker inspect watany-redis --format "{{json .Config.Cmd}}" 2>$null
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($raw)) {
    return $null
  }

  $cmd = $raw | ConvertFrom-Json
  for ($index = 0; $index -lt $cmd.Count; $index++) {
    if ($cmd[$index] -eq "--requirepass" -and ($index + 1) -lt $cmd.Count) {
      return $cmd[$index + 1]
    }
  }

  return $null
}

function Get-ProcessEnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Name
  )

  return [Environment]::GetEnvironmentVariable($Name, "Process")
}

function Set-ProcessEnvValue {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Name,
    [AllowNull()]
    [string] $Value
  )

  [Environment]::SetEnvironmentVariable($Name, $Value, "Process")
}

function Set-EnvIfMissing {
  param(
    [Parameter(Mandatory = $true)]
    [string] $Name,
    [AllowNull()]
    [string] $Value
  )

  $existingValue = Get-ProcessEnvValue -Name $Name
  if (-not [string]::IsNullOrWhiteSpace($existingValue)) {
    return
  }

  if (-not [string]::IsNullOrWhiteSpace($Value)) {
    Set-ProcessEnvValue -Name $Name -Value $Value
  }
}

function Wait-ForGatewayHealth {
  param(
    [int] $MaxAttempts = 20,
    [int] $DelaySeconds = 2
  )

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing http://127.0.0.1:4000/health
      if ($response.StatusCode -eq 200 -and -not [string]::IsNullOrWhiteSpace($response.Content)) {
        return $response.Content
      }
    }
    catch {
      if ($attempt -eq $MaxAttempts) {
        throw
      }
    }

    Start-Sleep -Seconds $DelaySeconds
  }

  throw "Gateway health check did not succeed after $MaxAttempts attempts"
}

$repoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $repoRoot

try {
  $postgresEnv = Get-ContainerEnvMap -ContainerName "watany-postgres"
  $gatewayEnv = Get-ContainerEnvMap -ContainerName "watany-gateway"
  $redisPassword = Get-RedisPassword

  Set-EnvIfMissing -Name "COMPOSE_PROJECT_NAME" -Value "watan"
  Set-EnvIfMissing -Name "DB_USER" -Value $postgresEnv["POSTGRES_USER"]
  Set-EnvIfMissing -Name "DB_NAME" -Value $postgresEnv["POSTGRES_DB"]
  Set-EnvIfMissing -Name "DB_PASSWORD" -Value $postgresEnv["POSTGRES_PASSWORD"]
  Set-EnvIfMissing -Name "REDIS_PASSWORD" -Value $redisPassword
  Set-EnvIfMissing -Name "JWT_SECRET" -Value $gatewayEnv["JWT_SECRET"]
  Set-EnvIfMissing -Name "OPENAI_API_KEY" -Value $(if ($gatewayEnv.ContainsKey("OPENAI_API_KEY")) { $gatewayEnv["OPENAI_API_KEY"] } else { $gatewayEnv["AI_API_KEY"] })
  Set-EnvIfMissing -Name "AI_API_KEY" -Value $(if ($gatewayEnv.ContainsKey("AI_API_KEY")) { $gatewayEnv["AI_API_KEY"] } else { $gatewayEnv["OPENAI_API_KEY"] })
  Set-EnvIfMissing -Name "CORS_ORIGINS" -Value $gatewayEnv["CORS_ORIGINS"]
  Set-EnvIfMissing -Name "LOG_LEVEL" -Value $gatewayEnv["LOG_LEVEL"]

  $required = @("DB_USER", "DB_NAME", "DB_PASSWORD", "REDIS_PASSWORD", "JWT_SECRET")
  $missing = @($required | Where-Object { [string]::IsNullOrWhiteSpace((Get-ProcessEnvValue -Name $_)) })
  if ($missing.Count -gt 0) {
    throw "Missing required compose environment variables: $($missing -join ', ')"
  }

  Write-Host "Using compose project: $env:COMPOSE_PROJECT_NAME"
  Write-Host "Building gateway-api image..."
  docker compose build gateway-api
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose build gateway-api failed"
  }

  Write-Host "Recreating watany-gateway container..."
  docker rm -f watany-gateway 2>$null | Out-Null
  docker compose up -d --no-build --no-deps gateway-api
  if ($LASTEXITCODE -ne 0) {
    throw "docker compose up gateway-api failed"
  }

  Write-Host "Verifying gateway runtime..."
  docker inspect watany-gateway --format "{{json .Mounts}}"
  Wait-ForGatewayHealth | Write-Host

  Write-Host "Gateway Docker redeploy completed."
}
finally {
  Pop-Location
}