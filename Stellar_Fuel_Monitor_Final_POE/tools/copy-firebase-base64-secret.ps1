# Copy a Firebase service-account JSON to the clipboard as Base64 without displaying secrets.
# Do not run on a shared or untrusted Windows PC.
param(
  [Parameter(Mandatory = $true)]
  [string] $KeyPath
)
$ErrorActionPreference = 'Stop'
$resolved = (Resolve-Path -LiteralPath $KeyPath).Path
$json = Get-Content -LiteralPath $resolved -Raw -Encoding UTF8 | ConvertFrom-Json
if (-not $json.project_id -or -not $json.client_email -or -not $json.private_key) {
  throw 'This is not a complete Firebase service-account JSON file (project_id, client_email or private_key missing).'
}
$bytes = [System.IO.File]::ReadAllBytes($resolved)
[Convert]::ToBase64String($bytes) | Set-Clipboard
Write-Host ('Base64 secret copied to clipboard for Firebase project: ' + $json.project_id)
Write-Host 'Paste ONLY into your private backend hosting secret FIREBASE_SERVICE_ACCOUNT_BASE64.'
Write-Host "After pasting run: Set-Clipboard -Value ''"
Write-Host 'WARNING: Base64 is NOT encryption. Do not share this value.'
