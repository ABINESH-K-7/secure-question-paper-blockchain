function errorHandler(error, _request, response, _next) {
  console.error(error);
  if (error.name === 'ValidationError') return response.status(400).json({ success: false, message: 'Invalid request data.' });
  if (error.name === 'CastError') return response.status(400).json({ success: false, message: 'Invalid resource identifier.' });
  if (error.name === 'MulterError' && error.code === 'LIMIT_FILE_SIZE') return response.status(400).json({ success: false, message: 'PDF files must not exceed 10 MB.' });
  if (error.name === 'MulterError') return response.status(400).json({ success: false, message: 'Invalid file upload.' });
  response.status(500).json({ success: false, message: 'Internal server error.' });
}

module.exports = errorHandler;
