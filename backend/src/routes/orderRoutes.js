const express = require('express');
const router = express.Router();
const orderController = require('../controllers/orderController');
const { verifyToken, verifyRole } = require('../middleware/auth');

router.use(verifyToken);

// Executive creates orders
router.post('/', verifyRole(['ejecutivo', 'supervisor']), orderController.createOrder);

// Executive registers payment
router.post('/:id/pay', verifyRole(['ejecutivo', 'supervisor']), orderController.registerPayment);

// Executive marks order as finished
router.post('/:id/finish-order', verifyRole(['ejecutivo', 'supervisor']), orderController.markFinished);

// All users can see orders (frontend filters them locally)
router.get('/', verifyRole(['supervisor', 'ejecutivo', 'tecnico']), orderController.getOrders);

// Technician actions
router.get('/my-active', verifyRole(['tecnico']), orderController.getMyActiveOrder);
router.post('/take-next', verifyRole(['tecnico']), orderController.takeNextOrder);
router.post('/:id/finish', verifyRole(['tecnico']), orderController.finishTask);
router.post('/:id/pause', verifyRole(['tecnico']), orderController.pauseTask);
router.post('/:id/resume', verifyRole(['tecnico']), orderController.resumeTask);

module.exports = router;
