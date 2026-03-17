const sequelize = require('../config/database');
const { Sequelize, Op } = require('sequelize');

const db = {};

db.Sequelize = Sequelize;
db.sequelize = sequelize;

// Import tất cả các model
db.User = require('./user.model');
db.Table = require('./table.model');
db.MenuItem = require('./menuItem.model');
db.Order = require('./order.model');
db.OrderItem = require('./orderItem.model');
db.Reservation = require('./reservation.model');
db.TimeClock = require('./timeClock.model.js'); 
db.EndOfDayReport = require('./endOfDayReport.model.js');


db.Table.hasMany(db.Order, { foreignKey: 'tableId' });
db.Order.belongsTo(db.Table, { foreignKey: 'tableId' });


db.Table.hasOne(db.Order, {
  as: 'activeOrder',
  foreignKey: 'tableId',
  
  scope: {
    status: { [Op.notIn]: ['paid', 'cancelled'] }
  }
});


db.Order.hasMany(db.OrderItem, { foreignKey: 'orderId', onDelete: 'CASCADE' });
db.OrderItem.belongsTo(db.Order, { foreignKey: 'orderId' });

db.MenuItem.hasMany(db.OrderItem, { foreignKey: 'menuItemId' });
db.OrderItem.belongsTo(db.MenuItem, { foreignKey: 'menuItemId' });

db.Table.hasMany(db.Reservation, { foreignKey: 'tableId' });
db.Reservation.belongsTo(db.Table, { foreignKey: 'tableId' });

db.User.hasMany(db.Order, { foreignKey: 'userId' });
db.Order.belongsTo(db.User, { foreignKey: 'userId' });

db.User.hasMany(db.TimeClock, { foreignKey: 'userId' });
db.TimeClock.belongsTo(db.User, { foreignKey: 'userId' });

db.User.hasMany(db.EndOfDayReport, { foreignKey: 'generatedByUserId' });
db.EndOfDayReport.belongsTo(db.User, { foreignKey: 'generatedByUserId' });


module.exports = db;