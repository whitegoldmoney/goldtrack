import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from './UI'

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')

  async function handleLogin() {
    if (!email || !pass) { setErr('Enter email and password.'); return }
    setLoading(true); setErr('')
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pass })
      if (error) throw error
      onLogin(data.user)
    } catch (e) {
      setErr(e.message || 'Login failed.')
    } finally { setLoading(false) }
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">
          <div className="login-logo-mark">✦</div>
          <h1>GoldTrack</h1>
          <p>Walk-in Management System</p>
        </div>
        {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>{err}</div>}
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="you@whitegold.money" autoFocus />
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label>Password</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            placeholder="••••••••" />
        </div>
        <button className="btn btn-dark" style={{ width: '100%', padding: 11 }}
          onClick={handleLogin} disabled={loading}>
          {loading ? <><Spinner /> Signing in…</> : 'Sign In →'}
        </button>
      </div>
    </div>
  )
}
