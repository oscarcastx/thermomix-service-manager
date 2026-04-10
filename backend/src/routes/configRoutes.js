const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const { verifyToken, verifyRole } = require('../middleware/auth');

router.get('/', verifyToken, configController.getConfig);
router.put('/', verifyToken, verifyRole(['supervisor']), configController.updateConfig);

module.exports = router;
