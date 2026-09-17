const { storageProvider } = require('../config/env');
const localStorage = require('./localQuestionPaperStorageService');
const s3Storage = require('./s3QuestionPaperStorageService');

const providers = { local: localStorage, s3: s3Storage };

function getStorage(provider = storageProvider) {
  const selected = providers[provider];
  if (!selected) { const error = new Error('Question-paper storage provider is not supported.'); error.code = 'STORAGE_CONFIGURATION_ERROR'; throw error; }
  return selected;
}

function currentProvider() { return storageProvider; }

module.exports = {
  getStorage,
  currentProvider,
  saveEncryptedFile: (...args) => getStorage().saveEncryptedFile(...args),
  getEncryptedFile: (...args) => getStorage().getEncryptedFile(...args),
  remove: (...args) => getStorage().remove(...args),
  exists: (...args) => getStorage().exists(...args),
};
