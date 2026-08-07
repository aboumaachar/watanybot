$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName='C:\Windows\System32\cmd.exe'
$psi.Arguments='/c echo HELLO_WORLD'
$psi.RedirectStandardOutput=$true
$psi.RedirectStandardError=$true
$psi.UseShellExecute=$false
$psi.CreateNoWindow=$true
$proc=New-Object System.Diagnostics.Process
$proc.StartInfo=$psi
$sb=New-Object System.Text.StringBuilder
$handler=[System.Diagnostics.DataReceivedEventHandler]{ param($s,$e) if ($e.Data -ne $null) {[void]$sb.AppendLine($e.Data)} }
$proc.add_OutputDataReceived($handler)
$proc.Start() | Out-Null
$proc.BeginOutputReadLine()
$exited=$proc.WaitForExit(2000)
$rem=$proc.StandardOutput.ReadToEnd()
Write-Output "Exited:$exited"
Write-Output "ReadToEnd:'$rem'"
Write-Output "Buffer:'$($sb.ToString())'"
