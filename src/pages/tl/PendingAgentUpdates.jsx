import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../lib/utils'
import { Loading, Empty } from '../../components/UI'

export default function PendingAgentUpdates({ agents, branches }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState({})

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('walk_ins')
      .select('*')
      .eq('status', 'assigned')
      .order('created_at', { ascending: true })
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const agentName = id => (agents.find(a => a.id === id) || {}).name || 'Unknown Agent'
  const branchName = id => (branches.find(b => b.id === id) || {}).name || '—'

  // Group by assigned_agent_id
  const grouped = rows.reduce((acc, row) => {
    const aid = row.assigned_agent_id
    if (!acc[aid]) acc[aid] = []
    acc[aid].push(row)
    return acc
  }, {})

  const agentIds = Object.keys(grouped).sort((a, b) =>
    grouped[b].length - grouped[a].length // most pending first
  )

  function toggle(id) {
    setExpanded(e => ({ ...e, [id]: !e[id] }))
  }

  if (loading) return <Loading />
  if (!agentIds.length) return (
    <Empty icon="✅" text="All agents are up to date. No pending walk-in updates." />
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          <strong>{agentIds.length}</strong> agent{agentIds.length !== 1 ? 's' : ''} with{' '}
          <strong>{rows.length}</strong> walk-in{rows.length !== 1 ? 's' : ''} pending source update
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {agentIds.map(aid => {
        const agentRows = grouped[aid]
        const isOpen = expanded[aid]
        const count = agentRows.length

        return (
          <div key={aid} className="pending-agent-card">
            {/* Agent header row */}
            <div className="pending-agent-header" onClick={() => toggle(aid)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="pending-agent-avatar">
                  {agentName(aid).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{agentName(aid)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {count} walk-in{count !== 1 ? 's' : ''} not yet updated
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span className="pending-count-badge">{count}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {isOpen ? '▲ Hide' : '▼ Show'}
                </span>
              </div>
            </div>

            {/* Walk-ins list */}
            {isOpen && (
              <div className="pending-agent-body">
                <div className="table-wrap" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Gold</th>
                        <th>Grams</th>
                        <th>Branch</th>
                        <th>Walk-in Date</th>
                        <th>Assigned On</th>
                        <th>Days Pending</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentRows.map(r => {
                        const assignedDate = r.approved_at ? new Date(r.approved_at) : new Date(r.created_at)
                        const daysPending = Math.floor((new Date() - assignedDate) / (1000 * 60 * 60 * 24))
                        return (
                          <tr key={r.id}>
                            <td className="td-name">{r.customer_name}</td>
                            <td className="td-phone">{r.phone}</td>
                            <td style={{ fontSize: 12 }}>{r.gold_type}</td>
                            <td className="td-grams">{r.grams}g</td>
                            <td style={{ fontSize: 12 }}>{branchName(r.branch_id)}</td>
                            <td style={{ fontSize: 12, color: 'var(--text2)' }}>{r.visit_date || '—'}</td>
                            <td style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(r.approved_at || r.created_at)}</td>
                            <td>
                              <span style={{
                                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                                background: daysPending >= 3 ? 'var(--red-bg)' : daysPending >= 1 ? '#FEF9E7' : 'var(--green-bg)',
                                color: daysPending >= 3 ? 'var(--red)' : daysPending >= 1 ? '#B7950B' : 'var(--green)',
                              }}>
                                {daysPending === 0 ? 'Today' : `${daysPending}d`}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
