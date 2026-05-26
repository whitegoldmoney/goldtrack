import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../lib/utils'
import { Loading, Empty } from '../../components/UI'

export default function AgentHolds({ agents, branches, toast, profile, teamAgentIds }) {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(true)
  const [expanded, setExpanded] = useState({})
  const [cooldowns, setCooldowns] = useState({})   // { agentId: secondsRemaining }
  const timers = useRef({})                         // { agentId: intervalId }

  async function load() {
    setLoading(true)
    if (teamAgentIds !== null && teamAgentIds.length === 0) {
      setRows([]); setLoading(false); return
    }
    let q = supabase.from('walk_ins').select('*').eq('status', 'draft').order('created_at', { ascending: false })
    if (teamAgentIds !== null) q = q.in('submitted_by', teamAgentIds)
    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }

  useEffect(() => {
    load()
    return () => Object.values(timers.current).forEach(clearInterval)
  }, [])

  const agentName  = id => (agents.find(a => a.id === id) || {}).name || 'Unknown Agent'
  const branchName = id => (branches.find(b => b.id === id) || {}).name || '—'

  // Group by submitted_by, sort most holds first
  const grouped = rows.reduce((acc, row) => {
    const aid = row.submitted_by
    if (!acc[aid]) acc[aid] = []
    acc[aid].push(row)
    return acc
  }, {})
  const agentIds = Object.keys(grouped).sort((a, b) => grouped[b].length - grouped[a].length)

  function toggle(id) {
    setExpanded(e => ({ ...e, [id]: !e[id] }))
  }

  async function nudge(aid) {
    if (cooldowns[aid] > 0) return

    const { error } = await supabase.from('nudges').insert({
      agent_id: aid,
      sent_by: profile.id,
      message: 'Your TL wants you to follow up on your held walk-ins!'
    })
    if (error) { toast(error.message, 'error'); return }
    toast(`Nudge sent to ${agentName(aid)}! 📞`, 'success')

    // Start 30-second cooldown
    setCooldowns(c => ({ ...c, [aid]: 30 }))
    timers.current[aid] = setInterval(() => {
      setCooldowns(c => {
        const remaining = (c[aid] || 0) - 1
        if (remaining <= 0) {
          clearInterval(timers.current[aid])
          const { [aid]: _, ...rest } = c
          return rest
        }
        return { ...c, [aid]: remaining }
      })
    }, 1000)
  }

  if (loading) return <Loading />
  if (!agentIds.length) return (
    <Empty icon="🎉" text="No holds at the moment — all agents are up to date!" />
  )

  return (
    <div>
      {/* Summary line */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--text2)' }}>
          <strong>{agentIds.length}</strong> agent{agentIds.length !== 1 ? 's' : ''} with{' '}
          <strong>{rows.length}</strong> walk-in{rows.length !== 1 ? 's' : ''} on hold
        </div>
        <button className="btn btn-outline btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      {agentIds.map(aid => {
        const agentRows  = grouped[aid]
        const isOpen     = !!expanded[aid]
        const count      = agentRows.length
        const secsLeft   = cooldowns[aid] || 0
        const isCooling  = secsLeft > 0

        return (
          <div key={aid} style={{
            background: 'var(--white)', borderRadius: 'var(--radius)',
            border: '1px solid var(--border)', borderLeft: '3px solid #E67E22',
            marginBottom: 12, overflow: 'hidden', boxShadow: 'var(--shadow)'
          }}>

            {/* ── Agent header ── */}
            <div
              onClick={() => toggle(aid)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 20px', cursor: 'pointer', userSelect: 'none'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  background: 'linear-gradient(135deg,#F39C12,#F5CBA7)',
                  color: 'var(--dark)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontWeight: 700, fontSize: 15
                }}>
                  {agentName(aid).charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{agentName(aid)}</div>
                  <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                    {count} walk-in{count !== 1 ? 's' : ''} on hold
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{
                  background: '#FEF0D9', color: '#E67E22', border: '1px solid #F5CBA7',
                  borderRadius: 20, fontSize: 11, fontWeight: 700,
                  padding: '3px 12px', letterSpacing: '.03em'
                }}>
                  {count} ON HOLD
                </span>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>
                  {isOpen ? '▲ Hide' : '▼ Show'}
                </span>
              </div>
            </div>

            {/* ── Expanded walk-ins list ── */}
            {isOpen && (
              <div style={{ borderTop: '1px solid var(--border)', background: 'var(--surface)' }}>
                <div className="table-wrap" style={{ margin: 0, border: 'none', borderRadius: 0 }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Phone</th>
                        <th>Gold Type</th>
                        <th>Grams</th>
                        <th>Branch</th>
                        <th>Put on Hold</th>
                      </tr>
                    </thead>
                    <tbody>
                      {agentRows.map(r => (
                        <tr key={r.id}>
                          <td className="td-name">{r.customer_name}</td>
                          <td className="td-phone">{r.phone}</td>
                          <td style={{ fontSize: 12 }}>{r.gold_type}</td>
                          <td className="td-grams">{r.grams}g</td>
                          <td style={{ fontSize: 12 }}>{branchName(r.branch_id)}</td>
                          <td style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(r.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Nudge button */}
                <div style={{
                  padding: '12px 20px', display: 'flex',
                  justifyContent: 'flex-end', borderTop: '1px solid var(--border)'
                }}>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{
                      color: isCooling ? 'var(--text3)' : '#E67E22',
                      borderColor: isCooling ? 'var(--border)' : '#F5CBA7',
                      minWidth: 140
                    }}
                    onClick={e => { e.stopPropagation(); nudge(aid) }}
                    disabled={isCooling}
                  >
                    {isCooling ? `⏳ Wait ${secsLeft}s…` : '📞 Nudge Agent'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
