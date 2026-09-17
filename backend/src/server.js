const app = require('./app');
const connectDatabase = require('./config/database');
const { port, nodeEnv, validateProductionEnvironment } = require('./config/env');

async function start() {
  try { validateProductionEnvironment(); await connectDatabase(); }
  catch (error) {
    console.error('MongoDB or production configuration is unavailable:', error.message);
    if (nodeEnv === 'production') process.exit(1);
    console.error('Starting without MongoDB because NODE_ENV is not production.');
  }
  const server = app.listen(port, () => console.log(`API listening at http://localhost:${port}`));
  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') console.error(`Cannot start API: port ${port} is already in use. Set PORT to another available port.`);
    else console.error('API server failed to start:', error.message);
    process.exit(1);
  });
}
start();
