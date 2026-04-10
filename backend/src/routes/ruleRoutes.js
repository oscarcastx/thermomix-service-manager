const express = require('express');
const router = express.Router();
const ruleController = require('../controllers/ruleController');
const { verifyToken, verifyRole } = require('../middleware/auth');

// Technician rule viewing
router.get('/my-rule', verifyToken, verifyRole(['tecnico']), ruleController.getMyRule);

// All other rule routes are protected and for supervisors only
router.use(verifyToken, verifyRole(['supervisor']));

router.post('/', ruleController.createRule);
router.get('/', ruleController.getRulesByDate);
router.delete('/:id', ruleController.deleteRule);

module.exports = router;
