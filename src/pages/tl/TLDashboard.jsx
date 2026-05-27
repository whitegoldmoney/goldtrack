import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import PendingApprovals from './PendingApprovals'
import AllWalkIns from './AllWalkIns'
import PendingAgentUpdates from './PendingAgentUpdates'
import AgentHolds from './AgentHolds'
import ImportData from '../admin/ImportData'
import TeamManagement from '../admin/TeamManagement'
import AgentPerformanceDashboard from './AgentDashboard'
import AuditLog from '../admin/AuditLog'

export default function TLDashboard({ activePage, profile, branches, agents, toast, onBadgesUpdate }) {
  const [stats, setStats]         = useState({ pending: 0, today: 0, tele: 0, direct: 0, completed: 0, holds: 0 })
  const [tlProfiles, setTlProfiles] = useState([])

  // Team agent IDs — used only for PendingApprovals filtering
  const myTeamAgentIds = profile.role === 'admin'
    ? null
    : agents.filter(a => a.assigned_tl === profile.id).map(a => a.id)

  useEffect(() => {
    supabase.from('profiles').select('id, name').eq('role', 'tl')
      .then(({ data }) => setTlProfiles(data || []))
  }, [])

  async function loadStats() {
    const today = new Date().toISOString().split('T')[0]
    const [p, tod, tele, dir, comp, hold] = await Promise.all([
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('visit_date', today),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('walk_in_type', 'tele_sales'),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('walk_in_type', 'direct'),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('status', 'completed'),
      supabase.from('walk_ins').select('id', { count: 'exact', head: true }).eq('status', 'draft'),
    ])
    const next = {
      pending:   p.count    || 0,
      today:     tod.count  || 0,
      tele:      tele.count || 0,
      direct:    dir.count  || 0,
      completed: comp.count || 0,
      holds:     hold.count || 0,
    }
    setStats(next)
    onBadgesUpdate({ pending: next.pending, holds: next.holds })
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
      {/* ── Stats strip — always visible ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(6, 1fr)', marginBottom: 24 }}>
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

      {/* ── Page content ── */}
      {activePage === 'pending'         && <PendingApprovals profile={profile} branches={branches} agents={agents} toast={toast} onApproved={loadStats} teamAgentIds={myTeamAgentIds} />}
      {activePage === 'all'             && <AllWalkIns branches={branches} agents={agents} profile={profile} toast={toast} tls={tlProfiles} />}
      {activePage === 'holds'           && <AgentHolds agents={agents} branches={branches} toast={toast} profile={profile} tls={tlProfiles} />}
      {activePage === 'pending-updates' && <PendingAgentUpdates agents={agents} branches={branches} />}
      {activePage === 'dashboard'       && <AgentPerformanceDashboard profile={profile} />}
      {activePage === 'import'          && <ImportData branches={branches} agents={agents} profile={profile} toast={toast} />}
      {activePage === 'teams' && profile.role === 'admin' && <TeamManagement toast={toast} />}
      {activePage === 'audit' && profile.role === 'admin' && <AuditLog profile={profile} />}
    </div>
  )
}
