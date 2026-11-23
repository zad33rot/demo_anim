export default function LoginPage({ users, loginInput, onLoginInputChange, onSubmit, onBack }) {
  return (
    <div className="panel login-box">
      <div className="page-bar">
        <h1>Вход в систему</h1>
        <button type="button" className="btn" onClick={onBack}>
          ← Назад
        </button>
      </div>

      <form onSubmit={onSubmit}>
        <label htmlFor="login-input">
          <strong>Логин пользователя:</strong>
        </label>
        <input
          id="login-input"
          className="input"
          value={loginInput}
          onChange={(event) => onLoginInputChange(event.target.value)}
          placeholder="Например: client1, manager1, admin1"
          autoComplete="username"
        />
        <button
          type="submit"
          className="btn btn-primary"
          style={{ width: "100%", marginTop: 12 }}
        >
          Войти
        </button>
      </form>

      <div className="field-hint" style={{ marginTop: 16 }}>
        Тестовые учётные записи:
      </div>
      <div className="hint-logins">
        {users.map((item) => (
          <span key={item.id} className="field-hint">
            <code>{item.login}</code> — {item.role_name}
          </span>
        ))}
      </div>
    </div>
  );
}