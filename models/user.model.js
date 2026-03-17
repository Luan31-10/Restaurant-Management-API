const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  role: {
    type: DataTypes.STRING,
    allowNull: false // Ví dụ: 'admin', 'staff', 'kitchen'
  },
  pin: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  // THÊM TRƯỜNG MỚI ĐỂ BẢO MẬT
  masterPin: {
    type: DataTypes.STRING,
    allowNull: true // Chỉ admin mới có, nhân viên sẽ là NULL
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
}, {
  tableName: 'users'
});

module.exports = User;