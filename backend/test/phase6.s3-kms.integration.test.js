const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase6-test-only-secret';
process.env.STORAGE_PROVIDER = 's3';
process.env.AWS_REGION = 'ap-south-1';
process.env.AWS_S3_BUCKET = 'phase6-test-private-bucket';
process.env.AWS_KMS_KEY_ID = 'alias/phase6-test-key';

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { KMSClient, GenerateDataKeyCommand, DecryptCommand } = require('@aws-sdk/client-kms');
const originalS3Send = S3Client.prototype.send;
const originalKmsSend = KMSClient.prototype.send;
const objects = new Map();
const plaintextKey = Buffer.alloc(32, 7);
const encryptedKey = Buffer.from('phase6-kms-ciphertext-key');
const calls = { generateDataKey: 0, decrypt: 0, put: 0, get: 0 };
let failKmsGenerate = false;
let failKmsDecrypt = false;
let failS3Put = false;

S3Client.prototype.send = async command => {
  if (command instanceof PutObjectCommand) {
    calls.put += 1;
    if (failS3Put) throw new Error('S3 unavailable');
    objects.set(command.input.Key, Buffer.from(command.input.Body));
    return {};
  }
  if (command instanceof GetObjectCommand) {
    calls.get += 1;
    const body = objects.get(command.input.Key);
    if (!body) { const error = new Error('missing'); error.name = 'NoSuchKey'; error.$metadata = { httpStatusCode: 404 }; throw error; }
    return { Body: { transformToByteArray: async () => Uint8Array.from(body) } };
  }
  if (command instanceof DeleteObjectCommand) { objects.delete(command.input.Key); return {}; }
  if (command instanceof HeadObjectCommand) {
    if (!objects.has(command.input.Key)) { const error = new Error('missing'); error.name = 'NotFound'; error.$metadata = { httpStatusCode: 404 }; throw error; }
    return {};
  }
  throw new Error('Unexpected S3 command');
};

KMSClient.prototype.send = async command => {
  if (command instanceof GenerateDataKeyCommand) {
    calls.generateDataKey += 1;
    if (failKmsGenerate) throw new Error('KMS unavailable');
    assert.equal(command.input.KeyId, process.env.AWS_KMS_KEY_ID);
    assert.equal(command.input.KeySpec, 'AES_256');
    return { Plaintext: Uint8Array.from(plaintextKey), CiphertextBlob: Uint8Array.from(encryptedKey) };
  }
  if (command instanceof DecryptCommand) {
    calls.decrypt += 1;
    if (failKmsDecrypt) throw new Error('KMS unavailable');
    assert.deepEqual(Buffer.from(command.input.CiphertextBlob), encryptedKey);
    return { Plaintext: Uint8Array.from(plaintextKey) };
  }
  throw new Error('Unexpected KMS command');
};

const app = require('../src/app');
const connectDatabase = require('../src/config/database');
const User = require('../src/models/User');
const QuestionPaper = require('../src/models/QuestionPaper');
const AuditLog = require('../src/models/AuditLog');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

let server;
let baseUrl;

async function request(url, options = {}) {
  const response = await fetch(baseUrl + url, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  return { status: response.status, body: await response.json() };
}

async function createPaper(token, title) {
  const result = await request('/question-papers', { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ title, examName: 'Cloud Exam', subject: 'Security' }) });
  assert.equal(result.status, 201);
  return result.body.paper.id;
}

async function upload(token, id) {
  const form = new FormData();
  const pdf = new Blob(['%PDF-1.4\nphase6 secure paper'], { type: 'application/pdf' });
  form.append('file', pdf, 'paper.pdf');
  const response = await fetch(baseUrl + `/question-papers/${id}/upload`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
  return { status: response.status, body: await response.json() };
}

async function tokenFor(email) {
  const user = await User.create({ name: 'Phase Six Setter', email, passwordHash: await bcrypt.hash('Password123', 10), role: 'QUESTION_SETTER' });
  return require('../src/services/tokenService').issueToken(user);
}

test.before(async () => {
  await connectDatabase();
  await User.deleteMany({ email: /phase6-test-/ });
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  await QuestionPaper.deleteMany({ title: /^Phase6 Test/ });
  await User.deleteMany({ email: /phase6-test-/ });
  S3Client.prototype.send = originalS3Send;
  KMSClient.prototype.send = originalKmsSend;
  await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
});

test('S3/KMS storage encrypts only ciphertext, redacts crypto metadata, and blocks tampering before KMS decrypt', async () => {
  const token = await tokenFor('phase6-test-setter@example.com');
  const id = await createPaper(token, 'Phase6 Test S3 Paper');
  const uploaded = await upload(token, id);
  assert.equal(uploaded.status, 200);
  assert.equal(uploaded.body.paper.storageKey, undefined);
  assert.equal(uploaded.body.paper.encryptedKey, undefined);
  assert.equal(uploaded.body.paper.encryptionKeySource, undefined);

  const paper = await QuestionPaper.findById(id).select('+storageProvider +encryptionKeySource +encryptedKey +keyIv +keyAuthTag +iv +authTag +encryptedFileHash');
  assert.equal(paper.storageProvider, 's3');
  assert.equal(paper.encryptionKeySource, 'AWS_KMS');
  assert.equal(paper.encryptedKey, encryptedKey.toString('base64'));
  assert.notEqual(paper.encryptedKey, plaintextKey.toString('base64'));
  assert.equal(paper.keyIv, null);
  assert.equal(paper.keyAuthTag, null);
  const ciphertext = objects.get(paper.storageKey);
  assert.ok(ciphertext);
  assert.notDeepEqual(ciphertext, Buffer.from('%PDF-1.4\nphase6 secure paper'));
  assert.equal(ciphertext.subarray(0, 5).equals(Buffer.from('%PDF-')), false);
  assert.equal(crypto.createHash('sha256').update(ciphertext).digest('hex'), paper.encryptedFileHash);

  const download = await fetch(baseUrl + `/question-papers/${id}/download`, { headers: { authorization: `Bearer ${token}` } });
  assert.equal(download.status, 200);
  assert.deepEqual(Buffer.from(await download.arrayBuffer()), Buffer.from('%PDF-1.4\nphase6 secure paper'));
  assert.equal(calls.decrypt, 1);

  objects.set(paper.storageKey, Buffer.concat([ciphertext, Buffer.from('tamper')]));
  const decryptsBeforeTamper = calls.decrypt;
  assert.equal((await request(`/question-papers/${id}/download`, { headers: { authorization: `Bearer ${token}` } })).status, 422);
  assert.equal(calls.decrypt, decryptsBeforeTamper);
  assert.ok(await AuditLog.exists({ action: 'QUESTION_PAPER_INTEGRITY_CHECK_FAILED', targetId: id }));
});

test('S3/KMS failures are safe and never fall back to local storage', async () => {
  const token = await tokenFor('phase6-test-failures@example.com');
  const localDirectory = path.resolve(__dirname, '../storage/question-papers');
  const beforeLocal = (await fs.readdir(localDirectory)).filter(name => name.endsWith('.enc'));

  const kmsFailurePaper = await createPaper(token, 'Phase6 Test KMS Generate Failure');
  failKmsGenerate = true;
  assert.equal((await upload(token, kmsFailurePaper)).status, 502);
  failKmsGenerate = false;
  assert.ok(await AuditLog.exists({ action: 'KMS_GENERATE_DATA_KEY_FAILED', targetId: kmsFailurePaper }));

  const s3FailurePaper = await createPaper(token, 'Phase6 Test S3 Failure');
  failS3Put = true;
  assert.equal((await upload(token, s3FailurePaper)).status, 502);
  failS3Put = false;
  assert.ok(await AuditLog.exists({ action: 'S3_QUESTION_PAPER_UPLOAD_FAILED', targetId: s3FailurePaper }));
  assert.deepEqual((await fs.readdir(localDirectory)).filter(name => name.endsWith('.enc')), beforeLocal);

  const decryptFailurePaper = await createPaper(token, 'Phase6 Test KMS Decrypt Failure');
  assert.equal((await upload(token, decryptFailurePaper)).status, 200);
  failKmsDecrypt = true;
  assert.equal((await request(`/question-papers/${decryptFailurePaper}/download`, { headers: { authorization: `Bearer ${token}` } })).status, 502);
  failKmsDecrypt = false;
  assert.ok(await AuditLog.exists({ action: 'KMS_DECRYPT_FAILED', targetId: decryptFailurePaper }));
});
