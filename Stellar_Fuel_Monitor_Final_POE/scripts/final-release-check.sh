#!/usr/bin/env bash
set -euo pipefail
node scripts/verify-submission.mjs
node scripts/check-no-secrets.mjs
node scripts/verify-android-logging.mjs
(
  cd server
  npm ci
  npm run check
  npm test
  npm run verify:analytics -- --quiet
)
(
  cd android-app
  gradle :app:testDebugUnitTest --no-daemon --stacktrace
  gradle :app:assembleDebug --no-daemon --stacktrace
)
echo "Automated checks complete. Run physical-device QA before tagging Final-POE."
