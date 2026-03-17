const controller = require("../controllers/report.controller");
const authMiddleware = require("../middleware/auth.middleware");
const router = require("express").Router();

// Route để lấy báo cáo bán hàng chi tiết
router.get("/reports/sales", controller.getSalesReport);
//Route để lấy báo cáo kết ca
router.get("/reports/end-of-day", [authMiddleware.verifyToken, authMiddleware.isAdmin], controller.getPastReports);

router.post("/reports/end-of-day", [authMiddleware.verifyToken, authMiddleware.isAdmin], controller.generateEndOfDayReport);

router.get("/reports/end-of-day/:id", [authMiddleware.verifyToken, authMiddleware.isAdmin], controller.getReportById);

module.exports = router;