const assert = require('node:assert/strict');
const test = require('node:test');
const Module = require('node:module');

const controllerPath = require.resolve('../src/controllers/questionPaperController');

function loadController({ enabled = false, status = 'LOCKED', releaseStatus = 'SCHEDULED', scheduledReleaseAt = new Date(Date.now() - 1000), hashValid = true, blockchainResult = true, blockchainError, role = 'EXAM_CENTER' } = {}) {
  const order = [];
  const audits = [];
  const paper = {
    id: '507f1f77bcf86cd799439011', _id: '507f1f77bcf86cd799439011', status, releaseStatus, scheduledReleaseAt,
    storageKey: 'paper.enc', storageProvider: 's3', encryptedFileHash: 'ab'.repeat(32), encryptedKey: 'wrapped-key', iv: 'iv', authTag: 'tag', encryptionKeySource: 'AWS_KMS', fileOriginalName: 'final.pdf',
    save: async () => { order.push('Release status'); },
  };
  const query = { select: () => query, then: (resolve, reject) => Promise.resolve(paper).then(resolve, reject) };
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (request === 'mongoose') return { isObjectIdOrHexString: () => true };
    if (request === '../models/QuestionPaper') return { findById: () => query };
    if (request === '../models/QuestionPaperReview' || request === '../models/QuestionPaperApproval') return {};
    if (request === '../config/env') return { blockchainEnabled: enabled };
    if (request === '../services/questionPaperStorageService') return { getStorage: () => ({ getEncryptedFile: async () => { order.push('Artifact'); return Buffer.from('ciphertext'); } }) };
    if (request === '../services/encryptionService') return {
      verifySha256: () => { order.push('SHA-256'); order.push('MongoDB'); return hashValid; },
      decryptQuestionPaperWithKms: async () => { order.push('KMS'); order.push('AES-GCM'); return Buffer.from('%PDF-1.4\nreleased'); },
    };
    if (request === '../services/kmsEncryptionService') return {};
    if (request === '../services/blockchainService') return { verify: async () => { order.push('Blockchain'); if (blockchainError) throw blockchainError; return blockchainResult; }, anchor: async () => { throw new Error('release must not anchor'); } };
    if (request === '../services/auditService') return { audit: async (_request, action) => { audits.push(action); } };
    return originalLoad.call(this, request, parent, isMain);
  };
  delete require.cache[controllerPath];
  const controller = require(controllerPath);
  const response = {
    statusCode: 200, body: undefined, sent: undefined,
    status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; },
    set() { return this; }, send(value) { this.sent = value; return this; },
  };
  const request = { params: { id: paper.id }, user: { _id: 'exam-centre', role } };
  return { controller, order, audits, paper, request, response, restore: () => { Module._load = originalLoad; delete require.cache[controllerPath]; } };
}

async function release(fixture) { await fixture.controller.releasePaper(fixture.request, fixture.response, error => { throw error; }); }

test('denies every non-EXAM_CENTER role before artifact retrieval', async () => {
  for (const role of ['ADMIN', 'QUESTION_SETTER', 'REVIEWER', 'SECURITY_OFFICER', 'EXAM_AUTHORITY']) {
    const fixture = loadController({ role });
    try { await release(fixture); assert.equal(fixture.response.statusCode, 403); assert.deepEqual(fixture.order, []); } finally { fixture.restore(); }
  }
});

test('blocks an Exam Centre before the scheduled time without decryption', async () => {
  const fixture = loadController({ scheduledReleaseAt: new Date(Date.now() + 60_000) });
  try { await release(fixture); assert.equal(fixture.response.statusCode, 403); assert.deepEqual(fixture.order, []); assert.equal(fixture.response.sent, undefined); assert.ok(fixture.audits.includes('RELEASE_BLOCKED_BEFORE_SCHEDULE')); } finally { fixture.restore(); }
});

test('releases a valid scheduled LOCKED paper with blockchain disabled only after SHA-256/MongoDB validation', async () => {
  const fixture = loadController();
  try { await release(fixture); assert.equal(fixture.response.statusCode, 200); assert.deepEqual(fixture.order, ['Artifact', 'SHA-256', 'MongoDB', 'KMS', 'AES-GCM', 'Release status']); assert.equal(fixture.paper.releaseStatus, 'RELEASED'); assert.ok(fixture.response.sent); } finally { fixture.restore(); }
});

test('uses SHA-256, MongoDB, blockchain, KMS, and AES-GCM in order when blockchain is enabled', async () => {
  const fixture = loadController({ enabled: true });
  try { await release(fixture); assert.equal(fixture.response.statusCode, 200); assert.deepEqual(fixture.order, ['Artifact', 'SHA-256', 'MongoDB', 'Blockchain', 'KMS', 'AES-GCM', 'Release status']); } finally { fixture.restore(); }
});

test('blocks a MongoDB hash mismatch before blockchain, KMS, AES-GCM, or PDF output', async () => {
  const fixture = loadController({ enabled: true, hashValid: false });
  try { await release(fixture); assert.equal(fixture.response.statusCode, 422); assert.deepEqual(fixture.order, ['Artifact', 'SHA-256', 'MongoDB']); assert.equal(fixture.response.sent, undefined); assert.ok(fixture.audits.includes('RELEASE_INTEGRITY_FAILED')); } finally { fixture.restore(); }
});

test('blocks a blockchain mismatch before KMS, AES-GCM, or PDF output', async () => {
  const fixture = loadController({ enabled: true, blockchainResult: false });
  try { await release(fixture); assert.equal(fixture.response.statusCode, 422); assert.deepEqual(fixture.order, ['Artifact', 'SHA-256', 'MongoDB', 'Blockchain']); assert.equal(fixture.response.sent, undefined); assert.ok(fixture.audits.includes('RELEASE_BLOCKCHAIN_VERIFICATION_FAILED')); } finally { fixture.restore(); }
});

test('fails closed when blockchain verification is unavailable', async () => {
  const fixture = loadController({ enabled: true, blockchainError: new Error('unavailable') });
  try { await release(fixture); assert.equal(fixture.response.statusCode, 422); assert.equal(fixture.order.includes('KMS'), false); assert.equal(fixture.order.includes('AES-GCM'), false); assert.equal(fixture.response.sent, undefined); } finally { fixture.restore(); }
});

test('denies non-LOCKED papers before artifact retrieval', async () => {
  const fixture = loadController({ status: 'AUTHORITY_REVIEW' });
  try { await release(fixture); assert.equal(fixture.response.statusCode, 403); assert.deepEqual(fixture.order, []); } finally { fixture.restore(); }
});

test('allows an already RELEASED paper to be retrieved again without anchoring', async () => {
  const fixture = loadController({ enabled: true, releaseStatus: 'RELEASED' });
  try { await release(fixture); assert.equal(fixture.response.statusCode, 200); assert.equal(fixture.order.includes('Release status'), false); assert.equal(fixture.order.includes('Blockchain'), true); } finally { fixture.restore(); }
});

test('denies a LOCKED paper that has no schedule and audits request and denial', async () => {
  const fixture = loadController({ releaseStatus: 'NOT_SCHEDULED', scheduledReleaseAt: null });
  try { await release(fixture); assert.equal(fixture.response.statusCode, 403); assert.deepEqual(fixture.order, []); assert.ok(fixture.audits.includes('RELEASE_ACCESS_REQUESTED')); assert.ok(fixture.audits.includes('RELEASE_ACCESS_DENIED')); } finally { fixture.restore(); }
});
