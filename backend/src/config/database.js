const mongoose = require('mongoose');
const { mongoUri } = require('./env');

async function connectDatabase() {
  try {
    await mongoose.connect(mongoUri);
    console.log(`MongoDB connected: ${mongoose.connection.host}`);
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    console.error('Start MongoDB or set MONGO_URI in the root .env file.');
  }
}

module.exports = connectDatabase;

