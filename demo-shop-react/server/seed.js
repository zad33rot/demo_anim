require('dotenv').config();
const fs = require('fs');
const path = require('path');
const {
  sequelize,
  Category,
  User,
  Product,
  ProductVariant,
  Order,
} = require('./src/models');
const { normalizeRole } = require('./src/utils/roles');

const DATA_CANDIDATES = [
  process.env.MOCK_DATA_PATH && path.resolve(__dirname, process.env.MOCK_DATA_PATH),
  path.resolve(__dirname, '../mockData.json'),
  path.resolve(__dirname, '../src/data/mockData.json'),
  path.resolve(__dirname, '../src/mockData.json'),
  path.resolve(__dirname, '../public/mockData.json'),
  path.resolve(__dirname, '../data/mockData.json'),
].filter(Boolean);

function loadMockData() {
  const filePath = DATA_CANDIDATES.find((candidate) => fs.existsSync(candidate));
  if (!filePath) {
    throw new Error('Не найден mockData.json. Положите его рядом с папкой server или задайте MOCK_DATA_PATH в .env.');
  }
  const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  console.log(`Источник стартовых данных: ${filePath}`);

  // В приложенном mockData.json находятся оба учебных варианта.
  // По умолчанию загружается А (обувь); для Б задайте DATA_VARIANT=variantB.
  const variantKey = process.env.DATA_VARIANT || 'variantA';
  if (parsed[variantKey] && typeof parsed[variantKey] === 'object') {
    console.log(`Выбран набор данных: ${variantKey}`);
    return parsed[variantKey];
  }
  // Поддерживаем и JSON, в котором сразу лежат users/categories/products/orders.
  if (Array.isArray(parsed.products)) return parsed;
  throw new Error(`В mockData.json нет набора ${variantKey} и нет корневого массива products.`);
}

function requireNumber(value, label, { integer = false, min = 0 } = {}) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < min || (integer && !Number.isInteger(number))) {
    throw new Error(`Некорректное значение ${label}: ${value}`);
  }
  return number;
}

function normalizeOrderDate(value, label) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw new Error(`Некорректная дата заказа ${label}: ${value}`);
  return date;
}

async function seed() {
  const data = loadMockData();
  const rawCategories = Array.isArray(data.categories) ? data.categories : [];
  const rawUsers = Array.isArray(data.users) ? data.users : [];
  const rawProducts = Array.isArray(data.products) ? data.products : [];
  const rawOrders = Array.isArray(data.orders) ? data.orders : [];

  if (!rawCategories.length || !rawUsers.length || !rawProducts.length) {
    throw new Error('Для выбранного варианта нужны непустые массивы categories, users и products.');
  }

  const categories = rawCategories.map((category) => ({
    id: String(category.id),
    name: String(category.name).trim(),
  }));
  const categoryIds = new Set(categories.map((category) => category.id));

  const users = rawUsers.map((user) => ({
    id: String(user.id),
    login: String(user.login).trim(),
    fullName: String(user.full_name ?? user.fullName ?? user.name ?? user.login).trim(),
    role: normalizeRole(user.role_code ?? user.role ?? user.type),
  }));
  const userIds = new Set(users.map((user) => user.id));

  const variants = [];
  const products = rawProducts.map((item) => {
    const id = String(item.id);
    const categoryId = String(item.category_id ?? item.categoryId);
    if (!categoryIds.has(categoryId)) {
      throw new Error(`У товара ${item.name} указана неизвестная категория ${categoryId}`);
    }

    const productVariants = Array.isArray(item.variants) ? item.variants : [];
    const normalizedVariants = productVariants.map((variant) => {
      const normalized = {
        id: String(variant.id),
        productId: id,
        size: String(variant.size),
        stock: requireNumber(variant.quantity, `остаток варианта ${variant.id}`, { integer: true }),
      };
      variants.push(normalized);
      return normalized;
    });

    const stock = normalizedVariants.length
      ? normalizedVariants.reduce((sum, variant) => sum + variant.stock, 0)
      : requireNumber(item.stock ?? 0, `остаток товара ${id}`, { integer: true });
    const price = requireNumber(item.base_price ?? item.price, `цена товара ${id}`);

    return {
      id,
      name: String(item.name).trim(),
      description: item.description == null ? null : String(item.description),
      price,
      stock,
      image: item.image ? String(item.image) : null,
      manufacturerName: item.manufacturer_name == null ? null : String(item.manufacturer_name),
      composition: item.composition == null ? null : String(item.composition),
      categoryId,
      attributes: {
        categoryName: item.category_name ?? null,
        // Сюда попадут дополнительные поля, если они появятся в mockData.
        ...Object.fromEntries(Object.entries(item).filter(([key]) => ![
          'id', 'name', 'category_id', 'categoryId', 'category_name', 'manufacturer_name',
          'composition', 'description', 'base_price', 'price', 'image', 'variants', 'stock',
        ].includes(key))),
      },
    };
  });
  const productIds = new Set(products.map((product) => product.id));
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));

  // В mockData заказ — это шапка с массивом items. По модели задания каждый item
  // становится отдельной записью Order (один товар/размер в одной записи).
  const orders = [];
  for (const sourceOrder of rawOrders) {
    const userId = String(sourceOrder.user_id ?? sourceOrder.userId);
    if (!userIds.has(userId)) throw new Error(`У заказа ${sourceOrder.id} не найден пользователь ${userId}`);
    const items = Array.isArray(sourceOrder.items) ? sourceOrder.items : [];

    for (const item of items) {
      const productId = String(item.product_id ?? item.productId);
      const variantId = item.variant_id == null ? null : String(item.variant_id);
      const product = products.find((candidate) => candidate.id === productId);
      if (!productIds.has(productId)) throw new Error(`У позиции заказа ${item.id} не найден товар ${productId}`);
      if (variantId && (!variantById.has(variantId) || variantById.get(variantId).productId !== productId)) {
        throw new Error(`У позиции заказа ${item.id} не найден вариант ${variantId} товара ${productId}`);
      }
      const quantity = requireNumber(item.quantity, `количество в позиции ${item.id}`, { integer: true, min: 1 });
      const unitPrice = requireNumber(item.unit_price, `цена в позиции ${item.id}`);
      orders.push({
        quantity,
        totalPrice: Number((unitPrice * quantity).toFixed(2)),
        status: 'new',
        createdAt: normalizeOrderDate(sourceOrder.order_date ?? sourceOrder.createdAt, sourceOrder.id),
        sourceOrderId: String(sourceOrder.id),
        sourceItemId: item.id == null ? null : String(item.id),
        size: item.size == null ? (variantId ? variantById.get(variantId).size : null) : String(item.size),
        userId,
        productId,
        variantId,
      });
    }
  }

  // force:true очищает только учебные таблицы проекта; повторный seed не дублирует строки.
  await sequelize.sync({ force: true });
  await sequelize.transaction(async (transaction) => {
    await Category.bulkCreate(categories, { transaction });
    await User.bulkCreate(users, { transaction });
    await Product.bulkCreate(products, { transaction });
    if (variants.length) await ProductVariant.bulkCreate(variants, { transaction });
    if (orders.length) await Order.bulkCreate(orders, { transaction });
  });

  console.log(`Seed завершён для ${process.env.DATA_VARIANT || 'variantA'}:`);
  console.log(`Категорий: ${categories.length}; пользователей: ${users.length}; товаров: ${products.length}; вариантов: ${variants.length}; позиций заказов: ${orders.length}.`);
  console.log('Логины: client1 (id=1), client2 (id=2), manager1 (id=3), admin1 (id=4).');
}

seed()
  .catch((error) => {
    console.error('Ошибка seed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
