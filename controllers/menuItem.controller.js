// controllers/menuItem.controller.js

const db = require("../models");
const MenuItem = db.MenuItem;
const sequelize = db.sequelize; // Để dùng transaction (nếu cần sau này)
const { Op } = require("sequelize");

// GET /api/menu-items - Lấy tất cả món ăn ĐANG BÁN (cho nhân viên)
exports.getAllMenuItems = async (req, res) => {
    try {
        // Chỉ lấy các món đang được set là 'isAvailable: true'
        const menuItems = await MenuItem.findAll({ where: { isAvailable: true } });
        res.status(200).send(menuItems);
    } catch (error) {
        console.error("❌ Error fetching available menu items:", error);
        res.status(500).send({ message: error.message || "Could not fetch menu items." });
    }
};

// GET /api/menu-items/all - Lấy TẤT CẢ món ăn (cho Admin)
exports.getAllMenuItemsForAdmin = async (req, res) => {
    try {
        // Lấy tất cả, không có điều kiện 'where'
        const menuItems = await MenuItem.findAll({
            order: [['category', 'ASC'], ['name', 'ASC']] // Sắp xếp cho dễ quản lý
        });
        res.status(200).send(menuItems);
    } catch (error) {
        console.error("❌ Error fetching all menu items for admin:", error);
        res.status(500).send({ message: error.message || "Could not fetch menu items for admin." });
    }
};

// POST /api/menu-items - Tạo món ăn mới
exports.createMenuItem = async (req, res) => {
    const { name, description, price, category, imageUrl, isAvailable } = req.body;
    try {
        if (!name || !price || !category) {
            return res.status(400).send({ message: "Name, price, and category are required." });
        }
        // Gán giá trị mặc định cho isAvailable nếu client không gửi
        const available = isAvailable === undefined ? true : Boolean(isAvailable);

        const menuItem = await MenuItem.create({
            name,
            description: description || null, // Cho phép description là null
            price: parseFloat(price) || 0, // Đảm bảo price là số
            category,
            imageUrl: imageUrl || null, // Cho phép imageUrl là null
            isAvailable: available
        });
        res.status(201).send(menuItem); // Trả về món vừa tạo với status 201 (Created)
    } catch (error) {
        console.error("❌ Error creating menu item:", error);
        res.status(500).send({ message: error.message || "Could not create menu item." });
    }
};

// PUT /api/menu-items/:id - Cập nhật món ăn
exports.updateMenuItem = async (req, res) => {
    const id = req.params.id;
    // Chỉ lấy các trường hợp lệ từ body
    const { name, description, price, category, imageUrl, isAvailable } = req.body;
    try {
        const menuItem = await MenuItem.findByPk(id);
        if (!menuItem) {
            return res.status(404).send({ message: "Menu item not found." });
        }

        // Tạo object chứa các trường cần update một cách an toàn
        const updateData = {};
        if (name !== undefined) updateData.name = name;
        // Cho phép cập nhật description thành null hoặc rỗng
        if (description !== undefined) updateData.description = description;
        if (price !== undefined) updateData.price = parseFloat(price) || menuItem.price;
        if (category !== undefined) updateData.category = category;
        // Cho phép cập nhật imageUrl thành null hoặc rỗng
        if (imageUrl !== undefined) updateData.imageUrl = imageUrl;
        if (isAvailable !== undefined) updateData.isAvailable = Boolean(isAvailable);

        // Chỉ update nếu có dữ liệu thay đổi
        if (Object.keys(updateData).length > 0) {
           await menuItem.update(updateData);
        }

        res.status(200).send(menuItem); // Trả về món đã cập nhật
    } catch (error) {
        console.error(`❌ Error updating menu item ${id}:`, error);
        res.status(500).send({ message: error.message || "Could not update menu item." });
    }
};

// DELETE /api/menu-items/:id - Xóa món ăn
exports.deleteMenuItem = async (req, res) => {
    const id = req.params.id;
    // Cân nhắc dùng transaction nếu việc xóa có liên quan đến các bảng khác phức tạp
    // const transaction = await sequelize.transaction();
    try {
        const menuItem = await MenuItem.findByPk(id /*, { transaction }*/);
        if (!menuItem) {
            
            return res.status(404).send({ message: "Menu item not found." });
        }
        
        await menuItem.destroy();
        
        res.status(200).send({ message: "Menu item was deleted successfully." });
    } catch (error) {
        
        console.error(`❌ Error deleting menu item ${id}:`, error);
        
        if (error.name === 'SequelizeForeignKeyConstraintError') {
             return res.status(400).send({ message: "Cannot delete this item as it is referenced in existing orders." });
        }
        res.status(500).send({ message: error.message || "Could not delete menu item." });
    }
};

