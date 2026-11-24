#!/usr/bin/env node
/**
 * Final POE end-to-end API smoke test (backend evidence for the hand-in).
 *
 * Runs against a live API - local or the hosted Azure App Service - using the same endpoints
 * and payloads as the Android app:
 *   health -> fleet read -> Fleet Watchlist round-trip -> Evidence Vault upload/list/download/
 *   delete -> input validation -> FCM credential check (+ optional real phone push).
 * It writes a redacted Markdown report (no secrets; device tokens shown only as a suffix).
 *
 * Usage:
 *   node scripts/smoke-final-poe.mjs --base https://<app>.azurewebsites.net/api
 *     [--report ../docs/NICK_API_TEST_REPORT.md] [--registration B176ACT]
 *     [--push-token <FCM token from the phone log> --device-id <app deviceId>] [--keep]
 *
 * --keep leaves the watchlist entry and evidence file in place so they can be shown in
 * MongoDB Atlas and the Azure portal. A vehicle that was already watched is never removed.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = name => args.includes(`--${name}`);
const option = (name, fallback = null) => { const i = args.indexOf(`--${name}`); return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback; };

const base = String(option('base', 'http://localhost:3000/api')).replace(/\/+$/, '');
const reportPath = path.resolve(option('report', path.join(here, '..', '..', 'docs', 'NICK_API_TEST_REPORT.md')));
const pushToken = option('push-token');
const pushDeviceId = option('device-id', 'smoke-test-phone');
const keep = flag('keep');
const PNG_1X1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PDF_MINI = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1');
const FAKE_DEVICE = `smoke-fake-device-${Date.now()}`;

const results = [];

async function call(method, route, { json, expect, label, raw = false } = {}) {
  const headers = { Accept: 'application/json' };
  if (json !== undefined) headers['Content-Type'] = 'application/json';
  const started = Date.now();
  let status = 0;
  let data = null;
  let error = null;
  try {
    const res = await fetch(`${base}${route}`, { method, headers, body: json === undefined ? undefined : JSON.stringify(json) });
    status = res.status;
    data = raw ? Buffer.from(await res.arrayBuffer()) : await res.json().catch(() => null);
  } catch (e) {
    error = e.message;
  }
  const expected = Array.isArray(expect) ? expect : [expect];
  const ok = !error && expected.includes(status);
  results.push({ label, method, route, status: status || 'ERR', expected: expected.join('/'), ok, ms: Date.now() - started, note: error || (!ok && data?.message) || '' });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${method.padEnd(6)} ${route.padEnd(52)} ${status || error}  ${label}`);
  return { ok, status, data };
}

function note(label, ok, detail) {
  results.push({ label, method: '-', route: '-', status: '-', expected: '-', ok, ms: 0, note: detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${detail}`);
}

const health = await call('GET', '/health', { expect: 200, label: 'API health and Final POE readiness' });
const finalPoe = health.data?.finalPoe || {};
const blob = finalPoe.blobStorage || {};
const push = finalPoe.pushNotifications || {};

let registration = option('registration');
if (!registration) {
  const vehicles = await call('GET', '/vehicles?limit=200', { expect: 200, label: 'Read fleet from the API' });
  // Prefer a real truck with recent full-cycle results over placeholder fleet rows.
  const list = Array.isArray(vehicles.data) ? vehicles.data : [];
  registration = (list.find(v => !v.isTrailer && Number.isFinite(v.currentKmL)) || list.find(v => !v.isTrailer) || list[0])?.registration;
}

// --- Fleet Watchlist (MongoDB `watchlist`) ---
if (registration) {
  const before = await call('GET', '/watchlist', { expect: 200, label: 'List watchlist' });
  const preExisting = Boolean(before.data?.some?.(w => w.registration === registration));
  const saved = await call('POST', '/watchlist', { json: { registration, note: `API smoke test ${new Date().toISOString()}`, priority: 'Priority' }, expect: 201, label: `Save ${registration} to watchlist` });
  const listed = await call('GET', '/watchlist', { expect: 200, label: 'Watchlist read back from the database' });
  const row = listed.data?.find?.(w => w.registration === registration);
  note('Watchlist enrichment', Boolean(row && 'currentKmL' in row && row.priority === 'Priority'), 'item carries priority and the live km/L summary');
  await call('POST', '/watchlist', { json: { registration, note: 'offline replay', priority: 'Priority' }, expect: 201, label: 'Replaying the same save (offline queue)' });
  const afterReplay = await call('GET', '/watchlist', { expect: 200, label: 'List after replay' });
  note('Replay is idempotent', afterReplay.data?.filter?.(w => w.registration === registration).length === 1, 'still exactly one entry for the vehicle');
  if (!keep && !preExisting && saved.ok) await call('DELETE', `/watchlist/${encodeURIComponent(registration)}`, { expect: 200, label: 'Remove smoke-test watchlist entry' });
} else note('Watchlist', false, 'no vehicle available from /vehicles');
await call('POST', '/watchlist', { json: { registration: '' }, expect: 400, label: 'Blank registration is rejected' });
await call('POST', '/watchlist', { json: { registration: 'ZZ999ZZGP' }, expect: 404, label: 'Unknown vehicle is rejected' });

// --- Evidence Vault (Azure Blob + MongoDB `evidence_records`) ---
if (registration) {
  const uploaded = await call('POST', '/evidence', {
    json: { registration, tripId: '', note: 'API smoke test - 1x1 PNG', fileName: 'smoke-test.png', contentType: 'image/png', base64Data: PNG_1X1.toString('base64') },
    expect: 201, label: `Upload evidence for ${registration}`
  });
  if (uploaded.ok) {
    const item = uploaded.data;
    note('Evidence stored', item.storageProvider === 'azure-blob-storage' || blob.mode !== 'azure', `${item.storageProvider} blob ${item.blobName} (${item.sizeBytes} bytes)`);
    note('Blob URL has no SAS', !String(item.blobUrl || '').includes('sig='), 'the response never carries the SAS signature');
    const listed = await call('GET', `/evidence?registration=${encodeURIComponent(registration)}`, { expect: 200, label: 'List evidence for the vehicle' });
    note('Evidence listed', Boolean(listed.data?.some?.(x => x.id === item.id)), 'metadata read back from the database');
    const file = await call('GET', `/evidence/${item.id}/file`, { expect: 200, raw: true, label: 'Download evidence through the API' });
    const sha = file.data ? crypto.createHash('sha256').update(file.data).digest('hex') : null;
    note('Evidence integrity', sha === item.sha256, `SHA-256 ${sha === item.sha256 ? 'matches' : 'differs'}`);
    if (!keep) await call('DELETE', `/evidence/${item.id}`, { expect: 200, label: 'Delete smoke-test evidence' });
  }
  await call('POST', '/evidence', { json: { registration, fileName: 'renamed.png', contentType: 'image/png', base64Data: PDF_MINI.toString('base64') }, expect: 400, label: 'PDF bytes declared as PNG are rejected' });
  await call('POST', '/evidence', { json: { registration, fileName: 'note.txt', contentType: 'text/plain', base64Data: Buffer.from('plain text').toString('base64') }, expect: 400, label: 'Unsupported file type is rejected' });
}

// --- Firebase Cloud Messaging ---
await call('POST', '/notifications/register', { json: { token: 'short', deviceId: FAKE_DEVICE }, expect: 400, label: 'Invalid FCM token is rejected' });
await call('POST', '/notifications/unregister', { json: {}, expect: 400, label: 'Unregister without token/deviceId is rejected' });
if (push.configured) {
  // A fake token makes FCM answer "not a valid registration token" only once Google has
  // accepted the server's service-account credentials; the API then prunes it.
  await call('POST', '/notifications/register', { json: { token: `smoke-fake-token-${crypto.randomUUID()}`, deviceId: FAKE_DEVICE, platform: 'android' }, expect: 200, label: 'Register a fake device token' });
  const first = await call('POST', '/notifications/test', { json: { deviceId: FAKE_DEVICE }, expect: 200, label: 'Test push to the fake token' });
  const second = await call('POST', '/notifications/test', { json: { deviceId: FAKE_DEVICE }, expect: 404, label: 'Fake token was pruned after FCM rejected it' });
  note('FCM credentials accepted by Google', first.data?.failed === 1 && second.status === 404, 'FCM authenticated the server and rejected only the fake token');
  if (second.status !== 404) await call('POST', '/notifications/unregister', { json: { deviceId: FAKE_DEVICE }, expect: 200, label: 'Clean up fake device' });
} else note('FCM', false, 'pushNotifications.configured is false: FIREBASE_SERVICE_ACCOUNT_BASE64 missing or invalid');
if (pushToken) {
  await call('POST', '/notifications/register', { json: { token: pushToken, deviceId: pushDeviceId, platform: 'android' }, expect: 200, label: `Register phone token …${pushToken.slice(-6)}` });
  const sent = await call('POST', '/notifications/test', { json: { deviceId: pushDeviceId }, expect: 200, label: 'Send a test push to the phone' });
  note('FCM delivery accepted', sent.data?.sent >= 1 && sent.data?.failed === 0, `${sent.data?.sent ?? 0} sent, ${sent.data?.failed ?? 0} failed (confirm it arrived on the phone)`);
}

// --- Report ---
const passed = results.filter(r => r.ok).length;
const failed = results.length - passed;
const host = (() => { try { return new URL(base).origin; } catch { return base; } })();
const yesNo = v => (v ? 'yes' : 'no');
const lines = [
  '# API Test Report - Final POE backend',
  '',
  `- **Run:** ${new Date().toISOString()}`,
  `- **API:** ${host}/api (feature version \`${health.data?.featureVersion || 'unknown'}\`)`,
  `- **Result:** ${passed}/${results.length} checks passed${failed ? `, **${failed} failed**` : ''}`,
  `- **Test data:** vehicle \`${registration || 'n/a'}\`${keep ? ' (kept for portal screenshots)' : ' (removed afterwards)'}`,
  '',
  '## Services reported by `/api/health`',
  '',
  '| Service | Status |',
  '|---|---|',
  `| MongoDB | connected: ${yesNo(health.data?.mongoConnected)}, source: \`${health.data?.source || 'unknown'}\`, database: \`${health.data?.databaseName || '-'}\` |`,
  `| Azure Blob (Evidence Vault) | mode: \`${blob.mode || 'unknown'}\`, container: \`${blob.container || '-'}\`, SAS expires: ${blob.sasExpiresOn || '-'} |`,
  `| Firebase Cloud Messaging | configured: ${yesNo(push.configured)}, project: \`${push.projectId || '-'}\` |`,
  '',
  '## Checks',
  '',
  '| # | Check | Request | HTTP | Expected | Result | ms | Note |',
  '|---|---|---|---|---|---|---|---|',
  ...results.map((r, i) => `| ${i + 1} | ${r.label} | \`${r.method} ${r.route}\` | ${r.status} | ${r.expected} | ${r.ok ? 'PASS' : '**FAIL**'} | ${r.ms} | ${String(r.note || '').replace(/\|/g, '/')} |`),
  '',
  '_Generated by `server/scripts/smoke-final-poe.mjs`. No connection strings, SAS signatures, service-account data or full FCM tokens are recorded._',
  ''
];
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, lines.join('\n'));
console.log(`\n${passed}/${results.length} passed. Report: ${reportPath}`);
process.exit(failed ? 1 : 0);
