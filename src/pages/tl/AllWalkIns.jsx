import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../lib/utils'
import { StatusBadge, Loading } from '../../components/UI'

const srcLabel = { today: 'Today', this_month: 'This Month', previous_month: 'Prev Month' }

export default function AllWalkIns({ branches, agents }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({ status: '', type: '', date: '', search: '' })

  async function load() {
    setLoading(true)
    let q = supabase.from('walk_ins').select('*').order('created_at', { ascending: false }).limit(500)
    if (filter.status) q = q.eq('status', filter.status)
    if (filter.type) q = q.eq('walk_in_type', filter.type)
    if (filter.date) q = q.eq('visit_date', filter.date)
    const { data } = await q
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [filter.status, filter.type, filter.date])

  const branchName = id => (branches.find(b => b.id === id) || {}).name || '—'
  const agentName = id => (agents.find(a => a.id === id) || {}).name || '—'

  const filtered = rows.filter(r => {
    if (!filter.search) return true
    const s = filter.search.toLowerCase()
    return r.customer_name?.toLowerCase().includes(s) || r.phone?.includes(s)
  })

  return (
    <div>
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
        <div className="table-wrap">
          <table>
            <thead><tr>
              <th>Customer</th><th>Phone</th><th>Gold</th><th>Grams</th><th>Branch</th>
              <th>Type</th><th>Agent</th><th>Lead Src</th><th>Status</th><th>Submitted</th>
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
                  <td style={{ fontSize: 12 }}>{r.lead_source ? srcLabel[r.lead_source] : '—'}</td>
                  <td><StatusBadge status={r.status} /></td>
                  <td style={{ fontSize: 11, color: 'var(--text3)' }}>{fmt(r.created_at)}</td>
                </tr>
              ))}
              {!filtered.length && (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 32, color: 'var(--text3)' }}>No records found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
