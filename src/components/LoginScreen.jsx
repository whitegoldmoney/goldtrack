import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Spinner } from './UI'

export default function LoginScreen({ onLogin }) {
  const [mode, setMode] = useState('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [info, setInfo] = useState('')

  async function handleSignIn() {
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

  async function handleSignUp() {
    if (!name.trim()) { setErr('Enter your full name.'); return }
    if (!email || !pass) { setErr('Enter email and password.'); return }
    if (pass !== confirm) { setErr('Passwords do not match.'); return }
    if (pass.length < 6) { setErr('Password must be at least 6 characters.'); return }
    setLoading(true); setErr('')
    try {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pass })
      if (error) throw error
      if (data.user) {
        await supabase.from('profiles').insert({ id: data.user.id, name: name.trim(), role: 'agent', email: email.trim() })
      }
      if (data.session) {
        onLogin(data.user)
      } else {
        setInfo('Account created! Check your email to confirm, then sign in.')
        switchMode('signin')
      }
    } catch (e) {
      setErr(e.message || 'Sign up failed.')
    } finally { setLoading(false) }
  }

  function switchMode(m) { setMode(m); setErr(''); setInfo('') }
  const submit = mode === 'signin' ? handleSignIn : handleSignUp

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">
          <div className="login-logo-mark">✦</div>
          <h1>GoldTrack</h1>
          <p>Walk-in Management System</p>
        </div>
        <div className="login-tabs">
          <button className={`login-tab${mode === 'signin' ? ' active' : ''}`} onClick={() => switchMode('signin')}>Sign In</button>
          <button className={`login-tab${mode === 'signup' ? ' active' : ''}`} onClick={() => switchMode('signup')}>Sign Up</button>
        </div>
        {err && <div className="alert alert-error" style={{ marginBottom: 14 }}>{err}</div>}
        {info && <div className="alert alert-success" style={{ marginBottom: 14 }}>{info}</div>}
        {mode === 'signup' && (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Full Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="Your full name" autoFocus />
          </div>
        )}
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label>Email Address</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="you@whitegold.money" autoFocus={mode === 'signin'} />
        </div>
        <div className="form-group" style={{ marginBottom: mode === 'signup' ? 12 : 20 }}>
          <label>Password</label>
          <input type="password" value={pass} onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="••••••••" />
        </div>
        {mode === 'signup' && (
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label>Confirm Password</label>
            <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && submit()}
              placeholder="••••••••" />
          </div>
        )}
        <button className="btn btn-dark" style={{ width: '100%', padding: 11 }}
          onClick={submit} disabled={loading}>
          {loading
            ? <><Spinner /> {mode === 'signin' ? 'Signing in…' : 'Creating account…'}</>
            : mode === 'signin' ? 'Sign In →' : 'Create Account →'}
        </button>
      </div>
    </div>
  )
}
