#requires -Version 5.1
[CmdletBinding()]
param(
	[string]$ValidationRoot = 'C:\APEX\P8-post-repair-validation',
	[switch]$RunGateway,
	[switch]$RunWeb
)
Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function ConvertTo-P8WindowsArgument([string]$Value) {
	$builder = New-Object Text.StringBuilder
	[void]$builder.Append('"')
	$slashCount = 0
	foreach ($character in $Value.ToCharArray()) {
		if ($character -eq '\') {
			$slashCount++
			continue
		}
		if ($character -eq '"') {
			if ($slashCount -gt 0) { [void]$builder.Append(('\' * ($slashCount * 2))) }
			[void]$builder.Append('\')
			[void]$builder.Append('"')
			$slashCount = 0
			continue
		}
		if ($slashCount -gt 0) { [void]$builder.Append(('\' * $slashCount)); $slashCount = 0 }
		[void]$builder.Append($character)
	}
	if ($slashCount -gt 0) { [void]$builder.Append(('\' * ($slashCount * 2))) }
	[void]$builder.Append('"')
	return $builder.ToString()
}

function Invoke-P8ProcessCommand([string]$Name, [string]$WorkingDirectory, [string]$FilePath, [string[]]$CommandArgs, [string]$OutputDirectory, [int]$TimeoutMilliseconds = 1800000) {
	$stdoutPath = Join-Path $OutputDirectory ($Name + '.stdout.log')
	$stderrPath = Join-Path $OutputDirectory ($Name + '.stderr.log')
	$started = Get-Date
	$exitCode = 1
	$status = 'BLOCKED'
	$errorText = ''
	$processStarted = $false
	$processId = 0
	$exitObserved = $false
	try {
		if (-not (Test-Path -LiteralPath $WorkingDirectory -PathType Container)) { throw ('Missing working directory: ' + $WorkingDirectory) }
		$startInfo = New-Object Diagnostics.ProcessStartInfo
		$startInfo.FileName = $FilePath
		$startInfo.Arguments = (($CommandArgs | ForEach-Object { ConvertTo-P8WindowsArgument ([string]$_) }) -join ' ')
		$startInfo.WorkingDirectory = $WorkingDirectory
		$startInfo.UseShellExecute = $false
		$startInfo.CreateNoWindow = $true
		$startInfo.RedirectStandardOutput = $true
		$startInfo.RedirectStandardError = $true
		$process = New-Object Diagnostics.Process
		$process.StartInfo = $startInfo
		[void]$process.Start()
		$processStarted = $true
		$processId = $process.Id
		$stdoutTask = $process.StandardOutput.ReadToEndAsync()
		$stderrTask = $process.StandardError.ReadToEndAsync()
		if (-not $process.WaitForExit($TimeoutMilliseconds)) {
			$errorText = 'Process timeout after ' + $TimeoutMilliseconds + ' ms'
			try { $process.Kill() } catch { }
			$process.WaitForExit()
			$stdoutText = $stdoutTask.Result
			$stderrText = $stderrTask.Result
			throw $errorText
		}
		$stdoutText = $stdoutTask.Result
		$stderrText = $stderrTask.Result
		$exitCode = $process.ExitCode
		$exitObserved = $true
		$process.Dispose()
		[IO.File]::WriteAllText($stdoutPath, $stdoutText, (New-Object Text.UTF8Encoding($false)))
		[IO.File]::WriteAllText($stderrPath, $stderrText, (New-Object Text.UTF8Encoding($false)))
		if ($exitCode -eq 0) { $status = 'PASS' }
	} catch {
		$errorText = $_.Exception.Message
		[IO.File]::WriteAllText($stdoutPath, '', (New-Object Text.UTF8Encoding($false)))
		[IO.File]::WriteAllText($stderrPath, $errorText, (New-Object Text.UTF8Encoding($false)))
	}
	$stdoutBytes = if (Test-Path -LiteralPath $stdoutPath) { (Get-Item -LiteralPath $stdoutPath).Length } else { 0 }
	$stderrBytes = if (Test-Path -LiteralPath $stderrPath) { (Get-Item -LiteralPath $stderrPath).Length } else { 0 }
	return [pscustomobject]@{
		name = $Name
		status = $status
		exitCode = $exitCode
		processStarted = if ($processStarted) { 'YES' } else { 'NO' }
		processId = $processId
		exitObserved = if ($exitObserved) { 'YES' } else { 'NO' }
		stdoutFileExists = if (Test-Path -LiteralPath $stdoutPath) { 'YES' } else { 'NO' }
		stderrFileExists = if (Test-Path -LiteralPath $stderrPath) { 'YES' } else { 'NO' }
		stdoutBytes = $stdoutBytes
		stderrBytes = $stderrBytes
		startedUtc = $started.ToUniversalTime().ToString('o')
		stdoutPath = $stdoutPath
		stderrPath = $stderrPath
		error = $errorText
	}
}

function Invoke-RequiredP8ProcessCommand([string]$Name, [string]$WorkingDirectory, [string]$FilePath, [string[]]$CommandArgs, [string]$OutputDirectory) {
	$result = Invoke-P8ProcessCommand -Name $Name -WorkingDirectory $WorkingDirectory -FilePath $FilePath -CommandArgs $CommandArgs -OutputDirectory $OutputDirectory
	$stderr = if (Test-Path -LiteralPath $result.stderrPath) { [IO.File]::ReadAllText($result.stderrPath) } else { '' }
	if ($result.status -ne 'PASS' -or $result.exitCode -ne 0 -or $result.exitObserved -ne 'YES' -or $stderr -match '(?i)\b(error|failed|failure|exception)\b') {
		throw ('Required Process gate failed: ' + $Name)
	}
	return $result
}

function Invoke-P8Process {
	param(
		[string]$ProcessValidationRoot = 'C:\APEX\P8-post-repair-validation',
		[switch]$ProcessGateway,
		[switch]$ProcessWeb
	)
	if (-not (Test-Path -LiteralPath $ProcessValidationRoot -PathType Container)) {
		New-Item -ItemType Directory -Path $ProcessValidationRoot -Force | Out-Null
	}
	$logs = Join-Path $ProcessValidationRoot 'process-logs'
	New-Item -ItemType Directory -Path $logs -Force | Out-Null
	$workspace = 'C:\xampp\htdocs\projectx\watanybot'
	$rows = @()
	if ($ProcessGateway) {
		$rows += Invoke-RequiredP8ProcessCommand -Name 'gateway-typecheck' -WorkingDirectory (Join-Path $workspace 'apps\gateway-api') -FilePath 'node.exe' -CommandArgs @('C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs', 'typecheck') -OutputDirectory $logs
		$rows += Invoke-RequiredP8ProcessCommand -Name 'gateway-tests' -WorkingDirectory (Join-Path $workspace 'apps\gateway-api') -FilePath 'node.exe' -CommandArgs @('C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs', 'test', '--', '--run', '--pool=forks', '--poolOptions.forks.singleFork=true') -OutputDirectory $logs
	}
	if ($ProcessWeb) {
		$rows += Invoke-RequiredP8ProcessCommand -Name 'web-user-typecheck' -WorkingDirectory (Join-Path $workspace 'apps\web-user') -FilePath 'node.exe' -CommandArgs @('C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs', 'typecheck') -OutputDirectory $logs
		$rows += Invoke-RequiredP8ProcessCommand -Name 'web-user-build' -WorkingDirectory (Join-Path $workspace 'apps\web-user') -FilePath 'node.exe' -CommandArgs @('C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs', 'build') -OutputDirectory $logs
		$rows += Invoke-RequiredP8ProcessCommand -Name 'web-user-tests' -WorkingDirectory (Join-Path $workspace 'apps\web-user') -FilePath 'node.exe' -CommandArgs @('C:\Users\User\AppData\Roaming\npm\node_modules\pnpm\bin\pnpm.cjs', 'test:run') -OutputDirectory $logs
	}
	$required = @($rows)
	$pass = ($required.Count -gt 0 -and @($required | Where-Object { $_.status -ne 'PASS' }).Count -eq 0)
	return [pscustomobject]@{ validationRoot = $ProcessValidationRoot; gates = $required; status = if ($pass) { 'PASS' } else { 'BLOCKED' } }
}