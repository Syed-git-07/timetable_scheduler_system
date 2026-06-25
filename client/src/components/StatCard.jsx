export default function StatCard({ label, value, icon: Icon, color = '#6366f1', colorRgb = '99,102,241' }) {
  return (
    <div className="stat-card" style={{ '--stat-color': color, '--stat-color-rgb': colorRgb }}>
      <div className="icon-wrap" style={{ color }}>
        <Icon size={20} />
      </div>
      <div className="label">{label}</div>
      <div className="value">{value ?? '—'}</div>
    </div>
  );
}
