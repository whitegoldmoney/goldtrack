import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import { useToast } from './lib/utils'
import LoginScreen from './components/LoginScreen'
import NudgeAlert from './components/NudgeAlert'
import { Toast } from './components/UI'
import AgentDashboard from './pages/agent/AgentDashboard'
import TLDashboard from './pages/tl/TLDashboard'
import AdminDashboard from './pages/admin/AdminDashboard'

export default function App() {
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [branches, setBranches] = useState([])
  const [agents, setAgents]   = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingLeads, setPendingLeads] = useState(0)
  const [toasts, addToast]    = useToast()
  const profileRef            = useRef(null)
  const [welcome, setWelcome] = useState(null)
  const [welcomeExit, setWelcomeExit] = useState(false)

  // ── Nudge state ──
  const [showNudge, setShowNudge]       = useState(false)
  const [nudgeMessage, setNudgeMessage] = useState('')
  const [nudgeId, setNudgeId]           = useState(null)

  async function handleLogin(u, fromScreen = false) {
    setLoading(true)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    if (!prof) { addToast('Profile not found. Contact admin.', 'error'); setLoading(false); return }
    profileRef.current = prof
    setProfile(prof)
    setUser(u)

    const [{ data: brs }, { data: ags }] = await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('profiles').select('id,name,assigned_tl').eq('role', 'agent').order('name'),
    ])
    setBranches(brs || [])
    setAgents(ags || [])

    if (prof.role === 'agent') {
      // Count assigned leads
      const { count } = await supabase.from('walk_ins')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', prof.id).eq('status', 'assigned')
      setPendingLeads(count || 0)

      // Check for any unread nudges waiting since last session
      const { data: unread } = await supabase
        .from('nudges')
        .select('*')
        .eq('agent_id', prof.id)
        .eq('is_read', false)
        .order('created_at', { ascending: false })
        .limit(1)
      if (unread && unread.length > 0) {
        setShowNudge(true)
        setNudgeMessage(unread[0].message)
        setNudgeId(unread[0].id)
      }
    }

    setLoading(false)
    setupRealtime(prof)
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
    if (fromScreen) {
      setWelcome({ name: prof.name })
      setWelcomeExit(false)
      setTimeout(() => setWelcomeExit(true), 3800)
      setTimeout(() => setWelcome(null), 4600)
    }
  }

  function notify(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body })
    addToast(`${title}: ${body}`, 'info')
  }

  function setupRealtime(prof) {
    // Walk-ins channel (TL new-submission alerts + agent lead/rejection alerts)
    supabase.channel('walkins-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'walk_ins' }, payload => {
        if (profileRef.current?.role === 'tl' || profileRef.current?.role === 'admin')
          notify('New Walk-in', `${payload.new.customer_name} submitted`)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'walk_ins' }, payload => {
        const p = profileRef.current; const r = payload.new
        if (!p) return
        if (p.role === 'agent') {
          if (r.assigned_agent_id === p.id && r.status === 'assigned') {
            notify('Lead Assigned!', `${r.customer_name} assigned to you`)
            setPendingLeads(c => c + 1)
          }
          if (r.submitted_by === p.id && r.status === 'rejected')
            notify('Walk-in Rejected', `${r.customer_name}: ${r.rejection_reason}`)
        }
      })
      .subscribe()

    // Nudge channel — agents only, filtered to this agent's id
    if (prof.role === 'agent') {
      supabase.channel('agent-nudges')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'nudges',
          filter: `agent_id=eq.${prof.id}`
        }, payload => {
          setShowNudge(true)
          setNudgeMessage(payload.new.message)
          setNudgeId(payload.new.id)
        })
        .subscribe()
    }
  }

  async function onDismissNudge() {
    if (nudgeId) {
      await supabase.from('nudges').update({ is_read: true }).eq('id', nudgeId)
    }
    setShowNudge(false)
    setNudgeId(null)
    setNudgeMessage('')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    sessionStorage.removeItem('goldtrack_active')
    setUser(null); setProfile(null); setBranches([]); setAgents([])
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      if (data.session) {
        const keep   = localStorage.getItem('goldtrack_keep')
        const active = sessionStorage.getItem('goldtrack_active')
        // If user opted out of "keep me signed in" and this is a fresh browser session, sign them out
        if (keep === '0' && !active) {
          await supabase.auth.signOut()
          setLoading(false)
          return
        }
        handleLogin(data.session.user, false)
      } else {
        setLoading(false)
      }
    })
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text3)', gap: 12 }}>
      <span className="spinner" style={{ borderTopColor: 'var(--gold)', width: 24, height: 24, borderWidth: 3 }} />
      Loading…
    </div>
  )

  if (!user || !profile) return <LoginScreen onLogin={u => handleLogin(u, true)} />

  return (
    <>
      {/* Nudge alarm overlay — agents only */}
      {profile?.role === 'agent' && showNudge && (
        <NudgeAlert message={nudgeMessage} onDismiss={onDismissNudge} />
      )}

      {/* Welcome animation */}
      {welcome && (
        <div className={`welcome-overlay${welcomeExit ? ' exiting' : ''}`}>
          <div className="welcome-hi">Hi, {welcome.name}</div>
          <div className="welcome-title">Welcome to White Gold<br />Tele-Sales Walk-in</div>
          <div className="welcome-divider" />
          <div className="welcome-tagline">Where Every Lead Becomes Gold</div>
        </div>
      )}

      <div className="app-shell">
        <div className="topbar">
          <div className="topbar-brand">
            <img src="/WG_Logo_Blue.png" alt="White Gold" className="topbar-logo" />
          </div>
          <div className="topbar-right">
            <span className="topbar-user">{profile.name}</span>
            <span className="topbar-role">
              {profile.role === 'admin' ? 'Admin' : profile.role === 'tl' ? 'Team Lead' : 'Agent'}
            </span>
            <button
              className="btn btn-outline btn-sm"
              style={{ color: 'var(--text3)', borderColor: 'rgba(255,255,255,.2)' }}
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="main-content">
          {(profile.role === 'tl' || profile.role === 'admin')
            ? <TLDashboard profile={profile} branches={branches} agents={agents} toast={addToast} />
            : <AgentDashboard profile={profile} branches={branches} toast={addToast} pendingCount={pendingLeads} />
          }
        </div>

        <Toast toasts={toasts} />
      </div>
    </>
  )
}
