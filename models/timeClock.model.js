// File: models/timeClock.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TimeClock = sequelize.define('TimeClock', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  clockInTime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  clockOutTime: {
    type: DataTypes.DATE,
    allowNull: true // Sẽ là null khi nhân viên chưa check-out
  },
  totalHours: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true // Sẽ được tính khi check-out
  }
}, {
  tableName: 'time_clocks'
});

module.exports = TimeClock;