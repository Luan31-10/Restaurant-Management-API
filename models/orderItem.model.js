const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OrderItem = sequelize.define('OrderItem', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  price: {
    type: DataTypes.DECIMAL(10, 2), // Giá tại thời điểm đặt hàng
    allowNull: false
  },
  status: {
    type: DataTypes.ENUM('pending', 'preparing', 'ready'),
    allowNull: false,
    defaultValue: 'pending'
  }
  // orderId và menuItemId sẽ được Sequelize tự động thêm vào
}, {
  tableName: 'order_items'
});

module.exports = OrderItem;