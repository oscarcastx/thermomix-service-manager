const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verifyToken, verifyRole } = require('../middleware/auth');

router.use(verifyToken);
router.use(verifyRole(['supervisor'])); // Todos los endpoints de dashboard son de supervisor

router.get('/stats', dashboardController.getStats);
router.get('/technicians', dashboardController.getTechnicians);
router.get('/report', dashboardController.getReport);
router.get('/activity', dashboardController.getActivity);
router.get('/:id/history', dashboardController.getOrderHistory);

module.exports = router;
