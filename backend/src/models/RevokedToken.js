const mongoose = require('mongoose');

const revokedTokenSchema = new mongoose.Schema({
  jti: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { versionKey: false });
module.exports = mongoose.model('RevokedToken', revokedTokenSchema);
