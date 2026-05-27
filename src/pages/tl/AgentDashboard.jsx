import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { Loading, Empty } from '../../components/UI'

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: 'week',  label: 'This Week' },
  { key: 'month', label: 'This Month' },
  { key: 'custom', label: 'Custom Range' },
]

function getDateRange(period, customFrom, customTo) {
  const todayStr = new Date().toISOString().split('T')[0]
  if (period === 'today')
    return { from: `${todayStr}T00:00:00`, to: `${todayStr}T23:59:59.999` }
  if (period === 'week') {
    const d = new Date(); d.setDate(d.getDate() - d.getDay())
    return { from: `${d.toISOString().split('T')[0]}T00:00:00`, to: `${todayStr}T23:59:59.999` }
  }
  if (period === 'month') {
    return { from: `${todayStr.slice(0, 7)}-01T00:00:00`, to: `${todayStr}T23:59:59.999` }
  }
  // custom
  return {
    from: `${customFrom || todayStr}T00:00:00`,
    to:   `${customTo   || todayStr}T23:59:59.999`,
  }
}

function buildStats(walkIns, agents) {
  return agents.map(agent => {
    const leads = walkIns.filter(w => w.assigned_agent_id === agent.id)
    const nl        = leads.filter(w => w.walkin_status === 'NL').length
    const cm        = leads.filter(w => w.walkin_status === 'CM').length
    const pm        = leads.filter(w => w.walkin_status === 'PM').length
    const total     = leads.length
    const soldLeads = leads.filter(w => w.remarks === 'Sold')
    const sold      = soldLeads.length
    const soldGrams = soldLeads.reduce((sum, w) => sum + (parseFloat(w.grams_sold) || 0), 0)
    return { agent, nl, cm, pm, total, sold, soldGrams }
  })
}

function fmtG(g) {
  return g > 0 ? `${g % 1 === 0 ? g : g.toFixed(1)}g` : '—'
}

export default function AgentPerformanceDashboard({ profile }) {
  const [period,     setPeriod]     = useState('today')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')
  const [teamFilter, setTeamFilter] = useState('')   // TL id or '' = all
  const [tls,        setTls]        = useState([])
  const [rows,       setRows]       = useState([])
  const [loading,    setLoading]    = useState(true)

  const todayStr = new Date().toISOString().split('T')[0]

  // Load TL list once (for admin team filter dropdown)
  useEffect(() => {
    supabase.from('profiles').select('id, name').eq('role', 'tl').order('name')
      .then(({ data }) => setTls(data || []))
  }, [])

  const loadData = useCallback(async () => {
    setLoading(true)
    const { from, to } = getDateRange(period, customFrom, customTo)

    const [{ data: walkIns }, { data: agentList }] = await Promise.all([
      supabase.from('walk_ins').select('*')
        .eq('status', 'completed')
        .gte('updated_at', from)
        .lte('updated_at', to),
      supabase.from('profiles').select('id, name, assigned_tl')
        .eq('role', 'agent').order('name'),
    ])

    let agents = agentList || []
    // TL sees only their own team; admin can filter by team
    if (profile.role === 'tl') {
      agents = agents.filter(a => a.assigned_tl === profile.id)
    } else if (profile.role === 'admin' && teamFilter) {
      agents = agents.filter(a => a.assigned_tl === teamFilter)
    }

    setRows(buildStats(walkIns || [], agents))
    setLoading(false)
  }, [period, customFrom, customTo, teamFilter, profile.id, profile.role])

  useEffect(() => {
    // Don't fire if custom range is incomplete
    if (period === 'custom' && (!customFrom || !customTo)) { setLoading(false); return }
    loadData()
  }, [loadData])

  // ── Totals row ──
  const totals = {
    nl:        rows.reduce((s, r) => s + r.nl,        0),
    cm:        rows.reduce((s, r) => s + r.cm,        0),
    pm:        rows.reduce((s, r) => s + r.pm,        0),
    total:     rows.reduce((s, r) => s + r.total,     0),
    sold:      rows.reduce((s, r) => s + r.sold,      0),
    soldGrams: rows.reduce((s, r) => s + r.soldGrams, 0),
  }

  // Agent with most walk-ins gets gold highlight (if > 0)
  const maxTotal = Math.max(...rows.map(r => r.total), 0)

  // ── Excel export ──
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
      'Agent Name':     'TOTAL',
      'NL':             totals.nl,
      'CM':             totals.cm,
      'PM':             totals.pm,
      'Total Walk-ins': totals.total,
      'Walk-in Sold':   totals.sold,
      'Sold Grams':     totals.soldGrams,
    })
    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Agent Performance')
    XLSX.writeFile(wb, `agent-performance-${todayStr}.xlsx`)
  }

  return (
    <div>
      {/* ── Filter / action bar ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>

        {/* Period quick buttons */}
        <div style={{ display: 'flex', gap: 4 }}>
          {PERIODS.map(p => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={period === p.key ? 'btn btn-primary btn-sm' : 'btn btn-outline btn-sm'}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date pickers */}
        {period === 'custom' && (
          <>
            <input type="date" value={customFrom} max={customTo || todayStr}
              onChange={e => setCustomFrom(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border2)', width: 130 }}
            />
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>→</span>
            <input type="date" value={customTo} min={customFrom || undefined} max={todayStr}
              onChange={e => setCustomTo(e.target.value)}
              style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border2)', width: 130 }}
            />
          </>
        )}

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

        {/* Export — pushed to right */}
        <button
          className="btn btn-outline btn-sm"
          style={{ marginLeft: 'auto' }}
          onClick={exportExcel}
          disabled={loading || rows.length === 0}
        >
          📥 Export Excel
        </button>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <Loading />
      ) : rows.length === 0 ? (
        <Empty icon="📊" text="No agents found for the selected filter." />
      ) : (
        <>
          {totals.total === 0 && (
            <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 12 }}>
              No completed walk-ins found for the selected period.
            </div>
          )}

          <div className="table-wrap">
            <table style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '24%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '10%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '12%' }} />
                <col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Agent Name</th>
                  <th style={{ textAlign: 'center', color: 'var(--blue)' }}>NL</th>
                  <th style={{ textAlign: 'center', color: '#E67E22' }}>CM</th>
                  <th style={{ textAlign: 'center', color: '#8E44AD' }}>PM</th>
                  <th style={{ textAlign: 'center' }}>Total</th>
                  <th style={{ textAlign: 'center', color: 'var(--green)' }}>Sold</th>
                  <th style={{ textAlign: 'center', color: 'var(--green)' }}>Sold Grams</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => {
                  const isTop  = r.total > 0 && r.total === maxTotal
                  const isZero = r.total === 0
                  return (
                    <tr key={r.agent.id} style={{
                      ...(isTop  ? { borderLeft: '3px solid var(--gold)', background: '#FDFBF4' } : {}),
                      ...(isZero ? { opacity: 0.4 } : {}),
                    }}>
                      <td style={{ fontWeight: 500, color: isZero ? 'var(--text3)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {r.agent.name}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'DM Mono', color: 'var(--blue)' }}>
                        {r.nl  || <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'DM Mono', color: '#E67E22' }}>
                        {r.cm  || <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'DM Mono', color: '#8E44AD' }}>
                        {r.pm  || <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'DM Mono', fontWeight: 700, fontSize: 14 }}>
                        {r.total || <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 13 }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'DM Mono', color: 'var(--green)' }}>
                        {r.sold || <span style={{ color: 'var(--text3)' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'DM Mono', color: 'var(--green)', fontWeight: r.soldGrams > 0 ? 600 : 400 }}>
                        {fmtG(r.soldGrams)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--dark)', color: 'var(--white)', fontWeight: 700 }}>
                  <td style={{ padding: '12px 14px', letterSpacing: '.05em', fontSize: 12 }}>TOTAL</td>
                  <td style={{ textAlign: 'center', padding: '12px 6px', fontFamily: 'DM Mono' }}>{totals.nl}</td>
                  <td style={{ textAlign: 'center', padding: '12px 6px', fontFamily: 'DM Mono' }}>{totals.cm}</td>
                  <td style={{ textAlign: 'center', padding: '12px 6px', fontFamily: 'DM Mono' }}>{totals.pm}</td>
                  <td style={{ textAlign: 'center', padding: '12px 6px', fontFamily: 'DM Mono', fontSize: 15 }}>{totals.total}</td>
                  <td style={{ textAlign: 'center', padding: '12px 6px', fontFamily: 'DM Mono' }}>{totals.sold}</td>
                  <td style={{ textAlign: 'center', padding: '12px 6px', fontFamily: 'DM Mono' }}>
                    {fmtG(totals.soldGrams)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  )
}
