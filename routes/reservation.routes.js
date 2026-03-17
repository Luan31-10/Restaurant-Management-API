// routes/reservation.routes.js
const controller = require("../controllers/reservation.controller");
const authMiddleware = require("../middleware/auth.middleware");
const router = require("express").Router();

// Tất cả các route này đều yêu cầu đăng nhập
router.use(authMiddleware.verifyToken);

router.get("/", controller.getAllReservations);
router.post("/", controller.createReservation);
router.patch("/:id", controller.updateReservationStatus);
router.post("/:id/seat", controller.seatCustomer);

// === THÊM 2 ROUTE MỚI ===
// Sửa chi tiết
router.put("/:id", controller.updateReservation);
// Xóa
router.delete("/:id", controller.deleteReservation);
// =========================

module.exports = router;