export function StatusBadge({ status }) {
  const map = {
    pending: ['badge-pending', '⏳ Pending'],
    assigned: ['badge-assigned', '📋 Assigned'],
    direct: ['badge-direct', '⚡ Direct'],
    completed: ['badge-completed', '✅ Completed'],
    rejected: ['badge-rejected', '✗ Rejected'],
  }
  const [cls, label] = map[status] || ['badge-pending', status]
  return <span className={`badge ${cls}`}>{label}</span>
}

export function Toast({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
      ))}
    </div>
  )
}

export function Spinner({ dark }) {
  return <span className="spinner" style={dark ? { borderTopColor: 'var(--dark)' } : {}} />
}

export function Empty({ icon, text }) {
  return (
    <div className="empty">
      <div className="empty-icon">{icon}</div>
      <p>{text}</p>
    </div>
  )
}

export function Loading({ text = 'Loading…' }) {
  return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text3)' }}>{text}</div>
  )
}
