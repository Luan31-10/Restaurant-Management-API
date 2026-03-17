// table.controller.js
const db = require("../models");
const { Op } = require("sequelize");
const Table = db.Table;
const Order = db.Order;
const OrderItem = db.OrderItem;
const MenuItem = db.MenuItem;
const Reservation = db.Reservation; // <<< ADD Reservation model

// Helper: Get io instance
const getIo = (req) => req.io || req.app.get('io');

// === SỬA LẠI HÀM checkAndReserveTable: Dùng logic so sánh Miligiây ===
// Checks if there's an upcoming reservation and sets table to 'reserved'
const checkAndReserveTable = async (tableId, io) => {
  if (!tableId) return false; // Return indicating no action taken

  const now = new Date();
  const requiredDifferenceMs = 60 * 60 * 1000; // 60 phút

  // 1. Tìm lịch đặt CONFIRMED gần nhất trong tương lai
  const upcomingReservation = await Reservation.findOne({
      where: {
          tableId: tableId,
          status: 'confirmed', 
          reservationTime: { [Op.gt]: now } // Chỉ lấy lịch đặt trong tương lai
      },
      order: [['reservationTime', 'ASC']], // Đảm bảo lấy lịch gần nhất
      attributes: ['reservationTime'],
  });

  if (upcomingReservation) {
      const reservationTime = upcomingReservation.reservationTime;
      // LOGIC SỬA LỖI MÚI GIỜ: So sánh khoảng cách thời gian bằng Miligiây
      const timeRemainingMs = reservationTime.getTime() - now.getTime();
      
      // Nếu khoảng cách còn lại từ 0ms đến 60 phút (3600000ms)
      if (timeRemainingMs >= 0 && timeRemainingMs <= requiredDifferenceMs) {
          const [affectedRows] = await Table.update(
              { status: 'reserved' },
              { where: { id: tableId, status: 'available' } } // Chỉ cập nhật nếu đang 'available'
          );

          if (affectedRows > 0) {
              const tableToUpdate = await Table.findByPk(tableId);
              if (io && tableToUpdate) {
                  console.log(`   Emit table_status_updated (table.controller.checkAndReserveTable): Table ${tableToUpdate.id} -> reserved`);
                  io.emit('table_status_updated', tableToUpdate.toJSON());
              }
              return true; // Đã cập nhật
          }
      }
  }
  return false; // Không cần cập nhật
};
// ====================================================================

// HÀM HELPER: Làm sạch dữ liệu bàn (bao gồm cả activeOrder nếu có) - Giữ nguyên
const sanitizeTable = (tableInstance) => {
    // ... (logic sanitize giữ nguyên) ...
    if (!tableInstance) return null;

    // 1. Chuyển đổi thành object thường TRƯỚC
    const table = tableInstance.get({ plain: true });

    // 2. Làm sạch các trường của Bàn
    if (table.id) table.id = parseInt(table.id, 10);
    if (table.capacity) table.capacity = parseInt(table.capacity, 10);

    // 3. Làm sạch activeOrder NẾU nó tồn tại (bên trong object 'table')
    if (table.activeOrder) {
        const order = table.activeOrder; 
        if (order.id) order.id = parseInt(order.id, 10);
        if (order.totalAmount) order.totalAmount = parseFloat(order.totalAmount);

        // Làm sạch OrderItems bên trong activeOrder
        if (order.OrderItems) {
            order.OrderItems = order.OrderItems.map(item => {
                 const cleanItem = { ...item };
                 if (cleanItem.id) cleanItem.id = parseInt(cleanItem.id, 10);
                 if (cleanItem.quantity) cleanItem.quantity = parseInt(cleanItem.quantity, 10);
                 if (cleanItem.price) cleanItem.price = parseFloat(cleanItem.price);
                 if (cleanItem.MenuItem) {
                     const cleanMenuItem = { ...cleanItem.MenuItem };
                     if (cleanMenuItem.id) cleanMenuItem.id = parseInt(cleanMenuItem.id, 10);
                     if (cleanMenuItem.price) cleanMenuItem.price = parseFloat(cleanMenuItem.price);
                     cleanItem.MenuItem = cleanMenuItem;
                 }
                 return cleanItem;
            });
        }
    }
    
    // 4. Bổ sung trường ReservationInfo (Dựa trên Reservation Model đã có)
    // Nếu bạn có trường reservation trên Table Model, bạn sẽ sanitize ở đây.
    
    return table;
};

// HÀM HELPER: Lấy thông tin bàn chi tiết - Giữ nguyên
const getTableDetail = async (id, transaction) => {
    // ... (logic getTableDetail giữ nguyên) ...
    const table = await Table.findByPk(id, {
        include: [{ 
            model: Order, 
            as: 'activeOrder', 
            include: [{ model: OrderItem, include: [MenuItem] }] 
        }],
        transaction
    });

    return sanitizeTable(table);
};

// Lấy tất cả các bàn - Giữ nguyên
exports.getAllTables = async (req, res) => {
    // ... (logic getAllTables giữ nguyên) ...
    try {
        const tables = await Table.findAll({
            include: [{ 
                model: Order, 
                as: 'activeOrder', 
                include: [{ model: OrderItem, include: [MenuItem] }] 
            }],
            order: [['number', 'ASC']]
        });
        
        // Cập nhật: Cần kiểm tra trạng thái Reserved cho mỗi bàn TRƯỚC KHI TRẢ VỀ
        const io = getIo(req);
        for (const table of tables) {
            // Nếu bàn đang available, kiểm tra xem nó có nên được reserved không
            if (table.status === 'available') {
                await checkAndReserveTable(table.id, io);
            }
        }
        
        // Lấy lại danh sách bàn sau khi có thể đã update trạng thái
        const updatedTables = await Table.findAll({
            include: [{ 
                model: Order, 
                as: 'activeOrder', 
                include: [{ model: OrderItem, include: [MenuItem] }] 
            }],
            order: [['number', 'ASC']]
        });
        
        res.status(200).send(updatedTables.map(sanitizeTable));
    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

// Cập nhật trạng thái bàn - Giữ nguyên
exports.updateTableStatus = async (req, res) => {
    const transaction = await db.sequelize.transaction();
    try {
        const tableId = req.params.id;
        const newStatus = req.body.status;
        const io = getIo(req);

        // 1. Cập nhật trạng thái bàn
        const [affectedRows] = await Table.update(
            { status: newStatus },
            { where: { id: tableId }, transaction }
        );

        if (affectedRows === 0) {
            await transaction.rollback();
            return res.status(404).send({ message: "Table not found." });
        }
        
        // 2. Xử lý các trường hợp đặc biệt
        if (newStatus === 'available') {
             // Cần kiểm tra lại reservation ngay sau khi bàn được free (chuyển sang 'available')
             // Nếu có reservation sắp tới (trong 60p), nó phải chuyển ngay sang 'reserved'
             await checkAndReserveTable(tableId, io); 
        }

        // 3. Lấy data bàn đã cập nhật để gửi Socket
        const updatedTable = await getTableDetail(tableId, transaction);

        await transaction.commit();

        // 4. Gửi Socket
        if (updatedTable) {
            console.log(`✅ Table status updated (API): Table ${tableId} -> ${newStatus}`);
            // Gửi qua socket
            io.emit('table_status_updated', updatedTable);
        }
        
        res.status(200).send({ message: "Table status updated successfully." });

    } catch (error) {
        if (transaction && !transaction.finished) { 
            await transaction.rollback();
        }
        console.error("Error in updateTableStatus:", error);
        res.status(500).send({ message: error.message });
    }
};

// ... (các hàm khác như exports.createTable, exports.deleteTable giữ nguyên) ...

// HÀM HELPER: Dọn dẹp OrderItems và MenuItem cho mục đích Socket emit (Giữ nguyên)
const sanitizeOrderForEmit = (orderInstance) => {
    // ... (logic sanitizeOrderForEmit giữ nguyên) ...
    if (!orderInstance) return null;
    const order = orderInstance.get({ plain: true });
    if (order.id) order.id = parseInt(order.id, 10);
    if (order.totalAmount) order.totalAmount = parseFloat(order.totalAmount);
    if (order.Table && order.Table.id) order.Table.id = parseInt(order.Table.id, 10);
    if (order.OrderItems) {
        order.OrderItems = order.OrderItems.map(item => {
             const cleanItem = { ...item };
             if (cleanItem.id) cleanItem.id = parseInt(cleanItem.id, 10);
             if (cleanItem.quantity) cleanItem.quantity = parseInt(cleanItem.quantity, 10);
             if (cleanItem.price) cleanItem.price = parseFloat(cleanItem.price);
             if (cleanItem.MenuItem) {
                 const cleanMenuItem = { ...cleanItem.MenuItem };
                 if (cleanMenuItem.id) cleanMenuItem.id = parseInt(cleanMenuItem.id, 10);
                 if (cleanMenuItem.price) cleanMenuItem.price = parseFloat(cleanMenuItem.price);
                 cleanItem.MenuItem = cleanMenuItem;
             }
             return cleanItem;
        });
    }
    return order;
};