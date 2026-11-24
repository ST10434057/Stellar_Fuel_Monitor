import crypto from 'node:crypto';

let cachedToken = null;
let cachedTokenExpiry = 0;

function base64url(value) {
  const encoded = Buffer.isBuffer(value)
    ? value.toString('base64')
    : Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64');
  return encoded.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function serviceAccount() {
  // The backend accepts either raw JSON or a Base64-encoded service account.
  // Keep both values ONLY in a private host secret store; never commit a credential.
  const rawJson = String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim();
  const rawBase64 = String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim();
  if (!rawJson && !rawBase64) return null;

  const source = rawJson ? 'FIREBASE_SERVICE_ACCOUNT_JSON' : 'FIREBASE_SERVICE_ACCOUNT_BASE64';
  try {
    // Base64 is a transport encoding, NOT encryption or credential protection.
    const json = rawJson || Buffer.from(rawBase64, 'base64').toString('utf8');
    const parsed = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('expected a JSON object');
    }
    if (typeof parsed.private_key === 'string') {
      parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
    }
    return parsed;
  } catch {
    // Deliberately no parser detail: V8's JSON.parse message quotes part of the input, which
    // here is the private key, and pushStatus() is published on /api/health.
    throw new Error(`${source} is invalid JSON (check the secret value on the host)`);
  }
}

export function pushStatus() {
  try {
    const account = serviceAccount();
    return {
      configured: Boolean(account?.client_email && account?.private_key && (account?.project_id || process.env.FIREBASE_PROJECT_ID)),
      projectId: account?.project_id || process.env.FIREBASE_PROJECT_ID || null,
      provider: 'firebase-cloud-messaging-http-v1',
      error: null
    };
  } catch (error) {
    return {
      configured: false,
      projectId: process.env.FIREBASE_PROJECT_ID || null,
      provider: 'firebase-cloud-messaging-http-v1',
      error: error?.message || 'Firebase push configuration is invalid'
    };
  }
}

async function accessToken() {
  if (cachedToken && Date.now() < cachedTokenExpiry - 60_000) return cachedToken;
  const account = serviceAccount();
  if (!account?.client_email || !account?.private_key) throw new Error('Firebase service account is not configured');
  const now = Math.floor(Date.now() / 1000);
  const header = base64url({ alg: 'RS256', typ: 'JWT' });
  const claims = base64url({
    iss: account.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  });
  const unsigned = `${header}.${claims}`;
  const signature = crypto.createSign('RSA-SHA256').update(unsigned).end().sign(account.private_key);
  const assertion = `${unsigned}.${base64url(signature)}`;

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion
    })
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new Error(`Firebase OAuth token request failed (${response.status})`);
  cachedToken = payload.access_token;
  cachedTokenExpiry = Date.now() + Number(payload.expires_in || 3600) * 1000;
  return cachedToken;
}

export async function sendPushToToken(token, { title, body, data = {} }) {
  if (!token) throw new Error('FCM token is required');
  const account = serviceAccount();
  const projectId = account?.project_id || process.env.FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error('Firebase project ID is not configured');
  const bearer = await accessToken();
  const stringData = Object.fromEntries(Object.entries(data || {}).map(([k, v]) => [k, String(v ?? '')]));
  const response = await fetch(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/messages:send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: { title, body, ...stringData },
        android: { priority: 'high' }
      }
    })
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`FCM send failed (${response.status}): ${JSON.stringify(payload).slice(0, 500)}`);
    error.statusCode = response.status;
    // FCM v1 puts its machine-readable reason (UNREGISTERED, INVALID_ARGUMENT, ...) in details[].
    error.fcmErrorCode = (payload?.error?.details || []).find(d => d?.errorCode)?.errorCode || payload?.error?.status || null;
    error.fcmMessage = String(payload?.error?.message || '');
    throw error;
  }
  return payload;
}

/**
 * True when FCM says the token will never work again, so its device row can be deleted.
 * A generic INVALID_ARGUMENT only counts when it is about the token: a malformed message
 * payload returns the same code and must not wipe every registered phone.
 */
export function isDeadTokenError(error) {
  if (error?.fcmErrorCode === 'UNREGISTERED') return true;
  return error?.fcmErrorCode === 'INVALID_ARGUMENT' && /registration token/i.test(error?.fcmMessage || '');
}

export async function sendPushToTokens(tokens, message) {
  const unique = [...new Set((tokens || []).filter(Boolean))].slice(0, 500);
  const results = await Promise.allSettled(unique.map(token => sendPushToToken(token, message)));
  return {
    requested: unique.length,
    sent: results.filter(x => x.status === 'fulfilled').length,
    failed: results.filter(x => x.status === 'rejected').length,
    errors: results.filter(x => x.status === 'rejected').slice(0, 5).map(x => x.reason?.message || 'Unknown push error'),
    // Callers remove these registrations; the tokens are never returned to API clients.
    invalidTokens: unique.filter((_, i) => results[i].status === 'rejected' && isDeadTokenError(results[i].reason))
  };
}
