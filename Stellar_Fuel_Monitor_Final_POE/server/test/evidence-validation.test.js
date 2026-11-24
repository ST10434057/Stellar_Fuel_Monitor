import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { decodeEvidence, detectContentType, safeEvidenceFileName } from '../src/evidence-validation.js';

// Smallest valid PNG (1x1 transparent pixel) and a minimal PDF header.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n', 'latin1');
const b64 = buffer => buffer.toString('base64');
const rejectsWith = (fn, statusCode, pattern) => assert.throws(fn, err => err.statusCode === statusCode && pattern.test(err.message));

test('detectContentType recognises the allowed signatures only', () => {
  assert.equal(detectContentType(PNG), 'image/png');
  assert.equal(detectContentType(PDF), 'application/pdf');
  assert.equal(detectContentType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), 'image/jpeg');
  assert.equal(detectContentType(Buffer.from('RIFF\0\0\0\0WEBPVP8 ', 'latin1')), 'image/webp');
  assert.equal(detectContentType(Buffer.from('MZ\x90\0 windows executable')), null);
  assert.equal(detectContentType(Buffer.from('tiny')), null);
});

test('decodeEvidence returns validated bytes, a safe file name and a SHA-256', () => {
  const result = decodeEvidence({ base64Data: b64(PNG), contentType: 'image/png', fileName: '../../slip from depot.PNG' });
  assert.deepEqual(result.buffer, PNG);
  assert.equal(result.contentType, 'image/png');
  assert.equal(result.fileName, 'slip from depot.png');
  assert.equal(result.sha256, crypto.createHash('sha256').update(PNG).digest('hex'));
});

test('data-URL prefixes, line breaks, URL-safe Base64 and image/jpg are accepted', () => {
  const urlSafe = b64(PDF).replace(/\+/g, '-').replace(/\//g, '_');
  assert.equal(decodeEvidence({ base64Data: `data:application/pdf;base64,${urlSafe}`, contentType: 'application/pdf', fileName: 'note.pdf' }).contentType, 'application/pdf');
  const wrapped = b64(PNG).replace(/(.{20})/g, '$1\n');
  assert.equal(decodeEvidence({ base64Data: wrapped, contentType: 'image/png' }).fileName, 'evidence.png');
  const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]);
  assert.equal(decodeEvidence({ base64Data: b64(jpeg), contentType: 'image/jpg', fileName: 'odo.jpeg' }).fileName, 'odo.jpg');
});

test('the declared type must match the real bytes', () => {
  rejectsWith(() => decodeEvidence({ base64Data: b64(PDF), contentType: 'image/png' }), 400, /does not match/);
  rejectsWith(() => decodeEvidence({ base64Data: b64(Buffer.from('<html><script>alert(1)</script></html>')), contentType: 'image/jpeg' }), 400, /real JPEG/);
});

test('unsupported types, empty and malformed Base64 are rejected with 400', () => {
  rejectsWith(() => decodeEvidence({ base64Data: b64(PNG), contentType: 'text/html' }), 400, /JPEG, PNG, WEBP or PDF/);
  rejectsWith(() => decodeEvidence({ base64Data: '', contentType: 'image/png' }), 400, /required/);
  rejectsWith(() => decodeEvidence({ base64Data: 'not*base64!', contentType: 'image/png' }), 400, /not valid Base64/);
});

test('files over the limit are rejected with 413 before and after decoding', () => {
  const big = Buffer.concat([PNG, Buffer.alloc(4096)]);
  rejectsWith(() => decodeEvidence({ base64Data: b64(big), contentType: 'image/png', maxBytes: 1024 }), 413, /1 MB|0 MB|or smaller/);
  rejectsWith(() => decodeEvidence({ base64Data: b64(Buffer.concat([PNG, Buffer.alloc(40)])), contentType: 'image/png', maxBytes: PNG.length + 10 }), 413, /or smaller/);
});

test('safeEvidenceFileName strips paths and odd characters and forces the real extension', () => {
  assert.equal(safeEvidenceFileName('..\\..\\windows\\evil.exe', 'image/png'), 'evil.png');
  assert.equal(safeEvidenceFileName('slip<script>.pdf', 'application/pdf'), 'slip_script_.pdf');
  assert.equal(safeEvidenceFileName('', 'image/webp'), 'evidence.webp');
});
