const app = require('./app');
const connectDatabase = require('./config/database');
const { port } = require('./config/env');

connectDatabase();

const server = app.listen(port, () => {
  console.log(`API listening at http://localhost:${port}`);
});
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') console.error(`Cannot start API: port ${port} is already in use. Set PORT to another available port.`);
  else console.error('API server failed to start:', error.message);
  process.exit(1);
});
