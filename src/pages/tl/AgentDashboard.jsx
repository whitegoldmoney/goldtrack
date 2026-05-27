import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { Loading, Empty } from '../../components/UI'

const PERIODS = ['Today', 'This Week', 'This Month', 'All Time']

function getDateRange(period) {
  const todayStr = new Date().toISOString().split('T')[0]
  if (period === 'Today')
    return { from: `${todayStr}T00:00:00`, to: `${todayStr}T23:59:59.999` }
  if (period === 'This Week') {
    const d = new Date(); d.setDate(d.getDate() - d.getDay())
    return { from: `${d.toISOString().split('T')[0]}T00:00:00`, to: `${todayStr}T23:59:59.999` }
  }
  if (period === 'This Month')
    return { from: `${todayStr.slice(0, 7)}-01T00:00:00`, to: `${todayStr}T23:59:59.999` }
  // All Time — use a wide open range
  return { from: '2020-01-01T00:00:00', to: `${todayStr}T23:59:59.999` }
}

function buildStats(walkIns, agents) {
  return agents.map(agent => {
    const leads     = walkIns.filter(w => w.assigned_agent_id === agent.id)
    const nl        = leads.filter(w => w.walkin_status === 'NL').length
    const cm        = leads.filter(w => w.walkin_status === 'CM').length
    const pm        = leads.filter(w => w.walkin_status === 'PM').length
    const total     = leads.length
    const soldLeads = leads.filter(w => w.remarks === 'Sold')
    const sold      = soldLeads.length
    const soldGrams = soldLeads.reduce((s, w) => s + (parseFloat(w.grams_sold) || 0), 0)
    return { agent, nl, cm, pm, total, sold, soldGrams }
  })
}

function fmtG(g) {
  if (!g || g === 0) return '—'
  return `${g % 1 === 0 ? g : g.toFixed(1)}g`
}

// Zero → muted dash, non-zero → number
function val(n) {
  return n === 0
    ? <span style={{ color: 'var(--border2)' }}>—</span>
    : n
}

// Shared inline styles for compact table cells
const TH = (extra = {}) => ({
  fontSize: 11, padding: '8px 10px', fontWeight: 600,
  color: 'var(--text2)', textTransform: 'uppercase',
  letterSpacing: '.04em', whiteSpace: 'nowrap',
  background: 'var(--surface2)', borderBottom: '1px solid var(--border)',
  ...extra,
})
const TD = (extra = {}) => ({
  fontSize: 12, padding: '7px 10px', verticalAlign: 'middle',
  ...extra,
})

export default function AgentPerformanceDashboard({ profile }) {
  const [period,     setPeriod]     = useState('Today')
  const [teamFilter, setTeamFilter] = useState('')
  const [hideZero,   setHideZero]   = useState(true)
  const [tls,        setTls]        = useState([])
  const [rows,       setRows]       = useState([])
  const [loading,    setLoading]    = useState(true)

  const todayStr = new Date().toISOString().split('T')[0]

  // TL list for admin team filter + team label in cells
  useEffect(() => {
    supabase.from('profiles').select('id, name').eq('role', 'tl').order('name')
      .then(({ data }) => setTls(data || []))
  }, [])

  const getTLName = tlId => {
    if (!tlId) return null
    const tl = tls.find(t => t.id === tlId)
    return tl ? `${tl.name.split(' ')[0]}'s Team` : null
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    const { from, to } = getDateRange(period)

    const [{ data: walkIns }, { data: agentList }] = await Promise.all([
      supabase.from('walk_ins').select('*')
        .eq('status', 'completed')
        .gte('updated_at', from)
        .lte('updated_at', to),
      supabase.from('profiles').select('id, name, assigned_tl')
        .eq('role', 'agent').order('name'),
    ])

    let agents = agentList || []
    if (profile.role === 'tl') {
      agents = agents.filter(a => a.assigned_tl === profile.id)
    } else if (profile.role === 'admin' && teamFilter) {
      agents = agents.filter(a => a.assigned_tl === teamFilter)
    }

    setRows(buildStats(walkIns || [], agents))
    setLoading(false)
  }, [period, teamFilter, profile.id, profile.role])

  useEffect(() => { loadData() }, [loadData])

  // Totals from ALL rows (ignores hideZero — shows full picture)
  const totals = {
    nl:        rows.reduce((s, r) => s + r.nl,        0),
    cm:        rows.reduce((s, r) => s + r.cm,        0),
    pm:        rows.reduce((s, r) => s + r.pm,        0),
    total:     rows.reduce((s, r) => s + r.total,     0),
    sold:      rows.reduce((s, r) => s + r.sold,      0),
    soldGrams: rows.reduce((s, r) => s + r.soldGrams, 0),
  }

  // Rows shown in table (filtered by hideZero)
  const displayRows = hideZero ? rows.filter(r => r.total > 0) : rows

  const maxTotal = Math.max(...rows.map(r => r.total), 0)

  function exportExcel() {
    const data = rows.map(r => ({
      'Agent Name':     r.agent.name,
      'NL':             r.nl,
      'CM':             r.cm,
      'PM':             r.pm,
      'Total Walk-ins': r.total,
      'Walk-in Sold':   r.sold,
      'Sold Grams':     r.soldGrams,
    }))
    data.push({
      'Agent Name': 'TOTAL',
      'NL': totals.nl, 'CM': totals.cm, 'PM': totals.pm,
      'Total Walk-ins': totals.total,
      'Walk-in Sold': totals.sold,
      'Sold Grams': totals.soldGrams,
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Agent Performance')
    XLSX.writeFile(wb, `agent-performance-${todayStr}.xlsx`)
  }

  return (
    <div>
      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>

        {/* Period buttons */}
        {PERIODS.map(label => (
          <button
            key={label}
            className={`btn btn-sm ${period === label ? 'btn-dark' : 'btn-outline'}`}
            onClick={() => setPeriod(label)}
          >
            {label}
          </button>
        ))}

        {/* Team filter — admin only */}
        {profile.role === 'admin' && (
          <select
            value={teamFilter}
            onChange={e => setTeamFilter(e.target.value)}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--white)', color: 'var(--text)' }}
          >
            <option value="">All Teams</option>
            {tls.map(tl => (
              <option key={tl.id} value={tl.id}>{tl.name.split(' ')[0]}'s Team</option>
            ))}
          </select>
        )}

        {/* Right-side controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
            <input
              type="checkbox"
              checked={hideZero}
              onChange={e => setHideZero(e.target.checked)}
              style={{ accentColor: 'var(--gold)', cursor: 'pointer' }}
            />
            Active only
          </label>
          <button
            className="btn btn-outline btn-sm"
            onClick={exportExcel}
            disabled={loading || rows.length === 0}
          >
            📥 Export
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty icon="📊" text="No agents found for the selected filter." />
      ) : (
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          {totals.total === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              No completed walk-ins for this period.
            </div>
          )}
          {displayRows.length === 0 && hideZero ? (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              No active agents for this period. Uncheck "Active only" to see all agents.
            </div>
          ) : null}

          <div className="table-wrap">
            <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '30%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={TH({ textAlign: 'left' })}>Agent Name</th>
                  <th style={TH({ textAlign: 'center', color: 'var(--blue)' })}>NL</th>
                  <th style={TH({ textAlign: 'center', color: '#E67E22' })}>CM</th>
                  <th style={TH({ textAlign: 'center', color: '#8E44AD' })}>PM</th>
                  <th style={TH({ textAlign: 'center' })}>Total</th>
                  <th style={TH({ textAlign: 'center', color: 'var(--green)' })}>Sold</th>
                  <th style={TH({ textAlign: 'center', color: 'var(--green)' })}>Sold Grams</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map(r => {
                  const isTop = r.total > 0 && r.total === maxTotal
                  return (
                    <tr
                      key={r.agent.id}
                      style={{
                        borderBottom: '1px solid var(--border)',
                        ...(isTop ? { borderLeft: '3px solid var(--gold)', background: '#FDFBF4' } : {}),
                      }}
                    >
                      <td style={TD({ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                        {r.agent.name}
                        {profile.role === 'admin' && getTLName(r.agent.assigned_tl) && (
                          <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 6, fontWeight: 400 }}>
                            {getTLName(r.agent.assigned_tl)}
                          </span>
                        )}
                      </td>
                      <td style={TD({ textAlign: 'center', fontFamily: 'DM Mono', color: 'var(--blue)' })}>{val(r.nl)}</td>
                      <td style={TD({ textAlign: 'center', fontFamily: 'DM Mono', color: '#E67E22' })}>{val(r.cm)}</td>
                      <td style={TD({ textAlign: 'center', fontFamily: 'DM Mono', color: '#8E44AD' })}>{val(r.pm)}</td>
                      <td style={TD({ textAlign: 'center', fontFamily: 'DM Mono', fontWeight: 700 })}>{val(r.total)}</td>
                      <td style={TD({ textAlign: 'center', fontFamily: 'DM Mono', color: 'var(--green)' })}>{val(r.sold)}</td>
                      <td style={TD({ textAlign: 'center', fontFamily: 'DM Mono', color: r.soldGrams > 0 ? 'var(--green)' : undefined, fontWeight: r.soldGrams > 0 ? 600 : 400 })}>
                        {fmtG(r.soldGrams)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--dark)', color: 'var(--white)', fontWeight: 600 }}>
                  <td style={{ padding: '8px 10px', fontSize: 12, letterSpacing: '.05em' }}>TOTAL</td>
                  <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{totals.nl  || '—'}</td>
                  <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{totals.cm  || '—'}</td>
                  <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{totals.pm  || '—'}</td>
                  <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{totals.total || '—'}</td>
                  <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{totals.sold || '—'}</td>
                  <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{fmtG(totals.soldGrams)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
