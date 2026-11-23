export default function Header({
  companyName,
  user,
  canManageOrders,
  onGoCatalog,
  onGoOrders,
  onGoLogin,
  onLogout,
}) {
  return (
    <header className="app-header">
      <div className="brand" onClick={onGoCatalog}>
        <img src="/logo.png" alt="Логотип компании" />
        <div>
          <div className="brand-title">{companyName}</div>
          <div className="brand-subtitle">Система оформления заказов</div>
        </div>
      </div>

      <div className="header-actions">
        {canManageOrders && (
          <button type="button" className="btn" onClick={onGoOrders}>
            Заказы
          </button>
        )}

        {user ? (
          <>
            <div className="user-badge">
              <div className="user-fio">{user.full_name}</div>
              <div className="user-role">{user.role_name}</div>
            </div>
            <button type="button" className="btn" onClick={onLogout}>
              Выйти
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-primary" onClick={onGoLogin}>
            Войти
          </button>
        )}
      </div>
    </header>
  );
}