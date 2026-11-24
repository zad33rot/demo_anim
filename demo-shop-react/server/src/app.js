const express = require('express');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const categoriesRoutes = require('./routes/categories.routes');
const productsRoutes = require('./routes/products.routes');
const ordersRoutes = require('./routes/orders.routes');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.use('/api/auth', authRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/products', productsRoutes);
app.use('/api/orders', ordersRoutes);

app.use((req, res) => res.status(404).json({ message: `Маршрут ${req.method} ${req.originalUrl} не найден` }));

app.use((error, _req, res, _next) => {
  console.error('Необработанная ошибка:', error);
  return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
});

module.exports = app;
