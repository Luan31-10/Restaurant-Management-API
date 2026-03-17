const controller = require("../controllers/table.controller");
const authMiddleware = require("../middleware/auth.middleware");
const router = require("express").Router();

// Route để lấy tất cả bàn
router.get(
    "/",
    [authMiddleware.verifyToken],
    controller.getAllTables
);

// Route để cập nhật trạng thái bàn
router.patch(
    "/:id",
    [authMiddleware.verifyToken],
    controller.updateTableStatus
);

module.exports = router;