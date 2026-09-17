const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

const controllerPath = require.resolve('../src/controllers/questionPaperController');
const digest = 'ab'.repeat(32);

function loadController({ enabled, mongoHashValid = true, blockchainResult = true, blockchainError } = {}) {
  const calls = [];
  const order = [];
  const paper = {
    id: '507f1f77bcf86cd799439011', _id: '507f1f77bcf86cd799439011', storageKey: 'paper.enc', storageProvider: 's3',
    encryptedFileHash: digest, encryptedKey: 'wrapped-key', iv: 'iv', authTag: 'tag', encryptionKeySource: 'AWS_KMS',
    fileOriginalName: 'paper.pdf', createdBy: { equals: () => true },
  };
  const query = { select: () => query, then: (resolve, reject) => { order.push('Authorize'); return Promise.resolve(paper).then(resolve, reject); } };
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'mongoose') return { isObjectIdOrHexString: () => true };
    if (request === '../models/QuestionPaper') return { findById: () => query };
    if (request === '../models/QuestionPaperReview' || request === '../models/QuestionPaperApproval') return {};
    if (request === '../config/env') return { blockchainEnabled: enabled };
    if (request === '../services/questionPaperStorageService') return { getStorage: () => ({ getEncryptedFile: async () => { order.push('Retrieve encrypted artifact'); return Buffer.from('ciphertext'); } }) };
    if (request === '../services/encryptionService') return {
      verifySha256: () => { calls.push('MongoDB hash verification'); return mongoHashValid; },
      decryptQuestionPaperWithKms: async () => { calls.push('KMS'); calls.push('AES'); return Buffer.from('%PDF-1.4\nplaintext'); },
      decryptQuestionPaper: async () => { calls.push('AES'); return Buffer.from('%PDF-1.4\nplaintext'); },
    };
    if (request === '../services/kmsEncryptionService') return {};
    if (request === '../services/blockchainService') return { verify: async () => { calls.push('Blockchain verification'); if (blockchainError) throw blockchainError; return blockchainResult; } };
    if (request === '../services/auditService') return { audit: async () => {} };
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[controllerPath];
  const controller = require(controllerPath);
  const response = {
    statusCode: 200, body: undefined, sent: undefined,
    status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; },
    set() { return this; }, send(value) { this.sent = value; return this; },
  };
  const request = { params: { id: paper.id }, user: { _id: 'user-id', role: 'QUESTION_SETTER' } };
  return { controller, calls, order, request, response, restore: () => { Module._load = originalLoad; delete require.cache[controllerPath]; } };
}

async function download(fixture) { await fixture.controller.downloadPaper(fixture.request, fixture.response, error => { throw error; }); }

test('downloads with blockchain disabled without calling blockchain verification', async () => {
  const fixture = loadController({ enabled: false });
  try {
    await download(fixture);
    assert.equal(fixture.response.statusCode, 200);
    assert.deepEqual(fixture.calls, ['MongoDB hash verification', 'KMS', 'AES']);
    assert.ok(fixture.response.sent);
  } finally { fixture.restore(); }
});

test('verifies blockchain before KMS and AES when blockchain is enabled and valid', async () => {
  const fixture = loadController({ enabled: true });
  try {
    await download(fixture);
    assert.equal(fixture.response.statusCode, 200);
    assert.deepEqual(fixture.calls, ['MongoDB hash verification', 'Blockchain verification', 'MongoDB hash verification', 'KMS', 'AES']);
    assert.ok(fixture.response.sent);
  } finally { fixture.restore(); }
});

test('fails closed on a blockchain hash mismatch without KMS, AES, or PDF output', async () => {
  const fixture = loadController({ enabled: true, blockchainResult: false });
  try {
    await download(fixture);
    assert.equal(fixture.response.statusCode, 422);
    assert.deepEqual(fixture.calls, ['MongoDB hash verification', 'Blockchain verification']);
    assert.equal(fixture.response.sent, undefined);
  } finally { fixture.restore(); }
});

test('fails closed when the blockchain record is missing without KMS, AES, or PDF output', async () => {
  const fixture = loadController({ enabled: true, blockchainResult: false });
  try {
    await download(fixture);
    assert.equal(fixture.response.statusCode, 422);
    assert.equal(fixture.calls.includes('KMS'), false);
    assert.equal(fixture.calls.includes('AES'), false);
    assert.equal(fixture.response.sent, undefined);
  } finally { fixture.restore(); }
});

test('fails closed when blockchain verification is unavailable without KMS, AES, or PDF output', async () => {
  const fixture = loadController({ enabled: true, blockchainError: new Error('network unavailable') });
  try {
    await download(fixture);
    assert.equal(fixture.response.statusCode, 422);
    assert.deepEqual(fixture.calls, ['MongoDB hash verification', 'Blockchain verification']);
    assert.equal(fixture.response.sent, undefined);
  } finally { fixture.restore(); }
});

test('rejects a MongoDB ciphertext hash mismatch before blockchain, KMS, or AES', async () => {
  const fixture = loadController({ enabled: true, mongoHashValid: false });
  try {
    await download(fixture);
    assert.equal(fixture.response.statusCode, 422);
    assert.deepEqual(fixture.calls, ['MongoDB hash verification', 'MongoDB hash verification']);
    assert.equal(fixture.response.sent, undefined);
  } finally { fixture.restore(); }
});

test('keeps KMS and AES strictly after successful blockchain verification', async () => {
  const fixture = loadController({ enabled: true });
  try {
    await download(fixture);
    const blockchainIndex = fixture.calls.indexOf('Blockchain verification');
    assert.ok(blockchainIndex >= 0);
    assert.ok(fixture.calls.indexOf('KMS') > blockchainIndex);
    assert.ok(fixture.calls.indexOf('AES') > fixture.calls.indexOf('KMS'));
  } finally { fixture.restore(); }
});

test('authorizes before retrieving an encrypted artifact for blockchain verification', async () => {
  const fixture = loadController({ enabled: true });
  try {
    await download(fixture);
    assert.equal(fixture.order[0], 'Authorize');
    assert.ok(fixture.order.indexOf('Retrieve encrypted artifact') > fixture.order.indexOf('Authorize'));
  } finally { fixture.restore(); }
});
