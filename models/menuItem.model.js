// models/menuItem.model.js

const { Sequelize, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const getServerIp = require('../get-ip');

const MenuItem = sequelize.define('MenuItem', {
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    description: {
        type: DataTypes.STRING,
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
    },
    category: {
        type: DataTypes.STRING,
        allowNull: false
    },
    isAvailable: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    imageUrl: {
    type: DataTypes.STRING,
    allowNull: true,
    // SỬA LẠI HOÀN TOÀN HÀM "GET" NÀY
    get() {
      // Lấy giá trị gốc đang được lưu trong database
      const rawValue = this.getDataValue('imageUrl');

      // Chỉ xử lý nếu giá trị tồn tại
      if (rawValue) {
        // KIỂM TRA: Nếu rawValue đã là một URL đầy đủ, trả về ngay lập tức
        if (rawValue.startsWith('http')) {
          return rawValue;
        }

        // Nếu không, mới tiến hành tạo URL đầy đủ
        const serverIp = getServerIp();
        const port = process.env.PORT || 3000;
        
        // Đảm bảo không có dấu / thừa ở đầu rawValue
        const cleanRawValue = rawValue.startsWith('/') ? rawValue.substring(1) : rawValue;
        
        return `http://${serverIp}:${port}/${cleanRawValue}`;
      }
      
      return null;
    }
  }
}, {
    tableName: 'menu_items' // Đảm bảo tên bảng khớp với CSDL
});

module.exports = MenuItem;