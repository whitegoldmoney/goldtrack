import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import PendingApprovals from './PendingApprovals'
import AllWalkIns from './AllWalkIns'
import PendingAgentUpdates from './PendingAgentUpdates'
import AgentHolds from './AgentHolds'
import ImportData from '../admin/ImportData'

export default function TLDashboard({ profile, branches, agents, toast }) {
  const [tab, setTab] = useState('pending')
  const [stats, setStats] = useState({
    pending: 0, today: 0, tele: 0, direct: 0, completed: 0, holds: 0
  })

  async function loadStats() {
    const today = new Date().toISOString().split('T')[0]
    const [p, tod, tele, dir, comp, holds] = await Promise.all([
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('visit_date', today),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('walk_in_type', 'tele_sales'),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('walk_in_type', 'direct'),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    ])
    setStats({
      pending:   p.count    || 0,
      today:     tod.count  || 0,
      tele:      tele.count || 0,
      direct:    dir.count  || 0,
      completed: comp.count || 0,
      holds:     holds.count || 0,
    })
  }

  useEffect(() => {
    loadStats()
    const channel = supabase.channel('tl-stats-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'walk_ins' }, loadStats)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'walk_ins' }, loadStats)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [])

  return (
    <div>
      {/* ── Stats strip (6 cards) ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)' }}>
        <div className="stat-card gold">
          <div className="stat-num" style={{ color: 'var(--gold)' }}>{stats.pending}</div>
          <div className="stat-label">⏳ Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{stats.today}</div>
          <div className="stat-label">📅 Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{stats.tele}</div>
          <div className="stat-label">📞 Tele Sales</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{stats.direct}</div>
          <div className="stat-label">⚡ Direct</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--green)' }}>{stats.completed}</div>
          <div className="stat-label">✅ Completed</div>
        </div>
        <div className="stat-card" style={{ borderColor: '#F5CBA7', background: 'linear-gradient(135deg,#FEF9F0,#FFF)' }}>
          <div className="stat-num" style={{ color: '#E67E22' }}>{stats.holds}</div>
          <div className="stat-label">🕐 On Hold</div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="tabs">
        <button className={`tab-btn ${tab === 'pending' ? 'active' : ''}`} onClick={() => setTab('pending')}>
          Pending Approvals {stats.pending > 0 && <span className="notif-count">{stats.pending}</span>}
        </button>
        <button className={`tab-btn ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          All Walk-ins
        </button>
        <button className={`tab-btn ${tab === 'holds' ? 'active' : ''}`} onClick={() => setTab('holds')}>
          🕐 Agent Holds {stats.holds > 0 && (
            <span className="notif-count" style={{ background: '#E67E22' }}>{stats.holds}</span>
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
      {tab === 'pending'         && <PendingApprovals profile={profile} branches={branches} agents={agents} toast={toast} onApproved={loadStats} />}
      {tab === 'all'             && <AllWalkIns branches={branches} agents={agents} profile={profile} toast={toast} />}
      {tab === 'holds'           && <AgentHolds agents={agents} branches={branches} toast={toast} profile={profile} />}
      {tab === 'pending-updates' && <PendingAgentUpdates agents={agents} branches={branches} />}
      {tab === 'import'          && <ImportData branches={branches} agents={agents} profile={profile} toast={toast} />}
    </div>
  )
}
