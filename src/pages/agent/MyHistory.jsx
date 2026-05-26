import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../lib/utils'
import { Loading, Empty } from '../../components/UI'

const srcLabel = { today: 'Today', this_month: 'This Month', previous_month: 'Prev Month' }
const displaySource = s => srcLabel[s] || s || '—'

const walkinLabel = { NL: 'New Lead', CM: 'Current Month', PM: 'Prev Month' }
const displayWalkin = s => walkinLabel[s] || s || '—'

export default function MyHistory({ profile, branches }) {
  const [rows, setRows]       = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo,   setDateTo]   = useState('')

  useEffect(() => {
    supabase.from('walk_ins').select('*')
      .eq('assigned_agent_id', profile.id)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])

  const branchName = id => (branches.find(b => b.id === id) || {}).name || '—'

  // ── Stats always computed from ALL completed rows ──
  const today     = new Date().toISOString().split('T')[0]
  const thisMonth = new Date().toISOString().slice(0, 7)

  const todayCount     = rows.filter(r => r.updated_at?.startsWith(today)).length
  const monthCount     = rows.filter(r => r.updated_at?.startsWith(thisMonth)).length
  const totalCount     = rows.length
  const gramsThisMonth = rows
    .filter(r => r.updated_at?.startsWith(thisMonth))
    .reduce((sum, r) => sum + (parseFloat(r.grams) || 0), 0)

  // ── Date range filter ──
  const filtered = rows.filter(r => {
    const d = r.updated_at?.slice(0, 10) || ''
    if (dateFrom && d < dateFrom) return false
    if (dateTo   && d > dateTo)   return false
    return true
  })

  const hasFilter = dateFrom || dateTo
  const clearFilter = () => { setDateFrom(''); setDateTo('') }

  if (loading) return <Loading />

  return (
    <div>
      {/* ── Stats strip (4 cards) ── */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 16 }}>
        <div className="stat-card" style={{ borderColor: 'var(--gold)', background: 'linear-gradient(135deg,#FFFBF0,#FFF)' }}>
          <div className="stat-num" style={{ color: 'var(--gold)' }}>{todayCount}</div>
          <div className="stat-label">📅 Today</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--blue)' }}>{monthCount}</div>
          <div className="stat-label">📆 This Month</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: 'var(--green)' }}>{totalCount}</div>
          <div className="stat-label">✅ Total</div>
        </div>
        <div className="stat-card">
          <div className="stat-num" style={{ color: '#6A1B9A', fontSize: 20 }}>
            {gramsThisMonth % 1 === 0 ? gramsThisMonth : gramsThisMonth.toFixed(1)}g
          </div>
          <div className="stat-label">⚖️ Grams (Month)</div>
        </div>
      </div>

      {/* ── Date range filter ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap' }}>From</label>
        <input
          type="date"
          value={dateFrom}
          max={dateTo || today}
          onChange={e => setDateFrom(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', width: 130 }}
        />
        <label style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600, whiteSpace: 'nowrap' }}>To</label>
        <input
          type="date"
          value={dateTo}
          min={dateFrom || undefined}
          max={today}
          onChange={e => setDateTo(e.target.value)}
          style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', width: 130 }}
        />
        {hasFilter && (
          <button className="btn btn-outline btn-sm" onClick={clearFilter}>✕ Clear</button>
        )}
      </div>

      {/* ── Empty states ── */}
      {rows.length === 0 ? (
        <Empty icon="🎯" text="No completed leads yet. Start locking leads to see your history here!" />
      ) : filtered.length === 0 ? (
        <Empty icon="📅" text="No completed leads for the selected date range." />
      ) : (
        <>
          <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 10 }}>
            <strong>{filtered.length}</strong> completed lead{filtered.length !== 1 ? 's' : ''}
            {hasFilter && <span style={{ marginLeft: 6, color: 'var(--text3)' }}>
              ({dateFrom || '…'} → {dateTo || '…'})
            </span>}
          </div>

          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Phone</th>
                  <th>Gold</th>
                  <th>Grams</th>
                  <th>Branch</th>
                  <th>Lead Source</th>
                  <th>Walk-in Status</th>
                  <th>Remarks</th>
                  <th>Completed At</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td className="td-name">{r.customer_name}</td>
                    <td className="td-phone">{r.phone}</td>
                    <td>
                      <span style={{ fontSize: 12, padding: '2px 8px', background: 'var(--surface2)', borderRadius: 4 }}>
                        {r.gold_type}
                      </span>
                    </td>
                    <td className="td-grams">{r.grams}g</td>
                    <td style={{ fontSize: 12 }}>{branchName(r.branch_id)}</td>
                    <td style={{ fontSize: 12 }}>{displaySource(r.lead_source)}</td>
                    <td style={{ fontSize: 12 }}>
                      {r.walkin_status
                        ? <span style={{ fontWeight: 600, color: 'var(--blue)' }}>
                            {displayWalkin(r.walkin_status)}
                          </span>
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                    <td style={{ fontSize: 12 }}>{r.remarks || '—'}</td>
                    <td style={{ fontSize: 12, color: 'var(--text2)' }}>{fmt(r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
