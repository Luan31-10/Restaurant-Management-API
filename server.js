// server.js
const express = require('express');
require('dotenv').config();
const db = require('./models'); // Đảm bảo models đã import đúng
const http = require('http');
const { Server } = require("socket.io");

// === BỎ IMPORT CRON, CHỈ GIỮ LẠI CÁC IMPORT CẦN THIẾT ===
const Table = db.Table; // Lấy model Table
const Reservation = db.Reservation; // Lấy model Reservation
const { Op } = db.Sequelize; // Lấy Op từ db instance đã khởi tạo
// =======================================================

// Import Routes (giữ nguyên)
const tableRoutes = require('./routes/table.routes');
const menuItemRoutes = require('./routes/menuItem.routes');
const orderRoutes = require('./routes/order.routes');
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const aiRoutes = require('./routes/ai.routes');
const reservationRoutes = require('./routes/reservation.routes');
const statisticsRoutes = require('./routes/statistics.routes.js');
const reportRoutes = require('./routes/report.routes.js');
const timeClockRoutes = require('./routes/timeClock.routes.js');
const orderItemRoutes = require('./routes/orderItem.routes.js');
const uploadRoutes = require('./routes/upload.routes.js');
const dashboardRoutes = require('./routes/dashboard.routes.js');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Cho phép mọi kết nối
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use('/uploads', express.static('uploads'));

// Middleware để gán io vào mỗi request (giữ nguyên)
app.use((req, res, next) => {
  req.io = io;
  next();
});

// Thêm io vào app instance để interval job có thể dùng
app.set('io', io);
const getIo = () => app.get('io');

// Socket.IO connection (giữ nguyên)
io.on('connection', (socket) => {
  console.log('✅ Một người dùng đã kết nối qua WebSocket:', socket.id);
  socket.on('join_role_room', (role) => {
    console.log(`Socket ${socket.id} đã tham gia vào phòng: ${role}`);
    socket.join(role);
  });
  socket.on('disconnect', () => {
    console.log('❌ Người dùng đã ngắt kết nối WebSocket:', socket.id);
  });
});

// DB Authentication (giữ nguyên)
db.sequelize.authenticate()
  .then(() => console.log('✅ Đã kết nối thành công tới MySQL.'))
  .catch(err => console.error('❌ Lỗi kết nối MySQL:', err));

// Sử dụng Routes (kiểm tra lại tiền tố)
app.use('/api/auth', authRoutes);
app.use('/api/tables', tableRoutes);
app.use('/api/menu-items', menuItemRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/users', userRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api', statisticsRoutes);
app.use('/api', reportRoutes);
app.use('/api', timeClockRoutes);
app.use('/api/order-items', orderItemRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api', dashboardRoutes);



const runTableStatusChecker = async (appInstance) => { 
    

    const now = new Date(); 
    const gracePeriodPast = new Date(now.getTime() - 30 * 60000); 
    const requiredDifferenceMs = 60 * 60 * 1000;

    const socketIo = getIo(); 
    const transaction = await db.sequelize.transaction();
    let tableIdsToEmit = []; 

    try {
        
        const reservationsToCheck = await Reservation.findAll({
             where: {
                status: 'confirmed',
                tableId: { [Op.ne]: null },
                reservationTime: { [Op.gt]: now } 
            },
            attributes: ['id', 'tableId', 'reservationTime'],
            transaction
        });

        const tableIdsToReserve = [];
        reservationsToCheck.forEach(r => {
            const reservationTime = r.reservationTime; 
            const timeRemainingMs = reservationTime.getTime() - now.getTime(); 
            if (timeRemainingMs >= 0 && timeRemainingMs <= requiredDifferenceMs) {
                tableIdsToReserve.push(r.tableId);
            }
        });
        const uniqueTableIdsToReserve = [...new Set(tableIdsToReserve)];

        if (uniqueTableIdsToReserve.length > 0) {
            const [affectedRowsReserve] = await Table.update(
                { status: 'reserved' },
                {
                    where: {
                        id: { [Op.in]: uniqueTableIdsToReserve },
                        status: 'available' 
                    },
                    transaction
                }
            );
            if (affectedRowsReserve > 0) {
                 const updated = await Table.findAll({ where: { id: { [Op.in]: uniqueTableIdsToReserve }, status: 'reserved' }, attributes: ['id'], transaction });
                 tableIdsToEmit.push(...updated.map(t => t.id));
            }
        } 
        const reservedTables = await Table.findAll({ where: { status: 'reserved' }, attributes: ['id'], transaction });
        const reservedTableIds = reservedTables.map(t => t.id);
        const tableIdsToMakeAvailable = [];

        if (reservedTableIds.length > 0) {
            
            const stillValidReservations = await Reservation.findAll({
                where: {
                    tableId: { [Op.in]: reservedTableIds },
                    status: { [Op.in]: ['confirmed', 'arrived'] },
                    
                    reservationTime: { [Op.gt]: gracePeriodPast }
                },
                attributes: ['tableId'],
                transaction
            });
            const validReservedTableIds = new Set(stillValidReservations.map(r => r.tableId));

            
            for (const tableId of reservedTableIds) {
                if (!validReservedTableIds.has(tableId)) {
                    tableIdsToMakeAvailable.push(tableId);
                }
            }
        }

        if (tableIdsToMakeAvailable.length > 0) {
           const [affectedRowsFree] = await Table.update(
             { status: 'available' },
             { where: { id: { [Op.in]: tableIdsToMakeAvailable }, status: 'reserved' }, transaction }
           );
           if (affectedRowsFree > 0) {
                 const updated = await Table.findAll({ where: { id: { [Op.in]: tableIdsToMakeAvailable }, status: 'available' }, attributes: ['id'], transaction });
                 updated.forEach(t => { if (tableIdsToEmit.indexOf(t.id) === -1) tableIdsToEmit.push(t.id); });
           }
        } 
        
        await transaction.commit();
        if (socketIo && tableIdsToEmit.length > 0) {
            const uniqueTableIdsToEmit = [...new Set(tableIdsToEmit)];
            const tablesDataToEmit = await Table.findAll({ where: { id: { [Op.in]: uniqueTableIdsToEmit } } });
            tablesDataToEmit.forEach(table => {
                 socketIo.emit('table_status_updated', table.toJSON());
            });
        }

    } catch (error) {
        if (transaction && !transaction.finished) { await transaction.rollback(); }
        console.error('❌ Lỗi trong interval job:', error);
    }
};


server.listen(PORT, () => {
  console.log(`🚀 Server đang chạy trên cổng ${PORT}.`);
  console.log('🚀 Starting table status checker interval (every 10 seconds)...');
  runTableStatusChecker(app);
  setInterval(() => runTableStatusChecker(app), 10000);
  
});