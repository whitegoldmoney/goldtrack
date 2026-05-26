import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../lib/utils'
import { Empty, Loading, Spinner } from '../../components/UI'

export default function PendingApprovals({ profile, branches, agents, toast, onApproved }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState({})
  const [decisions, setDecisions] = useState({})
  const [rejectReasons, setRejectReasons] = useState({})
  const [showReject, setShowReject] = useState({})

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('walk_ins').select('*').eq('status', 'pending')
      .order('created_at', { ascending: true })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  function setD(id, k, v) { setDecisions(d => ({ ...d, [id]: { ...(d[id] || {}), [k]: v } })) }

  async function approve(row) {
    const d = decisions[row.id] || {}
    if (!d.walk_in_type) { toast('Select type: Tele Sales or Direct.', 'error'); return }
    if (d.walk_in_type === 'tele_sales' && !d.assigned_agent_id) { toast('Assign an agent for Tele Sales.', 'error'); return }
    setProcessing(p => ({ ...p, [row.id]: true }))
    const { error } = await supabase.from('walk_ins').update({
      status: d.walk_in_type === 'tele_sales' ? 'assigned' : 'direct',
      walk_in_type: d.walk_in_type,
      assigned_agent_id: d.assigned_agent_id || null,
      approved_by: profile.id,
      approved_at: new Date().toISOString()
    }).eq('id', row.id)
    if (error) toast(error.message, 'error')
    else { toast(`Approved as ${d.walk_in_type === 'tele_sales' ? 'Tele Sales' : 'Direct Walk-in'}!`, 'success'); load(); onApproved() }
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

  if (loading) return <Loading />
  if (!rows.length) return <Empty icon="✅" text="No pending walk-ins. All caught up!" />

  return (
    <div>
      <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text2)' }}>
        <strong>{rows.length}</strong> walk-in{rows.length !== 1 ? 's' : ''} awaiting your approval
      </div>
      {rows.map(r => {
        const d = decisions[r.id] || {}
        return (
          <div key={r.id} className="approval-card">
            <div className="approval-card-info">
              <div className="approval-card-field"><label>Customer</label><p>{r.customer_name}</p></div>
              <div className="approval-card-field"><label>Phone</label><p style={{ fontFamily: 'DM Mono', fontSize: 13 }}>{r.phone}</p></div>
              {r.alternate_phone && (
                <div className="approval-card-field"><label>Alt Phone</label><p style={{ fontFamily: 'DM Mono', fontSize: 13 }}>{r.alternate_phone}</p></div>
              )}
              <div className="approval-card-field"><label>Gold / Grams</label><p>{r.gold_type} · {r.grams}g</p></div>
              <div className="approval-card-field"><label>Branch</label><p>{branchName(r.branch_id)}</p></div>
            </div>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>Submitted: {fmt(r.created_at)}</div>
            <div className="approval-actions">
              <select style={{ padding: '7px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border2)', minWidth: 150 }}
                value={d.walk_in_type || ''} onChange={e => setD(r.id, 'walk_in_type', e.target.value)}>
                <option value="">— Select Type —</option>
                <option value="tele_sales">Tele Sales</option>
                <option value="direct">Direct Walk-in</option>
              </select>
              {d.walk_in_type === 'tele_sales' && (
                <select style={{ padding: '7px 12px', fontSize: 13, borderRadius: 6, border: '1px solid var(--border2)', minWidth: 160 }}
                  value={d.assigned_agent_id || ''} onChange={e => setD(r.id, 'assigned_agent_id', e.target.value)}>
                  <option value="">— Assign Agent —</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              )}
              <button className="btn btn-success btn-sm" onClick={() => approve(r)} disabled={processing[r.id]}>
                {processing[r.id] ? <Spinner /> : '✓ Approve'}
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => setShowReject(s => ({ ...s, [r.id]: !s[r.id] }))}>
                ✗ Reject
              </button>
            </div>
            {showReject[r.id] && (
              <div className="inline-reject" style={{ marginTop: 10 }}>
                <input placeholder="Reason for rejection…" value={rejectReasons[r.id] || ''}
                  onChange={e => setRejectReasons(rr => ({ ...rr, [r.id]: e.target.value }))} />
                <button className="btn btn-danger btn-sm" onClick={() => reject(r)} disabled={processing[r.id]}>
                  Confirm Reject
                </button>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
