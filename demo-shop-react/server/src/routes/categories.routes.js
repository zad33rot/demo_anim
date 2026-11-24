const express = require('express');
const { Category } = require('../models');

const router = express.Router();

router.get('/', async (_req, res) => {
  try {
    const categories = await Category.findAll({ order: [['name', 'ASC']] });
    return res.json(categories);
  } catch (error) {
    console.error('GET /api/categories:', error);
    return res.status(500).json({ message: 'Не удалось получить категории' });
  }
});

module.exports = router;
