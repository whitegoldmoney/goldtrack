import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../lib/utils'
import { StatusBadge, Loading, Spinner } from '../../components/UI'

export default function AdminDashboard({ branches, agents, toast }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ search: '', status: '', type: '', date: '' })
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)
  const [stats, setStats] = useState({ total: 0, pending: 0, completed: 0, rejected: 0 })

  const branchName = id => (branches.find(b => b.id === id) || {}).name || '—'
  const agentName = id => (agents.find(a => a.id === id) || {}).name || '—'

  async function load() {
    setLoading(true)
    let q = supabase.from('walk_ins').select('*').order('created_at', { ascending: false }).limit(1000)
    if (filter.status) q = q.eq('status', filter.status)
    if (filter.type) q = q.eq('walk_in_type', filter.type)
    if (filter.date) q = q.eq('visit_date', filter.date)
    const { data } = await q
    const all = data || []
    setRows(all)
    setStats({
      total: all.length,
      pending: all.filter(r => r.status === 'pending').length,
      completed: all.filter(r => r.status === 'completed').length,
      rejected: all.filter(r => r.status === 'rejected').length,
    })
    setLoading(false)
  }

  useEffect(() => { load() }, [filter.status, filter.type, filter.date])

  const filtered = rows.filter(r => {
    if (!filter.search) return true
    const s = filter.search.toLowerCase()
    return r.customer_name?.toLowerCase().includes(s) || r.phone?.includes(s)
  })

  function setE(k, v) { setEditing(e => ({ ...e, [k]: v })) }

  async function handleSave() {
    const { id, customer_name, phone, gold_type, grams, branch_id, visit_date,
      status, walk_in_type, assigned_agent_id, rejection_reason } = editing
    if (!customer_name || !phone || !grams || !branch_id) {
      toast('Fill all required fields.', 'error'); return
    }
    setSaving(true)
    const { error } = await supabase.from('walk_ins').update({
      customer_name: customer_name.trim(),
      phone: phone.trim(),
      gold_type,
      grams: parseFloat(grams),
      branch_id: parseInt(branch_id),
      visit_date,
      status,
      walk_in_type: walk_in_type || null,
      assigned_agent_id: assigned_agent_id || null,
      rejection_reason: rejection_reason || null,
    }).eq('id', id)
    if (error) toast(error.message, 'error')
    else { toast('Entry updated successfully!', 'success'); setEditing(null); load() }
    setSaving(false)
  }

  async function handleDelete(id) {
    setDeleting(id)
    const { error } = await supabase.from('walk_ins').delete().eq('id', id)
    if (error) toast(error.message, 'error')
    else { toast('Entry deleted.', 'success'); load() }
    setDeleting(null)
  }

  return (
    <div>
      {/* Stats */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
        <div className="stat-card gold">
          <div className="stat-num" style={{ color: 'var(--gold)' }}>{stats.total}</div>
          <div className="stat-label">Total Entries</div>
        </div>
        <div className="stat-card">
          <div className="stat-num">{stats.pending}</div>
          <div className="stat-label">⏳ Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--green)' }}>{stats.completed}</div>
          <div className="stat-label">✅ Completed</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--red)' }}>{stats.rejected}</div>
          <div className="stat-label">✗ Rejected</div>
        </div>
      </div>

      {/* Filters */}
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

      {/* Table */}
      {loading ? <Loading /> : (
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Customer</th><th>Phone</th><th>Gold</th><th>Grams</th><th>Branch</th>
              <th>Type</th><th>Agent</th><th>Status</th><th>Date</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td className="td-name">{r.customer_name}</td>
                  <td className="td-phone">{r.phone}</td>
                  <td style={{ fontSize: 12 }}>{r.gold_type}</td>
                  <td className="td-grams">{r.grams}g</td>
                  <td style={{ fontSize: 12 }}>{branchName(r.branch_id)}</td>
                  <td style={{ fontSize: 12 }}>{r.walk_in_type === 'tele_sales' ? '📞 Tele' : r.walk_in_type === 'direct' ? '⚡ Direct' : '—'}</td>
                  <td style={{ fontSize: 12 }}>{r.assigned_agent_id ? agentName(r.assigned_agent_id) : '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ fontSize: 11, color: 'var(--text3)' }}>{r.visit_date || fmt(r.created_at)}</td>
                  <td>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setEditing({ ...r })}>✏ Edit</button>
                      <button className="btn btn-danger btn-sm"
                        onClick={() => { if (window.confirm(`Delete entry for "${r.customer_name}"?`)) handleDelete(r.id) }}
                        disabled={deleting === r.id}>
                        {deleting === r.id ? <Spinner /> : '🗑'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Modal */}
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
                  <input value={editing.customer_name || ''} onChange={e => setE('customer_name', e.target.value)} placeholder="Full name" />
                </div>
                <div className="form-group">
                  <label>Phone *</label>
                  <input value={editing.phone || ''} onChange={e => setE('phone', e.target.value)} maxLength={10} placeholder="10-digit" />
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
                  <input type="number" step="0.1" value={editing.grams || ''} onChange={e => setE('grams', e.target.value)} placeholder="e.g. 10.5" />
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
                {editing.status === 'rejected' && (
                  <div className="form-group full">
                    <label>Rejection Reason</label>
                    <input value={editing.rejection_reason || ''} onChange={e => setE('rejection_reason', e.target.value)} placeholder="Reason for rejection…" />
                  </div>
                )}
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
