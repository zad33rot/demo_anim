function normalizeRole(role) {
  const value = String(role || '').trim().toLowerCase();
  if (['admin', 'админ', 'администратор', 'administrator'].includes(value)) return 'admin';
  if (['manager', 'менеджер', 'модератор'].includes(value)) return 'manager';
  if (['client', 'клиент', 'user', 'customer', 'покупатель', 'пользователь'].includes(value)) return 'client';
  return 'client';
}

module.exports = { normalizeRole };
