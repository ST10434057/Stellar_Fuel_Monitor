import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const forbiddenExact = new Set([
  'android-app/local.properties',
  'server/.env',
  'google-services.json'
]);
const forbiddenSegments = new Set(['node_modules', '.gradle', 'build']);
const forbiddenExtensions = ['.jks', '.keystore', '.aab', '.apk'];

function isForbidden(rel) {
  const normalized = rel.replaceAll('\\', '/');
  const filename = normalized.split('/').at(-1).toLowerCase();
  if (/firebase-adminsdk.*\.json$|service[-_]account.*key.*\.json$|firebase-private.*\.json$/.test(filename)) return true;
  if (filename === 'google-services.json') return true;
  if (forbiddenExact.has(normalized)) return true;
  if (forbiddenExtensions.some(ext => normalized.toLowerCase().endsWith(ext))) return true;
  return normalized.split('/').some(segment => forbiddenSegments.has(segment));
}

function walk(dir, base = dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, base, out);
    else out.push(path.relative(base, full).replaceAll('\\', '/'));
  }
  return out;
}

let candidates;
try {
  candidates = execFileSync('git', ['ls-files'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  }).split(/\r?\n/).filter(Boolean);
} catch {
  // Drag-and-drop assessment copies often have no .git metadata.
  // Scan the working tree so a keystore/build output cannot slip into the handoff ZIP.
  candidates = walk(process.cwd());
}

const findings = candidates.filter(isForbidden);
if (findings.length) {
  console.error('Secrets/generated release outputs must be removed before submission:');
  findings.slice(0, 100).forEach(rel => console.error(` - ${rel}`));
  process.exit(1);
}

console.log('Tracked-secret/build-output guard passed.');
