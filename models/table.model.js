// models/table.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Table = sequelize.define('Table', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  number: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  capacity: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  // Trường này đã có, rất tốt!
  status: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'available' // Mặc định là trống
  }
}, {
  tableName: 'tables'
});

module.exports = Table;