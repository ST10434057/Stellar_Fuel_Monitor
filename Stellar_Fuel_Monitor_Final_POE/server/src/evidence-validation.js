/**
 * Evidence Vault input validation (Final POE).
 *
 * The Android app sends evidence as JSON { contentType, fileName, base64Data }. Before anything
 * reaches Azure Blob Storage the server decodes the Base64 strictly, enforces the 5 MB limit and
 * checks the file's magic bytes, so a renamed executable or HTML page cannot be stored as
 * "photo.jpg" just by declaring image/jpeg.
 */
import crypto from 'node:crypto';
import path from 'node:path';

export const EVIDENCE_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'application/pdf': '.pdf'
};
export const EVIDENCE_MAX_BYTES = 5 * 1024 * 1024;

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;

function invalid(message, statusCode = 400) {
  return Object.assign(new Error(message), { statusCode });
}

/** Identifies the allowed formats from their file signatures. */
export function detectContentType(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'image/jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buffer.toString('latin1', 0, 4) === 'RIFF' && buffer.toString('latin1', 8, 12) === 'WEBP') return 'image/webp';
  if (buffer.toString('latin1', 0, 5) === '%PDF-') return 'application/pdf';
  return null;
}

/** Keeps a readable base name and forces the extension that matches the real content. */
export function safeEvidenceFileName(original, contentType) {
  const ext = EVIDENCE_TYPES[contentType];
  const stem = path.basename(String(original || '')).replace(/\.[^.]*$/, '')
    .replace(/[^\w. -]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 100);
  return `${stem || 'evidence'}${ext}`;
}

/**
 * Turns the app's upload request into validated bytes. Throws an Error with statusCode 400/413
 * that the route returns as-is.
 */
export function decodeEvidence({ base64Data, contentType, fileName, maxBytes = EVIDENCE_MAX_BYTES }) {
  let declared = String(contentType || '').trim().toLowerCase();
  if (declared === 'image/jpg') declared = 'image/jpeg';
  if (!EVIDENCE_TYPES[declared]) throw invalid('Evidence must be JPEG, PNG, WEBP or PDF');

  const encoded = String(base64Data || '')
    .replace(/^data:[^;]+;base64,/, '')
    .replace(/\s+/g, '')
    .replace(/-/g, '+').replace(/_/g, '/'); // accept URL-safe Base64 too
  if (!encoded) throw invalid('base64Data is required');
  // Buffer.from() silently skips invalid characters, so validate before decoding.
  if (!BASE64_PATTERN.test(encoded) || encoded.length % 4 === 1) throw invalid('base64Data is not valid Base64');
  // Reject oversized payloads before allocating the decoded buffer.
  if (Math.floor(encoded.length * 3 / 4) > maxBytes + 2) throw invalid(`Evidence file must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller`, 413);

  const buffer = Buffer.from(encoded, 'base64');
  if (!buffer.length) throw invalid('Evidence file is empty');
  if (buffer.length > maxBytes) throw invalid(`Evidence file must be ${Math.round(maxBytes / 1024 / 1024)} MB or smaller`, 413);

  const detected = detectContentType(buffer);
  if (!detected) throw invalid('Evidence must be a real JPEG, PNG, WEBP or PDF file');
  if (detected !== declared) throw invalid(`File content (${detected}) does not match contentType (${declared})`);

  return {
    buffer,
    contentType: detected,
    fileName: safeEvidenceFileName(fileName, detected),
    sha256: crypto.createHash('sha256').update(buffer).digest('hex')
  };
}
