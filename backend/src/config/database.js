const mongoose = require('mongoose');
const { mongoUri } = require('./env');

async function connectDatabase() {
  await mongoose.connect(mongoUri);
  console.log(`MongoDB connected: ${mongoose.connection.host}`);
}

module.exports = connectDatabase;
