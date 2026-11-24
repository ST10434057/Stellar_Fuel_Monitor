import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { EVIDENCE_TYPES } from './evidence-validation.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const localUploadDir = path.resolve(here, '../data/evidence-uploads');
const AZURE_API_VERSION = '2023-11-03';

function safePart(value, fallback = 'file') {
  return String(value || fallback)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100) || fallback;
}

function configError(message) {
  // expose: the message is safe for the phone (it never contains the SAS itself).
  return Object.assign(new Error(message), { statusCode: 503, expose: true });
}

/** Parses the container SAS URL without ever returning its signature/query string. */
export function describeSasUrl(value) {
  let url;
  try { url = new URL(value); } catch { return { valid: false, error: 'AZURE_BLOB_CONTAINER_SAS_URL is not a valid URL' }; }
  const container = url.pathname.split('/').filter(Boolean)[0] || null;
  if (url.protocol !== 'https:') return { valid: false, error: 'AZURE_BLOB_CONTAINER_SAS_URL must use https' };
  if (!url.searchParams.get('sig')) return { valid: false, error: 'AZURE_BLOB_CONTAINER_SAS_URL has no SAS signature' };
  if (!container) return { valid: false, error: 'AZURE_BLOB_CONTAINER_SAS_URL must point at a container' };
  return { valid: true, url, account: url.host, container, expiresOn: url.searchParams.get('se') || null };
}

function storageConfig() {
  const sasUrl = String(process.env.AZURE_BLOB_CONTAINER_SAS_URL || '').trim();
  const allowLocal = String(process.env.BLOB_ALLOW_LOCAL_FALLBACK || 'true') === 'true';
  if (sasUrl) {
    const sas = describeSasUrl(sasUrl);
    // A broken SAS never silently falls back to local disk: that would fake an Azure upload.
    return sas.valid ? { mode: 'azure', sas, allowLocal } : { mode: 'misconfigured', error: sas.error, allowLocal };
  }
  return { mode: allowLocal ? 'local' : 'disabled', allowLocal };
}

export function blobStorageStatus() {
  const cfg = storageConfig();
  return {
    configured: cfg.mode === 'azure',
    provider: cfg.mode === 'azure' ? 'azure-blob-storage' : 'local-development-fallback',
    container: cfg.sas?.container || process.env.AZURE_BLOB_CONTAINER_NAME || null,
    mode: cfg.mode,
    account: cfg.sas?.account || null,
    sasExpiresOn: cfg.sas?.expiresOn || null,
    localFallbackAllowed: cfg.allowLocal,
    error: cfg.error || null
  };
}

function blobUrl(sas, blobName) {
  const target = new URL(sas.url);
  target.pathname = `${target.pathname.replace(/\/$/, '')}/${blobName.split('/').map(encodeURIComponent).join('/')}`;
  return target;
}

function localPath(blobName) {
  const resolved = path.resolve(localUploadDir, ...String(blobName).split('/'));
  if (!resolved.startsWith(localUploadDir + path.sep)) throw new Error('Invalid evidence blob name');
  return resolved;
}

async function azureFailure(action, response) {
  // Azure's error XML is logged for the backend owner but never returned to the phone.
  const detail = await response.text().catch(() => '');
  console.error(`Azure Blob ${action} failed (${response.status}): ${detail.slice(0, 300)}`);
  return Object.assign(new Error(`Azure Blob ${action} failed (${response.status})`), { statusCode: 502 });
}

/**
 * Uploads binary evidence to Azure Blob Storage using a container-level SAS URL.
 * No Azure SDK is required, which keeps the assessment API small and easy to deploy.
 * The blob extension comes from the validated content type, never from the client file name.
 */
export async function uploadEvidenceBlob({ buffer, contentType, registration }) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Evidence file is empty');
  const extension = EVIDENCE_TYPES[contentType] || '';
  const blobName = `${safePart(registration, 'unknown')}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}${extension}`;
  const cfg = storageConfig();

  if (cfg.mode === 'azure') {
    const target = blobUrl(cfg.sas, blobName);
    const response = await fetch(target, {
      method: 'PUT',
      headers: {
        'x-ms-blob-type': 'BlockBlob',
        'x-ms-version': AZURE_API_VERSION,
        'x-ms-blob-content-type': contentType || 'application/octet-stream',
        'Content-Type': contentType || 'application/octet-stream',
        'Content-Length': String(buffer.length)
      },
      body: buffer
    });
    if (!response.ok) throw await azureFailure('upload', response);
    const publicUrl = `${target.origin}${target.pathname}`;
    return { blobName, blobUrl: publicUrl, provider: 'azure-blob-storage' };
  }

  if (cfg.mode === 'misconfigured') throw configError(cfg.error);
  if (cfg.mode === 'disabled') throw configError('Azure Blob Storage is not configured');

  const destination = localPath(blobName);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, buffer);
  return {
    blobName,
    blobUrl: `local-evidence://${blobName}`,
    provider: 'local-development-fallback'
  };
}

/** Reads an evidence file back through the API so the SAS never has to leave the server. */
export async function downloadEvidenceBlob({ blobName, provider }) {
  if (provider === 'local-development-fallback') return fs.readFile(localPath(blobName));
  const cfg = storageConfig();
  if (cfg.mode !== 'azure') throw configError(cfg.error || 'Azure Blob Storage is not configured');
  const response = await fetch(blobUrl(cfg.sas, blobName), { headers: { 'x-ms-version': AZURE_API_VERSION } });
  if (response.status === 404) throw Object.assign(new Error('Evidence file is no longer in blob storage'), { statusCode: 404 });
  if (!response.ok) throw await azureFailure('download', response);
  return Buffer.from(await response.arrayBuffer());
}

/** Deletes an evidence file; a blob that is already gone counts as deleted. */
export async function deleteEvidenceBlob({ blobName, provider }) {
  if (provider === 'local-development-fallback') { await fs.rm(localPath(blobName), { force: true }); return; }
  const cfg = storageConfig();
  if (cfg.mode !== 'azure') throw configError(cfg.error || 'Azure Blob Storage is not configured');
  const response = await fetch(blobUrl(cfg.sas, blobName), { method: 'DELETE', headers: { 'x-ms-version': AZURE_API_VERSION } });
  if (!response.ok && response.status !== 404) throw await azureFailure('delete', response);
}
