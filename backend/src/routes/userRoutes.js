const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { verifyToken, verifyRole } = require('../middleware/auth');

// Public route
router.post('/login', userController.login);

// Protected routes (Supervisor only)
router.post('/', verifyToken, verifyRole(['supervisor']), userController.createUser);
router.get('/', verifyToken, verifyRole(['supervisor']), userController.getUsers);
router.delete('/:id', verifyToken, verifyRole(['supervisor']), userController.deleteUser);
router.get('/tecnicos', verifyToken, verifyRole(['supervisor', 'ejecutivo']), userController.getTechnicians);

// Notifications
router.get('/notifications', verifyToken, userController.getNotifications);
router.post('/notifications/:id/read', verifyToken, userController.markNotificationRead);

// Reports
router.get('/daily-report', verifyToken, verifyRole(['ejecutivo', 'tecnico', 'supervisor']), userController.getDailyReport);

module.exports = router;
