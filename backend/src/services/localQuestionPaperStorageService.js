const crypto = require('crypto');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const { questionPaperStorageDir } = require('../config/env');

const storageRoot = path.resolve(__dirname, '../../', questionPaperStorageDir);
const prefix = 'question-papers/';

function resolveKey(storageKey) {
  if (typeof storageKey !== 'string' || !storageKey.startsWith(prefix) || storageKey.includes('..')) return null;
  const resolved = path.resolve(storageRoot, storageKey.slice(prefix.length));
  return resolved.startsWith(`${storageRoot}${path.sep}`) ? resolved : null;
}

async function saveEncryptedFile(buffer) {
  await fs.mkdir(storageRoot, { recursive: true });
  const fileStoredName = `${crypto.randomUUID()}.enc`;
  const storageKey = `${prefix}${fileStoredName}`;
  await fs.writeFile(resolveKey(storageKey), buffer, { flag: 'wx', mode: 0o600 });
  return { storageKey, fileStoredName };
}

async function remove(storageKey) {
  const destination = resolveKey(storageKey);
  if (!destination) return false;
  try { await fs.unlink(destination); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

async function exists(storageKey) { const destination = resolveKey(storageKey); return Boolean(destination && fsSync.existsSync(destination)); }
async function getEncryptedFile(storageKey) { const destination = resolveKey(storageKey); if (!destination) return null; try { return await fs.readFile(destination); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }

module.exports = { saveEncryptedFile, getEncryptedFile, remove, exists };
