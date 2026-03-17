// File: controllers/dashboard.controller.js
const db = require("../models");
const { Op, Sequelize } = require("sequelize");
const Order = db.Order;
const OrderItem = db.OrderItem;
const MenuItem = db.MenuItem;

exports.getDashboardStats = async (req, res) => {
    try {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const now = new Date();

        // 1. Lấy các đơn hàng đã thanh toán trong ngày
        const paidOrders = await Order.findAll({
            where: {
                status: 'paid',
                updatedAt: { [Op.between]: [todayStart, now] }
            }
        });

        // 2. Tính toán các chỉ số KPI
        const totalRevenue = paidOrders.reduce((sum, order) => sum + parseFloat(order.totalAmount), 0);
        const totalOrders = paidOrders.length;
        const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

        // 3. Lấy top 5 món bán chạy nhất trong ngày
        const topMenuItems = await OrderItem.findAll({
            attributes: [
                'menuItemId',
                [Sequelize.fn('SUM', Sequelize.col('quantity')), 'totalQuantity']
            ],
            include: [{
                model: Order,
                where: {
                    status: 'paid',
                    updatedAt: { [Op.between]: [todayStart, now] }
                },
                attributes: []
            }, {
                model: MenuItem,
                attributes: ['name']
            }],
            group: ['menuItemId', 'MenuItem.id'],
            order: [[Sequelize.literal('totalQuantity'), 'DESC']],
            limit: 5,
            raw: true
        });

        // 4. Lấy dữ liệu doanh thu theo giờ (ví dụ cho biểu đồ)
        const revenueByHour = await Order.findAll({
            attributes: [
                [Sequelize.fn('HOUR', Sequelize.col('updatedAt')), 'hour'],
                [Sequelize.fn('SUM', Sequelize.col('totalAmount')), 'revenue']
            ],
            where: {
                status: 'paid',
                updatedAt: { [Op.between]: [todayStart, now] }
            },
            group: ['hour'],
            order: [['hour', 'ASC']],
            raw: true
        });


        res.status(200).json({
            todaySummary: {
                totalRevenue,
                totalOrders,
                averageOrderValue
            },
            topMenuItems,
            revenueByHour
        });

    } catch (error) {
        console.error("Error fetching dashboard stats:", error);
        res.status(500).json({ message: error.message });
    }
};