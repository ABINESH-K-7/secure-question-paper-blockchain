const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'phase7-test-only-secret';
process.env.QUESTION_PAPER_MASTER_KEY = crypto.randomBytes(32).toString('base64');
process.env.STORAGE_PROVIDER = 'local';

const app = require('../src/app');
const connectDatabase = require('../src/config/database');
const User = require('../src/models/User');
const QuestionPaper = require('../src/models/QuestionPaper');
const QuestionPaperReview = require('../src/models/QuestionPaperReview');
const AuditLog = require('../src/models/AuditLog');
const storage = require('../src/services/questionPaperStorageService');
const tokenService = require('../src/services/tokenService');
const mongoose = require('mongoose');

let server;
let baseUrl;
let setter;
let reviewerOne;
let reviewerTwo;
let admin;
let centre;
let setterToken;
let reviewerOneToken;
let reviewerTwoToken;
let adminToken;
let centreToken;

async function request(url, options = {}) {
  const response = await fetch(baseUrl + url, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } });
  return { status: response.status, body: await response.json() };
}
const auth = token => ({ authorization: `Bearer ${token}` });

async function createPaper(title, token = setterToken) {
  const result = await request('/question-papers', { method: 'POST', headers: auth(token), body: JSON.stringify({ title, examName: 'Review Exam', subject: 'Cryptography' }) });
  assert.equal(result.status, 201);
  return result.body.paper.id;
}

async function uploadPaper(id, token = setterToken, content = '%PDF-1.4\nphase7 paper') {
  const form = new FormData();
  form.append('file', new Blob([content], { type: 'application/pdf' }), 'review.pdf');
  const response = await fetch(baseUrl + `/question-papers/${id}/upload`, { method: 'POST', headers: auth(token), body: form });
  return { status: response.status, body: await response.json() };
}

async function createSubmittedPaper(title) {
  const id = await createPaper(title);
  assert.equal((await uploadPaper(id)).status, 200);
  assert.equal((await request(`/question-papers/${id}/submit`, { method: 'POST', headers: auth(setterToken) })).status, 200);
  return id;
}

async function createUser(name, email, role) { return User.create({ name, email, passwordHash: 'phase7-test-hash', role }); }

test.before(async () => {
  await connectDatabase();
  await User.deleteMany({ email: /phase7-test-/ });
  setter = await createUser('Phase Seven Setter', 'phase7-test-setter@example.com', 'QUESTION_SETTER');
  reviewerOne = await createUser('Reviewer One', 'phase7-test-reviewer-one@example.com', 'REVIEWER');
  reviewerTwo = await createUser('Reviewer Two', 'phase7-test-reviewer-two@example.com', 'REVIEWER');
  admin = await createUser('Phase Seven Admin', 'phase7-test-admin@example.com', 'ADMIN');
  centre = await createUser('Phase Seven Centre', 'phase7-test-centre@example.com', 'EXAM_CENTER');
  setterToken = tokenService.issueToken(setter); reviewerOneToken = tokenService.issueToken(reviewerOne); reviewerTwoToken = tokenService.issueToken(reviewerTwo); adminToken = tokenService.issueToken(admin); centreToken = tokenService.issueToken(centre);
  server = app.listen(0); baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

test.after(async () => {
  const papers = await QuestionPaper.find({ title: /^Phase7 Test/ }).select('+storageProvider').lean();
  await Promise.all(papers.map(paper => storage.getStorage(paper.storageProvider || 'local').remove(paper.storageKey).catch(() => {})));
  await QuestionPaperReview.deleteMany({ paperId: { $in: papers.map(paper => paper._id) } });
  await QuestionPaper.deleteMany({ title: /^Phase7 Test/ });
  await User.deleteMany({ email: /phase7-test-/ });
  await new Promise(resolve => server.close(resolve));
  await mongoose.disconnect();
});

test('reviewer endpoints enforce RBAC and only list eligible submitted papers', async () => {
  assert.equal((await request('/reviewer/dashboard/stats', { headers: auth(reviewerOneToken) })).status, 200);
  assert.equal((await request('/reviewer/dashboard/stats', { headers: auth(setterToken) })).status, 403);
  assert.equal((await request('/reviewer/dashboard/stats', { headers: auth(centreToken) })).status, 403);
  assert.equal((await request('/admin/users', { headers: auth(adminToken) })).status, 200);
  const draftId = await createPaper('Phase7 Test Draft Hidden');
  const submittedId = await createSubmittedPaper('Phase7 Test Eligible Review');
  const listed = await request('/reviewer/question-papers', { headers: auth(reviewerOneToken) });
  assert.equal(listed.status, 200);
  assert.equal(listed.body.papers.some(paper => paper.id === submittedId), true);
  assert.equal(listed.body.papers.some(paper => paper.id === draftId), false);
  assert.equal(listed.body.papers.some(paper => 'encryptedKey' in paper || 'storageKey' in paper), false);
});

test('claim, secure reviewer access, approval, and conflict-of-interest rules are server controlled', async () => {
  const id = await createSubmittedPaper('Phase7 Test Claim And Approve');
  const claimed = await request(`/reviewer/question-papers/${id}/claim`, { method: 'POST', headers: auth(reviewerOneToken) });
  assert.equal(claimed.status, 200);
  assert.equal(claimed.body.paper.status, 'UNDER_REVIEW');
  assert.equal((await request(`/reviewer/question-papers/${id}/claim`, { method: 'POST', headers: auth(reviewerTwoToken) })).status, 409);
  assert.equal((await request(`/reviewer/question-papers/${id}`, { headers: auth(reviewerTwoToken) })).status, 404);
  const secureDownload = await fetch(baseUrl + `/question-papers/${id}/download`, { headers: auth(reviewerOneToken) });
  assert.equal(secureDownload.status, 200);
  assert.equal(secureDownload.headers.get('content-type'), 'application/pdf');
  const approved = await request(`/reviewer/question-papers/${id}/approve`, { method: 'POST', headers: auth(reviewerOneToken), body: JSON.stringify({ comment: 'Ready for the next review phase.' }) });
  assert.equal(approved.status, 200);
  assert.equal(approved.body.paper.status, 'REVIEWER_APPROVED');
  const stored = await QuestionPaper.findById(id).select('+reviewerId');
  assert.equal(stored.reviewerId.toString(), reviewerOne.id);
  assert.ok(stored.reviewedAt);
  assert.ok(await AuditLog.exists({ action: 'REVIEWER_PAPER_APPROVED', targetId: id }));
  assert.equal((await request(`/reviewer/question-papers/${id}/approve`, { method: 'POST', headers: auth(reviewerOneToken), body: JSON.stringify({}) })).status, 409);
  assert.equal((await uploadPaper(id)).status, 409);

  const ownPaper = await QuestionPaper.create({ title: 'Phase7 Test Reviewer Own Paper', examName: 'Review Exam', subject: 'Cryptography', status: 'SUBMITTED', createdBy: reviewerOne._id, submittedAt: new Date() });
  assert.equal((await request(`/reviewer/question-papers/${ownPaper.id}/claim`, { method: 'POST', headers: auth(reviewerOneToken) })).status, 403);
  assert.ok(await AuditLog.exists({ action: 'REVIEWER_SELF_REVIEW_ATTEMPT', targetId: ownPaper.id }));
});

test('rejection requires a reason and the original setter can revise and re-encrypt only after rejection', async () => {
  const id = await createSubmittedPaper('Phase7 Test Reject And Resubmit');
  assert.equal((await request(`/reviewer/question-papers/${id}/claim`, { method: 'POST', headers: auth(reviewerTwoToken) })).status, 200);
  assert.equal((await request(`/reviewer/question-papers/${id}/reject`, { method: 'POST', headers: auth(reviewerTwoToken), body: JSON.stringify({ comment: 'no' }) })).status, 400);
  const rejected = await request(`/reviewer/question-papers/${id}/reject`, { method: 'POST', headers: auth(reviewerTwoToken), body: JSON.stringify({ comment: 'Please correct the marks distribution.' }) });
  assert.equal(rejected.status, 200);
  assert.equal(rejected.body.paper.status, 'REVIEWER_REJECTED');
  assert.equal(rejected.body.paper.reviewComment, 'Please correct the marks distribution.');
  assert.ok(await AuditLog.exists({ action: 'REVIEWER_PAPER_REJECTED', targetId: id }));
  assert.equal((await request(`/question-papers/${id}/revise`, { method: 'POST', headers: auth(reviewerOneToken) })).status, 403);
  const before = await QuestionPaper.findById(id).select('+encryptedKey +iv +encryptedFileHash');
  assert.equal((await request(`/question-papers/${id}/revise`, { method: 'POST', headers: auth(setterToken) })).status, 200);
  assert.equal((await uploadPaper(id, setterToken, '%PDF-1.4\ncorrected phase7 paper')).status, 200);
  const after = await QuestionPaper.findById(id).select('+encryptedKey +iv +encryptedFileHash');
  assert.equal(after.status, 'DRAFT');
  assert.notEqual(after.encryptedKey, before.encryptedKey);
  assert.notEqual(after.iv, before.iv);
  assert.notEqual(after.encryptedFileHash, before.encryptedFileHash);
  assert.equal((await request(`/question-papers/${id}/submit`, { method: 'POST', headers: auth(setterToken) })).status, 200);
  const history = await request(`/reviewer/question-papers/${id}/reviews`, { headers: auth(reviewerTwoToken) });
  assert.equal(history.status, 200);
  assert.equal(history.body.reviews.some(review => review.action === 'REJECTED'), true);
  assert.equal(history.body.reviews.some(review => review.action === 'RELEASED_FOR_CORRECTION'), true);
});
