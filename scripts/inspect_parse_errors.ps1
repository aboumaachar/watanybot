$path = 'c:\xampp\htdocs\projectx\watanybot\scripts\apex_process_lifecycle_controller_v1.ps1'
$tokens = $null
$errors = $null
[System.Management.Automation.Language.Parser]::ParseFile($path, [ref]$tokens, [ref]$errors) | Out-Null
if ($errors -ne $null) { $errors | ForEach-Object { $_.ToString() } } else { Write-Output 'No parser errors' }
