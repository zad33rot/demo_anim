const express = require('express');
const { Op } = require('sequelize');
const { Product, ProductVariant, Category } = require('../models');
const { getProductsWithDiscount, getProductWithDiscount } = require('../utils/discount');

const router = express.Router();
const productIncludes = [
  { model: Category, as: 'category' },
  { model: ProductVariant, as: 'variants', separate: true, order: [['id', 'ASC']] },
];

router.get('/', async (req, res) => {
  try {
    const { search, categoryId, sort } = req.query;
    const where = {};

    if (search && String(search).trim()) {
      const query = `%${String(search).trim()}%`;
      where[Op.or] = [
        { name: { [Op.iLike]: query } },
        { description: { [Op.iLike]: query } },
      ];
    }
    if (categoryId) where.categoryId = String(categoryId);

    const order = sort === 'price_asc'
      ? [['price', 'ASC']]
      : sort === 'price_desc'
        ? [['price', 'DESC']]
        : [['name', 'ASC']];

    const products = await Product.findAll({ where, include: productIncludes, order });
    return res.json(await getProductsWithDiscount(products));
  } catch (error) {
    console.error('GET /api/products:', error);
    return res.status(500).json({ message: 'Не удалось получить товары' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const product = await Product.findByPk(String(req.params.id), { include: productIncludes });
    if (!product) return res.status(404).json({ message: 'Товар не найден' });
    return res.json(await getProductWithDiscount(product));
  } catch (error) {
    console.error(`GET /api/products/${req.params.id}:`, error);
    return res.status(500).json({ message: 'Не удалось получить товар' });
  }
});

module.exports = router;
