import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../lib/utils'
import { StatusBadge, Empty, Loading } from '../../components/UI'

export default function MySubmissions({ profile, branches }) {
  const [rows, setRows]           = useState([])
  const [allProfiles, setAllProfiles] = useState([])
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    async function load() {
      const [{ data: walkIns }, { data: profiles }] = await Promise.all([
        supabase.from('walk_ins').select('*')
          .eq('submitted_by', profile.id)
          .neq('status', 'draft')
          .order('created_at', { ascending: false })
          .limit(100),
        supabase.from('profiles').select('id, name'),
      ])
      setRows(walkIns || [])
      setAllProfiles(profiles || [])
      setLoading(false)
    }
    load()
  }, [])

  const branchName = id => (branches.find(b => b.id === id) || {}).name || '—'
  const agentName  = id => (allProfiles.find(p => p.id === id) || {}).name || '—'

  // True when the walk-in was submitted by this agent but TL assigned it to a different agent
  const isTransferred = r =>
    !!r.assigned_agent_id &&
    r.assigned_agent_id !== profile.id &&
    r.submitted_by === profile.id

  if (loading) return <Loading />
  if (!rows.length) return <Empty icon="📭" text="No submissions yet." />

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Customer</th>
            <th>Phone</th>
            <th>Alt Phone</th>
            <th>Gold</th>
            <th>Grams</th>
            <th>Branch</th>
            <th>Date</th>
            <th>Status</th>
            <th>Transferred To</th>
            <th>Rejection Note</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const transferred = isTransferred(r)
            return (
              <tr key={r.id} style={transferred ? { background: '#FAF0FF' } : {}}>
                <td className="td-name">{r.customer_name}</td>
                <td className="td-phone">{r.phone}</td>
                <td className="td-phone">{r.alternate_phone || '—'}</td>
                <td>
                  <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--surface2)', borderRadius: 4 }}>
                    {r.gold_type}
                  </span>
                </td>
                <td className="td-grams">{r.grams}g</td>
                <td style={{ fontSize: 12 }}>{branchName(r.branch_id)}</td>
                <td style={{ fontSize: 12, color: 'var(--text3)' }}>{fmt(r.created_at)}</td>

                {/* Status — show Transferred badge when applicable, else normal badge */}
                <td>
                  {transferred ? (
                    <div>
                      <span className="badge badge-transferred">🔄 Transferred</span>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                        → {agentName(r.assigned_agent_id)}
                      </div>
                    </div>
                  ) : (
                    <StatusBadge status={r.status} />
                  )}
                </td>

                {/* Transferred To column */}
                <td style={{ fontSize: 12 }}>
                  {transferred
                    ? <span style={{ color: '#6C3483', fontWeight: 500 }}>{agentName(r.assigned_agent_id)}</span>
                    : <span style={{ color: 'var(--text3)' }}>—</span>}
                </td>

                <td style={{ fontSize: 12, color: 'var(--red)', maxWidth: 160 }}>
                  {r.rejection_reason || '—'}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
