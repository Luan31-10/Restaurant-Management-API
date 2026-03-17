const db = require("../models");
const { Op, Sequelize } = require("sequelize");
const Order = db.Order;
const OrderItem = db.OrderItem;
const MenuItem = db.MenuItem;
const Table = db.Table;
const sequelize = db.sequelize;

// === HÀM HELPER: LÀM SẠCH DỮ LIỆU ORDER (AN TOÀN HƠN) ===
const sanitizeOrder = (orderInstance) => {
    if (!orderInstance) return null;
    if (typeof orderInstance.get !== 'function') {
        const order = { ...orderInstance };
        if (order.id) order.id = parseInt(order.id, 10);
        if (order.totalAmount) order.totalAmount = parseFloat(order.totalAmount);
        if (order.Table && typeof order.Table === 'object') {
             if (order.Table.id) order.Table.id = parseInt(order.Table.id, 10);
        }
        if (order.OrderItems && Array.isArray(order.OrderItems)) {
             order.OrderItems = order.OrderItems.map(item => {
                 const cleanItem = { ...item };
                 if (cleanItem.id) cleanItem.id = parseInt(cleanItem.id, 10);
                 if (cleanItem.quantity) cleanItem.quantity = parseInt(cleanItem.quantity, 10);
                 if (cleanItem.price) cleanItem.price = parseFloat(cleanItem.price);
                  if (cleanItem.MenuItem && typeof cleanItem.MenuItem === 'object') {
                      const cleanMenuItem = { ...cleanItem.MenuItem };
                      if (cleanMenuItem.id) cleanMenuItem.id = parseInt(cleanMenuItem.id, 10);
                      if (cleanMenuItem.price) cleanMenuItem.price = parseFloat(cleanMenuItem.price);
                      cleanItem.MenuItem = cleanMenuItem;
                  }
                 return cleanItem;
             });
        }
        return order;
    }
    const order = orderInstance.get({ plain: true });
    if (order.id) order.id = parseInt(order.id, 10);
    if (order.totalAmount) order.totalAmount = parseFloat(order.totalAmount);
    if (order.Table) {
        if (order.Table.id) order.Table.id = parseInt(order.Table.id, 10);
    }
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

// === HÀM HELPER: LÀM SẠCH DỮ LIỆU BÀN (AN TOÀN HƠN) ===
const sanitizeTable = (tableInstance) => {
    if (!tableInstance) return null;
     if (typeof tableInstance.get !== 'function') {
         const table = { ...tableInstance };
         if (table.id) table.id = parseInt(table.id, 10);
         if (table.capacity) table.capacity = parseInt(table.capacity, 10);
         if (table.activeOrder && typeof table.activeOrder === 'object') {
              table.activeOrder = sanitizeOrder(table.activeOrder);
         }
         return table;
     }
    const table = tableInstance.get({ plain: true });
    if (table.id) table.id = parseInt(table.id, 10);
    if (table.capacity) table.capacity = parseInt(table.capacity, 10);
    if (table.activeOrder) {
        table.activeOrder = sanitizeOrder(table.activeOrder);
    }
    return table;
};
// ===================================


// POST /api/orders - Tạo một order mới
exports.createOrder = async (req, res) => {
    const { tableId, items, customerPhone } = req.body;
    const userId = req.userId;
    if (!tableId || !items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).send({ message: "Table ID and a non-empty array of items are required." });
    }

    const transaction = await sequelize.transaction();
    let orderId;
    let createdOrder;

    try {
        // --- Xử lý Menu Items ---
        const menuItemIds = items.map(item => item.menuItemId);
        const menuItems = await MenuItem.findAll({ where: { id: { [Op.in]: menuItemIds } }, transaction });
        const menuItemsMap = new Map(menuItems.map(item => [item.id, item]));
        if (menuItems.length !== menuItemIds.length) throw new Error(`One or more menu items were not found.`);
        let totalAmount = 0;
        const orderItemsData = items.map(item => {
            const menuItem = menuItemsMap.get(item.menuItemId);
            const price = parseFloat(menuItem.price) || 0;
            const quantity = parseInt(item.quantity) || 0;
            totalAmount += price * quantity;
            return { menuItemId: item.menuItemId, quantity: item.quantity, price: menuItem.price, status: 'pending' };
        });
        // --- Kết thúc xử lý Menu Items ---

        // Tạo Order
        createdOrder = await Order.create({ tableId, status: 'pending', totalAmount, userId, customerPhone: customerPhone || null }, { transaction });
        orderId = createdOrder.id;

        // Gán orderId và Tạo OrderItems
        orderItemsData.forEach(item => item.orderId = orderId);
        await OrderItem.bulkCreate(orderItemsData, { transaction });

        // Cập nhật trạng thái bàn
        await Table.update({ status: 'occupied' }, { where: { id: tableId }, transaction });

        // Commit transaction
        await transaction.commit();

        // === EMIT WEBSOCKET BÀN SAU COMMIT ===
        try {
            const updatedTableData = await Table.findByPk(tableId, { include: [{ model: Order, as: 'activeOrder', where: { id: orderId }, required: false, include: [{ model: OrderItem, include: [MenuItem] }] }] });
            if (updatedTableData) {
                const sanitizedTable = sanitizeTable(updatedTableData);
                console.log(`✅ Emit table_status_updated (createOrder): Bàn ${tableId} -> occupied`);
                req.io.to('waitstaff').emit('table_status_updated', sanitizedTable);
            } else { console.warn(`⚠️ Không tìm thấy bàn ${tableId} sau khi tạo order để emit.`); }
        } catch (emitError) { console.error("❌ Lỗi khi emit table_status_updated (createOrder):", emitError); }
        // =====================================

    } catch (error) {
        if (!transaction.finished) await transaction.rollback();
        console.error("❌ Create Order Transaction Error:", error);
        return res.status(500).send({ message: error.message || "Failed to create order due to a database error." });
    }

    // --- TRẢ RESPONSE VÀ EMIT CHO BẾP ---
    try {
        const newOrderData = await Order.findByPk(orderId, { include: [{ model: Table, attributes: ['id', 'number'] }, { model: OrderItem, include: [MenuItem] }] });
        if (!newOrderData) {
            console.error(`Không tìm thấy order ${orderId} sau khi tạo.`);
            return res.status(201).send({ message: "Order created successfully, but failed to retrieve full data." });
        }
        const sanitizedOrder = sanitizeOrder(newOrderData);
        req.io.to('kitchen').emit('new_order', sanitizedOrder);
        req.io.emit('order_updated', sanitizedOrder);
        res.status(201).send(sanitizedOrder);
    } catch (postTransactionError) {
        console.error("❌ Post-Transaction Error (Emit Kitchen/Response createOrder):", postTransactionError);
        res.status(201).send({ message: "Order created successfully, but failed to retrieve full data or notify kitchen." });
    }
    // --- Kết thúc ---
};

// GET /api/orders/kitchen/active - Lấy các order cho bếp
exports.getKitchenOrders = async (req, res) => {
    try {
        const orders = await Order.findAll({
            where: {
                // === QUAN TRỌNG: Phải có 'ready' ở đây ===
                status: { [Op.or]: ['pending', 'preparing', 'ready'] }
                // ======================================
            },
            include: [
                { model: Table, attributes: ['id', 'number'] },
                { model: OrderItem, include: [{ model: MenuItem, attributes: ['id', 'name'] }] }
            ],
            order: [['createdAt', 'ASC']] // Sắp xếp theo thời gian tạo
        });
        const sanitizedOrders = orders.map(sanitizeOrder); // Dùng hàm helper của bro
        res.status(200).send(sanitizedOrders);
    } catch (error) {
        console.error("❌ Get Kitchen Orders Error:", error);
        res.status(500).send({ message: error.message });
    }
};

// PATCH /api/orders/:orderId - Cập nhật trạng thái của order
exports.updateOrderStatus = async (req, res) => {
    const orderId = req.params.orderId;
    const { status, paymentMethod } = req.body;
    const transaction = await sequelize.transaction();
    let associatedTableId;

    try {
        const order = await Order.findByPk(orderId, { transaction });
        if (!order) { await transaction.rollback(); return res.status(404).send({ message: "Order not found." }); }
        associatedTableId = order.tableId;

        // Cập nhật Order
        let updatedFields = { status };
        if (status === 'paid' && paymentMethod) updatedFields.paymentMethod = paymentMethod;
        await order.update(updatedFields, { transaction });

        // Đồng bộ OrderItem nếu cần
        if (status === 'pending' || status === 'preparing') { await OrderItem.update({ status: 'pending' }, { where: { orderId: orderId }, transaction }); }

        // Cập nhật Table
        let updatedTableStatus = null;
        if (associatedTableId) {
            if (status === 'ready') { await Table.update({ status: 'serving' }, { where: { id: associatedTableId }, transaction }); updatedTableStatus = 'serving'; }
            else if (status === 'paid') { await Table.update({ status: 'cleaning' }, { where: { id: associatedTableId }, transaction }); updatedTableStatus = 'cleaning'; }
            else if (status === 'cancelled') { await Table.update({ status: 'available' }, { where: { id: associatedTableId }, transaction }); updatedTableStatus = 'available'; }
        }

        await transaction.commit();

        // === EMIT WEBSOCKET BÀN SAU COMMIT ===
        if (updatedTableStatus && associatedTableId) {
             try {
                 const updatedTableData = await Table.findByPk(associatedTableId, { include: [{ model: Order, as: 'activeOrder', required: false, where: { status: { [Op.notIn]: ['paid', 'cancelled'] } }, include: [{ model: OrderItem, include: [MenuItem] }] }] });
                 if (updatedTableData) {
                     const sanitizedTable = sanitizeTable(updatedTableData);
                     console.log(`✅ Emit table_status_updated (updateOrderStatus): Bàn ${associatedTableId} -> ${updatedTableStatus}`);
                     req.io.to('waitstaff').emit('table_status_updated', sanitizedTable);
                 } else { console.warn(`⚠️ Không tìm thấy bàn ${associatedTableId} sau khi cập nhật status order để emit.`); }
             } catch (emitError) { console.error("❌ Lỗi khi emit table_status_updated (updateOrderStatus):", emitError); }
        }
        // =====================================

        // --- TRẢ RESPONSE VÀ EMIT ORDER ---
        try {
            const updatedOrderData = await Order.findByPk(orderId, { include: [{ model: Table, attributes: ['id', 'number'] }, { model: OrderItem, include: [MenuItem] }] });
             if (!updatedOrderData) {
                  console.error(`Không tìm thấy order ${orderId} sau khi cập nhật status.`);
                  return res.status(200).send({ message: "Order status updated, but failed to retrieve full data." });
             }
            const sanitizedOrder = sanitizeOrder(updatedOrderData);
            req.io.emit('order_updated', sanitizedOrder);
            if (status === 'ready') {
                const tableName = sanitizedOrder.Table ? `${sanitizedOrder.Table.number}` : 'Mang về';
                req.io.to('waitstaff').emit('order_ready', { tableName, order: sanitizedOrder });
            }
            res.status(200).send({ message: "Order status updated successfully." });
        } catch (postTransactionError) {
             console.error("❌ Post-Transaction Error (Emit Order/Response updateOrderStatus):", postTransactionError);
             res.status(200).send({ message: "Order status updated, but failed to emit updates or retrieve full data." });
        }
        // --- Kết thúc ---

    } catch (error) {
        if (!transaction.finished) await transaction.rollback();
        console.error(`❌ Update Order Status Error for Order ID ${orderId}:`, error);
        res.status(500).send({ message: error.message });
    }
};

// PUT /api/orders/:orderId/items - Sửa order
exports.updateOrderItems = async (req, res) => {
    const orderId = req.params.orderId;
    const { items } = req.body;
    if (!items || !Array.isArray(items)) return res.status(400).json({ message: 'Danh sách món ăn không hợp lệ.' });

    const transaction = await sequelize.transaction();
    try {
        // --- Xử lý Menu Items ---
        const menuItemIds = items.map(item => item.menuItemId);
        const menuItems = await MenuItem.findAll({ where: { id: { [Op.in]: menuItemIds } }, transaction });
        const menuItemsMap = new Map(menuItems.map(item => [item.id, item]));
        if (menuItems.length !== menuItemIds.length) throw new Error(`Một hoặc nhiều món ăn không tìm thấy.`);
        let totalAmount = 0;
        const newOrderItems = items.map(item => {
            const menuItem = menuItemsMap.get(item.menuItemId);
            const price = parseFloat(menuItem.price) || 0;
            const quantity = parseInt(item.quantity) || 0;
            totalAmount += price * quantity;
            return { orderId, menuItemId: item.menuItemId, quantity: item.quantity, price: menuItem.price, status: 'pending' };
        });
        // --- Kết thúc ---

        // Cập nhật DB
        await OrderItem.destroy({ where: { orderId: orderId }, transaction });
        await OrderItem.bulkCreate(newOrderItems, { transaction });
        await Order.update({ totalAmount: totalAmount, status: 'pending' }, { where: { id: orderId }, transaction });

        await transaction.commit();

        // --- TRẢ RESPONSE VÀ EMIT ORDER ---
        try {
            const updatedOrderData = await Order.findByPk(orderId, { include: [{ model: Table, attributes: ['id', 'number'] }, { model: OrderItem, include: [MenuItem] }] });
             if (!updatedOrderData) {
                 console.error(`Không tìm thấy order ${orderId} sau khi sửa món.`);
                 return res.status(200).send({ message: "Order items updated, but failed to retrieve full data." });
             }
            const sanitizedOrder = sanitizeOrder(updatedOrderData);
            req.io.emit('order_updated', sanitizedOrder);
            req.io.to('kitchen').emit('order_items_updated', sanitizedOrder);
            res.status(200).send({ message: "Order được cập nhật thành công." });
        } catch(postTransactionError){
             console.error("❌ Post-Transaction Error (Emit/Response updateOrderItems):", postTransactionError);
             res.status(200).send({ message: "Order items updated, but failed to emit updates or retrieve full data." });
        }
        // --- Kết thúc ---

    } catch (error) {
        if (!transaction.finished) await transaction.rollback();
        console.error(`❌ Update Order Items Error for Order ID ${orderId}:`, error);
        res.status(500).send({ message: error.message });
    }
};


// PATCH /api/orders/items/:itemId - Cập nhật trạng thái của TỪNG MÓN
exports.updateOrderItemStatus = async (req, res) => {
    const itemId = req.params.itemId;
    const { status } = req.body;

    const transaction = await sequelize.transaction();
    let orderId;
    let associatedTableId;

    try {
        const orderItem = await OrderItem.findByPk(itemId, { transaction });
        if (!orderItem) { await transaction.rollback(); return res.status(404).json({ message: "Order item not found." }); }
        orderId = orderItem.orderId;

        // Cập nhật trạng thái món ăn
        await orderItem.update({ status }, { transaction });

        // Kiểm tra và cập nhật trạng thái Order
        const allItemsInOrder = await OrderItem.findAll({ where: { orderId: orderId }, transaction });
        const order = await Order.findByPk(orderId, { transaction });
        if (!order) { await transaction.rollback(); console.error(`Không tìm thấy order ${orderId}`); return res.status(500).json({ message: "Associated order not found."}); }
        associatedTableId = order.tableId;

        const isAllReady = allItemsInOrder.every(item => item.status === 'ready');
        const isAnyPreparing = allItemsInOrder.some(item => item.status === 'preparing');
        let orderStatusChanged = false;
        let newOrderStatus = order.status;

        if (isAllReady && !['ready', 'paid', 'cancelled'].includes(order.status)) { newOrderStatus = 'ready'; orderStatusChanged = true; }
        else if (isAnyPreparing && order.status === 'pending') { newOrderStatus = 'preparing'; orderStatusChanged = true; }

        let updatedTableStatus = null;
        if (orderStatusChanged) {
            await order.update({ status: newOrderStatus }, { transaction });
            if (newOrderStatus === 'ready' && associatedTableId) {
                await Table.update({ status: 'serving' }, { where: { id: associatedTableId }, transaction });
                updatedTableStatus = 'serving';
            }
        }

        await transaction.commit();

        // === EMIT CẬP NHẬT BÀN SAU COMMIT (NẾU CÓ) ===
        if (updatedTableStatus && associatedTableId) {
             try {
                 const updatedTableData = await Table.findByPk(associatedTableId, { include: [{ model: Order, as: 'activeOrder', required: false, where: { status: { [Op.notIn]: ['paid', 'cancelled'] } }, include: [{ model: OrderItem, include: [MenuItem] }] }] });
                 if (updatedTableData) {
                      const sanitizedTable = sanitizeTable(updatedTableData);
                      console.log(`✅ Emit table_status_updated (updateOrderItemStatus): Bàn ${associatedTableId} -> ${updatedTableStatus}`);
                      req.io.to('waitstaff').emit('table_status_updated', sanitizedTable);
                 } else { console.warn(`⚠️ Không tìm thấy bàn ${associatedTableId} sau khi cập nhật item status để emit.`); }
             } catch (emitError) { console.error("❌ Lỗi khi emit table_status_updated (updateOrderItemStatus):", emitError); }
        }
        // ===========================================

        // --- TRẢ RESPONSE VÀ EMIT ORDER ---
         try {
             const updatedOrderData = await Order.findByPk(orderId, { include: [{ model: Table, attributes: ['id', 'number'] }, { model: OrderItem, include: [MenuItem] }] });
              if (!updatedOrderData) {
                  console.error(`Không tìm thấy order ${orderId} sau khi cập nhật item status.`);
                  return res.status(200).json({ message: "Order item status updated, but failed to retrieve full order data." });
              }
             const sanitizedOrder = sanitizeOrder(updatedOrderData);
             req.io.emit('order_updated', sanitizedOrder);
             if (orderStatusChanged && newOrderStatus === 'ready') {
                 const tableName = sanitizedOrder.Table ? `${sanitizedOrder.Table.number}` : 'Mang về';
                 req.io.to('waitstaff').emit('order_ready', { tableName, order: sanitizedOrder });
             }
             res.status(200).json({ message: "Order item status updated." });
         } catch(postUpdateError){
              console.error("❌ Post-Update Error (Emit/Response updateOrderItemStatus):", postUpdateError);
              res.status(200).json({ message: "Order item status updated, but failed to emit updates or retrieve full data." });
         }
        // --- Kết thúc ---

    } catch (error) {
        if (!transaction.finished) await transaction.rollback();
        console.error(`❌ Update Order Item Status Error for Item ID ${itemId}:`, error);
        res.status(500).json({ message: error.message });
    }
};