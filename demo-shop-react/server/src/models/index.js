const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Category = sequelize.define('Category', {
  id: {
    type: DataTypes.STRING(64),
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
  },
}, { tableName: 'categories', timestamps: false });

const User = sequelize.define('User', {
  id: {
    type: DataTypes.STRING(64),
    primaryKey: true,
    allowNull: false,
  },
  login: {
    type: DataTypes.STRING(120),
    allowNull: false,
    unique: true,
  },
  fullName: {
    type: DataTypes.STRING(180),
    allowNull: false,
  },
  role: {
    type: DataTypes.STRING(24),
    allowNull: false,
    defaultValue: 'client',
    validate: { isIn: [['client', 'manager', 'admin']] },
  },
}, { tableName: 'users', timestamps: false });

const Product = sequelize.define('Product', {
  id: {
    type: DataTypes.STRING(64),
    primaryKey: true,
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(220),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: { min: 0 },
  },
  // Общий остаток по товару; синхронизируется с суммой остатков вариантов.
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0, isInt: true },
  },
  image: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  manufacturerName: { type: DataTypes.STRING(120), allowNull: true },
  composition: { type: DataTypes.TEXT, allowNull: true },
  // Поле пригодится, если в каталоге появятся товары без размерных вариантов.
  attributes: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  categoryId: {
    type: DataTypes.STRING(64),
    allowNull: false,
    references: { model: 'categories', key: 'id' },
  },
}, { tableName: 'products', timestamps: false });

const ProductVariant = sequelize.define('ProductVariant', {
  id: {
    type: DataTypes.STRING(64),
    primaryKey: true,
    allowNull: false,
  },
  size: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  stock: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    validate: { min: 0, isInt: true },
  },
  productId: {
    type: DataTypes.STRING(64),
    allowNull: false,
    references: { model: 'products', key: 'id' },
  },
}, {
  tableName: 'product_variants',
  timestamps: false,
  indexes: [{ unique: true, fields: ['productId', 'size'] }],
});

const Order = sequelize.define('Order', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  quantity: {
    type: DataTypes.INTEGER,
    allowNull: false,
    validate: { min: 1, isInt: true },
  },
  totalPrice: {
    type: DataTypes.DECIMAL(12, 2),
    allowNull: false,
    validate: { min: 0 },
  },
  status: {
    type: DataTypes.ENUM('new', 'completed', 'cancelled'),
    allowNull: false,
    defaultValue: 'new',
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  // Дополнительные поля сохраняют структуру исходного mockData.json.
  sourceOrderId: { type: DataTypes.STRING(64), allowNull: true },
  sourceItemId: { type: DataTypes.STRING(64), allowNull: true },
  size: { type: DataTypes.STRING(100), allowNull: true },
  userId: {
    type: DataTypes.STRING(64),
    allowNull: false,
    references: { model: 'users', key: 'id' },
  },
  productId: {
    type: DataTypes.STRING(64),
    allowNull: false,
    references: { model: 'products', key: 'id' },
  },
  variantId: {
    type: DataTypes.STRING(64),
    allowNull: true,
    references: { model: 'product_variants', key: 'id' },
  },
}, { tableName: 'orders', timestamps: false });

Category.hasMany(Product, { foreignKey: 'categoryId', as: 'products' });
Product.belongsTo(Category, { foreignKey: 'categoryId', as: 'category' });
Product.hasMany(ProductVariant, { foreignKey: 'productId', as: 'variants' });
ProductVariant.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
User.hasMany(Order, { foreignKey: 'userId', as: 'orders' });
Order.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Product.hasMany(Order, { foreignKey: 'productId', as: 'orders' });
Order.belongsTo(Product, { foreignKey: 'productId', as: 'product' });
ProductVariant.hasMany(Order, { foreignKey: 'variantId', as: 'orders' });
Order.belongsTo(ProductVariant, { foreignKey: 'variantId', as: 'variant' });

module.exports = { sequelize, Category, User, Product, ProductVariant, Order };
