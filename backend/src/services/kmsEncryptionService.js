const { KMSClient, GenerateDataKeyCommand, DecryptCommand } = require('@aws-sdk/client-kms');
const { awsRegion, awsKmsKeyId } = require('../config/env');

function kmsError(code, message, cause) { const error = new Error(message); error.code = code; error.cause = cause; return error; }
function configuration() { if (!awsRegion || !awsKmsKeyId) throw kmsError('KMS_CONFIGURATION_ERROR', 'AWS KMS question-paper encryption is not configured.'); return { region: awsRegion, keyId: awsKmsKeyId }; }
function getClient() { return new KMSClient({ region: configuration().region }); }

async function generateDataKey() {
  const { keyId } = configuration();
  try {
    const response = await getClient().send(new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: 'AES_256' }));
    const plaintextKey = Buffer.from(response.Plaintext || []); const encryptedKey = Buffer.from(response.CiphertextBlob || []);
    if (plaintextKey.length !== 32 || !encryptedKey.length) throw kmsError('KMS_OPERATION_FAILED', 'AWS KMS returned an invalid data key.');
    return { plaintextKey, encryptedKey };
  } catch (error) { if (error.code?.startsWith('KMS_')) throw error; throw kmsError('KMS_GENERATE_DATA_KEY_FAILED', 'AWS KMS data-key generation failed.', error); }
}

async function decryptDataKey(encryptedKey) {
  if (!Buffer.isBuffer(encryptedKey) || !encryptedKey.length) throw kmsError('KMS_OPERATION_FAILED', 'Encrypted KMS data key is invalid.');
  try {
    const response = await getClient().send(new DecryptCommand({ CiphertextBlob: encryptedKey })); const plaintextKey = Buffer.from(response.Plaintext || []);
    if (plaintextKey.length !== 32) throw kmsError('KMS_OPERATION_FAILED', 'AWS KMS returned an invalid decrypted data key.');
    return plaintextKey;
  } catch (error) { if (error.code?.startsWith('KMS_')) throw error; throw kmsError('KMS_DECRYPT_FAILED', 'AWS KMS data-key decryption failed.', error); }
}

module.exports = { generateDataKey, decryptDataKey };
