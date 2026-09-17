const path = require('path');
const dotenv = require('dotenv');

// One shared .env file at the project root keeps backend-only secrets out of React.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const nodeEnv = process.env.NODE_ENV || 'development';
const required = (name, value) => { if (!value) throw new Error(`Required production environment variable is missing: ${name}.`); };
function trustProxy() {
  const value = process.env.TRUST_PROXY;
  if (value === undefined || value === '') return 1;
  if (value === 'false') return false;
  if (/^\d+$/.test(value)) return Number(value);
  throw new Error('TRUST_PROXY must be a non-negative number or false.');
}
function validateProductionEnvironment() {
  if (nodeEnv !== 'production') return;
  required('MONGO_URI', process.env.MONGO_URI || process.env.MONGODB_URI);
  required('JWT_SECRET', process.env.JWT_SECRET);
  if (process.env.STORAGE_PROVIDER === 's3') ['AWS_REGION', 'AWS_S3_BUCKET', 'AWS_KMS_KEY_ID'].forEach(name => required(name, process.env[name]));
  if (process.env.BLOCKCHAIN_ENABLED === 'true') ['BLOCKCHAIN_RPC_URL', 'BLOCKCHAIN_PRIVATE_KEY', 'BLOCKCHAIN_CONTRACT_ADDRESS'].forEach(name => required(name, process.env[name]));
}
module.exports = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/secure_question_papers',
  nodeEnv,
  mfaDisplayOtpEnabled: () => process.env.MFA_DISPLAY_OTP === 'true',
  trustProxy: trustProxy(),
  validateProductionEnvironment,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  storageProvider: process.env.STORAGE_PROVIDER || 'local',
  questionPaperStorageDir: process.env.QUESTION_PAPER_STORAGE_DIR || 'storage/question-papers',
  maxQuestionPaperSizeMb: Number(process.env.MAX_QUESTION_PAPER_SIZE_MB) || 10,
  questionPaperMasterKey: process.env.QUESTION_PAPER_MASTER_KEY,
  awsRegion: process.env.AWS_REGION,
  awsS3Bucket: process.env.AWS_S3_BUCKET,
  awsKmsKeyId: process.env.AWS_KMS_KEY_ID,
  blockchainEnabled: process.env.BLOCKCHAIN_ENABLED === 'true', blockchainRpcUrl: process.env.BLOCKCHAIN_RPC_URL, blockchainPrivateKey: process.env.BLOCKCHAIN_PRIVATE_KEY, blockchainContractAddress: process.env.BLOCKCHAIN_CONTRACT_ADDRESS, blockchainNetwork: process.env.BLOCKCHAIN_NETWORK || 'hardhat',
};
