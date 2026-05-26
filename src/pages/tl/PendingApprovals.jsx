import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../lib/utils'
import { Empty, Loading, Spinner } from '../../components/UI'

export default function PendingApprovals({ profile, branches, agents, toast, onApproved, teamAgentIds }) {
  const [rows, setRows]             = useState([])
  const [loading, setLoading]       = useState(true)
  const [processing, setProcessing] = useState({})
  const [decisions, setDecisions]   = useState({})
  const [rejectReasons, setRejectReasons] = useState({})
  const [showReject, setShowReject] = useState({})

  async function load() {
    setLoading(true)
    if (teamAgentIds !== null && teamAgentIds.length === 0) {
      setRows([]); setLoading(false); return
    }
    let q = supabase.from('walk_ins').select('*').eq('status', 'pending').order('created_at', { ascending: true })
    if (teamAgentIds !== null) q = q.in('submitted_by', teamAgentIds)
    const { data } = await q
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function setD(id, k, v) {
    setDecisions(d => ({ ...d, [id]: { ...(d[id] || {}), [k]: v } }))
  }

  async function approve(row) {
    const d = decisions[row.id] || {}
    if (!d.walk_in_type) { toast('Select type first.', 'error'); return }
    if (d.walk_in_type === 'tele_sales' && !d.assigned_agent_id) {
      toast('Assign an agent or select Old Lead.', 'error'); return
    }
    setProcessing(p => ({ ...p, [row.id]: true }))

    const isOldLead = d.walk_in_type === 'tele_sales' && d.assigned_agent_id === 'old_lead'
    const update = d.walk_in_type === 'direct'
      ? { walk_in_type: 'direct',     status: 'direct',    assigned_agent_id: null }
      : { walk_in_type: 'tele_sales', status: isOldLead ? 'old_lead' : 'assigned',
          assigned_agent_id: isOldLead ? null : d.assigned_agent_id }
    Object.assign(update, { approved_by: profile.id, approved_at: new Date().toISOString() })

    const { error } = await supabase.from('walk_ins').update(update).eq('id', row.id)
    if (error) toast(error.message, 'error')
    else {
      const label = d.walk_in_type === 'direct' ? 'Direct Walk-in'
                  : isOldLead                   ? 'Old Lead'
                  :                               'Tele Sales'
      toast(`Approved as ${label}!`, 'success'); load(); onApproved()
    }
    setProcessing(p => ({ ...p, [row.id]: false }))
  }

  async function reject(row) {
    const reason = rejectReasons[row.id] || ''
    if (!reason.trim()) { toast('Enter rejection reason.', 'error'); return }
    setProcessing(p => ({ ...p, [row.id]: true }))
    const { error } = await supabase.from('walk_ins')
      .update({ status: 'rejected', rejection_reason: reason.trim() }).eq('id', row.id)
    if (error) toast(error.message, 'error')
    else { toast('Walk-in rejected.', 'success'); load(); onApproved() }
    setProcessing(p => ({ ...p, [row.id]: false }))
  }

  const branchName = id => (branches.find(b => b.id === id) || {}).name || '—'
  const agentName  = id => (agents.find(a => a.id === id) || {}).name || 'Unknown'

  if (loading) return <Loading />
  if (!rows.length) {
    return teamAgentIds !== null && teamAgentIds.length === 0
      ? <Empty icon="👥" text="No agents assigned to your team yet." />
      : <Empty icon="✅" text="No pending walk-ins. All caught up!" />
  }

  return (
    <div>
      {/* Header count */}
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
        <strong>{rows.length}</strong> walk-in{rows.length !== 1 ? 's' : ''} awaiting approval
      </div>

      <div className="approvals-grid">
        {rows.map(r => {
          const d = decisions[r.id] || {}
          const busy = processing[r.id]

          return (
            <div key={r.id} className="sticky-card">

              {/* Customer info block */}
              <div className="sticky-card-name">{r.customer_name}</div>

              <div className="sticky-card-row">
                <span>📞</span>
                <span style={{ fontFamily: 'DM Mono' }}>{r.phone}</span>
              </div>

              {r.alternate_phone && (
                <div className="sticky-card-row">
                  <span>📱</span>
                  <span style={{ fontFamily: 'DM Mono' }}>{r.alternate_phone}</span>
                </div>
              )}

              <div className="sticky-card-row">
                <span>🏦</span>
                <span>{branchName(r.branch_id)}</span>
              </div>

              <div className="sticky-card-row">
                <span>⚖️</span>
                <span>{r.gold_type} · {r.grams}g</span>
              </div>

              <div className="sticky-card-row">
                <span>🕐</span>
                <span>Submitted: {fmt(r.created_at)}</span>
              </div>

              <div className="sticky-card-row">
                <span>👤</span>
                <span style={{
                  fontWeight: 500, color: 'var(--text)',
                  background: 'rgba(201,168,76,0.08)',
                  borderRadius: 4, padding: '2px 4px'
                }}>By: {agentName(r.submitted_by)}</span>
              </div>

              {/* Type selector */}
              <select
                style={{ width: '100%', marginTop: 12, padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border2)' }}
                value={d.walk_in_type || ''}
                onChange={e => setD(r.id, 'walk_in_type', e.target.value)}
              >
                <option value="">— Select Type —</option>
                <option value="tele_sales">📞 Tele Sales</option>
                <option value="direct">⚡ Direct Walk-in</option>
              </select>

              {/* Agent selector (Tele Sales only — not for Direct or Old Lead) */}
              {d.walk_in_type === 'tele_sales' && (
                <select
                  style={{ width: '100%', marginTop: 6, padding: '7px 10px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border2)' }}
                  value={d.assigned_agent_id || ''}
                  onChange={e => setD(r.id, 'assigned_agent_id', e.target.value)}
                >
                  <option value="">— Assign Agent —</option>
                  <option value="old_lead">📁 Old Lead</option>
                  {(teamAgentIds !== null ? agents.filter(a => teamAgentIds.includes(a.id)) : agents).map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}

              {/* Approve / Reject buttons */}
              <div className="sticky-card-actions">
                <button
                  className="btn btn-success"
                  onClick={() => approve(r)}
                  disabled={busy}
                >
                  {busy ? <Spinner /> : '✓ Approve'}
                </button>
                <button
                  className="btn btn-danger"
                  onClick={() => setShowReject(s => ({ ...s, [r.id]: !s[r.id] }))}
                  disabled={busy}
                >
                  ✗ Reject
                </button>
              </div>

              {/* Inline reject reason */}
              {showReject[r.id] && (
                <div style={{ marginTop: 10 }}>
                  <textarea
                    rows={2}
                    placeholder="Reason…"
                    value={rejectReasons[r.id] || ''}
                    onChange={e => setRejectReasons(rr => ({ ...rr, [r.id]: e.target.value }))}
                    style={{ width: '100%', fontSize: 12, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--border2)', resize: 'none', minHeight: 'unset', fontFamily: 'inherit' }}
                  />
                  <button
                    className="btn btn-danger btn-sm"
                    style={{ width: '100%', marginTop: 6 }}
                    onClick={() => reject(r)}
                    disabled={busy}
                  >
                    {busy ? <Spinner /> : 'Confirm Reject'}
                  </button>
                </div>
              )}

            </div>
          )
        })}
      </div>
    </div>
  )
}
