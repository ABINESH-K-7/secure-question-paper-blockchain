const crypto = require('crypto');
const { Readable } = require('stream');
const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { awsRegion, awsS3Bucket } = require('../config/env');

const prefix = 'question-papers/';

function storageError(code, message, cause) { const error = new Error(message); error.code = code; error.cause = cause; return error; }
function configuration() { if (!awsRegion || !awsS3Bucket) throw storageError('STORAGE_CONFIGURATION_ERROR', 'S3 question-paper storage is not configured.'); return { region: awsRegion, bucket: awsS3Bucket }; }
function getClient() { return new S3Client({ region: configuration().region }); }
function validKey(storageKey) { return typeof storageKey === 'string' && storageKey.startsWith(prefix) && !storageKey.includes('..'); }

async function toBuffer(body) {
  if (!body) return null;
  if (Buffer.isBuffer(body)) return body;
  if (typeof body.transformToByteArray === 'function') return Buffer.from(await body.transformToByteArray());
  if (body instanceof Readable || typeof body[Symbol.asyncIterator] === 'function') { const chunks = []; for await (const chunk of body) chunks.push(Buffer.from(chunk)); return Buffer.concat(chunks); }
  throw storageError('S3_STORAGE_ERROR', 'Encrypted question-paper storage response was invalid.');
}

async function saveEncryptedFile(buffer) {
  const { bucket } = configuration(); const fileStoredName = `${crypto.randomUUID()}.enc`; const storageKey = `${prefix}${fileStoredName}`;
  try { await getClient().send(new PutObjectCommand({ Bucket: bucket, Key: storageKey, Body: buffer, ContentType: 'application/octet-stream' })); return { storageKey, fileStoredName }; }
  catch (error) { throw storageError('S3_UPLOAD_FAILED', 'Encrypted question-paper upload failed.', error); }
}

async function getEncryptedFile(storageKey) {
  if (!validKey(storageKey)) return null;
  const { bucket } = configuration();
  try { return toBuffer((await getClient().send(new GetObjectCommand({ Bucket: bucket, Key: storageKey }))).Body); }
  catch (error) { if (error?.name === 'NoSuchKey' || error?.$metadata?.httpStatusCode === 404) return null; throw storageError('S3_DOWNLOAD_FAILED', 'Encrypted question-paper retrieval failed.', error); }
}

async function remove(storageKey) {
  if (!validKey(storageKey)) return false;
  const { bucket } = configuration();
  try { await getClient().send(new DeleteObjectCommand({ Bucket: bucket, Key: storageKey })); return true; }
  catch (error) { throw storageError('S3_DELETE_FAILED', 'Encrypted question-paper cleanup failed.', error); }
}

async function exists(storageKey) {
  if (!validKey(storageKey)) return false;
  const { bucket } = configuration();
  try { await getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: storageKey })); return true; }
  catch (error) { if (error?.$metadata?.httpStatusCode === 404 || error?.name === 'NotFound') return false; throw storageError('S3_DOWNLOAD_FAILED', 'Encrypted question-paper retrieval failed.', error); }
}

module.exports = { saveEncryptedFile, getEncryptedFile, remove, exists, toBuffer };
