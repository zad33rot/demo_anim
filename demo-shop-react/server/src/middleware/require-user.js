const { User } = require('../models');
const { normalizeRole } = require('../utils/roles');

async function requireUser(req, res, next) {
  try {
    const userId = req.get('x-user-id');
    if (!userId) {
      return res.status(401).json({ message: 'Передайте заголовок x-user-id' });
    }

    const user = await User.findByPk(String(userId));
    if (!user) {
      return res.status(401).json({ message: 'Пользователь не найден' });
    }

    req.currentUser = user;
    req.currentRole = normalizeRole(user.role);
    return next();
  } catch (error) {
    console.error('Ошибка проверки пользователя:', error);
    return res.status(500).json({ message: 'Внутренняя ошибка сервера' });
  }
}

module.exports = requireUser;
