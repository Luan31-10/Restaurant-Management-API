const controller = require("../controllers/order.controller");
const authMiddleware = require("../middleware/auth.middleware");
const router = require("express").Router();

// Middleware để xác thực token cho tất cả các route bên dưới
router.use(authMiddleware.verifyToken);

// POST /api/orders - Tạo order mới
router.post("/", controller.createOrder);

// GET /api/orders/kitchen/active - Lấy các order đang hoạt động cho bếp
router.get(
    "/kitchen/active",
    // Thêm middleware kiểm tra quyền cho bếp hoặc admin nếu cần
    controller.getKitchenOrders
);

// CẢI TIẾN: Thêm route mới cho việc cập nhật trạng thái của MỘT món ăn
// :itemId ở đây là ID của OrderItem, không phải Order
router.patch("/items/:itemId", controller.updateOrderItemStatus);

// SỬA LỖI XUNG ĐỘT: Route này dùng để thay thế TOÀN BỘ danh sách món ăn.
// :orderId ở đây là ID của Order.
// LƯU Ý: Hàm `updateOrderItems` cần tồn tại trong controller của bạn.
// Nếu chưa có, bạn cần tạo nó.
router.put("/:orderId/items", controller.updateOrderItems);

// SỬA LỖI XUNG ĐỘT: Cập nhật trạng thái của CẢ order (vd: pending -> paid)
// :orderId ở đây là ID của Order
router.patch("/:orderId", controller.updateOrderStatus);

module.exports = router;