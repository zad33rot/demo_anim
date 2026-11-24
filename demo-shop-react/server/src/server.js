require('dotenv').config();
const app = require('./app');
const { sequelize } = require('./models');

const PORT = Number(process.env.PORT || 5000);

async function start() {
  try {
    await sequelize.authenticate();
    console.log('Подключение к PostgreSQL установлено');
    await sequelize.sync();
    app.listen(PORT, () => console.log(`REST API запущен: http://localhost:${PORT}`));
  } catch (error) {
    console.error('Не удалось запустить сервер:', error);
    process.exit(1);
  }
}

start();
