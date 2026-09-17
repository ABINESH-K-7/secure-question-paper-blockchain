const path = require('path');
const dotenv = require('dotenv');

// One shared .env file at the project root keeps backend-only secrets out of React.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

module.exports = {
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGO_URI || process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/secure_question_papers',
  nodeEnv: process.env.NODE_ENV || 'development',
  mfaDisplayOtpEnabled: () => process.env.MFA_DISPLAY_OTP === 'true',
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
