$ErrorActionPreference = "Stop"
Write-Host "[1/4] Repository QA"
node scripts/verify-submission.mjs
node scripts/check-no-secrets.mjs
node scripts/verify-android-logging.mjs

Write-Host "[2/4] Server"
Push-Location server
npm ci
npm run check
npm test
npm run verify:analytics -- --quiet
Pop-Location

Write-Host "[3/4] Android"
Push-Location android-app
gradle :app:testDebugUnitTest --no-daemon --stacktrace
gradle :app:assembleDebug --no-daemon --stacktrace
Pop-Location

Write-Host "[4/4] Complete"
Write-Host "Run physical-device QA before tagging Final-POE."
