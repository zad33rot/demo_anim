const express = require('express');
const { Op, Transaction } = require('sequelize');
const requireUser = require('../middleware/require-user');
const {
  sequelize,
  Order,
  Product,
  ProductVariant,
  User,
} = require('../models');
const { normalizeRole } = require('../utils/roles');

const router = express.Router();
router.use(requireUser);

const orderIncludes = [
  { model: Product, as: 'product', include: [{ model: ProductVariant, as: 'variants' }] },
  { model: ProductVariant, as: 'variant' },
  { model: User, as: 'user', attributes: ['id', 'login', 'fullName', 'role'] },
];

function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

router.get('/', async (req, res) => {
  try {
    const where = ['admin', 'manager'].includes(req.currentRole)
      ? {}
      : { userId: req.currentUser.id };

    const orders = await Order.findAll({
      where,
      include: orderIncludes,
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
    });
    return res.json(orders);
  } catch (error) {
    console.error('GET /api/orders:', error);
    return res.status(500).json({ message: 'Не удалось получить заказы' });
  }
});

router.post('/', async (req, res) => {
  const quantity = Number(req.body?.quantity);
  const productId = req.body?.productId;
  const requestedVariantId = req.body?.variantId == null ? null : String(req.body.variantId);
  const requestedSize = req.body?.size == null ? null : String(req.body.size);

  if (!Number.isInteger(quantity) || quantity < 1) {
    return res.status(400).json({ message: 'quantity должно быть целым числом не меньше 1' });
  }
  if (productId === undefined || productId === null || String(productId).trim() === '') {
    return res.status(400).json({ message: 'Поле productId обязательно' });
  }

  try {
    const createdOrder = await sequelize.transaction(
      { isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED },
      async (transaction) => {
        const product = await Product.findByPk(String(productId), {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!product) throw httpError(400, 'Товар не найден');
        if (product.stock < quantity) {
          throw httpError(400, `Недостаточно товара на складе. Доступно всего: ${product.stock}`);
        }

        const variants = await ProductVariant.findAll({
          where: { productId: String(product.id) },
          transaction,
          lock: transaction.LOCK.UPDATE,
          order: [['id', 'ASC']],
        });

        let selectedVariant = null;
        if (variants.length) {
          if (requestedVariantId) {
            selectedVariant = variants.find((variant) => String(variant.id) === requestedVariantId);
          } else if (requestedSize) {
            selectedVariant = variants.find((variant) => variant.size === requestedSize);
          } else {
            // Для совместимости с форматом задания { productId, quantity }:
            // автоматически выбираем первый по id размер, где хватает остатка.
            selectedVariant = variants.find((variant) => variant.stock >= quantity);
          }

          if (!selectedVariant) {
            throw httpError(400, 'Не найден подходящий размер. Передайте корректный variantId или size.');
          }
          if (selectedVariant.stock < quantity) {
            throw httpError(400, `Недостаточно товара выбранного размера ${selectedVariant.size}. Доступно: ${selectedVariant.stock}`);
          }
        }

        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        const recentActiveOrder = await Order.findOne({
          where: {
            productId: String(product.id),
            status: { [Op.ne]: 'cancelled' },
            createdAt: { [Op.gte]: monthAgo },
          },
          transaction,
        });
        const discountPercent = recentActiveOrder ? 0 : 25;
        const finalPrice = Number((Number(product.price) * (1 - discountPercent / 100)).toFixed(2));
        const totalPrice = Number((finalPrice * quantity).toFixed(2));

        if (selectedVariant) {
          selectedVariant.stock -= quantity;
          await selectedVariant.save({ transaction });
        }
        product.stock -= quantity;
        await product.save({ transaction });

        return Order.create({
          userId: req.currentUser.id,
          productId: String(product.id),
          variantId: selectedVariant ? String(selectedVariant.id) : null,
          size: selectedVariant ? selectedVariant.size : requestedSize,
          quantity,
          totalPrice,
          status: 'new',
          createdAt: new Date(),
        }, { transaction });
      }
    );

    const order = await Order.findByPk(createdOrder.id, { include: orderIncludes });
    return res.status(201).json(order);
  } catch (error) {
    console.error('POST /api/orders:', error);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : 'Не удалось создать заказ',
    });
  }
});

router.patch('/:id', async (req, res) => {
  const nextStatus = String(req.body?.status || '').trim().toLowerCase();
  if (!['new', 'completed', 'cancelled'].includes(nextStatus)) {
    return res.status(400).json({ message: 'status должен быть new, completed или cancelled' });
  }

  try {
    const updatedOrder = await sequelize.transaction(async (transaction) => {
      const order = await Order.findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!order) throw httpError(404, 'Заказ не найден');

      if (req.currentRole === 'client' && String(order.userId) !== String(req.currentUser.id)) {
        throw httpError(403, 'Нельзя изменять чужой заказ');
      }
      if (order.status === 'cancelled') {
        throw httpError(400, 'Заказ уже отменён; повторное изменение не допускается');
      }

      if (nextStatus === 'cancelled') {
        const product = await Product.findByPk(order.productId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (!product) throw httpError(500, 'Товар заказа не найден');

        if (order.variantId) {
          const variant = await ProductVariant.findByPk(order.variantId, {
            transaction,
            lock: transaction.LOCK.UPDATE,
          });
          if (!variant) throw httpError(500, 'Вариант товара заказа не найден');
          variant.stock += order.quantity;
          await variant.save({ transaction });
        }
        product.stock += order.quantity;
        await product.save({ transaction });
      }

      order.status = nextStatus;
      await order.save({ transaction });
      return order;
    });

    const result = await Order.findByPk(updatedOrder.id, { include: orderIncludes });
    return res.json(result);
  } catch (error) {
    console.error(`PATCH /api/orders/${req.params.id}:`, error);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : 'Не удалось изменить заказ',
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    if (normalizeRole(req.currentUser.role) !== 'admin') {
      return res.status(403).json({ message: 'Удалять заказы может только администратор' });
    }

    await sequelize.transaction(async (transaction) => {
      const order = await Order.findByPk(req.params.id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!order) throw httpError(404, 'Заказ не найден');

      // При удалении активного заказа возвращаем зарезервированный товар на склад.
      if (order.status !== 'cancelled') {
        const product = await Product.findByPk(order.productId, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
        if (product) {
          if (order.variantId) {
            const variant = await ProductVariant.findByPk(order.variantId, {
              transaction,
              lock: transaction.LOCK.UPDATE,
            });
            if (variant) {
              variant.stock += order.quantity;
              await variant.save({ transaction });
            }
          }
          product.stock += order.quantity;
          await product.save({ transaction });
        }
      }
      await order.destroy({ transaction });
    });

    return res.json({ message: 'Заказ удалён' });
  } catch (error) {
    console.error(`DELETE /api/orders/${req.params.id}:`, error);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : 'Не удалось удалить заказ',
    });
  }
});

module.exports = router;
