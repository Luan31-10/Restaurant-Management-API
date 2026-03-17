// File: routes/upload.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');

// Cấu hình nơi lưu trữ file
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, './uploads/'); // Đảm bảo bạn đã tạo thư mục 'uploads' ở gốc project
    },
    filename: function (req, file, cb) {
        // Tạo tên file duy nhất để tránh trùng lặp
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({ storage: storage });

// Định nghĩa API endpoint: POST /api/upload/image
// 'file' là key mà Flutter sẽ gửi lên
router.post('/image', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).send({ message: 'Vui lòng tải lên một file.' });
    }

    // === TỐI ƯU HÓA TẠI ĐÂY ===
    // Tự động lấy protocol (http) và host (192.168.1.87:3000) từ request
    const protocol = req.protocol;
    const host = req.get('host');
    
    // Tạo URL động
    const imageUrl = `${protocol}://${host}/uploads/${req.file.filename}`;
    // ===========================

    // Gửi URL này về cho ứng dụng Flutter
    res.status(200).json({ imageUrl: imageUrl });
});

module.exports = router;