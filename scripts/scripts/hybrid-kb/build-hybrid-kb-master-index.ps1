& {
  Set-Location "C:\xampp\htdocs\projectx\watanybot"

  New-Item -ItemType Directory -Force -Path "scripts\hybrid-kb" | Out-Null

  Copy-Item `
    -LiteralPath "$env:USERPROFILE\Downloads\APEX_POWERSHELL_HYBRID_KB_MASTER_INDEX_BUILDER_v1_3.ps1" `
    -Destination "scripts\hybrid-kb\build-hybrid-kb-master-index.ps1" `
    -Force

  git add scripts/hybrid-kb/build-hybrid-kb-master-index.ps1
  git commit -m "Add reusable Hybrid KB master index builder"
}