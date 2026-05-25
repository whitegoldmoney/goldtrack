import { useState, useCallback } from 'react'

export function fmt(dt) {
  if (!dt) return '—'
  const d = new Date(dt)
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) + ' ' +
    d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
}

export function parseWhatsApp(raw) {
  const parts = raw.split(',').map(s => s.trim())
  if (parts.length < 4) return null
  const name = parts[0]
  const phone = parts[1].replace(/\D/g, '').slice(-10)
  const goldRaw = parts[2].toLowerCase()
  const gold_type = goldRaw.includes('release') ? 'Release' : 'Physical'
  const grams = parseFloat(parts[3].replace(/[^\d.]/g, '')) || ''
  if (!name || phone.length < 6) return null
  return { customer_name: name, phone, gold_type, grams }
}

export function useToast() {
  const [toasts, setToasts] = useState([])
  const add = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, msg, type }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }, [])
  return [toasts, add]
}
