/* Requires a local MongoDB instance. It uses only phase2-test-* accounts and removes them afterwards. */
const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
process.env.JWT_SECRET = 'phase2-test-only-secret';
process.env.QUESTION_PAPER_MASTER_KEY = crypto.randomBytes(32).toString('base64');
process.env.NODE_ENV = 'test';
const originalRandomInt = crypto.randomInt;
crypto.randomInt = () => 123456;
const app = require('../src/app');
const connectDatabase = require('../src/config/database');
const User = require('../src/models/User');
const AuditLog = require('../src/models/AuditLog');
const QuestionPaper = require('../src/models/QuestionPaper');
const questionPaperStorage = require('../src/services/questionPaperStorageService');
const encryptionService = require('../src/services/encryptionService');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
let server; let baseUrl;
async function request(path, options = {}) { const response = await fetch(baseUrl + path, { ...options, headers: { 'content-type': 'application/json', ...(options.headers || {}) } }); return { status: response.status, body: await response.json() }; }
test.before(async () => { await connectDatabase(); await User.deleteMany({ email: /phase2-test-/ }); server = app.listen(0); baseUrl = `http://127.0.0.1:${server.address().port}/api`; });
test('AES-256-GCM encryption round trip uses distinct per-paper DEKs and IVs', () => {
  const plaintext = Buffer.from('%PDF-1.4\nround-trip'); const first = encryptionService.encryptQuestionPaper(plaintext); const second = encryptionService.encryptQuestionPaper(plaintext);
  assert.deepEqual(encryptionService.decryptQuestionPaper(first.ciphertext, first), plaintext); assert.notEqual(first.encryptedKey, second.encryptedKey); assert.notEqual(first.iv, second.iv); assert.equal(encryptionService.verifySha256(first.ciphertext, encryptionService.calculateSha256(first.ciphertext)), true);
});
test.after(async () => { const papers = await QuestionPaper.find({ title: /^Phase4 Test/ }).lean(); await Promise.all(papers.map(paper => questionPaperStorage.remove(paper.storageKey).catch(() => {}))); await QuestionPaper.deleteMany({ title: /^Phase4 Test/ }); crypto.randomInt = originalRandomInt; await User.deleteMany({ email: /phase2-test-/ }); await new Promise(resolve => server.close(resolve)); await mongoose.disconnect(); });
test('public roles register while ADMIN and EXAM_CENTER are rejected', async () => {
  for (const role of ['QUESTION_SETTER', 'REVIEWER', 'SECURITY_OFFICER', 'EXAM_AUTHORITY']) { const result = await request('/auth/register', { method: 'POST', body: JSON.stringify({ name: role, email: `phase2-test-${role}@example.com`, password: 'Password123', role }) }); assert.equal(result.status, 201); assert.equal(result.body.user.role, role); }
  for (const role of ['ADMIN', 'EXAM_CENTER']) { const result = await request('/auth/register', { method: 'POST', body: JSON.stringify({ name: role, email: `phase2-test-no-${role}@example.com`, password: 'Password123', role }) }); assert.equal(result.status, 400); }
  const duplicate = await request('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Duplicate', email: 'phase2-test-QUESTION_SETTER@example.com', password: 'Password123', role: 'QUESTION_SETTER' }) }); assert.equal(duplicate.status, 409);
  const weakPassword = await request('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Weak Password', email: 'phase2-test-weak@example.com', password: 'short', role: 'QUESTION_SETTER' }) }); assert.equal(weakPassword.status, 400);
});
test('MFA blocks wrong OTP, accepts correct OTP once, and protects /me', async () => {
  const email = 'phase2-test-login@example.com'; await request('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Login Test', email, password: 'Password123', role: 'QUESTION_SETTER' }) });
  const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'Password123' }) }); assert.equal(login.status, 200); assert.ok(login.body.challengeId);
  assert.equal((await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: login.body.challengeId, otp: '000000' }) })).status, 401);
  const verified = await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: login.body.challengeId, otp: '123456' }) }); assert.equal(verified.status, 200); assert.ok(verified.body.token); assert.equal(verified.body.user.passwordHash, undefined);
  assert.equal((await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: login.body.challengeId, otp: '123456' }) })).status, 401);
  assert.equal((await request('/auth/me', { headers: { authorization: `Bearer ${verified.body.token}` } })).status, 200);
  assert.equal((await request('/auth/me')).status, 401);
  assert.equal((await request('/auth/me', { headers: { authorization: 'Bearer invalid-token' } })).status, 401);
  const stored = await User.findOne({ email }).select('+passwordHash +mfaCodeHash'); assert.ok(stored.passwordHash.startsWith('$2')); assert.equal(stored.mfaCodeHash, undefined);
});
test('demo OTP is returned only when the backend demo mode is enabled', async () => {
  const email = 'phase2-test-demo-otp@example.com';
  await request('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Demo OTP Test', email, password: 'Password123', role: 'QUESTION_SETTER' }) });
  const previousDemoMode = process.env.MFA_DISPLAY_OTP; const previousRandomInt = crypto.randomInt;
  try {
    process.env.MFA_DISPLAY_OTP = 'false';
    const hidden = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'Password123' }) });
    assert.equal(hidden.status, 200); assert.equal(hidden.body.demoOtp, undefined);
    const otps = [123456, 654321]; crypto.randomInt = () => otps.shift(); process.env.MFA_DISPLAY_OTP = 'true';
    const displayed = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'Password123' }) });
    assert.equal(displayed.status, 200); assert.match(displayed.body.demoOtp, /^[0-9]{6}$/); assert.equal(displayed.body.demoOtp, '123456');
    const resent = await request('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ challengeId: displayed.body.challengeId }) });
    assert.equal(resent.status, 200); assert.match(resent.body.demoOtp, /^[0-9]{6}$/); assert.equal(resent.body.demoOtp, '654321');
    assert.equal((await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: displayed.body.challengeId, otp: displayed.body.demoOtp }) })).status, 401);
    assert.equal((await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: displayed.body.challengeId, otp: resent.body.demoOtp }) })).status, 200);
  } finally { crypto.randomInt = previousRandomInt; process.env.MFA_DISPLAY_OTP = previousDemoMode; }
});
test('expired OTP and replaced OTP are rejected', async () => {
  const email = 'phase2-test-otp@example.com';
  await request('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'OTP Test', email, password: 'Password123', role: 'QUESTION_SETTER' }) });
  const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'Password123' }) });
  await User.findByIdAndUpdate(login.body.challengeId, { mfaExpiresAt: new Date(Date.now() - 1000) });
  assert.equal((await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: login.body.challengeId, otp: '123456' }) })).status, 401);
  await User.findByIdAndUpdate(login.body.challengeId, { mfaCodeHash: await bcrypt.hash('111111', 12), mfaExpiresAt: new Date(Date.now() + 300000) });
  assert.equal((await request('/auth/resend-otp', { method: 'POST', body: JSON.stringify({ challengeId: login.body.challengeId }) })).status, 200);
  assert.equal((await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: login.body.challengeId, otp: '111111' }) })).status, 401);
  assert.equal((await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: login.body.challengeId, otp: '123456' }) })).status, 200);
});
test('RBAC permits admin management and rejects a non-admin', async () => {
  const admin = await User.create({ name: 'Admin', email: 'phase2-test-admin@example.com', passwordHash: await bcrypt.hash('Password123', 12), role: 'ADMIN' });
  const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: admin.email, password: 'Password123' }) }); const verified = await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: login.body.challengeId, otp: '123456' }) });
  assert.equal((await request('/admin/users', { headers: { authorization: `Bearer ${verified.body.token}` } })).status, 200);
  const center = await request('/admin/exam-centers', { method: 'POST', headers: { authorization: `Bearer ${verified.body.token}` }, body: JSON.stringify({ name: 'Centre', email: 'phase2-test-center@example.com', password: 'Password123' }) }); assert.equal(center.status, 201); assert.equal(center.body.user.role, 'EXAM_CENTER');
  const member = await request('/auth/register', { method: 'POST', body: JSON.stringify({ name: 'Member', email: 'phase2-test-member@example.com', password: 'Password123', role: 'REVIEWER' }) });
  const memberLogin = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: member.body.user.email, password: 'Password123' }) }); const memberOtp = await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: memberLogin.body.challengeId, otp: '123456' }) });
  assert.equal((await request('/admin/users', { headers: { authorization: `Bearer ${memberOtp.body.token}` } })).status, 403);
  const users = await request('/admin/users', { headers: { authorization: `Bearer ${verified.body.token}` } }); assert.equal(users.body.users.some(user => 'passwordHash' in user || 'mfaCodeHash' in user), false);
  const deactivate = await request(`/admin/users/${memberOtp.body.user.id}/status`, { method: 'PATCH', headers: { authorization: `Bearer ${verified.body.token}` }, body: JSON.stringify({ isActive: false }) }); assert.equal(deactivate.status, 200);
  assert.equal((await request('/auth/me', { headers: { authorization: `Bearer ${memberOtp.body.token}` } })).status, 401);
  assert.ok(await AuditLog.exists({ action: 'ADMIN_CREATED_EXAM_CENTER' })); assert.ok(await AuditLog.exists({ action: 'UNAUTHORIZED_ACCESS' }));
  assert.equal((await request('/auth/logout', { method: 'POST', headers: { authorization: `Bearer ${verified.body.token}` } })).status, 200);
  assert.equal((await request('/auth/me', { headers: { authorization: `Bearer ${verified.body.token}` } })).status, 401);
});
test('every non-admin role is denied admin operations and inactive users cannot log in', async () => {
  for (const role of ['QUESTION_SETTER', 'REVIEWER', 'SECURITY_OFFICER', 'EXAM_AUTHORITY', 'EXAM_CENTER']) {
    const user = await User.create({ name: role, email: `phase2-test-role-${role}@example.com`, passwordHash: await bcrypt.hash('Password123', 12), role });
    const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: user.email, password: 'Password123' }) });
    const verified = await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: login.body.challengeId, otp: '123456' }) });
    assert.equal((await request('/admin/exam-centers', { method: 'POST', headers: { authorization: `Bearer ${verified.body.token}` }, body: JSON.stringify({ name: 'Blocked', email: `phase2-test-blocked-${role}@example.com`, password: 'Password123' }) })).status, 403);
  }
  const inactive = await User.create({ name: 'Inactive', email: 'phase2-test-inactive@example.com', passwordHash: await bcrypt.hash('Password123', 12), role: 'REVIEWER', isActive: false });
  assert.equal((await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: inactive.email, password: 'Password123' }) })).status, 401);
});
test('admin dashboard, filtered lists, audit logs, and account safety protections work', async () => {
  const admin = await User.create({ name: 'Phase Three Admin', email: 'phase2-test-phase3-admin@example.com', passwordHash: await bcrypt.hash('Password123', 12), role: 'ADMIN' });
  const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: admin.email, password: 'Password123' }) });
  const verified = await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: login.body.challengeId, otp: '123456' }) }); const headers = { authorization: `Bearer ${verified.body.token}` };
  const stats = await request('/admin/dashboard/stats', { headers }); assert.equal(stats.status, 200); assert.equal(typeof stats.body.stats.totalUsers, 'number'); assert.equal((await request('/admin/dashboard/stats')).status, 401);
  const nonAdmin = await User.create({ name: 'Search Target', email: 'phase2-test-search-target@example.com', passwordHash: await bcrypt.hash('Password123', 12), role: 'SECURITY_OFFICER' });
  const list = await request('/admin/users?search=Search%20Target&role=SECURITY_OFFICER&isActive=true&page=1&limit=1&sortBy=name&sortOrder=asc', { headers }); assert.equal(list.status, 200); assert.equal(list.body.users.length, 1); assert.equal(list.body.users[0].id, nonAdmin.id.toString()); assert.equal(list.body.pagination.limit, 1);
  assert.equal((await request('/admin/users?role=NOPE', { headers })).status, 400); assert.equal((await request('/admin/users?page=-1', { headers })).status, 400); assert.equal((await request('/admin/users?sortBy=passwordHash', { headers })).status, 400);
  const centres = await request('/admin/exam-centers?limit=100', { headers }); assert.equal(centres.status, 200); assert.equal(centres.body.users.every(user => user.role === 'EXAM_CENTER'), true);
  const audit = await request('/admin/audit-logs?page=1&limit=5', { headers }); assert.equal(audit.status, 200); assert.ok(Array.isArray(audit.body.logs)); assert.equal((await request('/admin/audit-logs?role=NOPE', { headers })).status, 400);
  assert.equal((await request(`/admin/users/${admin.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ isActive: false }) })).status, 400);
  const protectedAdmin = await User.create({ name: 'Protected Final Admin', email: 'phase2-test-protected-admin@example.com', passwordHash: await bcrypt.hash('Password123', 12), role: 'ADMIN' });
  const originalCountDocuments = User.countDocuments; User.countDocuments = async filter => filter?.role === 'ADMIN' && filter?.isActive === true ? 1 : originalCountDocuments.call(User, filter);
  const lastAdminResult = await request(`/admin/users/${protectedAdmin.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ isActive: false }) }); User.countDocuments = originalCountDocuments; assert.equal(lastAdminResult.status, 400);
  const loginMember = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email: nonAdmin.email, password: 'Password123' }) }); const otpMember = await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: loginMember.body.challengeId, otp: '123456' }) });
  assert.equal((await request('/admin/dashboard/stats', { headers: { authorization: `Bearer ${otpMember.body.token}` } })).status, 403);
  assert.equal((await request(`/admin/users/${nonAdmin.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ isActive: false }) })).status, 200);
  assert.equal((await request(`/admin/users/${nonAdmin.id}/status`, { method: 'PATCH', headers, body: JSON.stringify({ isActive: true }) })).status, 200);
});
test('question setters can only manage their own PDF drafts and submitted papers are immutable', async () => {
  async function tokenFor(email, role = 'QUESTION_SETTER') {
    await request('/auth/register', { method: 'POST', body: JSON.stringify({ name: email, email, password: 'Password123', role }) });
    const login = await request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password: 'Password123' }) });
    const verified = await request('/auth/verify-otp', { method: 'POST', body: JSON.stringify({ challengeId: login.body.challengeId, otp: '123456' }) });
    return verified.body.token;
  }
  async function multipart(path, token, file) {
    const form = new FormData(); form.append('file', file, file.name || 'paper.pdf');
    const response = await fetch(baseUrl + path, { method: 'POST', headers: { authorization: `Bearer ${token}` }, body: form });
    return { status: response.status, body: await response.json() };
  }
  const ownerToken = await tokenFor('phase2-test-setter-a@example.com');
  const otherToken = await tokenFor('phase2-test-setter-b@example.com');
  const reviewerToken = await tokenFor('phase2-test-phase4-reviewer@example.com', 'REVIEWER');
  assert.equal((await request('/question-papers', { method: 'POST', body: JSON.stringify({ title: 'Phase4 Test Unauthenticated', examName: 'Exam', subject: 'Math' }) })).status, 401);
  assert.equal((await request('/question-papers', { method: 'POST', headers: { authorization: `Bearer ${reviewerToken}` }, body: JSON.stringify({ title: 'Phase4 Test Reviewer', examName: 'Exam', subject: 'Math' }) })).status, 403);
  const created = await request('/question-papers', { method: 'POST', headers: { authorization: `Bearer ${ownerToken}` }, body: JSON.stringify({ title: 'Phase4 Test Owner Paper', examName: 'Exam', examCode: 'EX-1', subject: 'Math', status: 'SUBMITTED', createdBy: 'bad' }) });
  assert.equal(created.status, 201); assert.equal(created.body.paper.status, 'DRAFT');
  const id = created.body.paper.id;
  assert.equal((await request('/question-papers', { headers: { authorization: `Bearer ${otherToken}` } })).body.papers.some(paper => paper.id === id), false);
  assert.equal((await request(`/question-papers/${id}`, { headers: { authorization: `Bearer ${otherToken}` } })).status, 404);
  assert.equal((await request(`/question-papers/${id}/download`, { headers: { authorization: `Bearer ${otherToken}` } })).status, 404);
  assert.equal((await multipart(`/question-papers/${id}/upload`, ownerToken, new Blob(['not a pdf'], { type: 'application/pdf', name: 'fake.pdf' }))).status, 400);
  const pdf = new Blob(['%PDF-1.4\nminimal test pdf'], { type: 'application/pdf' }); pdf.name = '../../paper.pdf';
  const uploaded = await multipart(`/question-papers/${id}/upload`, ownerToken, pdf);
  assert.equal(uploaded.status, 200); assert.equal(uploaded.body.paper.fileOriginalName, 'paper.pdf'); assert.equal(uploaded.body.paper.storageKey, undefined);
  assert.equal(uploaded.body.paper.encryptedKey, undefined); assert.equal(uploaded.body.paper.iv, undefined); assert.equal(uploaded.body.paper.isEncrypted, true);
  const storedPaper = await QuestionPaper.findById(id).select('+encryptedKey +keyIv +keyAuthTag +iv +authTag +encryptedFileHash +hashAlgorithm +encryptionAlgorithm');
  const encryptedArtifact = await questionPaperStorage.getEncryptedFile(storedPaper.storageKey);
  assert.ok(storedPaper.encryptedKey && storedPaper.keyIv && storedPaper.authTag); assert.equal(storedPaper.encryptionAlgorithm, 'AES-256-GCM'); assert.equal(storedPaper.hashAlgorithm, 'SHA-256'); assert.notDeepEqual(encryptedArtifact, Buffer.from('%PDF-1.4\nminimal test pdf')); assert.equal(encryptionService.calculateSha256(encryptedArtifact), storedPaper.encryptedFileHash);
  const ownDownload = await fetch(baseUrl + `/question-papers/${id}/download`, { headers: { authorization: `Bearer ${ownerToken}` } }); assert.equal(ownDownload.status, 200); assert.equal(ownDownload.headers.get('content-type'), 'application/pdf');
  await fs.appendFile(path.resolve(__dirname, '../storage/question-papers', storedPaper.fileStoredName), Buffer.from('tamper'));
  assert.equal((await request(`/question-papers/${id}/download`, { headers: { authorization: `Bearer ${ownerToken}` } })).status, 422);
  assert.ok(await AuditLog.exists({ action: 'QUESTION_PAPER_INTEGRITY_CHECK_FAILED', targetId: id }));
  assert.equal((await multipart(`/question-papers/${id}/upload`, ownerToken, pdf)).status, 200);
  assert.equal((await request(`/question-papers/${id}/submit`, { method: 'POST', headers: { authorization: `Bearer ${ownerToken}` } })).status, 200);
  assert.equal((await request(`/question-papers/${id}/submit`, { method: 'POST', headers: { authorization: `Bearer ${ownerToken}` } })).status, 409);
  assert.equal((await multipart(`/question-papers/${id}/upload`, ownerToken, pdf)).status, 409);
  assert.ok(await AuditLog.exists({ action: 'QUESTION_PAPER_SUBMITTED', targetId: id }));
});
