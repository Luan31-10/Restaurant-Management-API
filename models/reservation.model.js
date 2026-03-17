// models/reservation.model.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Reservation = sequelize.define('Reservation', {
    customerName: {
        type: DataTypes.STRING,
        allowNull: false
    },
    phoneNumber: {
        type: DataTypes.STRING,
        allowNull: false
    },
    numberOfGuests: {
        type: DataTypes.INTEGER,
        allowNull: false
    },
    reservationTime: {
        type: DataTypes.DATE, // Lưu cả ngày và giờ
        allowNull: false
    },
    notes: {
        type: DataTypes.TEXT,
    },
    status: {
        type: DataTypes.STRING,
        allowNull: false,
        defaultValue: 'confirmed' // Mặc định là đã xác nhận
    }
    // tableId sẽ được tự động thêm vào qua mối quan hệ
}, {
    tableName: 'reservations'
});

module.exports = Reservation;