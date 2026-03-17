const { Order } = require('../models');
const { Sequelize, Op } = require('sequelize');

exports.getRevenueStatistics = async (req, res) => {
  const { period } = req.query; 

  if (!['week', 'month'].includes(period)) {
    return res.status(400).json({ message: 'Invalid period parameter. Use "week" or "month".' });
  }

  try {
    const groupFunction = period === 'month' 
        ? [Sequelize.fn('YEAR', Sequelize.col('createdAt')), Sequelize.fn('MONTH', Sequelize.col('createdAt'))]
        : [Sequelize.fn('YEAR', Sequelize.col('createdAt')), Sequelize.fn('WEEK', Sequelize.col('createdAt'), 1)];

    const orders = await Order.findAll({
      attributes: [
        ...groupFunction,
        [Sequelize.fn('SUM', Sequelize.col('totalAmount')), 'totalRevenue'],
        // THÊM: Đếm số lượng đơn hàng và đặt tên là 'orderCount'
        [Sequelize.fn('COUNT', Sequelize.col('id')), 'orderCount'],
      ],
      where: {
        status: 'paid', 
      },
      group: groupFunction,
      order: groupFunction,
      raw: true,
    });

    const formattedData = orders.map(order => {
      let label = '';
      if (period === 'month') {
        const year = order['YEAR(`createdAt`)'];
        const month = order['MONTH(`createdAt`)'];
        label = `Tháng ${month}/${year}`;
      } else {
        const year = order['YEAR(`createdAt`)'];
        const week = order['WEEK(`createdAt`, 1)'];
        label = `Tuần ${week}/${year}`;
      }
      return {
        label,
        revenue: parseFloat(order.totalRevenue),
        // THÊM: Lấy orderCount và chuyển thành số
        orderCount: parseInt(order.orderCount, 10),
      };
    });

    res.status(200).json(formattedData);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({ message: 'Server error while fetching statistics.' });
  }
};
exports.getDetailedStatistics = async (req, res) => {
    const { period } = req.query;

    let startDate = new Date();
    if (period === 'month') {
        startDate.setDate(1); // Ngày đầu tiên của tháng
    } else { // 'week'
        const dayOfWeek = startDate.getDay();
        const diff = startDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // Bắt đầu từ thứ 2
        startDate.setDate(diff);
    }
    startDate.setHours(0, 0, 0, 0);

    try {
        const dailyRevenue = await Order.findAll({
            attributes: [
                // Nhóm theo ngày
                [Sequelize.fn('DATE', Sequelize.col('updatedAt')), 'date'],
                // Tính tổng doanh thu cho mỗi ngày
                [Sequelize.fn('SUM', Sequelize.col('totalAmount')), 'dailyRevenue']
            ],
            where: {
                status: 'paid',
                updatedAt: {
                    [Op.gte]: startDate,
                }
            },
            group: ['date'],
            order: [['date', 'ASC']],
            raw: true,
        });

        res.status(200).json(dailyRevenue);
    } catch (error) {
        console.error("Error fetching detailed statistics:", error);
        res.status(500).json({ message: error.message });
    }
};