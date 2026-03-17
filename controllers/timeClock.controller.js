// File: controllers/timeClock.controller.js
const db = require("../models");
const { Op } = require("sequelize");
const TimeClock = db.TimeClock;
const User = db.User;

// POST /api/timeclock/clock-in - Nhân viên check-in
exports.clockIn = async (req, res) => {
    const userId = req.userId; // Lấy từ middleware xác thực token

    try {
        // Kiểm tra xem nhân viên có đang trong ca làm việc không
        const existingEntry = await TimeClock.findOne({
            where: { userId: userId, clockOutTime: null }
        });

        if (existingEntry) {
            return res.status(400).json({ message: "You are already clocked in." });
        }

        const clockInEntry = await TimeClock.create({
            userId: userId,
            clockInTime: new Date()
        });

        res.status(201).json({ message: "Clocked in successfully.", entry: clockInEntry });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// POST /api/timeclock/clock-out - Nhân viên check-out
exports.clockOut = async (req, res) => {
    const userId = req.userId;

    try {
        const entry = await TimeClock.findOne({
            where: { userId: userId, clockOutTime: null }
        });

        if (!entry) {
            return res.status(400).json({ message: "You are not clocked in." });
        }

        const clockOutTime = new Date();
        const clockInTime = new Date(entry.clockInTime);
        const totalMilliseconds = clockOutTime - clockInTime;
        const totalHours = totalMilliseconds / 1000 / 60 / 60; // Chuyển sang giờ

        await entry.update({
            clockOutTime: clockOutTime,
            totalHours: totalHours.toFixed(2)
        });

        res.status(200).json({ message: "Clocked out successfully.", entry: entry });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// GET /api/reports/timekeeping - Admin lấy báo cáo chấm công
exports.getTimekeepingReport = async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required." });
    }

    try {
        const report = await User.findAll({
            attributes: ['id', 'name', 'role'],
            include: [{
                model: TimeClock,
                attributes: [],
                where: {
                    clockInTime: { [Op.between]: [new Date(startDate), new Date(endDate)] },
                    totalHours: { [Op.not]: null } // Chỉ lấy các ca đã hoàn thành
                },
                required: false // Vẫn hiện nhân viên dù không có giờ làm
            }],
            group: ['User.id'],
            raw: true, // Quan trọng để Sequelize tính toán đúng
            // Thêm cột tổng giờ làm cho mỗi nhân viên
            order: [[db.sequelize.fn('SUM', db.sequelize.col('TimeClocks.totalHours')), 'DESC']]
        });
        
        // Sequelize trả về kết quả hơi phức tạp, cần định dạng lại
        const usersWithTotalHours = await Promise.all(report.map(async (user) => {
            const result = await TimeClock.findOne({
                attributes: [[db.sequelize.fn('SUM', db.sequelize.col('totalHours')), 'totalHours']],
                where: {
                    userId: user.id,
                    clockInTime: { [Op.between]: [new Date(startDate), new Date(endDate)] }
                },
                raw: true
            });
            return {
                ...user,
                totalHours: parseFloat(result.totalHours || 0).toFixed(2)
            };
        }));


        res.status(200).json(usersWithTotalHours);

    } catch (error) {
        console.error("Error fetching timekeeping report:", error);
        res.status(500).json({ message: error.message });
    }
};
exports.getClockInStatus = async (req, res) => {
    const userId = req.userId; // Lấy từ token

    try {
        const activeEntry = await TimeClock.findOne({
            where: {
                userId: userId,
                clockOutTime: null // Tìm bản ghi chưa check-out
            }
        });

        if (activeEntry) {
            res.status(200).json({ status: 'clocked_in', entry: activeEntry });
        } else {
            res.status(200).json({ status: 'clocked_out' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getDetailedTimekeepingReport = async (req, res) => {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required." });
    }

    try {
        const timeClockEntries = await TimeClock.findAll({
            where: {
                clockInTime: { [Op.between]: [new Date(startDate), new Date(endDate)] },
                clockOutTime: { [Op.not]: null } // Chỉ lấy các ca đã check-out
            },
            include: [{
                model: User,
                attributes: ['id', 'name'] // Lấy ID và Tên của nhân viên
            }],
            order: [['userId', 'ASC'], ['clockInTime', 'ASC']] // Sắp xếp theo nhân viên, rồi theo thời gian
        });

        res.status(200).json(timeClockEntries);

    } catch (error) {
        console.error("Error fetching detailed timekeeping report:", error);
        res.status(500).json({ message: error.message });
    }
};