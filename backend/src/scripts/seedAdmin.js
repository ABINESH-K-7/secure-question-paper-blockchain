const bcrypt = require('bcrypt');
const connectDatabase = require('../config/database');
const User = require('../models/User');

async function seedAdmin() {
  const { ADMIN_NAME, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in the root .env file.');
  await connectDatabase();
  const email = ADMIN_EMAIL.trim().toLowerCase();
  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role !== 'ADMIN') throw new Error('The configured ADMIN_EMAIL belongs to a non-Admin account.');
    await User.updateOne({ _id: existing._id }, { $set: { passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12) } });
    console.log('Existing Admin password updated successfully.');
    process.exit(0);
  }
  await User.create({ name: ADMIN_NAME?.trim() || 'System Administrator', email, passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12), role: 'ADMIN' });
  console.log('Admin account created successfully.');
  process.exit(0);
}
seedAdmin().catch((error) => { console.error(`Admin seed failed: ${error.message}`); process.exit(1); });
