// models/menu_item_ingredient.model.js
module.exports = (sequelize, DataTypes) => {
  const MenuItemIngredient = sequelize.define('MenuItemIngredient', {
    // Giữ nguyên định nghĩa các cột: menu_item_id, ingredient_id, quantity_used
    menu_item_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: { model: 'menu_items', key: 'id' },
      field: 'menu_item_id'
    },
    ingredient_id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      references: { model: 'ingredients', key: 'id' },
      field: 'ingredient_id'
    },
    quantity_used: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      field: 'quantity_used'
    }
  }, {
    tableName: 'menu_item_ingredients',
    timestamps: true // Giữ timestamps nếu bảng có
  });

  // *** BỎ PHẦN associate Ở ĐÂY RA ***

  return MenuItemIngredient;
};