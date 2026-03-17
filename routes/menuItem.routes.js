// routes/menuItem.routes.js

const controller = require("../controllers/menuItem.controller");
const authMiddleware = require("../middleware/auth.middleware");
const router = require("express").Router();

// --- Các Route hiện có ---

// Lấy danh sách menu (GET) - Dành cho nhân viên (chỉ món available)
router.get("/", controller.getAllMenuItems);

// Lấy TẤT CẢ menu (GET) - Chỉ Admin (bao gồm cả món ẩn)
router.get(
    "/all",
    [authMiddleware.verifyToken, authMiddleware.isAdmin], // Chỉ Admin
    controller.getAllMenuItemsForAdmin
);

// Tạo món mới (POST) - Chỉ Admin
router.post(
    "/",
    [authMiddleware.verifyToken, authMiddleware.isAdmin], // Chỉ Admin
    controller.createMenuItem
);

// Cập nhật món ăn (PUT) - Chỉ Admin
router.put(
    "/:id",
    [authMiddleware.verifyToken, authMiddleware.isAdmin], // Chỉ Admin
    controller.updateMenuItem
);

// Xóa món ăn (DELETE) - Chỉ Admin
router.delete(
    "/:id",
    [authMiddleware.verifyToken, authMiddleware.isAdmin], // Chỉ Admin
    controller.deleteMenuItem
);




module.exports = router;