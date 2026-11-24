const express = require('express');
const { User } = require('../models');
const { normalizeRole } = require('../utils/roles');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const login = String(req.body?.login || '').trim();
    if (!login) return res.status(400).json({ message: 'Поле login обязательно' });

    const user = await User.findOne({ where: { login } });
    if (!user) return res.status(404).json({ message: 'Пользователь не найден' });

    return res.json({
      id: user.id,
      login: user.login,
      fullName: user.fullName,
      role: normalizeRole(user.role),
    });
  } catch (error) {
    console.error('POST /api/auth/login:', error);
    return res.status(500).json({ message: 'Не удалось выполнить вход' });
  }
});

module.exports = router;
