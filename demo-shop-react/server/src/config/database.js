const { Sequelize } = require('sequelize');

const required = ['DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_HOST'];
const missing = required.filter((key) => process.env[key] === undefined);
if (missing.length) {
  throw new Error(`Не заданы переменные окружения: ${missing.join(', ')}. Создайте .env по образцу .env.example`);
}

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    dialect: 'postgres',
    logging: process.env.SQL_LOG === 'true' ? console.log : false,
    define: {
      freezeTableName: true,
      underscored: false,
    },
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    },
  }
);

module.exports = sequelize;
