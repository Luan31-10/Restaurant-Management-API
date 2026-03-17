const express = require('express');
const router = express.Router();
const statisticsController = require('../controllers/statistics.controller');
const authMiddleware = require("../middleware/auth.middleware"); // Giả định bạn có middleware này

// Route để lấy dữ liệu tóm tắt (Tổng doanh thu, số đơn...)
router.get(
  '/statistics',
  [authMiddleware.verifyToken, authMiddleware.isAdmin],
  statisticsController.getRevenueStatistics
);

// THÊM ROUTE MỚI: Lấy dữ liệu chi tiết theo ngày cho biểu đồ
router.get(
  '/statistics/details',
  [authMiddleware.verifyToken, authMiddleware.isAdmin],
  statisticsController.getDetailedStatistics
);

module.exports = router;