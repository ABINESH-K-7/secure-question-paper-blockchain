const crypto = require('crypto');
const { questionPaperMasterKey } = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 12;
const KEY_VERSION = 'local-master-key-v1';
const KMS_KEY_VERSION = 'aws-kms-v1';

function configurationError(message) { const error = new Error(message); error.code = 'ENCRYPTION_CONFIGURATION_ERROR'; return error; }
function getMasterKey() {
  if (!questionPaperMasterKey) throw configurationError('QUESTION_PAPER_MASTER_KEY is required for encrypted question-paper storage.');
  let key;
  try { key = Buffer.from(questionPaperMasterKey, 'base64'); } catch { throw configurationError('QUESTION_PAPER_MASTER_KEY must be base64 encoded.'); }
  if (key.length !== 32 || key.toString('base64') !== questionPaperMasterKey.replace(/\s/g, '')) throw configurationError('QUESTION_PAPER_MASTER_KEY must be a base64-encoded 32-byte key.');
  return key;
}
function generateEncryptionKey() { return crypto.randomBytes(32); }
function encryptData(plaintext, key) {
  if (!Buffer.isBuffer(plaintext) || !Buffer.isBuffer(key) || key.length !== 32) throw new Error('Invalid encryption input.');
  const iv = crypto.randomBytes(IV_BYTES); const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  return { ciphertext: Buffer.concat([cipher.update(plaintext), cipher.final()]), iv: iv.toString('base64'), authTag: cipher.getAuthTag().toString('base64') };
}
function decryptData(ciphertext, key, iv, authTag) {
  if (!Buffer.isBuffer(ciphertext) || !Buffer.isBuffer(key) || key.length !== 32) throw new Error('Invalid decryption input.');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64')); decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
function wrapKey(dek) { const result = encryptData(dek, getMasterKey()); return { encryptedKey: result.ciphertext.toString('base64'), keyIv: result.iv, keyAuthTag: result.authTag, encryptionKeyVersion: KEY_VERSION }; }
function unwrapKey(wrapped) { return decryptData(Buffer.from(wrapped.encryptedKey, 'base64'), getMasterKey(), wrapped.keyIv, wrapped.keyAuthTag); }
function calculateSha256(data) { return crypto.createHash('sha256').update(data).digest('hex'); }
function verifySha256(data, expectedHash) { if (typeof expectedHash !== 'string' || !/^[a-f0-9]{64}$/i.test(expectedHash)) return false; const actual = Buffer.from(calculateSha256(data), 'hex'); const expected = Buffer.from(expectedHash, 'hex'); return actual.length === expected.length && crypto.timingSafeEqual(actual, expected); }
function encryptQuestionPaper(plaintext) { const dek = generateEncryptionKey(); const encrypted = encryptData(plaintext, dek); return { ciphertext: encrypted.ciphertext, ...wrapKey(dek), iv: encrypted.iv, authTag: encrypted.authTag, encryptionAlgorithm: 'AES-256-GCM', hashAlgorithm: 'SHA-256' }; }
function decryptQuestionPaper(ciphertext, paper) { return decryptData(ciphertext, unwrapKey(paper), paper.iv, paper.authTag); }
async function encryptQuestionPaperWithKms(plaintext, kms) {
  const keyMaterial = await kms.generateDataKey();
  try {
    const encrypted = encryptData(plaintext, keyMaterial.plaintextKey);
    return { ciphertext: encrypted.ciphertext, encryptedKey: keyMaterial.encryptedKey.toString('base64'), keyIv: null, keyAuthTag: null, iv: encrypted.iv, authTag: encrypted.authTag, encryptionAlgorithm: 'AES-256-GCM', encryptionKeyVersion: KMS_KEY_VERSION, encryptionKeySource: 'AWS_KMS', hashAlgorithm: 'SHA-256' };
  } finally { keyMaterial.plaintextKey.fill(0); }
}
async function decryptQuestionPaperWithKms(ciphertext, paper, kms) {
  const plaintextKey = await kms.decryptDataKey(Buffer.from(paper.encryptedKey, 'base64'));
  try { return decryptData(ciphertext, plaintextKey, paper.iv, paper.authTag); } finally { plaintextKey.fill(0); }
}
module.exports = { ALGORITHM, KEY_VERSION, KMS_KEY_VERSION, getMasterKey, generateEncryptionKey, encryptData, decryptData, wrapKey, unwrapKey, calculateSha256, verifySha256, encryptQuestionPaper, decryptQuestionPaper, encryptQuestionPaperWithKms, decryptQuestionPaperWithKms };
