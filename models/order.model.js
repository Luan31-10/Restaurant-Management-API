const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'preparing', 'ready', 'completed', 'paid', 'cancelled'),
    allowNull: false,
    defaultValue: 'pending' 
  },
  totalAmount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0.00
  },
  userId: {
    type: DataTypes.INTEGER,
    allowNull: true, // Cho phép null nếu là order hệ thống
    references: {
      model: 'users', // Tên của bảng người dùng trong CSDL
      key: 'id'
    }
  },
  paymentMethod: {
    type: DataTypes.ENUM('cash', 'card', 'transfer'), // Thêm các phương thức bạn hỗ trợ
    allowNull: false,
    defaultValue: 'cash'
  }
}, {
  tableName: 'orders'
});

module.exports = Order;