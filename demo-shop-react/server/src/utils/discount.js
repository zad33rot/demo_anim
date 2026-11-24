const { Op } = require('sequelize');
const { Order } = require('../models');

const DISCOUNT_PERCENT = 25;

async function getProductsWithDiscount(products, now = new Date()) {
  if (!products.length) return [];

  const monthAgo = new Date(now);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const recentOrders = await Order.findAll({
    attributes: ['productId'],
    where: {
      productId: { [Op.in]: products.map((product) => String(product.id)) },
      status: { [Op.ne]: 'cancelled' },
      createdAt: { [Op.gte]: monthAgo },
    },
    group: ['productId'],
    raw: true,
  });
  const orderedProductIds = new Set(recentOrders.map((order) => String(order.productId)));

  return products.map((product) => {
    const data = product.toJSON ? product.toJSON() : { ...product };
    const discountPercent = orderedProductIds.has(String(data.id)) ? 0 : DISCOUNT_PERCENT;
    const price = Number(data.price);
    return {
      ...data,
      discountPercent,
      finalPrice: Number((price * (1 - discountPercent / 100)).toFixed(2)),
    };
  });
}

async function getProductWithDiscount(product) {
  if (!product) return null;
  const [result] = await getProductsWithDiscount([product]);
  return result;
}

module.exports = { getProductsWithDiscount, getProductWithDiscount };
