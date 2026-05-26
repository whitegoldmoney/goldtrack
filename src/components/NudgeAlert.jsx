export default function NudgeAlert({ message, onDismiss }) {
  return (
    <div className="nudge-overlay">
      <div className="nudge-modal">
        <span className="nudge-clock">⏰</span>
        <div className="nudge-title">Heads Up!</div>
        <div className="nudge-message">{message}</div>
        <button className="btn btn-primary" style={{ width: '100%' }} onClick={onDismiss}>
          Got it! Dismiss
        </button>
      </div>
    </div>
  )
}
