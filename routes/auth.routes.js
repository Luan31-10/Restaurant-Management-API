const express = require('express');
const router = express.Router(); // Tạo một đối tượng Router mới
const rateLimit = require('express-rate-limit');
const controller = require("../controllers/user.controller");

// Cấu hình giới hạn số lần đăng nhập sai để chống tấn công
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max:20, // Giới hạn mỗi IP 10 lần request trong 15 phút
  message: {
    message: "Quá nhiều lần thử đăng nhập, vui lòng thử lại sau 15 phút."
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Endpoint: POST /api/auth/signin
// Lưu ý: Đường dẫn bây giờ là "/signin" vì "/api/auth" đã được định nghĩa trong server.js
router.post(
    "/signin", 
    loginLimiter, // Áp dụng biện pháp chống dò mật khẩu
    controller.signin // Gọi đến hàm signin trong controller
);

// Endpoint: POST /api/auth/verify-admin
// Đường dẫn là "/verify-admin"
router.post(
    "/verify-admin", 
    loginLimiter, 
    controller.verifyAdmin
);

router.post("/complete-admin-login", controller.completeAdminLogin);

module.exports = router; 