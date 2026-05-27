import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from './UI'

export default function LoginScreen({ onLogin }) {
  const [email, setEmail]   = useState('')
  const [pass, setPass]     = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr]       = useState('')
  // Default to checked; remember the last choice the user made
  const [keepSignedIn, setKeepSignedIn] = useState(
    () => localStorage.getItem('goldtrack_keep') !== '0'
  )

  async function handleLogin() {
    if (!email || !pass) { setErr('Enter email and password.'); return }
    setLoading(true); setErr('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass })
      if (error) throw error
      // Persist the preference and mark this as an active browser session
      localStorage.setItem('goldtrack_keep', keepSignedIn ? '1' : '0')
      localStorage.setItem('goldtrack_login_ts', Date.now().toString())
      if (!keepSignedIn) sessionStorage.setItem('goldtrack_active', '1')
      else sessionStorage.removeItem('goldtrack_active')
      onLogin(data.user)
    } catch (e) {
      setErr(e.message || 'Login failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">
          <img src="/WG_Logo_Blue.png" alt="White Gold" className="login-logo-img" />
          <p>Walk-in Management System</p>
        </div>
        {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>{err}</div>}
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="you@whitegold.money" autoFocus />
        </div>
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label>Password</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••" />
        </div>

        {/* ── Keep me signed in ── */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={keepSignedIn}
            onChange={e => setKeepSignedIn(e.target.checked)}
            style={{ width: 15, height: 15, accentColor: 'var(--gold)', cursor: 'pointer', flexShrink: 0 }}
          />
          <span style={{ fontSize: 13, color: 'var(--text2)' }}>Keep me signed in</span>
        </label>

        <button className="btn btn-dark" style={{ width: '100%', padding: 11 }}
          onClick={handleLogin} disabled={loading}>
          {loading ? <><Spinner /> Signing in…</> : 'Sign In →'}
        </button>
      </div>
    </div>
  )
}
