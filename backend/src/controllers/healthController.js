function getHealth(_request, response) {
  response.status(200).json({
    success: true,
    message: 'Secure Question Paper API is running.',
    timestamp: new Date().toISOString(),
  });
}

module.exports = { getHealth };

