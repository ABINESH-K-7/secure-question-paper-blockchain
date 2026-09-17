function getHealth(_request, response) {
  response.status(200).json({
    success: true,
    message: 'Secure Question Paper API is running.',
    timestamp: new Date().toISOString(),
  });
}
function getReady(_request, response) {
  const ready = mongoose.connection.readyState === 1;
  response.status(ready ? 200 : 503).json({ status: ready ? 'ready' : 'not_ready' });
}

module.exports = { getHealth, getReady };
const mongoose = require('mongoose');

