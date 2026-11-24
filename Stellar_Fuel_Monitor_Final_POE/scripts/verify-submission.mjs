import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const required = [
  'README.md',
  'FINAL_HANDOFF_SUMMARY.md',
  'AI_USAGE_FINAL_POE.md',
  'RELEASE_NOTES_FINAL_POE.md',
  'FINAL_POE_SETUP.md',
  'RUBRIC_STATUS_FINAL_POE.md',
  '.github/workflows/ci.yml',
  'android-app/settings.gradle.kts',
  'android-app/app/build.gradle.kts',
  'android-app/app/src/main/AndroidManifest.xml',
  'android-app/app/src/main/java/za/co/stellar/fuelmonitor/MainActivity.kt',
  'android-app/app/src/main/java/za/co/stellar/fuelmonitor/biometric/BiometricAuthenticator.kt',
  'android-app/app/src/main/java/za/co/stellar/fuelmonitor/offline/OfflineStore.kt',
  'android-app/app/src/main/java/za/co/stellar/fuelmonitor/offline/OfflineSyncWorker.kt',
  'android-app/app/src/main/java/za/co/stellar/fuelmonitor/notifications/StellarMessagingService.kt',
  'android-app/app/src/main/java/za/co/stellar/fuelmonitor/localization/AppLocalization.kt',
  'android-app/app/src/main/java/za/co/stellar/fuelmonitor/ui/screens/EvidenceVaultScreen.kt',
  'android-app/app/src/main/java/za/co/stellar/fuelmonitor/ui/screens/WatchlistScreen.kt',
  'android-app/app/src/test/java/za/co/stellar/fuelmonitor/domain/FuelMathTest.kt',
  'android-app/app/src/test/java/za/co/stellar/fuelmonitor/localization/AppLocalizationTest.kt',
  'server/package.json',
  'server/package-lock.json',
  'server/src/index.js',
  'server/src/blob-storage.js',
  'server/src/notifications.js',
  'server/test/final-poe-services.test.js',
  'docs/FINAL_POE_PHYSICAL_DEVICE_QA.md',
  'docs/FINAL_POE_VIDEO_RUNBOOK.md',
  'docs/PLAY_STORE_READINESS.md',
  'play-store/listing.md',
  'play-store/data-safety.md',
  'play-store/privacy-policy.md',
  'scripts/verify-android-logging.mjs',
  'scripts/final-evidence-readiness.mjs',
  'docs/FINAL_POE_EVIDENCE_MATRIX.md',
  'docs/TECHNICAL_REFERENCES.md',
  'play-store/screenshots/README.md',
  'CONTRIBUTING.md',
  'SECURITY.md',
  'server/README.md'
];

// The project lives in a sub-folder of the Git repository, and GitHub only reads workflows
// from the repository root, so .github/ (and the root README) may sit one level up.
let repoRoot = process.cwd();
try {
  repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim() || repoRoot;
} catch {
  // Not a Git checkout (e.g. an extracted hand-in copy): only the project folder is checked.
}
const exists = rel => fs.existsSync(path.resolve(rel)) || fs.existsSync(path.resolve(repoRoot, rel));

let failed = false;
for (const rel of required) {
  if (!exists(rel)) {
    console.error(`MISSING: ${rel}`);
    failed = true;
  }
}
if (failed) process.exit(1);
console.log(`Final POE repository structure check passed (${required.length} required items found).`);
