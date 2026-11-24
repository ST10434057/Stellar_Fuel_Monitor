import test from 'node:test';
import assert from 'node:assert/strict';
import { blobStorageStatus, uploadEvidenceBlob } from '../src/blob-storage.js';
import { pushStatus } from '../src/notifications.js';

function withEnv(overrides, fn) {
  const previous = Object.fromEntries(Object.keys(overrides).map(key => [key, process.env[key]]));
  for (const [key, value] of Object.entries(overrides)) {
    if (value == null) delete process.env[key];
    else process.env[key] = String(value);
  }
  return Promise.resolve()
    .then(fn)
    .finally(() => {
      for (const [key, value] of Object.entries(previous)) {
        if (value == null) delete process.env[key];
        else process.env[key] = value;
      }
    });
}

test('blob storage reports an explicit provider even when cloud credentials are absent', async () => {
  await withEnv({ AZURE_BLOB_CONTAINER_SAS_URL: null }, () => {
    const status = blobStorageStatus();
    assert.equal(typeof status.configured, 'boolean');
    assert.equal(status.configured, false);
    assert.equal(status.provider, 'local-development-fallback');
  });
});

test('production evidence uploads fail closed when Azure Blob is not configured', async () => {
  await withEnv({ AZURE_BLOB_CONTAINER_SAS_URL: null, BLOB_ALLOW_LOCAL_FALLBACK: 'false' }, async () => {
    await assert.rejects(
      () => uploadEvidenceBlob({
        buffer: Buffer.from('assessment-evidence'),
        fileName: 'proof.jpg',
        contentType: 'image/jpeg',
        registration: 'ABC123GP'
      }),
      error => error?.statusCode === 503 && /Azure Blob Storage is not configured/.test(error.message)
    );
  });
});

test('FCM status is safe to query without committing a service account', async () => {
  await withEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: null, FIREBASE_SERVICE_ACCOUNT_BASE64: null, FIREBASE_PROJECT_ID: null }, () => {
    const status = pushStatus();
    assert.equal(typeof status.configured, 'boolean');
    assert.equal(status.configured, false);
    assert.equal(status.provider, 'firebase-cloud-messaging-http-v1');
    assert.equal(status.error, null);
  });
});

test('malformed Firebase service account configuration does not crash health checks', async () => {
  await withEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: '{not-valid-json', FIREBASE_SERVICE_ACCOUNT_BASE64: null }, () => {
    const status = pushStatus();
    assert.equal(status.configured, false);
    assert.match(status.error, /invalid JSON/i);
  });
});


test('FCM status accepts base64-encoded service account JSON from a hosting secret', async () => {
  const account = {
    project_id: 'stellar-firebase-test-project',
    client_email: 'fake-service-account@stellar-firebase-test-project.iam.gserviceaccount.com',
    private_key: '-----BEGIN PRIVATE KEY-----\nTEST-ONLY-NOT-REAL\n-----END PRIVATE KEY-----\n'
  };
  const base64 = Buffer.from(JSON.stringify(account), 'utf8').toString('base64');
  await withEnv({
    FIREBASE_SERVICE_ACCOUNT_JSON: null,
    FIREBASE_SERVICE_ACCOUNT_BASE64: base64,
    FIREBASE_PROJECT_ID: account.project_id
  }, () => {
    const status = pushStatus();
    assert.equal(status.configured, true);
    assert.equal(status.projectId, account.project_id);
    assert.equal(status.error, null);
  });
});

test('FCM status handles malformed base64 without crashing', async () => {
  await withEnv({ FIREBASE_SERVICE_ACCOUNT_JSON: null, FIREBASE_SERVICE_ACCOUNT_BASE64: 'not-base64-valid-json' }, () => {
    const status = pushStatus();
    assert.equal(status.configured, false);
    assert.match(status.error, /FIREBASE_SERVICE_ACCOUNT_BASE64 is invalid/);
  });
});
