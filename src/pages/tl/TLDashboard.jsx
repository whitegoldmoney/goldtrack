import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import PendingApprovals from './PendingApprovals'
import AllWalkIns from './AllWalkIns'
import PendingAgentUpdates from './PendingAgentUpdates'
import AgentHolds from './AgentHolds'
import ImportData from '../admin/ImportData'

export default function TLDashboard({ profile, branches, agents, toast }) {
  const [tab, setTab]           = useState('pending')
  const [myStats, setMyStats]   = useState({ pending: 0, today: 0, tele: 0, direct: 0, completed: 0, holds: 0 })
  const [allStats, setAllStats] = useState({ pending: 0, today: 0, tele: 0, direct: 0, completed: 0, holds: 0 })
  const [tlProfiles, setTlProfiles] = useState([])

  const isAdmin        = profile.role === 'admin'
  const myTeamAgentIds = isAdmin ? null : agents.filter(a => a.assigned_tl === profile.id).map(a => a.id)

  // Load TL profiles once (for Team labels in AllWalkIns / AgentHolds)
  useEffect(() => {
    supabase.from('profiles').select('id, name').eq('role', 'tl')
      .then(({ data }) => setTlProfiles(data || []))
  }, [])

  async function loadStats() {
    const today = new Date().toISOString().split('T')[0]

    // ── All-teams totals (always) ──
    const [p, tod, tele, dir, comp, holds] = await Promise.all([
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('visit_date', today),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('walk_in_type', 'tele_sales'),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('walk_in_type', 'direct'),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    ])
    const all = {
      pending:   p.count    || 0,
      today:     tod.count  || 0,
      tele:      tele.count || 0,
      direct:    dir.count  || 0,
      completed: comp.count || 0,
      holds:     holds.count || 0,
    }
    setAllStats(all)

    // ── My-team stats (TL only) ──
    if (!isAdmin) {
      if (!myTeamAgentIds || myTeamAgentIds.length === 0) {
        setMyStats({ pending: 0, today: 0, tele: 0, direct: 0, completed: 0, holds: 0 })
      } else {
        const tf = q => q.in('submitted_by', myTeamAgentIds)
        const [mp, mtod, mtele, mdir, mcomp, mholds] = await Promise.all([
          tf(supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('status', 'pending')),
          tf(supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('visit_date', today)),
          tf(supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('walk_in_type', 'tele_sales')),
          tf(supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('walk_in_type', 'direct')),
          tf(supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('status', 'completed')),
          tf(supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('status', 'draft')),
        ])
        setMyStats({
          pending:   mp.count    || 0,
          today:     mtod.count  || 0,
          tele:      mtele.count || 0,
          direct:    mdir.count  || 0,
          completed: mcomp.count || 0,
          holds:     mholds.count || 0,
        })
      }
    } else {
      setMyStats(all) // admin: my stats = all stats (same numbers)
    }
  }

  useEffect(() => {
    loadStats()
    const channel = supabase.channel('tl-stats-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'walk_ins' }, loadStats)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'walk_ins' }, loadStats)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  // Cards show my-team stats; admin has no team so all == my
  const s = isAdmin ? allStats : myStats

  return (
    <div>
      {/* ── "My Team" label (TL only) ── */}
      {!isAdmin && (
        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>
          My Team
        </div>
      )}

      {/* ── Stats cards ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <div className="stat-card gold">
          <div className="stat-num" style={{ color: 'var(--gold)' }}>{s.pending}</div>
          <div className="stat-label">⏳ Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{s.today}</div>
          <div className="stat-label">📅 Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{s.tele}</div>
          <div className="stat-label">📞 Tele Sales</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{s.direct}</div>
          <div className="stat-label">⚡ Direct</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--green)' }}>{s.completed}</div>
          <div className="stat-label">✅ Completed</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#F5CBA7', background: 'linear-gradient(135deg,#FEF9F0,#FFF)' }}>
          <div className="stat-num" style={{ color: '#E67E22' }}>{s.holds}</div>
          <div className="stat-label">🕐 On Hold</div>
        </div>
      </div>

      {/* ── All-Teams strip (TL only) ── */}
      {!isAdmin && (
        <div style={{
          background: 'var(--surface)', borderRadius: 8, padding: '10px 20px',
          fontSize: 13, color: 'var(--text2)', border: '1px solid var(--border)',
          marginTop: 10, marginBottom: 4, display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center'
        }}>
          <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '.05em' }}>All Teams:</span>
          <span>⏳ Pending <strong>{allStats.pending}</strong></span>
          <span>📅 Today <strong>{allStats.today}</strong></span>
          <span>📞 Tele <strong>{allStats.tele}</strong></span>
          <span>⚡ Direct <strong>{allStats.direct}</strong></span>
          <span>✅ Done <strong>{allStats.completed}</strong></span>
          <span>🕐 Holds <strong>{allStats.holds}</strong></span>
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pending Approvals {myStats.pending > 0 && <span className="notif-count">{myStats.pending}</span>}
        </button>
        <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          All Walk-ins
        </button>
        <button className={`tab-btn ${tab === 'holds' ? 'active' : ''}`} onClick={() => setTab('holds')}>
          🕐 Agent Holds {allStats.holds > 0 && (
            <span className="notif-count" style={{ background: '#E67E22' }}>{allStats.holds}</span>
          )}
        </button>
        <button className={`tab-btn ${tab === 'pending-updates' ? 'active' : ''}`} onClick={() => setTab('pending-updates')}>
          ⚠ Agent Pending Updates
        </button>
        {(profile.role === 'admin' || profile.role === 'tl') && (
          <button className={`tab-btn ${tab === 'import' ? 'active' : ''}`} onClick={() => setTab('import')}>
            ⬆ Import Data
          </button>
        )}
      </div>

      {/* ── Tab content ── */}
      {/* PendingApprovals: filtered to own team only */}
      {tab === 'pending'         && <PendingApprovals profile={profile} branches={branches} agents={agents} toast={toast} onApproved={loadStats} teamAgentIds={myTeamAgentIds} />}
      {/* AllWalkIns + AgentHolds: all walk-ins, team labels via tlProfiles */}
      {tab === 'all'             && <AllWalkIns branches={branches} agents={agents} profile={profile} toast={toast} tls={tlProfiles} />}
      {tab === 'holds'           && <AgentHolds agents={agents} branches={branches} toast={toast} profile={profile} tls={tlProfiles} />}
      {tab === 'pending-updates' && <PendingAgentUpdates agents={agents} branches={branches} />}
      {tab === 'import'          && <ImportData branches={branches} agents={agents} profile={profile} toast={toast} />}
    </div>
  )
}
