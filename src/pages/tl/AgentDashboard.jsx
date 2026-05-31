import { useState, useEffect } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'
import { Loading, Empty } from '../../components/UI'

// getDateRange is defined inside the component to close over state

// ── Agent stats builder ───────────────────────────────────────────
function buildStats(walkIns, agents) {
  return agents.map(agent => {
    const agentLeads = walkIns.filter(w => w.assigned_agent_id === agent.id)

    // NL: lead_source = 'today' OR walkin_status / walk_in_status = 'NL'
    const nl = agentLeads.filter(w =>
      w.lead_source === 'today' ||
      w.walkin_status === 'NL' || w.walk_in_status === 'NL'
    ).length

    // CM: lead_source = 'this_month' OR walkin_status / walk_in_status = 'CM'
    const cm = agentLeads.filter(w =>
      w.lead_source === 'this_month' ||
      w.walkin_status === 'CM' || w.walk_in_status === 'CM'
    ).length

    // PM: lead_source = 'previous_month' OR walkin_status / walk_in_status = 'PM'
    const pm = agentLeads.filter(w =>
      w.lead_source === 'previous_month' ||
      w.walkin_status === 'PM' || w.walk_in_status === 'PM'
    ).length

    const total     = agentLeads.length
    const soldLeads = agentLeads.filter(w => String(w.remarks || '').toLowerCase() === 'sold')
    const sold      = soldLeads.length
    const soldGrams = soldLeads.reduce((s, w) => s + (parseFloat(w.grams_sold) || 0), 0)
    return { agent, nl, cm, pm, total, sold, soldGrams }
  })
}

// ── Source stats builder — grouped by lead_source (marketing channel) ──
// Excludes old time-indicator values (today / this_month / previous_month)
const TIME_INDICATORS = new Set(['today', 'this_month', 'previous_month'])

function buildSourceStats(walkIns) {
  const allSources = [
    ...new Set(walkIns.map(w => w.lead_source).filter(s => s && !TIME_INDICATORS.has(s)))
  ].sort()

  return allSources
    .map(source => {
      const sl = walkIns.filter(w => w.lead_source === source)

      const nl = sl.filter(w =>
        w.walkin_status === 'NL' || w.walk_in_status === 'NL'
      ).length
      const cm = sl.filter(w =>
        w.walkin_status === 'CM' || w.walk_in_status === 'CM'
      ).length
      const pm = sl.filter(w =>
        w.walkin_status === 'PM' || w.walk_in_status === 'PM'
      ).length

      const total     = sl.length
      const soldLeads = sl.filter(w => String(w.remarks || '').toLowerCase() === 'sold')
      const sold      = soldLeads.length
      const soldGrams = soldLeads.reduce((s, w) => s + (parseFloat(w.grams_sold) || 0), 0)

      return { source, nl, cm, pm, total, sold, soldGrams }
    })
    .filter(s => s.total > 0)
    .sort((a, b) => b.total - a.total)
}

// ── Time slots 10 AM – 7 PM ───────────────────────────────────────
const TIME_SLOTS = [
  { label: '10–11 AM', from: 10, to: 11 },
  { label: '11–12 PM', from: 11, to: 12 },
  { label: '12–1 PM',  from: 12, to: 13 },
  { label: '1–2 PM',   from: 13, to: 14 },
  { label: '2–3 PM',   from: 14, to: 15 },
  { label: '3–4 PM',   from: 15, to: 16 },
  { label: '4–5 PM',   from: 16, to: 17 },
  { label: '5–6 PM',   from: 17, to: 18 },
  { label: '6–7 PM',   from: 18, to: 19 },
]

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
  const [period,      setPeriod]      = useState('Today')
  const [teamFilter,  setTeamFilter]  = useState('')
  const [hideZero,    setHideZero]    = useState(false)
  const [tls,         setTls]         = useState([])
  const [rows,        setRows]        = useState([])
  const [sourceRows,  setSourceRows]  = useState([])
  const [walkIns,     setWalkIns]     = useState([])
  const [agents,      setAgents]      = useState([])
  const [loading,     setLoading]     = useState(true)

  // Custom date range
  const [showCustom,  setShowCustom]  = useState(false)
  const [customFrom,  setCustomFrom]  = useState('')
  const [customTo,    setCustomTo]    = useState('')

  const todayStr = new Date().toISOString().split('T')[0]

  // ── Date range — datetime strings for created_at filtering ──────
  // visit_date is only set for PM records; created_at is always populated
  function getDateRange() {
    const now = new Date()
    const todayDate = now.toISOString().split('T')[0]

    if (showCustom && customFrom && customTo)
      return {
        from: customFrom + 'T00:00:00',
        to:   customTo   + 'T23:59:59.999',
      }

    if (period === 'Today')
      return {
        from: todayDate + 'T00:00:00',
        to:   todayDate + 'T23:59:59.999',
      }

    if (period === 'This Week') {
      const d = new Date(now)
      d.setDate(now.getDate() - now.getDay() + 1) // Monday
      return {
        from: d.toISOString().split('T')[0] + 'T00:00:00',
        to:   todayDate + 'T23:59:59.999',
      }
    }

    if (period === 'This Month') {
      const yr  = now.getFullYear()
      const mon = String(now.getMonth() + 1).padStart(2, '0')
      return {
        from: `${yr}-${mon}-01T00:00:00`,
        to:   todayDate + 'T23:59:59.999',
      }
    }

    return { from: '2020-01-01T00:00:00', to: todayDate + 'T23:59:59.999' }
  }

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
  async function loadData() {
    setLoading(true)
    const { from, to } = getDateRange()

    console.log('Date range:', from, 'to', to)

    // Fetch walk-ins, agents, TLs all in parallel
    const [walkInsResult, agentsResult, tlsResult] = await Promise.all([
      supabase
        .from('walk_ins')
        .select('id, customer_name, assigned_agent_id, submitted_by, lead_source, walkin_status, walk_in_status, remarks, grams_sold, grams, created_at, visit_date, status, walk_in_type')
        .gte('created_at', from)
        .lte('created_at', to)
        .not('status', 'in', '(draft,pending,rejected)'),

      supabase
        .from('profiles')
        .select('id, name, assigned_tl')
        .eq('role', 'agent')
        .order('name'),

      supabase
        .from('profiles')
        .select('id, name')
        .eq('role', 'tl')
        .order('name'),
    ])

    if (walkInsResult.error) console.error('Walk-ins error:', walkInsResult.error)
    if (agentsResult.error) console.error('Agents error:', agentsResult.error)

    const wi          = walkInsResult.data  || []
    const tlList      = tlsResult.data      || []
    let   agentList   = agentsResult.data   || []

    console.log('Walk-ins fetched:', wi.length, '| Agents fetched:', agentList.length)
    console.log('Walk-ins with agent:', wi.filter(w => w.assigned_agent_id).length)

    if (profile.role === 'admin' && teamFilter)
      agentList = agentList.filter(a => a.assigned_tl === teamFilter)

    // Compute stats from fresh data before setting state
    const statsRows  = buildStats(wi, agentList)
    const srcRows    = buildSourceStats(wi)

    setWalkIns(wi)
    setAgents(agentList)
    setTls(tlList)
    setRows(statsRows)
    setSourceRows(srcRows)
    setLoading(false)
  }

  useEffect(() => { loadData() }, [period, showCustom, customFrom, customTo, teamFilter])

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

  // ── Hourly helpers ────────────────────────────────────────────
  function getCount(agentId, slot) {
    return walkIns.filter(w => {
      const hour = new Date(w.created_at).getHours()
      return w.submitted_by === agentId && hour >= slot.from && hour < slot.to
    }).length
  }

  const slotTotals = TIME_SLOTS.map(slot => ({
    slot,
    total: agents.reduce((sum, a) => sum + getCount(a.id, slot), 0),
  }))
  const peakSlot = slotTotals.length
    ? slotTotals.reduce((max, s) => s.total > max.total ? s : max, slotTotals[0])
    : null

  const busiestAgent = agents
    .map(a => ({ name: a.name, total: walkIns.filter(w => w.submitted_by === a.id).length }))
    .sort((a, b) => b.total - a.total)[0] || { name: '—', total: 0 }

  const currentHour   = new Date().getHours()
  const isCurrentSlot = slot =>
    period === 'Today' && !showCustom &&
    currentHour >= slot.from && currentHour < slot.to

  const displayRows = hideZero ? rows.filter(r => r.total > 0) : rows
  const maxTotal    = rows.length ? Math.max(...rows.map(r => r.total), 0) : 0

  // ── Period controls ───────────────────────────────────────────
  function selectPeriod(label) {
    setPeriod(label); setShowCustom(false)
  }
  function applyCustom() {
    if (!customFrom || !customTo) return
    if (customFrom > customTo) { toast('Start date cannot be after end date.', 'error'); return }
    setShowCustom(true) // triggers useEffect via showCustom + customFrom + customTo
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

    // Sheet 3 — Hourly (agents as rows, slots as columns)
    const hourlyExportData = agents.map(agent => ({
      'Agent Name': agent.name,
      ...TIME_SLOTS.reduce((acc, slot) => ({ ...acc, [slot.label]: getCount(agent.id, slot) }), {}),
      'Total': TIME_SLOTS.reduce((sum, slot) => sum + getCount(agent.id, slot), 0),
    }))
    hourlyExportData.push({
      'Agent Name': 'TOTAL',
      ...TIME_SLOTS.reduce((acc, slot) => ({
        ...acc,
        [slot.label]: agents.reduce((s, a) => s + getCount(a.id, slot), 0),
      }), {}),
      'Total': walkIns.length,
    })

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(agentData),        'Agent Performance')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(srcData),          'Source-wise')
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hourlyExportData), 'Hourly')
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

      {loading ? <Loading /> : agents.length === 0 ? (
        <Empty icon="📊" text="No agents found." />
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
              No walk-ins found for this period.
            </div>
          )}
          {displayRows.length === 0 && hideZero && totals.total > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>
              All agents have 0 walk-ins. Uncheck "Active only" to see all.
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

          {/* ════ Divider ════ */}
          <div style={DIVIDER} />

          {/* ════ Section 3: Hourly ════ */}
          <div style={SEC_HDR}>
            <span>🕐</span> Hourly Walk-in Report
          </div>

          {/* Summary line */}
          {peakSlot && peakSlot.total > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 12 }}>
              Peak hour: <strong style={{ color: 'var(--gold)' }}>{peakSlot.slot.label}</strong>
              &nbsp;·&nbsp;
              Busiest agent: <strong>{busiestAgent.name}</strong> ({busiestAgent.total} walk-in{busiestAgent.total !== 1 ? 's' : ''})
            </div>
          )}

          <div className="table-wrap" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
              <colgroup>
                <col style={{ width: 160 }} />
                {TIME_SLOTS.map(s => <col key={s.label} style={{ width: 80 }} />)}
                <col style={{ width: 70 }} />
              </colgroup>
              <thead>
                <tr>
                  <th style={{ ...TH({ textAlign: 'left' }), position: 'sticky', left: 0, zIndex: 2 }}>
                    Agent Name
                  </th>
                  {TIME_SLOTS.map(slot => {
                    const isPeakCol = peakSlot && slot.label === peakSlot.slot.label && peakSlot.total > 0
                    const isLive    = isCurrentSlot(slot)
                    return (
                      <th key={slot.label} style={{
                        ...TH({ textAlign: 'center', fontSize: 10 }),
                        background: isPeakCol ? 'rgba(201,168,76,0.20)' : 'var(--surface2)',
                        color:      isPeakCol ? 'var(--gold)' : 'var(--text2)',
                      }}>
                        {slot.label}
                        {isLive && (
                          <span style={{ display: 'block', fontSize: 8, color: 'var(--green)', fontWeight: 700, marginTop: 1 }}>
                            ● LIVE
                          </span>
                        )}
                      </th>
                    )
                  })}
                  <th style={{ ...TH({ textAlign: 'center' }), position: 'sticky', right: 0, zIndex: 2 }}>
                    Total
                  </th>
                </tr>
              </thead>
              <tbody>
                {agents.map(agent => {
                  const agentTotal = TIME_SLOTS.reduce((sum, slot) => sum + getCount(agent.id, slot), 0)
                  if (hideZero && agentTotal === 0) return null
                  return (
                    <tr key={agent.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{
                        ...TD({ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
                        position: 'sticky', left: 0, background: 'var(--white)', zIndex: 1,
                      }}>
                        {agent.name}
                      </td>
                      {TIME_SLOTS.map(slot => {
                        const count     = getCount(agent.id, slot)
                        const isPeakCol = peakSlot && slot.label === peakSlot.slot.label && peakSlot.total > 0
                        return (
                          <td key={slot.label} style={TD({
                            textAlign: 'center', fontFamily: 'DM Mono',
                            background: count > 0
                              ? isPeakCol ? 'rgba(201,168,76,0.12)' : 'rgba(201,168,76,0.06)'
                              : 'transparent',
                            fontWeight: count > 0 ? 600 : 400,
                            color:      count > 0 ? 'var(--text)' : 'var(--border2)',
                          })}>
                            {count > 0 ? count : '—'}
                          </td>
                        )
                      })}
                      <td style={{
                        ...TD({ textAlign: 'center', fontFamily: 'DM Mono', fontWeight: 700 }),
                        position: 'sticky', right: 0,
                        background: agentTotal > 0 ? '#FDFBF4' : 'var(--white)',
                        color: agentTotal > 0 ? 'var(--text)' : 'var(--text3)',
                        borderLeft: '1px solid var(--border)',
                      }}>
                        {agentTotal > 0 ? agentTotal : '—'}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: 'var(--dark)', color: 'var(--white)', fontWeight: 600 }}>
                  <td style={{ padding: '8px 10px', fontSize: 12, letterSpacing: '.05em', position: 'sticky', left: 0, background: 'var(--dark)', zIndex: 1 }}>
                    TOTAL
                  </td>
                  {TIME_SLOTS.map(slot => {
                    const slotTotal = agents.reduce((sum, a) => sum + getCount(a.id, slot), 0)
                    return (
                      <td key={slot.label} style={{ textAlign: 'center', padding: '8px 6px', fontSize: 12, fontFamily: 'DM Mono' }}>
                        {slotTotal || '—'}
                      </td>
                    )
                  })}
                  <td style={{ textAlign: 'center', padding: '8px 6px', fontSize: 12, fontFamily: 'DM Mono', position: 'sticky', right: 0, background: 'var(--dark)', borderLeft: '1px solid rgba(255,255,255,0.1)' }}>
                    {agents.reduce((sum, a) => sum + walkIns.filter(w => w.submitted_by === a.id).length, 0) || '—'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

        </div>
      )}
    </div>
  )
}
