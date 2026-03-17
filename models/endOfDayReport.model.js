const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EndOfDayReport = sequelize.define('EndOfDayReport', {
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    reportDate: {
        type: DataTypes.DATE,
        allowNull: false
    },
    totalRevenue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    totalOrders: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    cancelledOrders: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    revenueByPaymentMethod: {
        type: DataTypes.JSON,
        allowNull: true
    }
}, {
    tableName: 'end_of_day_reports'
});

module.exports = EndOfDayReport;