const bcrypt = require('bcrypt');
const User = require('../models/User');
const { audit } = require('../services/auditService');
const { safeUser } = require('./authController');
const AuditLog = require('../models/AuditLog');

const SORT_FIELDS = ['createdAt', 'name', 'email', 'role', 'lastLoginAt'];
const AUDIT_SORT_FIELDS = ['timestamp', 'action', 'role'];
function parsePagination(query) {
  const page = Number(query.page || 1); const limit = Number(query.limit || 10);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) return null;
  return { page, limit, skip: (page - 1) * limit };
}
function parseSort(query, allowed, fallback) {
  const sortBy = query.sortBy || fallback;
  const sortOrder = query.sortOrder || 'desc';
  if (!allowed.includes(sortBy) || !['asc', 'desc'].includes(sortOrder)) return null;
  return { [sortBy]: sortOrder === 'asc' ? 1 : -1 };
}
function userQuery(query, forcedRole) {
  const filter = forcedRole ? { role: forcedRole } : {};
  if (query.search !== undefined) {
    if (typeof query.search !== 'string' || query.search.length > 100) return null;
    const escaped = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (escaped) filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }];
  }
  if (!forcedRole && query.role !== undefined) { if (!User.ROLES.includes(query.role)) return null; filter.role = query.role; }
  if (query.isActive !== undefined) { if (!['true', 'false'].includes(query.isActive)) return null; filter.isActive = query.isActive === 'true'; }
  return filter;
}
async function listUsersWithFilter(request, response, next, forcedRole) {
  try {
    const pagination = parsePagination(request.query); const filter = userQuery(request.query, forcedRole); const sort = parseSort(request.query, SORT_FIELDS, 'createdAt');
    if (!pagination || !filter || !sort) return response.status(400).json({ success: false, message: 'Invalid pagination, filter, or sort parameters.' });
    const [users, total] = await Promise.all([User.find(filter).select('name email role mfaEnabled isActive createdBy lastLoginAt createdAt updatedAt').populate('createdBy', 'name email').sort(sort).skip(pagination.skip).limit(pagination.limit).lean(), User.countDocuments(filter)]);
    return response.json({ success: true, users: users.map(user => ({ ...safeUser(user), createdBy: user.createdBy ? { id: user.createdBy._id, name: user.createdBy.name, email: user.createdBy.email } : null })), pagination: { page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) } });
  } catch (error) { next(error); }
}

function listUsers(request, response, next) { return listUsersWithFilter(request, response, next); }
function listExamCenters(request, response, next) { return listUsersWithFilter(request, response, next, 'EXAM_CENTER'); }
async function dashboardStats(_request, response, next) {
  try {
    const groups = await User.aggregate([{ $group: { _id: null, totalUsers: { $sum: 1 }, activeUsers: { $sum: { $cond: ['$isActive', 1, 0] } }, inactiveUsers: { $sum: { $cond: ['$isActive', 0, 1] }, }, questionSetters: { $sum: { $cond: [{ $eq: ['$role', 'QUESTION_SETTER'] }, 1, 0] } }, reviewers: { $sum: { $cond: [{ $eq: ['$role', 'REVIEWER'] }, 1, 0] } }, securityOfficers: { $sum: { $cond: [{ $eq: ['$role', 'SECURITY_OFFICER'] }, 1, 0] } }, examAuthorities: { $sum: { $cond: [{ $eq: ['$role', 'EXAM_AUTHORITY'] }, 1, 0] } }, examCenters: { $sum: { $cond: [{ $eq: ['$role', 'EXAM_CENTER'] }, 1, 0] } } } }]);
    const stats = groups[0] || { totalUsers: 0, activeUsers: 0, inactiveUsers: 0, questionSetters: 0, reviewers: 0, securityOfficers: 0, examAuthorities: 0, examCenters: 0 };
    delete stats._id; response.json({ success: true, stats });
  } catch (error) { next(error); }
}
async function createExamCenter(request, response, next) {
  try {
    const { name, email, password } = request.body;
    if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(email || '') || typeof password !== 'string' || password.length < 8) return response.status(400).json({ success: false, message: 'Provide a valid name, email, and password of at least 8 characters.' });
    const user = await User.create({ name: name.trim(), email: email.trim().toLowerCase(), passwordHash: await bcrypt.hash(password, 12), role: 'EXAM_CENTER', createdBy: request.user._id });
    await audit(request, 'ADMIN_CREATED_EXAM_CENTER', { targetType: 'User', targetId: user._id.toString(), metadata: { email: user.email } });
    response.status(201).json({ success: true, message: 'Exam Centre account created.', user: safeUser(user) });
  } catch (error) { if (error.code === 11000) return response.status(409).json({ success: false, message: 'An account with that email already exists.' }); next(error); }
}
async function updateStatus(request, response, next) {
  try {
    if (typeof request.body.isActive !== 'boolean') return response.status(400).json({ success: false, message: 'isActive must be true or false.' });
    if (!/^[a-f\d]{24}$/i.test(request.params.id)) return response.status(400).json({ success: false, message: 'Invalid user identifier.' });
    const user = await User.findById(request.params.id);
    if (!user) return response.status(404).json({ success: false, message: 'User not found.' });
    if (!request.body.isActive && user._id.equals(request.user._id)) return response.status(400).json({ success: false, message: 'You cannot deactivate your own account.' });
    if (!request.body.isActive && user.role === 'ADMIN' && user.isActive && await User.countDocuments({ role: 'ADMIN', isActive: true }) <= 1) return response.status(400).json({ success: false, message: 'The final active ADMIN account cannot be deactivated.' });
    user.isActive = request.body.isActive; await user.save();
    await audit(request, 'USER_STATUS_CHANGED', { targetType: 'User', targetId: user._id.toString(), metadata: { isActive: user.isActive } });
    response.json({ success: true, message: 'User status updated.', user: safeUser(user) });
  } catch (error) { next(error); }
}
async function listAuditLogs(request, response, next) {
  try {
    const pagination = parsePagination(request.query); const sort = parseSort(request.query, AUDIT_SORT_FIELDS, 'timestamp');
    if (!pagination || !sort) return response.status(400).json({ success: false, message: 'Invalid pagination, filter, or sort parameters.' });
    const filter = {};
    if (request.query.action) { if (typeof request.query.action !== 'string' || request.query.action.length > 80) return response.status(400).json({ success: false, message: 'Invalid audit action filter.' }); filter.action = request.query.action; }
    if (request.query.role) { if (!User.ROLES.includes(request.query.role)) return response.status(400).json({ success: false, message: 'Invalid role filter.' }); filter.role = request.query.role; }
    if (request.query.from || request.query.to) { filter.timestamp = {}; if (request.query.from && Number.isNaN(Date.parse(request.query.from))) return response.status(400).json({ success: false, message: 'Invalid start date.' }); if (request.query.to && Number.isNaN(Date.parse(request.query.to))) return response.status(400).json({ success: false, message: 'Invalid end date.' }); if (request.query.from) filter.timestamp.$gte = new Date(request.query.from); if (request.query.to) filter.timestamp.$lte = new Date(request.query.to); }
    if (request.query.search) { const escaped = String(request.query.search).trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); const users = await User.find({ $or: [{ name: { $regex: escaped, $options: 'i' } }, { email: { $regex: escaped, $options: 'i' } }] }).select('_id').lean(); filter.userId = { $in: users.map(user => user._id) }; }
    const [logs, total] = await Promise.all([AuditLog.find(filter).select('userId action role targetType targetId ipAddress timestamp metadata').populate('userId', 'name email role').sort(sort).skip(pagination.skip).limit(pagination.limit).lean(), AuditLog.countDocuments(filter)]);
    response.json({ success: true, logs: logs.map(log => ({ ...log, metadata: undefined })), pagination: { page: pagination.page, limit: pagination.limit, total, totalPages: Math.ceil(total / pagination.limit) } });
  } catch (error) { next(error); }
}
module.exports = { listUsers, listExamCenters, dashboardStats, createExamCenter, updateStatus, listAuditLogs };
