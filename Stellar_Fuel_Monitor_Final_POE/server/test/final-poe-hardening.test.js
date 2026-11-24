// Backend hardening on top of the Final POE services: SAS handling, Azure failure paths,
// credential redaction and FCM dead-token pruning. fetch is stubbed, so nothing here reaches
// Azure or Google.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { blobStorageStatus, uploadEvidenceBlob, downloadEvidenceBlob, deleteEvidenceBlob } from '../src/blob-storage.js';
import { pushStatus, sendPushToTokens, isDeadTokenError } from '../src/notifications.js';

const SAS = 'https://stellarstore.blob.core.windows.net/evidence?sv=2026-02-06&sp=racwdl&se=2027-01-30T22:00:00Z&sr=c&sig=SECRETSIGNATURE%3D';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

async function withEnv(overrides, fn) {
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null) delete process.env[key];
    else process.env[key] = String(value);
  }
  try { return await fn(); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value == null) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

async function withFetch(handler, fn) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init = {}) => { calls.push({ url: String(url), init }); return handler(String(url), init, calls.length); };
  try { return await fn(calls); }
  finally { globalThis.fetch = original; }
}

const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

test('blob status describes the container but never exposes the SAS signature', async () => {
  await withEnv({ AZURE_BLOB_CONTAINER_SAS_URL: SAS }, () => {
    const status = blobStorageStatus();
    assert.equal(status.configured, true);
    assert.equal(status.mode, 'azure');
    assert.equal(status.provider, 'azure-blob-storage');
    assert.equal(status.account, 'stellarstore.blob.core.windows.net');
    assert.equal(status.container, 'evidence');
    assert.equal(status.sasExpiresOn, '2027-01-30T22:00:00Z');
    assert.ok(!JSON.stringify(status).includes('SECRETSIGNATURE'));
    assert.ok(!JSON.stringify(status).includes('sig='));
  });
});

test('a broken SAS URL is reported and never silently falls back to local disk', async () => {
  for (const bad of ['http://x.blob.core.windows.net/c?sig=a', 'https://x.blob.core.windows.net/c?sv=1', 'not a url']) {
    await withEnv({ AZURE_BLOB_CONTAINER_SAS_URL: bad, BLOB_ALLOW_LOCAL_FALLBACK: 'true' }, async () => {
      const status = blobStorageStatus();
      assert.equal(status.configured, false);
      assert.equal(status.mode, 'misconfigured');
      assert.ok(status.error);
      await assert.rejects(
        () => uploadEvidenceBlob({ buffer: PNG, contentType: 'image/png', registration: 'B176ACT' }),
        err => err.statusCode === 503 && err.expose === true
      );
    });
  }
});

test('Azure upload PUTs a block blob under the container, named from the validated type', async () => {
  await withEnv({ AZURE_BLOB_CONTAINER_SAS_URL: SAS }, () => withFetch(() => new Response(null, { status: 201 }), async calls => {
    const stored = await uploadEvidenceBlob({ buffer: PNG, contentType: 'image/png', registration: 'b176 act' });
    assert.equal(calls.length, 1);
    const url = new URL(calls[0].url);
    assert.equal(calls[0].init.method, 'PUT');
    assert.equal(calls[0].init.headers['x-ms-blob-type'], 'BlockBlob');
    assert.equal(calls[0].init.headers['x-ms-blob-content-type'], 'image/png');
    assert.equal(url.searchParams.get('sig'), 'SECRETSIGNATURE=', 'the SAS is used for the request');
    assert.match(url.pathname, /^\/evidence\/b176-act\/\d{4}-\d{2}-\d{2}\/[0-9a-f-]{36}\.png$/);
    assert.equal(stored.provider, 'azure-blob-storage');
    assert.ok(!stored.blobUrl.includes('sig='), 'the blob URL returned to the phone has no SAS');
  }));
});

test('Azure errors become a 502 without the storage error body', async () => {
  const azureXml = '<Error><Code>AuthenticationFailed</Code><AuthenticationErrorDetail>Signature did not match</AuthenticationErrorDetail></Error>';
  await withEnv({ AZURE_BLOB_CONTAINER_SAS_URL: SAS }, () => withFetch(() => new Response(azureXml, { status: 403 }), async () => {
    await assert.rejects(
      () => uploadEvidenceBlob({ buffer: PNG, contentType: 'image/png', registration: 'B176ACT' }),
      err => err.statusCode === 502 && /upload failed \(403\)/.test(err.message) && !err.message.includes('Signature')
    );
  }));
});

test('Azure download returns the bytes and delete treats a missing blob as deleted', async () => {
  await withEnv({ AZURE_BLOB_CONTAINER_SAS_URL: SAS }, () => withFetch((url, init) => {
    if ((init.method || 'GET') === 'GET') return new Response(PNG, { status: 200 });
    return new Response(null, { status: 404 });
  }, async calls => {
    const bytes = await downloadEvidenceBlob({ blobName: 'B176ACT/2026-11-06/x.png', provider: 'azure-blob-storage' });
    assert.deepEqual(bytes, PNG);
    await deleteEvidenceBlob({ blobName: 'B176ACT/2026-11-06/x.png', provider: 'azure-blob-storage' });
    assert.equal(calls[1].init.method, 'DELETE');
  }));
});

test('local fallback round-trips a file and refuses path traversal', async () => {
  await withEnv({ AZURE_BLOB_CONTAINER_SAS_URL: null, BLOB_ALLOW_LOCAL_FALLBACK: 'true' }, async () => {
    const stored = await uploadEvidenceBlob({ buffer: PNG, contentType: 'image/png', registration: 'TEST-LOCAL' });
    assert.equal(stored.provider, 'local-development-fallback');
    try {
      assert.deepEqual(await downloadEvidenceBlob(stored), PNG);
    } finally {
      await deleteEvidenceBlob(stored);
      // Remove the per-registration folder the upload created under data/evidence-uploads/.
      await fs.rm(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'evidence-uploads', 'TEST-LOCAL'), { recursive: true, force: true });
    }
    await assert.rejects(() => downloadEvidenceBlob(stored));
    await assert.rejects(() => downloadEvidenceBlob({ blobName: '../../../package.json', provider: 'local-development-fallback' }), /Invalid evidence blob name/);
  });
});

test('a malformed service account never echoes key material into /api/health', async () => {
  await withEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: '{"private_key":"-----BEGIN PRIVATE KEY-----TOPSECRETKEYMATERIAL', FIREBASE_SERVICE_ACCOUNT_BASE64: null }, () => {
    const status = pushStatus();
    assert.equal(status.configured, false);
    assert.match(status.error, /invalid JSON/);
    assert.ok(!status.error.includes('TOPSECRET'));
    assert.ok(!status.error.includes('BEGIN PRIVATE KEY'));
  });
});

test('only token-specific FCM errors mark a registration as dead', () => {
  assert.equal(isDeadTokenError({ fcmErrorCode: 'UNREGISTERED' }), true);
  assert.equal(isDeadTokenError({ fcmErrorCode: 'INVALID_ARGUMENT', fcmMessage: 'The registration token is not a valid FCM registration token' }), true);
  assert.equal(isDeadTokenError({ fcmErrorCode: 'INVALID_ARGUMENT', fcmMessage: 'Invalid JSON payload received.' }), false);
  assert.equal(isDeadTokenError({ fcmErrorCode: 'QUOTA_EXCEEDED' }), false);
  assert.equal(isDeadTokenError(new Error('network down')), false);
});

test('sendPushToTokens reports dead tokens separately from other failures', async () => {
  const { privateKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const account = { project_id: 'stellar-test', client_email: 'fcm@stellar-test.iam.gserviceaccount.com', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }) };
  await withEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: JSON.stringify(account), FIREBASE_SERVICE_ACCOUNT_BASE64: null }, () => withFetch((url, init) => {
    if (url.startsWith('https://oauth2.googleapis.com/')) return json(200, { access_token: 'test-access-token', expires_in: 3600 });
    const token = JSON.parse(init.body).message.token;
    if (token === 'token-ok-000000000000000') return json(200, { name: 'projects/stellar-test/messages/1' });
    if (token === 'token-gone-0000000000000') return json(404, { error: { code: 404, status: 'NOT_FOUND', message: 'Requested entity was not found.', details: [{ errorCode: 'UNREGISTERED' }] } });
    return json(500, { error: { code: 500, status: 'INTERNAL', message: 'Internal error' } });
  }, async calls => {
    const result = await sendPushToTokens(['token-ok-000000000000000', 'token-gone-0000000000000', 'token-flaky-000000000000'], { title: 't', body: 'b', data: { type: 'test' } });
    assert.equal(result.requested, 3);
    assert.equal(result.sent, 1);
    assert.equal(result.failed, 2);
    assert.deepEqual(result.invalidTokens, ['token-gone-0000000000000'], 'a transient 500 does not delete the device');
    const fcmCall = calls.find(c => c.url.includes('fcm.googleapis.com'));
    assert.equal(fcmCall.url, 'https://fcm.googleapis.com/v1/projects/stellar-test/messages:send');
    assert.equal(fcmCall.init.headers.Authorization, 'Bearer test-access-token');
  }));
});
