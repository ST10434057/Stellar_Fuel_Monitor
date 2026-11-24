import fs from 'node:fs';

const requiredLoggingFiles = [
  'android-app/app/src/main/java/za/co/stellar/fuelmonitor/MainActivity.kt',
  'android-app/app/src/main/java/za/co/stellar/fuelmonitor/auth/AuthManager.kt',
  'android-app/app/src/main/java/za/co/stellar/fuelmonitor/network/ApiClient.kt',
  'android-app/app/src/main/java/za/co/stellar/fuelmonitor/data/StellarRepository.kt',
  'android-app/app/src/main/java/za/co/stellar/fuelmonitor/settings/SettingsRepository.kt'
];

let failed = false;
let totalCalls = 0;

for (const file of requiredLoggingFiles) {
  if (!fs.existsSync(file)) {
    console.error(`Missing logging target: ${file}`);
    failed = true;
    continue;
  }

  const source = fs.readFileSync(file, 'utf8');
  const calls = source.match(/\bLog\.(?:v|d|i|w|e)\s*\(/g) || [];
  totalCalls += calls.length;

  if (!calls.length) {
    console.error(`No Android Log calls found in required lifecycle/state file: ${file}`);
    failed = true;
  }
}

if (failed) process.exit(1);

console.log(`Android logging check passed (${totalCalls} Log calls across required lifecycle/state files).`);
