$files = Get-ChildItem -Recurse -Filter directory_phonebook_lb.json
$summary = @()
foreach ($file in $files) {
    try {
        $data = Get-Content -Path $file.FullName -Raw | ConvertFrom-Json
        $entries = if ($data.entries -is [System.Array]) { $data.entries } else { @() }
        $hospitals = $entries | Where-Object { $_.entity_type -eq 'hospital' }
        $summary += [PSCustomObject]@{
            file = $file.FullName
            total = $entries.Count
            hospitals = $hospitals.Count
            ids = $hospitals | ForEach-Object { ($_.'id' + '|' + ($_.name_lb ?? $_.name)) }
        }
    } catch {
        $summary += [PSCustomObject]@{
            file = $file.FullName
            error = $_.Exception.Message
            total = 0
            hospitals = 0
            ids = @()
        }
    }
}
$summary | ConvertTo-Json -Depth 5 | Out-File -FilePath "$PSScriptRoot\audit-hospitals-result.json" -Encoding utf8
Write-Output "Wrote audit results to $PSScriptRoot\audit-hospitals-result.json"