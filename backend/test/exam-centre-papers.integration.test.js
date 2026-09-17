const test = require('node:test');
const assert = require('node:assert/strict');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'exam-centre-list-test-secret';

const app = require('../src/app');
const connectDatabase = require('../src/config/database');
const User = require('../src/models/User');
const QuestionPaper = require('../src/models/QuestionPaper');
const AuditLog = require('../src/models/AuditLog');
const tokens = require('../src/services/tokenService');
const mongoose = require('mongoose');

let server; let baseUrl; let users; let auth;
async function request(path, options = {}) { const response = await fetch(baseUrl + path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } }); return { status: response.status, body: await response.json() }; }
async function paper(title, overrides = {}) { return QuestionPaper.create({ title, examName: 'Exam Centre Test', examCode: 'ECT-1', subject: 'Security', questionPaperType: 'WEB', createdBy: users.QUESTION_SETTER._id, ...overrides }); }

test.before(async () => { await connectDatabase(); users = {}; auth = {}; for (const role of ['QUESTION_SETTER', 'REVIEWER', 'SECURITY_OFFICER', 'EXAM_AUTHORITY', 'EXAM_CENTER']) { const user = await User.create({ name: `Exam Centre ${role}`, email: `exam-centre-list-${role.toLowerCase()}@example.com`, passwordHash: 'hash', role }); users[role] = user; auth[role] = tokens.issueToken(user); } server = app.listen(0); baseUrl = `http://127.0.0.1:${server.address().port}/api`; });
test.beforeEach(async () => { await QuestionPaper.deleteMany({ title: /^Exam Centre List/ }); await AuditLog.deleteMany({ action: 'EXAM_CENTER_RELEASE_LIST_VIEWED' }); });
test.after(async () => { await QuestionPaper.deleteMany({ title: /^Exam Centre List/ }); await AuditLog.deleteMany({ action: 'EXAM_CENTER_RELEASE_LIST_VIEWED' }); await User.deleteMany({ email: /exam-centre-list-/ }); await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); });

test('Exam Centre list is authenticated, role restricted, filtered, and returns only safe metadata', async () => {
  const scheduled = await paper('Exam Centre List Scheduled', { status: 'LOCKED', releaseStatus: 'SCHEDULED', scheduledReleaseAt: new Date('2030-06-15T09:30:00.000Z'), isLocked: true });
  const released = await paper('Exam Centre List Released', { status: 'LOCKED', releaseStatus: 'RELEASED', scheduledReleaseAt: new Date('2030-06-14T09:30:00.000Z'), isLocked: true });
  await paper('Exam Centre List Draft', { status: 'DRAFT' });
  await paper('Exam Centre List Submitted', { status: 'SUBMITTED', releaseStatus: 'SCHEDULED', scheduledReleaseAt: new Date() });
  await paper('Exam Centre List Locked Unscheduled', { status: 'LOCKED', releaseStatus: 'NOT_SCHEDULED' });
  assert.equal((await request('/question-papers/exam-center')).status, 401);
  for (const role of ['QUESTION_SETTER', 'REVIEWER', 'SECURITY_OFFICER', 'EXAM_AUTHORITY']) assert.equal((await request('/question-papers/exam-center', { headers: { authorization: `Bearer ${auth[role]}` } })).status, 403);
  const result = await request('/question-papers/exam-center', { headers: { authorization: `Bearer ${auth.EXAM_CENTER}` } });
  assert.equal(result.status, 200);
  const listed = result.body.papers.filter(item => item.title.startsWith('Exam Centre List'));
  assert.deepEqual(listed.map(item => item.id).sort(), [scheduled.id, released.id].sort());
  const allowed = ['id', 'title', 'examName', 'examCode', 'subject', 'questionPaperType', 'status', 'releaseStatus', 'scheduledReleaseAt', 'createdAt'];
  for (const item of listed) { assert.equal(item.status, 'LOCKED'); assert.ok(['SCHEDULED', 'RELEASED'].includes(item.releaseStatus)); assert.deepEqual(Object.keys(item).sort(), allowed.sort()); }
  assert.ok(await AuditLog.exists({ action: 'EXAM_CENTER_RELEASE_LIST_VIEWED', userId: users.EXAM_CENTER._id }));
});
