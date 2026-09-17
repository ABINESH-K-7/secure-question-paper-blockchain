/* One-time development migration for Phase 4 plaintext artifacts. */
const connectDatabase = require('../config/database');
const QuestionPaper = require('../models/QuestionPaper');
const storage = require('../services/questionPaperStorageService');
const encryption = require('../services/encryptionService');
async function migrate() {
  if (storage.currentProvider() !== 'local') throw new Error('This legacy plaintext migration supports STORAGE_PROVIDER=local only. Migrate local records before moving them to S3/KMS.');
  await connectDatabase(); encryption.getMasterKey(); const papers = await QuestionPaper.find({ storageKey: { $ne: null }, encryptionAlgorithm: null }); let migrated = 0; let skipped = 0;
  for (const paper of papers) { let replacement; try { const plaintext = await storage.getEncryptedFile(paper.storageKey); if (!plaintext || !plaintext.subarray(0, 5).equals(Buffer.from('%PDF-'))) { skipped += 1; console.warn(`Skipped ${paper.id}: legacy file unavailable or not a PDF.`); continue; } const encrypted = encryption.encryptQuestionPaper(plaintext); replacement = await storage.saveEncryptedFile(encrypted.ciphertext); const stored = await storage.getEncryptedFile(replacement.storageKey); if (!stored) throw new Error('Stored artifact unavailable.'); const oldKey = paper.storageKey; paper.storageKey = replacement.storageKey; paper.fileStoredName = replacement.fileStoredName; Object.assign(paper, { encryptionAlgorithm: encrypted.encryptionAlgorithm, encryptionKeyVersion: encrypted.encryptionKeyVersion, encryptedKey: encrypted.encryptedKey, keyIv: encrypted.keyIv, keyAuthTag: encrypted.keyAuthTag, iv: encrypted.iv, authTag: encrypted.authTag, hashAlgorithm: encrypted.hashAlgorithm, encryptedFileHash: encryption.calculateSha256(stored) }); await paper.save(); await storage.remove(oldKey); migrated += 1; } catch (error) { if (replacement) await storage.remove(replacement.storageKey).catch(() => {}); skipped += 1; console.error(`Migration failed for ${paper.id}: ${error.message}`); } }
  console.log(`Question-paper migration complete: ${migrated} migrated, ${skipped} skipped.`);
}
migrate().then(() => process.exit(0)).catch(error => { console.error(`Migration aborted: ${error.message}`); process.exit(1); });
