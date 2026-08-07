$runDir = 'C:\xampp\htdocs\projectx\watanybot\.pma\implementation\controller-loop-escape-full-rank-layout-feature-green-closure-v5\direct-cmd-run-test'
New-Item -ItemType Directory -Path $runDir -Force | Out-Null
Push-Location $runDir
# Run native cmd with file redirection
& cmd.exe /d /s /c 'echo APEX_NATIVE_REDIRECT_PASS 1>stdout.log 2>stderr.log & echo %ERRORLEVEL% > exit-code.txt & echo CHILD_FINAL.marker > CHILD_FINAL.marker'
Pop-Location
Write-Output "TestComplete:$runDir"
