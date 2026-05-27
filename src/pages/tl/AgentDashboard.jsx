import { useState, useEffect, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { Loading, Empty } from '../../components/UI'

// ── Date range helper ─────────────────────────────────────────────
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
  return { from: '2020-01-01T00:00:00', to: `${todayStr}T23:59:59.999` }
}

// ── Agent stats builder ───────────────────────────────────────────
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

// ── Source stats builder — derives sources dynamically from data ──
function buildSourceStats(walkIns) {
  const sources = [...new Set(walkIns.map(w => w.lead_source).filter(Boolean))]
  return sources
    .map(source => {
      const sl        = walkIns.filter(w => w.lead_source === source)
      const nl        = sl.filter(w => w.walkin_status === 'NL').length
      const cm        = sl.filter(w => w.walkin_status === 'CM').length
      const pm        = sl.filter(w => w.walkin_status === 'PM').length
      const total     = sl.length
      const soldLeads = sl.filter(w => w.remarks === 'Sold')
      const sold      = soldLeads.length
      const soldGrams = soldLeads.reduce((s, w) => s + (parseFloat(w.grams_sold) || 0), 0)
      return { source, nl, cm, pm, total, sold, soldGrams }
    })
    .sort((a, b) => b.total - a.total)
}

// ── Source icon map ───────────────────────────────────────────────
const SOURCE_ICONS = {
  'Google':               '🔍',
  'WhatsApp Calls':       '📱',
  'Call Centre':          '📞',
  'CHATBOT':              '🤖',
  'WEBFORM':              '🌐',
  'Website':              '🌐',
  'Kerala Leads':         '🌴',
  'Suvarna News':         '📺',
  'Zee Kannada':          '📺',
  'Colors Kannada':       '📺',
  'Public TV':            '📺',
  'TV 9':                 '📺',
  'News 18':              '📺',
  'ROK Bus Campaign':     '🚌',
  'BMTC Bus Campaign':    '🚌',
  'Hordings Bus Shelters':'🪧',
  'Signage':              '🪧',
  'LED Boards':           '💡',
  'JUSTDAIL':             '📒',
  'Call Back':            '🔄',
  'OLD CRM':              '🗄️',
  'Andhra Pradesh Calls': '📞',
  'Hathway':              '📡',
  'DEN Cable':            '📡',
  'Social Media':         '📲',
  'Social Media New':     '📲',
  'Vijaya Karnataka':     '📰',
  'Newspaper':            '📰',
  'Gnani':                '🎙️',
}
const srcIcon = s => SOURCE_ICONS[s] || '📌'

// ── Shared helpers ────────────────────────────────────────────────
function fmtG(g) {
  if (!g || g === 0) return '—'
  return `${g % 1 === 0 ? g : g.toFixed(1)}g`
}
function val(n) {
  return n === 0
    ? <span style={{ color: 'var(--border2)' }}>—</span>
    : n
}

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
const SEC_HDR = {
  fontSize: 13, fontWeight: 700, color: 'var(--text)',
  marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6,
}
const DIVIDER = { borderTop: '1px solid var(--border)', margin: '28px 0 20px' }

const PERIOD_BTNS = ['Today', 'This Week', 'This Month']
const DATE_INPUT  = {
  padding: '5px 10px', fontSize: 12,
  border: '1px solid var(--border2)', borderRadius: 6,
  background: 'var(--white)', width: 'auto',
}

// ── Component ─────────────────────────────────────────────────────
export default function AgentPerformanceDashboard({ profile, toast }) {
  const [period,       setPeriod]       = useState('Today')
  const [teamFilter,   setTeamFilter]   = useState('')
  const [hideZero,     setHideZero]     = useState(true)
  const [tls,          setTls]          = useState([])
  const [rows,         setRows]         = useState([])
  const [sourceRows,   setSourceRows]   = useState([])
  const [loading,      setLoading]      = useState(true)

  // Custom date range
  const [showCustom,   setShowCustom]   = useState(false)
  const [customFrom,   setCustomFrom]   = useState('')
  const [customTo,     setCustomTo]     = useState('')
  const [appliedRange, setAppliedRange] = useState(null)

  const todayStr = new Date().toISOString().split('T')[0]

  useEffect(() => {
    supabase.from('profiles').select('id, name').eq('role', 'tl').order('name')
      .then(({ data }) => setTls(data || []))
  }, [])

  function tlBadge(tlId) {
    if (!tlId) return <span style={{ color: 'var(--text3)' }}>—</span>
    const tl = tls.find(t => t.id === tlId)
    if (!tl) return <span style={{ color: 'var(--text3)' }}>—</span>
    return (
      <span style={{
        fontSize: 10, padding: '2px 6px',
        background: 'rgba(201,168,76,0.12)', color: 'var(--gold)',
        borderRadius: 4, fontWeight: 600, whiteSpace: 'nowrap',
      }}>
        {tl.name.split(' ')[0]}
      </span>
    )
  }

  // ── Load data ─────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true)
    const { from, to } = appliedRange || getDateRange(period)

    const [{ data: walkIns }, { data: agentList }] = await Promise.all([
      supabase.from('walk_ins').select('*')
        .eq('status', 'completed')
        .gte('updated_at', from)
        .lte('updated_at', to),
      supabase.from('profiles').select('id, name, assigned_tl')
        .eq('role', 'agent').order('name'),
    ])

    let agents = agentList || []
    if (profile.role === 'admin' && teamFilter)
      agents = agents.filter(a => a.assigned_tl === teamFilter)

    const wi = walkIns || []
    setRows(buildStats(wi, agents))
    setSourceRows(buildSourceStats(wi))
    setLoading(false)
  }, [period, teamFilter, profile.id, profile.role, appliedRange])

  useEffect(() => { loadData() }, [loadData])

  // ── Aggregates ────────────────────────────────────────────────
  const totals = {
    nl:        rows.reduce((s, r) => s + r.nl,        0),
    cm:        rows.reduce((s, r) => s + r.cm,        0),
    pm:        rows.reduce((s, r) => s + r.pm,        0),
    total:     rows.reduce((s, r) => s + r.total,     0),
    sold:      rows.reduce((s, r) => s + r.sold,      0),
    soldGrams: rows.reduce((s, r) => s + r.soldGrams, 0),
  }
  const srcTotals = {
    nl:        sourceRows.reduce((s, r) => s + r.nl,        0),
    cm:        sourceRows.reduce((s, r) => s + r.cm,        0),
    pm:        sourceRows.reduce((s, r) => s + r.pm,        0),
    total:     sourceRows.reduce((s, r) => s + r.total,     0),
    sold:      sourceRows.reduce((s, r) => s + r.sold,      0),
    soldGrams: sourceRows.reduce((s, r) => s + r.soldGrams, 0),
  }

  const displayRows = hideZero ? rows.filter(r => r.total > 0) : rows
  const maxTotal    = Math.max(...rows.map(r => r.total), 0)

  // ── Period controls ───────────────────────────────────────────
  function selectPeriod(label) {
    setPeriod(label); setShowCustom(false); setAppliedRange(null)
  }
  function applyCustom() {
    if (!customFrom || !customTo) return
    if (customFrom > customTo) { toast('Start date cannot be after end date.', 'error'); return }
    setAppliedRange({ from: customFrom + 'T00:00:00', to: customTo + 'T23:59:59.999' })
  }

  // ── Excel export ──────────────────────────────────────────────
  function exportExcel() {
    // Sheet 1 — Agent-wise
    const agentData = rows.map(r => ({
      'Agent Name': r.agent.name,
      'Team': tls.find(t => t.id === r.agent.assigned_tl)?.name || '—',
      'NL': r.nl, 'CM': r.cm, 'PM': r.pm,
      'Total Walk-ins': r.total,
      'Walk-in Sold': r.sold,
      'Sold Grams': r.soldGrams,
    }))
    agentData.push({
      'Agent Name': 'TOTAL', 'Team': '',
      'NL': totals.nl, 'CM': totals.cm, 'PM': totals.pm,
      'Total Walk-ins': totals.total, 'Walk-in Sold': totals.sold, 'Sold Grams': totals.soldGrams,
    })

    // Sheet 2 — Source-wise
    const srcData = sourceRows.map(r => ({
      'Lead Source': r.source,
      'NL': r.nl, 'CM': r.cm, 'PM': r.pm,
      'Total Walk-ins': r.total,
      'Walk-in Sold': r.sold,
      'Sold Grams': r.soldGrams,
    }))
    srcData.push({
      'Lead Source': 'TOTAL',
      'NL': srcTotals.nl, 'CM': srcTotals.cm, 'PM': srcTotals.pm,
      'Total Walk-ins': srcTotals.total, 'Walk-in Sold': srcTotals.sold, 'Sold Grams': srcTotals.soldGrams,
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(agentData), 'Agent Performance')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(srcData),   'Source-wise')
    XLSX.writeFile(wb, `agent-performance-${todayStr}.xlsx`)
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        {PERIOD_BTNS.map(label => (
          <button key={label}
            className={`btn btn-sm ${period === label && !showCustom ? 'btn-dark' : 'btn-outline'}`}
            onClick={() => selectPeriod(label)}>
            {label}
          </button>
        ))}
        <button
          className={`btn btn-sm ${showCustom ? 'btn-dark' : 'btn-outline'}`}
          onClick={() => setShowCustom(true)}>
          📅 Custom Range
        </button>
        {showCustom && (
          <>
            <input type="date" value={customFrom}
              onChange={e => setCustomFrom(e.target.value)} style={DATE_INPUT} />
            <span style={{ fontSize: 12, color: 'var(--text3)' }}>to</span>
            <input type="date" value={customTo}
              onChange={e => setCustomTo(e.target.value)} style={DATE_INPUT} />
            <button className="btn btn-dark btn-sm" onClick={applyCustom}
              disabled={!customFrom || !customTo} style={{ fontSize: 12 }}>
              Apply
            </button>
          </>
        )}
        {profile.role === 'admin' && (
          <select value={teamFilter} onChange={e => setTeamFilter(e.target.value)}
            style={{ fontSize: 12, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border2)', background: 'var(--white)', color: 'var(--text)', width: 160 }}>
            <option value="">All Teams</option>
            {tls.map(tl => (
              <option key={tl.id} value={tl.id}>{tl.name.split(' ')[0]}'s Team</option>
            ))}
          </select>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}>
            <input type="checkbox" checked={hideZero} onChange={e => setHideZero(e.target.checked)}
              style={{ accentColor: 'var(--gold)', cursor: 'pointer' }} />
            Active only
          </label>
          <button className="btn btn-outline btn-sm" onClick={exportExcel}
            disabled={loading || rows.length === 0}>
            📥 Export
          </button>
        </div>
      </div>

      {loading ? <Loading /> : rows.length === 0 ? (
        <Empty icon="📊" text="No agents found for the selected filter." />
      ) : (
        <div style={{ maxWidth: 1100 }}>

          {/* ════ Section 1: Agent-wise ════ */}
          <div style={SEC_HDR}>
            <span>👥</span> Agent-wise Walk-ins
          </div>

          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 8 }}>
            {profile.role === 'admin'
              ? (teamFilter
                  ? `${tls.find(t => t.id === teamFilter)?.name.split(' ')[0]}'s team`
                  : 'All agents across all teams')
              : 'All agents — all teams'}
          </div>

          {totals.total === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              No completed walk-ins for this period.
            </div>
          )}
          {displayRows.length === 0 && hideZero && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              No active agents for this period. Uncheck "Active only" to see all.
            </div>
          )}

          <div className="table-wrap">
            <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
              <colgroup>
                <col style={{ width: '22%' }} /><col style={{ width: '12%' }} />
                <col style={{ width: '8%' }} /> <col style={{ width: '8%' }} />
                <col style={{ width: '8%' }} /> <col style={{ width: '11%' }} />
                <col style={{ width: '11%' }} /><col style={{ width: '14%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={TH({ textAlign: 'left' })}>Agent Name</th>
                  <th style={TH({ textAlign: 'left' })}>Team</th>
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
                    <tr key={r.agent.id} style={{
                      borderBottom: '1px solid var(--border)',
                      ...(isTop ? { borderLeft: '3px solid var(--gold)', background: '#FDFBF4' } : {}),
                    }}>
                      <td style={TD({ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                        {r.agent.name}
                      </td>
                      <td style={TD({})}>{tlBadge(r.agent.assigned_tl)}</td>
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
                  <td style={{ padding: '8px 10px' }} />
                  <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{totals.nl    || '—'}</td>
                  <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{totals.cm    || '—'}</td>
                  <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{totals.pm    || '—'}</td>
                  <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{totals.total || '—'}</td>
                  <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{totals.sold  || '—'}</td>
                  <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{fmtG(totals.soldGrams)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* ════ Divider ════ */}
          <div style={DIVIDER} />

          {/* ════ Section 2: Source-wise ════ */}
          <div style={SEC_HDR}>
            <span>📊</span> Source-wise Walk-ins
          </div>

          {sourceRows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>
              No walk-ins with lead source data for this period.
            </div>
          ) : (
            <div className="table-wrap">
              <table style={{ tableLayout: 'fixed', width: '100%', borderCollapse: 'collapse' }}>
                <colgroup>
                  <col style={{ width: '26%' }} /><col style={{ width: '9%' }} />
                  <col style={{ width: '9%' }} /> <col style={{ width: '9%' }} />
                  <col style={{ width: '12%' }} /><col style={{ width: '12%' }} />
                  <col style={{ width: '15%' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th style={TH({ textAlign: 'left' })}>Lead Source</th>
                    <th style={TH({ textAlign: 'center', color: 'var(--blue)' })}>NL</th>
                    <th style={TH({ textAlign: 'center', color: '#E67E22' })}>CM</th>
                    <th style={TH({ textAlign: 'center', color: '#8E44AD' })}>PM</th>
                    <th style={TH({ textAlign: 'center' })}>Total</th>
                    <th style={TH({ textAlign: 'center', color: 'var(--green)' })}>Sold</th>
                    <th style={TH({ textAlign: 'center', color: 'var(--green)' })}>Sold Grams</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceRows.map(r => (
                    <tr key={r.source} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={TD({ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' })}>
                        <span style={{ marginRight: 6 }}>{srcIcon(r.source)}</span>{r.source}
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
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: 'var(--dark)', color: 'var(--white)', fontWeight: 600 }}>
                    <td style={{ padding: '8px 10px', fontSize: 12, letterSpacing: '.05em' }}>TOTAL</td>
                    <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{srcTotals.nl    || '—'}</td>
                    <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{srcTotals.cm    || '—'}</td>
                    <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{srcTotals.pm    || '—'}</td>
                    <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{srcTotals.total || '—'}</td>
                    <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{srcTotals.sold  || '—'}</td>
                    <td style={{ textAlign: 'center', padding: '8px 10px', fontSize: 12, fontFamily: 'DM Mono' }}>{fmtG(srcTotals.soldGrams)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

        </div>
      )}
    </div>
  )
}
