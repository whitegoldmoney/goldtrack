import { useState, useEffect, useRef } from 'react'
import { supabase } from './lib/supabase'
import { useToast } from './lib/utils'
import LoginScreen from './components/LoginScreen'
import NudgeAlert from './components/NudgeAlert'
import { Toast } from './components/UI'
import AgentDashboard from './pages/agent/AgentDashboard'
import TLDashboard from './pages/tl/TLDashboard'

export default function App() {
  const [user, setUser]         = useState(null)
  const [profile, setProfile]   = useState(null)
  const [branches, setBranches] = useState([])
  const [agents, setAgents]     = useState([])
  const [loading, setLoading]   = useState(true)
  const [toasts, addToast]      = useToast()
  const profileRef              = useRef(null)
  const [welcome, setWelcome]   = useState(null)
  const [welcomeExit, setWelcomeExit] = useState(false)

  // ── Navigation ──
  const [activePage, setActivePage]   = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // ── Badge counts ──
  const [pendingLeads, setPendingLeads] = useState(0)
  const [draftCount, setDraftCount]     = useState(0)
  const [tlBadges, setTlBadges]         = useState({ pending: 0, holds: 0 })

  // ── Nudge state ──
  const [showNudge, setShowNudge]       = useState(false)
  const [nudgeMessage, setNudgeMessage] = useState('')
  const [nudgeId, setNudgeId]           = useState(null)

  async function loadDraftCount(profId) {
    const { count } = await supabase.from('walk_ins')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by', profId).eq('status', 'draft')
    setDraftCount(count || 0)
  }

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

    // Set default landing page per role
    setActivePage(prof.role === 'agent' ? 'new' : 'pending')

    if (prof.role === 'agent') {
      const { count } = await supabase.from('walk_ins')
        .select('id', { count: 'exact', head: true })
        .eq('assigned_agent_id', prof.id).eq('status', 'assigned')
      setPendingLeads(count || 0)

      loadDraftCount(prof.id)

      const { data: unread } = await supabase
        .from('nudges').select('*')
        .eq('agent_id', prof.id).eq('is_read', false)
        .order('created_at', { ascending: false }).limit(1)
      if (unread?.length > 0) {
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

    if (prof.role === 'agent') {
      supabase.channel('agent-nudges')
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'nudges',
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
    if (nudgeId) await supabase.from('nudges').update({ is_read: true }).eq('id', nudgeId)
    setShowNudge(false); setNudgeId(null); setNudgeMessage('')
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    sessionStorage.removeItem('goldtrack_active')
    localStorage.removeItem('goldtrack_login_ts')
    setUser(null); setProfile(null); setBranches([]); setAgents([])
    setActivePage('')
  }

  useEffect(() => {
    // onAuthStateChange handles expired-token refresh automatically (getSession does not).
    // INITIAL_SESSION fires once on load with the stored session (or null).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event !== 'INITIAL_SESSION') return

      if (!session) { setLoading(false); return }

      const keep = localStorage.getItem('goldtrack_keep')

      if (keep === '0') {
        // User chose not to stay signed in — check if this is a fresh browser open or
        // just a new tab / refresh in the same session.
        const active    = sessionStorage.getItem('goldtrack_active')
        const loginTs   = parseInt(localStorage.getItem('goldtrack_login_ts') || '0')
        const ageMs     = Date.now() - loginTs
        const withinSession = ageMs < 8 * 60 * 60 * 1000  // 8-hour grace window

        if (!active && !withinSession) {
          // Looks like a fresh browser open — clear session
          await supabase.auth.signOut()
          setLoading(false)
          return
        }

        // New tab opened in an active session — mark it so it doesn't sign out again
        if (!active) sessionStorage.setItem('goldtrack_active', '1')
      }

      handleLogin(session.user, false)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text3)', gap: 12 }}>
      <span className="spinner" style={{ borderTopColor: 'var(--gold)', width: 24, height: 24, borderWidth: 3 }} />
      Loading…
    </div>
  )

  if (!user || !profile) return <LoginScreen onLogin={u => handleLogin(u, true)} />

  // ── Build nav sections by role ──
  const agentNav = [
    {
      section: 'WALK-INS',
      items: [
        { key: 'new',         icon: '🏠', label: 'New Walk-in' },
        { key: 'drafts',      icon: '📋', label: 'My Drafts',      badge: draftCount },
        { key: 'submissions', icon: '📤', label: 'My Submissions' },
        { key: 'leads',       icon: '🎯', label: 'My Leads',       badge: pendingLeads },
        { key: 'history',     icon: '📊', label: 'My History' },
      ],
    },
  ]

  const tlNav = [
    {
      section: 'APPROVALS',
      items: [
        { key: 'pending', icon: '⏳', label: 'Pending',      badge: tlBadges.pending },
        { key: 'all',     icon: '📋', label: 'All Walk-ins' },
      ],
    },
    {
      section: 'TEAM',
      items: [
        { key: 'holds',           icon: '🕐', label: 'Agent Holds',     badge: tlBadges.holds },
        { key: 'pending-updates', icon: '⚠️',  label: 'Pending Updates' },
        { key: 'dashboard',       icon: '📊', label: 'Dashboard' },
        ...(profile.role === 'admin'
          ? [{ key: 'teams', icon: '👥', label: 'Team Management' }]
          : []),
      ],
    },
    {
      section: 'DATA',
      items: [
        { key: 'import', icon: '📥', label: 'Import Data' },
      ],
    },
    ...(profile.role === 'admin' ? [{
      section: 'LOGS',
      items: [
        { key: 'audit', icon: '📋', label: 'Audit Log' },
      ],
    }] : []),
  ]

  const navSections = profile.role === 'agent' ? agentNav : tlNav

  const navigate = key => { setActivePage(key); setSidebarOpen(false) }

  const roleLabel = profile.role === 'admin' ? 'Admin'
    : profile.role === 'tl' ? 'Team Lead' : 'Agent'

  return (
    <>
      {profile.role === 'agent' && showNudge && (
        <NudgeAlert message={nudgeMessage} onDismiss={onDismissNudge} />
      )}

      {welcome && (
        <div className={`welcome-overlay${welcomeExit ? ' exiting' : ''}`}>
          <div className="welcome-hi">Hi, {welcome.name}</div>
          <div className="welcome-title">Welcome to White Gold<br />Tele-Sales Walk-in</div>
          <div className="welcome-divider" />
          <div className="welcome-tagline">Where Every Lead Becomes Gold</div>
        </div>
      )}

      <div className="app-shell">
        {/* ── Topbar ── */}
        <div className="topbar">
          <div className="topbar-brand">
            <button className="hamburger" onClick={() => setSidebarOpen(s => !s)}>☰</button>
            <img src="/WG_Logo_Blue.png" alt="White Gold" className="topbar-logo" />
          </div>
          <div className="topbar-right">
            <span className="topbar-role">{roleLabel}</span>
            <button
              className="btn btn-outline btn-sm"
              style={{ color: 'var(--text3)', borderColor: 'rgba(255,255,255,.2)' }}
              onClick={handleLogout}
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="app-body">
          {/* ── Sidebar ── */}
          <aside className={`sidebar${sidebarOpen ? ' open' : ''}`}>
            <nav style={{ flex: 1, overflowY: 'auto' }}>
              {navSections.map(({ section, items }) => (
                <div key={section}>
                  <span className="sidebar-label">{section}</span>
                  <div className="sidebar-section">
                    {items.map(item => (
                      <button
                        key={item.key}
                        className={`nav-item${activePage === item.key ? ' active' : ''}`}
                        onClick={() => navigate(item.key)}
                      >
                        <span className="nav-icon">{item.icon}</span>
                        <span>{item.label}</span>
                        {item.badge > 0 && <span className="nav-badge">{item.badge}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </nav>

            {/* ── Sidebar user footer ── */}
            <div className="sidebar-user">
              <strong>{profile.name}</strong>
              {roleLabel}
            </div>
          </aside>

          {/* Mobile backdrop */}
          <div
            className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />

          {/* ── Content area ── */}
          <main className="content-area">
            {profile.role === 'agent'
              ? <AgentDashboard
                  activePage={activePage}
                  profile={profile}
                  branches={branches}
                  toast={addToast}
                  pendingCount={pendingLeads}
                  draftCount={draftCount}
                  onDraftCountChange={setDraftCount}
                  onDraftSaved={() => loadDraftCount(profile.id)}
                />
              : <TLDashboard
                  activePage={activePage}
                  profile={profile}
                  branches={branches}
                  agents={agents}
                  toast={addToast}
                  onBadgesUpdate={setTlBadges}
                />
            }
          </main>
        </div>

        <Toast toasts={toasts} />
      </div>
    </>
  )
}
