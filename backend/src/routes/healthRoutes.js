const express = require('express');
const { getHealth, getReady } = require('../controllers/healthController');

const router = express.Router();
router.get('/', getHealth);
router.get('/ready', getReady);

module.exports = router;
