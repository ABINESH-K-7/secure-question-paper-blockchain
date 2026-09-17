const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase10a-test-only-secret';
process.env.STORAGE_PROVIDER = 'local';

const app = require('../src/app');
const connectDatabase = require('../src/config/database');
const User = require('../src/models/User');
const QuestionPaper = require('../src/models/QuestionPaper');
const AuditLog = require('../src/models/AuditLog');
const tokens = require('../src/services/tokenService');
const mongoose = require('mongoose');

let server;
let baseUrl;
let users;
let auth;
const releaseAt = '2030-06-15T09:30:00.000Z';

async function request(path, options = {}) {
  const response = await fetch(baseUrl + path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  return { status: response.status, body: await response.json() };
}

async function lockedPaper(overrides = {}) {
  return QuestionPaper.create({
    title: 'Phase10A Locked Paper', examName: 'Release Controls', subject: 'Security', createdBy: users.setter._id,
    status: 'LOCKED', isLocked: true, lockedAt: new Date(), lockedBy: users.authority._id,
    storageKey: 'phase10a.enc', fileStoredName: 'phase10a.enc', encryptedFileHash: 'ab'.repeat(32),
    encryptedKey: 'wrapped-key', iv: 'iv', authTag: 'tag', encryptionAlgorithm: 'AES-256-GCM', encryptionKeyVersion: 'test',
    blockchainStatus: 'ANCHORED', blockchainPaperIdHash: '0x' + '11'.repeat(32), blockchainArtifactHash: 'ab'.repeat(32), blockchainTransactionHash: '0xtx', blockchainBlockNumber: 12, blockchainChainId: '31337', blockchainContractAddress: '0x' + '22'.repeat(20), blockchainAnchoredAt: new Date('2030-01-01T00:00:00.000Z'),
    ...overrides,
  });
}

function schedule(id, token, value = releaseAt) {
  return request(`/exam-authority/question-papers/${id}/schedule-release`, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: JSON.stringify({ scheduledReleaseAt: value }) });
}

test.before(async () => {
  await connectDatabase();
  users = {};
  auth = {};
  for (const role of ['QUESTION_SETTER', 'REVIEWER', 'SECURITY_OFFICER', 'EXAM_AUTHORITY', 'EXAM_CENTER']) {
    const user = await User.create({ name: `Phase10A ${role}`, email: `phase10a-${role.toLowerCase()}@example.com`, passwordHash: 'hash', role });
    users[role === 'QUESTION_SETTER' ? 'setter' : role === 'EXAM_AUTHORITY' ? 'authority' : role.toLowerCase()] = user;
    auth[role] = tokens.issueToken(user);
  }
  server = app.listen(0);
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.beforeEach(async () => {
  await QuestionPaper.deleteMany({ title: /^Phase10A/ });
  await AuditLog.deleteMany({ action: /^RELEASE_SCHEDULE/ });
});

test.after(async () => {
  await QuestionPaper.deleteMany({ title: /^Phase10A/ });
  await AuditLog.deleteMany({ action: /^RELEASE_SCHEDULE/ });
  await User.deleteMany({ email: /phase10a-/ });
  await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
});

test('EXAM_AUTHORITY schedules a LOCKED paper as a MongoDB Date and creates an audit event', async () => {
  const paper = await lockedPaper();
  const before = await QuestionPaper.findById(paper._id).select('+encryptedFileHash +encryptedKey +iv +authTag +blockchainPaperIdHash +blockchainArtifactHash');
  const result = await schedule(paper.id, auth.EXAM_AUTHORITY);
  assert.equal(result.status, 200);
  assert.equal(result.body.releaseStatus, 'SCHEDULED');
  const after = await QuestionPaper.findById(paper._id).select('+encryptedFileHash +encryptedKey +iv +authTag +blockchainPaperIdHash +blockchainArtifactHash');
  assert.ok(after.scheduledReleaseAt instanceof Date);
  assert.equal(after.scheduledReleaseAt.toISOString(), releaseAt);
  assert.equal(after.releaseStatus, 'SCHEDULED');
  for (const field of ['storageKey', 'encryptedFileHash', 'encryptedKey', 'iv', 'authTag', 'blockchainStatus', 'blockchainPaperIdHash', 'blockchainArtifactHash', 'blockchainTransactionHash', 'blockchainBlockNumber', 'blockchainChainId', 'blockchainContractAddress']) assert.deepEqual(after[field], before[field]);
  assert.ok(await AuditLog.exists({ action: 'RELEASE_SCHEDULED', targetId: paper.id }));
});

test('non-authorized roles cannot schedule a release', async () => {
  const paper = await lockedPaper();
  for (const role of ['QUESTION_SETTER', 'REVIEWER', 'SECURITY_OFFICER', 'EXAM_CENTER']) assert.equal((await schedule(paper.id, auth[role])).status, 403);
  const unchanged = await QuestionPaper.findById(paper._id);
  assert.equal(unchanged.releaseStatus, 'NOT_SCHEDULED');
  assert.equal(unchanged.scheduledReleaseAt, null);
});

test('does not schedule a paper that is not LOCKED', async () => {
  const paper = await lockedPaper({ status: 'AUTHORITY_REVIEW', isLocked: false, lockedBy: null });
  const result = await schedule(paper.id, auth.EXAM_AUTHORITY);
  assert.equal(result.status, 409);
  assert.equal((await QuestionPaper.findById(paper._id)).releaseStatus, 'NOT_SCHEDULED');
});

test('rejects an invalid release timestamp', async () => {
  const paper = await lockedPaper();
  const result = await schedule(paper.id, auth.EXAM_AUTHORITY, '15/06/2030 09:30');
  assert.equal(result.status, 400);
  assert.equal((await QuestionPaper.findById(paper._id)).scheduledReleaseAt, null);
});

test('does not release a paper when a past ISO timestamp is scheduled', async () => {
  const paper = await lockedPaper();
  const result = await schedule(paper.id, auth.EXAM_AUTHORITY, '2020-01-01T00:00:00.000Z');
  assert.equal(result.status, 200);
  const stored = await QuestionPaper.findById(paper._id);
  assert.equal(stored.releaseStatus, 'SCHEDULED');
  assert.equal(stored.status, 'LOCKED');
});

test('prevents arbitrary rescheduling after a schedule is set', async () => {
  const paper = await lockedPaper();
  assert.equal((await schedule(paper.id, auth.EXAM_AUTHORITY)).status, 200);
  const result = await schedule(paper.id, auth.EXAM_AUTHORITY, '2031-06-15T09:30:00.000Z');
  assert.equal(result.status, 409);
  assert.equal((await QuestionPaper.findById(paper._id)).scheduledReleaseAt.toISOString(), releaseAt);
});
