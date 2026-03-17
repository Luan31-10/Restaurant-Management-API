// controllers/ai.controller.js

const db = require("../models");
const OrderItem = db.OrderItem;
const MenuItem = db.MenuItem;
const { Op } = require("sequelize");
const sequelize = db.sequelize;

exports.getRecommendations = async (req, res) => {
    try {
        const primaryItemId = req.params.menuItemId;

        // 1. Tìm tất cả các order ID có chứa món ăn chính
        const ordersWithItem = await OrderItem.findAll({
            where: { menuItemId: primaryItemId },
            attributes: ['orderId'],
            raw: true,
        });
        const orderIds = ordersWithItem.map(item => item.orderId);

        if (orderIds.length === 0) {
            return res.status(200).send([]);
        }

        // 2. Từ các order đó, tìm tất cả các món ăn khác được gọi kèm
        const coOccurringItems = await OrderItem.findAll({
            where: {
                orderId: { [Op.in]: orderIds },
                menuItemId: { [Op.ne]: primaryItemId } // Loại trừ món ăn chính
            },
            raw: true,
        });

        // 3. Đếm tần suất xuất hiện của các món ăn đi kèm
        const frequencyMap = {};
        coOccurringItems.forEach(item => {
            frequencyMap[item.menuItemId] = (frequencyMap[item.menuItemId] || 0) + 1;
        });

        // 4. Sắp xếp và lấy ra 3 món phổ biến nhất
        const sortedItems = Object.keys(frequencyMap)
            .sort((a, b) => frequencyMap[b] - frequencyMap[a])
            .slice(0, 3);
        
        // 5. Lấy thông tin chi tiết của 3 món đó và trả về
        const recommendedMenuItems = await MenuItem.findAll({
            where: {
                id: { [Op.in]: sortedItems }
            }
        });

        res.status(200).send(recommendedMenuItems);

    } catch (error) {
        res.status(500).send({ message: error.message });
    }
};

exports.getBestsellers = async (req, res) => {
    try {
        console.log('\n[DEBUG] Bắt đầu lấy danh sách best-sellers...');
        
        // Bước 1: Tìm các món bán chạy nhất từ bảng order_items
        const bestsellers = await OrderItem.findAll({
            attributes: [
                'menuItemId',
                [sequelize.fn('SUM', sequelize.col('quantity')), 'totalQuantity']
            ],
            group: ['menuItemId'],
            order: [[sequelize.fn('SUM', sequelize.col('quantity')), 'DESC']],
            limit: 5,
            raw: true
        });
        console.log('[DEBUG] Bước 1 - Kết quả phân tích từ order_items:', JSON.stringify(bestsellers, null, 2));

        const bestsellerIds = bestsellers.map(item => item.menuItemId);
        console.log('[DEBUG] Bước 2 - Mảng các ID bán chạy:', bestsellerIds);

        if (bestsellerIds.length === 0) {
            console.log('[DEBUG] Không có dữ liệu bán hàng, trả về danh sách rỗng.');
            return res.status(200).send([]);
        }

        // Bước 3: Lấy thông tin chi tiết của các món đó từ bảng menu_items
        const recommendedMenuItems = await MenuItem.findAll({
            where: {
                id: { [Op.in]: bestsellerIds }
            }
        });
        console.log('[DEBUG] Bước 3 - Dữ liệu lấy từ menu_items:', JSON.stringify(recommendedMenuItems, null, 2));
        
        // Bước 4: Sắp xếp lại kết quả theo đúng thứ tự bán chạy
        const sortedResult = bestsellerIds
            .map(id => recommendedMenuItems.find(item => item.id === id))
            .filter(item => item != null);
        console.log('[DEBUG] Bước 4 - Kết quả cuối cùng gửi về cho app:', JSON.stringify(sortedResult, null, 2));

        res.status(200).send(sortedResult);

    } catch (error) {
        console.error('[DEBUG] Đã xảy ra lỗi trong getBestsellers:', error);
        res.status(500).send({ message: error.message });
    }
};