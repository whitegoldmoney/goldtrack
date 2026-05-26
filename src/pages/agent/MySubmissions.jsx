import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../lib/utils'
import { StatusBadge, Empty, Loading } from '../../components/UI'

export default function MySubmissions({ profile, branches }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('walk_ins').select('*').eq('submitted_by', profile.id)
      .neq('status', 'draft')
      .order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])

  const branchName = id => (branches.find(b => b.id === id) || {}).name || '—'

  if (loading) return <Loading />
  if (!rows.length) return <Empty icon="📭" text="No submissions yet." />

  return (
    <div className="table-wrap">
      <table>
        <thead><tr>
          <th>Customer</th><th>Phone</th><th>Alt Phone</th><th>Gold</th><th>Grams</th>
          <th>Branch</th><th>Date</th><th>Status</th><th>Rejection Note</th>
        </tr></thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td className="td-name">{r.customer_name}</td>
              <td className="td-phone">{r.phone}</td>
              <td className="td-phone">{r.alternate_phone || '—'}</td>
              <td><span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--surface2)', borderRadius: 4 }}>{r.gold_type}</span></td>
              <td className="td-grams">{r.grams}g</td>
              <td style={{ fontSize: 12 }}>{branchName(r.branch_id)}</td>
              <td style={{ fontSize: 12, color: 'var(--text3)' }}>{fmt(r.created_at)}</td>
              <td><StatusBadge status={r.status} /></td>
              <td style={{ fontSize: 12, color: 'var(--red)', maxWidth: 160 }}>{r.rejection_reason || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
