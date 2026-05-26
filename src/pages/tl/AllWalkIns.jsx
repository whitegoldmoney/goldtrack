import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../lib/utils'
import { StatusBadge, Loading, Spinner } from '../../components/UI'

const srcLabel = { today: 'Today', this_month: 'This Month', previous_month: 'Prev Month' }
const displaySource = s => srcLabel[s] || s || '—'

export default function AllWalkIns({ branches, agents, profile, toast }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter]   = useState({ status: '', type: '', date: '', search: '' })
  const [editing, setEditing] = useState(null)
  const [saving, setSaving]   = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [expanded, setExpanded] = useState(new Set())

  const isAdmin = profile?.role === 'admin'

  async function load() {
    setLoading(true)
    let q = supabase.from('walk_ins').select('*').order('created_at', { ascending: false }).limit(500)
    if (filter.status) q = q.eq('status', filter.status)
    if (filter.type)   q = q.eq('walk_in_type', filter.type)
    if (filter.date)   q = q.eq('visit_date', filter.date)
    const { data } = await q
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [filter.status, filter.type, filter.date])

  const branchName = id => (branches.find(b => b.id === id) || {}).name || '—'
  const agentName  = id => (agents.find(a => a.id === id) || {}).name  || '—'

  const filtered = rows.filter(r => {
    if (!filter.search) return true
    const s = filter.search.toLowerCase()
    return r.customer_name?.toLowerCase().includes(s) || r.phone?.includes(s)
  })

  function toggleExpand(id) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function setE(k, v) { setEditing(e => ({ ...e, [k]: v })) }

  async function handleSave() {
    const { id, customer_name, phone, gold_type, grams, branch_id, visit_date,
      status, walk_in_type, assigned_agent_id, rejection_reason,
      remarks, grams_sold, bm_remarks } = editing
    if (!customer_name || !phone || !grams || !branch_id) {
      toast('Fill all required fields.', 'error'); return
    }
    setSaving(true)
    const { error } = await supabase.from('walk_ins').update({
      customer_name: customer_name.trim(), phone: phone.trim(),
      gold_type, grams: parseFloat(grams), branch_id: parseInt(branch_id),
      visit_date, status, walk_in_type: walk_in_type || null,
      assigned_agent_id: assigned_agent_id || null,
      rejection_reason: rejection_reason || null,
      remarks: remarks || null,
      grams_sold: grams_sold ? parseFloat(grams_sold) : null,
      bm_remarks: bm_remarks || null,
    }).eq('id', id)
    if (error) toast(error.message, 'error')
    else { toast('Entry updated!', 'success'); setEditing(null); load() }
    setSaving(false)
  }

  async function handleDelete(row) {
    if (!window.confirm(`Delete entry for "${row.customer_name}"? This cannot be undone.`)) return
    setDeleting(row.id)
    const { error } = await supabase.from('walk_ins').delete().eq('id', row.id)
    if (error) toast(error.message, 'error')
    else { toast('Entry deleted.', 'success'); load() }
    setDeleting(null)
  }

  const colSpan = isAdmin ? 10 : 9

  return (
    <div>
      {/* Filter bar */}
      <div className="filter-bar">
        <input placeholder="Search name / phone…" value={filter.search}
          onChange={e => setFilter(f => ({ ...f, search: e.target.value }))} />
        <select value={filter.status} onChange={e => setFilter(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="assigned">Assigned</option>
          <option value="direct">Direct</option>
          <option value="completed">Completed</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={filter.type} onChange={e => setFilter(f => ({ ...f, type: e.target.value }))}>
          <option value="">All Types</option>
          <option value="tele_sales">Tele Sales</option>
          <option value="direct">Direct</option>
        </select>
        <input type="date" value={filter.date} onChange={e => setFilter(f => ({ ...f, date: e.target.value }))} />
        <button className="btn btn-outline btn-sm" onClick={load}>↻ Refresh</button>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8 }}>
        Click any row to expand details (Gold, Grams Sold, BM Remarks, Submitted)
      </div>

      {loading ? <Loading /> : (
        <div className="table-wrap" style={{ overflowX: 'hidden' }}>
          <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
            <colgroup>
              <col style={{ width: '2.5%' }} />  {/* expand */}
              <col style={{ width: '14%' }} />   {/* customer/phone */}
              <col style={{ width: '10%' }} />   {/* branch */}
              <col style={{ width: '12%' }} />   {/* type/agent */}
              <col style={{ width: '10%' }} />   {/* source */}
              <col style={{ width: '7%' }} />    {/* w-status */}
              <col style={{ width: '10%' }} />   {/* remarks */}
              <col style={{ width: '11%' }} />   {/* status */}
              <col style={{ width: '9%' }} />    {/* w-in date */}
              {isAdmin && <col style={{ width: '7%' }} />} {/* actions */}
            </colgroup>
            <thead>
              <tr>
                <th></th>
                <th>Customer / Phone</th>
                <th>Branch</th>
                <th>Type / Agent</th>
                <th>Source</th>
                <th>W-Status</th>
                <th>Remarks</th>
                <th>Status</th>
                <th>W-In Date</th>
                {isAdmin && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const isExp = expanded.has(r.id)
                return (
                  <>
                    <tr key={r.id}
                      onClick={() => toggleExpand(r.id)}
                      style={{ cursor: 'pointer' }}>
                      {/* Expand toggle */}
                      <td style={{ textAlign: 'center', color: 'var(--text3)', fontSize: 10, userSelect: 'none' }}>
                        {isExp ? '▲' : '▼'}
                      </td>
                      {/* Customer + Phone stacked */}
                      <td style={{ overflow: 'hidden' }}>
                        <div style={{ fontWeight: 600, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={r.customer_name}>{r.customer_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'DM Mono' }}>{r.phone}</div>
                      </td>
                      {/* Branch */}
                      <td style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={branchName(r.branch_id)}>{branchName(r.branch_id)}</td>
                      {/* Type + Agent stacked */}
                      <td style={{ overflow: 'hidden' }}>
                        <div style={{ fontSize: 11 }}>
                          {r.walk_in_type === 'tele_sales' ? '📞 Tele' : r.walk_in_type === 'direct' ? '⚡ Direct' : '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={r.assigned_agent_id ? agentName(r.assigned_agent_id) : ''}>
                          {r.assigned_agent_id ? agentName(r.assigned_agent_id) : ''}
                        </div>
                      </td>
                      {/* Lead Source */}
                      <td style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={displaySource(r.lead_source)}>{displaySource(r.lead_source)}</td>
                      {/* Walk-in Status */}
                      <td>
                        {r.walkin_status
                          ? <span style={{ fontWeight: 700, color: 'var(--blue)', fontSize: 12 }}>{r.walkin_status}</span>
                          : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      {/* Remarks */}
                      <td style={{ fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={r.remarks || ''}>{r.remarks || '—'}</td>
                      {/* Status badge */}
                      <td><StatusBadge status={r.status} /></td>
                      {/* Walk-in Date */}
                      <td style={{ fontSize: 11, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                        {r.visit_date || '—'}
                      </td>
                      {/* Admin actions */}
                      {isAdmin && (
                        <td onClick={e => e.stopPropagation()}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button className="btn btn-outline btn-sm"
                              style={{ padding: '4px 8px' }}
                              onClick={() => setEditing({ ...r })}>✏</button>
                            <button className="btn btn-danger btn-sm"
                              style={{ padding: '4px 8px' }}
                              onClick={() => handleDelete(r)}
                              disabled={deleting === r.id}>
                              {deleting === r.id ? <Spinner /> : '🗑'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>

                    {/* Expanded detail row */}
                    {isExp && (
                      <tr key={`${r.id}-detail`} style={{ background: 'var(--surface)' }}>
                        <td colSpan={colSpan} style={{ padding: '10px 20px 12px 40px', borderTop: '1px dashed var(--border)' }}>
                          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', fontSize: 12 }}>
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Gold / Grams</div>
                              <div style={{ fontWeight: 500 }}>{r.gold_type} · {r.grams}g</div>
                            </div>
                            {r.grams_sold != null && (
                              <div>
                                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Grams Sold</div>
                                <div style={{ fontWeight: 600, color: 'var(--green)' }}>{r.grams_sold}g</div>
                              </div>
                            )}
                            <div>
                              <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Submitted</div>
                              <div>{fmt(r.created_at)}</div>
                            </div>
                            {r.rejection_reason && (
                              <div>
                                <div style={{ fontSize: 10, color: 'var(--red)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>Rejection Reason</div>
                                <div style={{ color: 'var(--red)' }}>{r.rejection_reason}</div>
                              </div>
                            )}
                            {r.bm_remarks && (
                              <div style={{ flex: 1, minWidth: 200 }}>
                                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 2 }}>BM Remarks</div>
                                <div style={{ color: 'var(--text2)' }}>{r.bm_remarks}</div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
              {!filtered.length && (
                <tr>
                  <td colSpan={colSpan} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
                    No records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit Modal (admin only) ── */}
      {editing && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setEditing(null)}>
          <div className="modal-box">
            <div className="modal-header">
              <div>
                <div style={{ fontWeight: 600, fontSize: 15 }}>Edit Walk-in Entry</div>
                <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{editing.customer_name}</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>✕ Close</button>
            </div>
            <div className="modal-body">
              <div className="form-grid">
                <div className="form-group">
                  <label>Customer Name *</label>
                  <input value={editing.customer_name || ''} onChange={e => setE('customer_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Phone *</label>
                  <input value={editing.phone || ''} onChange={e => setE('phone', e.target.value)} maxLength={10} />
                </div>
                <div className="form-group">
                  <label>Gold Type *</label>
                  <select value={editing.gold_type || 'Physical'} onChange={e => setE('gold_type', e.target.value)}>
                    <option value="Physical">Physical</option>
                    <option value="Release">Release</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Grams *</label>
                  <input type="number" step="0.1" value={editing.grams || ''} onChange={e => setE('grams', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Branch *</label>
                  <select value={editing.branch_id || ''} onChange={e => setE('branch_id', e.target.value)}>
                    <option value="">— Select Branch —</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label>Walk-in Date</label>
                  <input type="date" value={editing.visit_date || ''} onChange={e => setE('visit_date', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Status</label>
                  <select value={editing.status || 'pending'} onChange={e => setE('status', e.target.value)}>
                    <option value="pending">Pending</option>
                    <option value="assigned">Assigned</option>
                    <option value="direct">Direct</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Walk-in Type</label>
                  <select value={editing.walk_in_type || ''} onChange={e => setE('walk_in_type', e.target.value)}>
                    <option value="">— Not Set —</option>
                    <option value="tele_sales">Tele Sales</option>
                    <option value="direct">Direct Walk-in</option>
                  </select>
                </div>
                {editing.walk_in_type === 'tele_sales' && (
                  <div className="form-group">
                    <label>Assigned Agent</label>
                    <select value={editing.assigned_agent_id || ''} onChange={e => setE('assigned_agent_id', e.target.value)}>
                      <option value="">— Not Assigned —</option>
                      {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                    </select>
                  </div>
                )}
                <div className="form-group">
                  <label>Remarks</label>
                  <select value={editing.remarks || ''} onChange={e => setE('remarks', e.target.value)}>
                    <option value="">— None —</option>
                    {['Taken Quotation','Price Enquiry','Price Issue','Verification Failed','Sold','KYC Failed','Release Loss'].map(o => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </div>
                {editing.remarks === 'Sold' && (
                  <div className="form-group">
                    <label>Grams Sold</label>
                    <input type="number" step="0.1" min="0"
                      value={editing.grams_sold || ''}
                      onChange={e => setE('grams_sold', e.target.value)}
                      placeholder="e.g. 10.5" />
                  </div>
                )}
                {editing.status === 'rejected' && (
                  <div className="form-group full">
                    <label>Rejection Reason</label>
                    <input value={editing.rejection_reason || ''} onChange={e => setE('rejection_reason', e.target.value)} placeholder="Reason for rejection…" />
                  </div>
                )}
                <div className="form-group full">
                  <label>Branch Manager Remarks</label>
                  <textarea value={editing.bm_remarks || ''} onChange={e => setE('bm_remarks', e.target.value)}
                    placeholder="e.g. Customer not interested…" style={{ minHeight: 60 }} />
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? <><Spinner dark /> Saving…</> : '✓ Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
