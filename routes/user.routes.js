// routes/user.routes.js
const { Router } = require('express');
const controller = require('../controllers/user.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

const router = Router();

router.use(verifyToken, isAdmin);

// Định nghĩa các route
router.get('/', controller.getAllUsers);
router.post('/', controller.createUser);
router.put('/:id', controller.updateUser);
router.delete('/:id', controller.deleteUser);

module.exports = router;