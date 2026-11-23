const ICONS = {
  error: "⛔",
  warning: "⚠️",
  info: "ℹ️",
};

export default function NoticeBanner({ notice, onClose }) {
  if (!notice) {
    return null;
  }

  const icon = ICONS[notice.type] || ICONS.info;

  return (
    <div className={`notice notice-${notice.type}`}>
      <div className="notice-body">
        <span className="notice-icon">{icon}</span>
        <div>
          <strong>{notice.title}</strong>
          <div>{notice.message}</div>
        </div>
      </div>
      <button type="button" className="btn" onClick={onClose}>
        Закрыть
      </button>
    </div>
  );
}