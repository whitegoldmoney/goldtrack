import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import { useToast } from './lib/utils'
import LoginScreen from './components/LoginScreen'
import { Toast, Spinner } from './components/UI'
import AgentDashboard from './pages/agent/AgentDashboard'
import TLDashboard from './pages/tl/TLDashboard'

export default function App() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [branches, setBranches] = useState([])
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingLeads, setPendingLeads] = useState(0)
  const [toasts, addToast] = useToast()
  const profileRef = useRef(null)

  async function handleLogin(u) {
    setLoading(true)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    if (!prof) { addToast('Profile not found. Contact admin.', 'error'); setLoading(false); return }
    profileRef.current = prof
    setProfile(prof)
    setUser(u)
    const [{ data: brs }, { data: ags }] = await Promise.all([
      supabase.from('branches').select('*').order('name'),
      supabase.from('profiles').select('id,name').eq('role', 'agent').order('name'),
    ])
    setBranches(brs || [])
    setAgents(ags || [])
    if (prof.role === 'agent') {
      const { count } = await supabase.from('walk_ins')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', prof.id).eq('status', 'assigned')
      setPendingLeads(count || 0)
    }
    setLoading(false)
    setupRealtime(prof)
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
  }

  function notify(title, body) {
    if ('Notification' in window && Notification.permission === 'granted') new Notification(title, { body })
    addToast(`${title}: ${body}`, 'info')
  }

  function setupRealtime(prof) {
    supabase.channel('walkins-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'walk_ins' }, payload => {
        if (profileRef.current?.role === 'tl') notify('New Walk-in', `${payload.new.customer_name} submitted`)
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
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    setUser(null); setProfile(null); setBranches([]); setAgents([])
  }

  // Check for existing session on load
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) handleLogin(data.session.user)
      else setLoading(false)
    })
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text3)', gap: 12 }}>
      <span className="spinner" style={{ borderTopColor: 'var(--gold)', width: 24, height: 24, borderWidth: 3 }} />
      Loading…
    </div>
  )

  if (!user || !profile) return <LoginScreen onLogin={handleLogin} />

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-brand"><span className="dot" />GoldTrack</div>
        <div className="topbar-right">
          <span className="topbar-user">{profile.name}</span>
          <span className="topbar-role">{profile.role === 'tl' ? 'Team Lead' : 'Agent'}</span>
          <button className="btn btn-outline btn-sm"
            style={{ color: 'var(--text3)', borderColor: 'rgba(255,255,255,.2)' }}
            onClick={handleLogout}>Sign out</button>
        </div>
      </div>
      <div className="main-content">
        {profile.role === 'tl'
          ? <TLDashboard profile={profile} branches={branches} agents={agents} toast={addToast} />
          : <AgentDashboard profile={profile} branches={branches} toast={addToast} pendingCount={pendingLeads} />
        }
      </div>
      <Toast toasts={toasts} />
    </div>
  )
}
