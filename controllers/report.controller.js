const db = require("../models");
const { Op } = require("sequelize");
const Order = db.Order;
const User = db.User;
const EndOfDayReport = db.EndOfDayReport; // THÊM IMPORT CHO MODEL BÁO CÁO

// Hàm getSalesReport không thay đổi
exports.getSalesReport = async (req, res) => {
    const { startDate, endDate } = req.query; // Nhận 'YYYY-MM-DD'

    if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required." });
    }

    try {
        // Khởi tạo ngày bắt đầu (00:00:00)
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0); // Đảm bảo bắt đầu từ 00:00:00 (giờ server)

        // Khởi tạo ngày kết thúc (23:59:59)
        const end = new Date(endDate);
        // Sửa lỗi: Cần chuyển ngày kết thúc thành ngày tiếp theo (endDate + 1 ngày) và lấy 00:00:00
        // Cách an toàn nhất: Thêm 1 ngày vào endDate, sau đó dùng [Op.lt] (nhỏ hơn)
        const nextDay = new Date(end);
        nextDay.setDate(end.getDate() + 1); // Chuyển sang ngày hôm sau
        nextDay.setHours(0, 0, 0, 0); // Đảm bảo là 00:00:00 ngày hôm sau

        const orders = await Order.findAll({
            where: {
                status: 'paid',
                // SỬA: Dùng [Op.gte] cho start và [Op.lt] cho nextDay (ngày hôm sau)
                createdAt: {
                    [Op.gte]: start, // Lớn hơn hoặc bằng ngày bắt đầu
                    [Op.lt]: nextDay // Nhỏ hơn ngày hôm sau (tức là bao gồm cả 23:59:59 của ngày kết thúc)
                }
            },
            include: [{
                model: User,
                attributes: ['name']
            }],
            order: [['createdAt', 'DESC']]
        });

        // ... (code tính toán summary và gửi response giữ nguyên) ...
        const totalRevenue = orders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);
        const totalOrders = orders.length;
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const revenueByPaymentMethod = orders.reduce((acc, order) => {
            const method = order.paymentMethod || 'Chưa rõ';
            acc[method] = (acc[method] || 0) + parseFloat(order.totalAmount);
            return acc;
        }, {});

        res.status(200).json({
            summary: {
                totalRevenue,
                totalOrders,
                averageOrderValue,
                revenueByPaymentMethod
            },
            orders: orders
        });
    } catch (error) {
        console.error("Error fetching sales report:", error);
        res.status(500).json({ message: error.message });
    }
};


exports.generateEndOfDayReport = async (req, res) => {
    const userId = req.userId; 
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const now = new Date();

        const paidOrders = await Order.findAll({
            where: {
                status: 'paid',
                updatedAt: {
                    [Op.between]: [todayStart, now],
                }
            }
        });

        const cancelledOrdersCount = await Order.count({
            where: {
                status: 'cancelled',
                updatedAt: {
                    [Op.between]: [todayStart, now],
                }
            }
        });

        const totalRevenue = paidOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);
        const totalOrders = paidOrders.length;
        const revenueByPaymentMethod = paidOrders.reduce((acc, order) => {
            const method = order.paymentMethod || 'Chưa rõ';
            acc[method] = (acc[method] || 0) + parseFloat(order.totalAmount);
            return acc;
        }, {});
        
        // Tạo một bản ghi báo cáo mới trong CSDL
        const newReport = await EndOfDayReport.create({
            reportDate: now,
            totalRevenue: totalRevenue,
            totalOrders: totalOrders,
            cancelledOrders: cancelledOrdersCount,
            revenueByPaymentMethod: revenueByPaymentMethod,
            generatedByUserId: userId
        });

        res.status(201).json(newReport); // Trả về báo cáo vừa được tạo với status 201 (Created)

    } catch (error) {
        console.error("Error generating End-of-Day report:", error);
        res.status(500).json({ message: error.message });
    }
};

// HÀM MỚI: Lấy danh sách các báo cáo đã lưu
exports.getPastReports = async (req, res) => {
    try {
        const reports = await EndOfDayReport.findAll({
            order: [['reportDate', 'DESC']], // Sắp xếp theo ngày mới nhất
            include: [{
                model: User,
                attributes: ['name'] // Lấy tên người tạo báo cáo
            }]
        });
        res.status(200).json(reports);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getReportById = async (req, res) => {
    try {
        const report = await EndOfDayReport.findByPk(req.params.id, {
            include: [{ model: User, attributes: ['name'] }]
        });
        if (!report) {
            return res.status(404).json({ message: "Report not found." });
        }
        res.status(200).json(report);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};