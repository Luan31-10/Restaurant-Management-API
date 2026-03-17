const controller = require("../controllers/order.controller");
const authMiddleware = require("../middleware/auth.middleware");
const router = require("express").Router();

// Route để cập nhật trạng thái của một món trong order
router.patch(
    "/order-items/:id", // Dùng PATCH vì chỉ cập nhật một phần
    [authMiddleware.verifyToken], // Bảo vệ route
    controller.updateOrderItemStatus
);

module.exports = router;