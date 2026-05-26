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

  const colCount = isAdmin ? 12 : 11

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

      {loading ? <Loading /> : (
        <div className="table-wrap" style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Customer / Phone</th>
                <th style={{ minWidth: 150 }}>Branch</th>
                <th style={{ minWidth: 160 }}>Type / Agent</th>
                <th style={{ minWidth: 130 }}>Lead Source</th>
                <th style={{ minWidth: 120 }}>Walk-in Status</th>
                <th style={{ minWidth: 150 }}>Remarks</th>
                <th style={{ minWidth: 130 }}>Status</th>
                <th style={{ minWidth: 130 }}>Walk-in Date</th>
                <th style={{ minWidth: 130 }}>Gold / Grams</th>
                <th style={{ minWidth: 110 }}>Grams Sold</th>
                <th style={{ minWidth: 160 }}>Submitted</th>
                {isAdmin && <th style={{ minWidth: 100 }}>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <>
                  {/* ── Primary row ── */}
                  <tr key={r.id}>
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
                        {r.walk_in_type === 'tele_sales' ? '📞 Tele Sales' : r.walk_in_type === 'direct' ? '⚡ Direct' : '—'}
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
                    <td style={{ fontSize: 13, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      {r.visit_date || '—'}
                    </td>
                    {/* Gold / Grams */}
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.gold_type || '—'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text3)', fontFamily: 'DM Mono' }}>{r.grams ? `${r.grams}g` : '—'}</div>
                    </td>
                    {/* Grams Sold */}
                    <td style={{ fontFamily: 'DM Mono', fontSize: 13, whiteSpace: 'nowrap' }}>
                      {r.grams_sold != null
                        ? <span style={{ color: 'var(--green)', fontWeight: 600 }}>{r.grams_sold}g</span>
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    {/* Submitted */}
                    <td style={{ fontSize: 12, color: 'var(--text2)', whiteSpace: 'nowrap' }}>
                      {fmt(r.created_at)}
                    </td>
                    {/* Admin actions */}
                    {isAdmin && (
                      <td>
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

                  {/* ── Secondary info row — only shown when there's extra detail ── */}
                  {(r.rejection_reason || r.bm_remarks) && (
                    <tr key={`${r.id}-info`} style={{ background: 'var(--surface)' }}>
                      <td colSpan={colCount}
                        style={{ padding: '5px 16px 8px 16px', borderBottom: '2px solid var(--border)' }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 28px', fontSize: 12, color: 'var(--text2)' }}>
                          {r.rejection_reason && (
                            <span>
                              <span style={{ color: 'var(--red)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>Rejection Reason: </span>
                              <span style={{ color: 'var(--red)' }}>{r.rejection_reason}</span>
                            </span>
                          )}
                          {r.bm_remarks && (
                            <span style={{ flex: 1, minWidth: 200 }}>
                              <span style={{ color: 'var(--text3)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 600 }}>BM Remarks: </span>
                              {r.bm_remarks}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
              {!filtered.length && (
                <tr>
                  <td colSpan={colCount} style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>
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
