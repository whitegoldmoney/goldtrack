import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const PAGE_SIZE = 50

export default function AuditLog({ profile }) {
  const [rows, setRows]         = useState([])
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [tableFilter, setTableFilter]   = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')
  const [page, setPage]         = useState(0)
  const [total, setTotal]       = useState(0)
  const [expanded, setExpanded] = useState({})

  async function load() {
    setLoading(true)
    let q = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    if (actionFilter) q = q.eq('action', actionFilter)
    if (tableFilter)  q = q.eq('table_name', tableFilter)
    if (dateFrom)     q = q.gte('created_at', dateFrom)
    if (dateTo)       q = q.lte('created_at', dateTo + 'T23:59:59')
    if (search)       q = q.ilike('performed_by_name', `%${search}%`)

    const { data, count } = await q
    setRows(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  useEffect(() => { load() }, [page, actionFilter, tableFilter, dateFrom, dateTo])

  function handleSearch(e) {
    e.preventDefault()
    setPage(0)
    load()
  }

  function toggleExpand(id) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }))
  }

  function formatDate(ts) {
    if (!ts) return '—'
    const d = new Date(ts)
    return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function actionBadge(action) {
    const colors = {
      INSERT: { background: '#E8F5E9', color: '#2E7D32', border: '#A5D6A7' },
      UPDATE: { background: '#FFF8E1', color: '#F57F17', border: '#FFE082' },
      DELETE: { background: '#FFEBEE', color: '#C62828', border: '#EF9A9A' },
    }
    const s = colors[action] || { background: '#F5F5F5', color: '#616161', border: '#E0E0E0' }
    return (
      <span style={{
        fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
        border: `1px solid ${s.border}`, background: s.background, color: s.color,
      }}>
        {action}
      </span>
    )
  }

  function renderDiff(row) {
    const oldVal = row.old_values || {}
    const newVal = row.new_values || {}
    const keys   = Array.from(new Set([...Object.keys(oldVal), ...Object.keys(newVal)]))
    if (keys.length === 0) return <span style={{ color: 'var(--text3)', fontSize: 12 }}>No data</span>

    const changed = keys.filter(k => JSON.stringify(oldVal[k]) !== JSON.stringify(newVal[k]))
    const display = changed.length > 0 ? changed : keys

    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
        <thead>
          <tr>
            <th style={{ padding: '4px 8px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600, width: '25%' }}>Field</th>
            {row.action !== 'INSERT' && <th style={{ padding: '4px 8px', textAlign: 'left', color: '#C62828', fontWeight: 600 }}>Old</th>}
            {row.action !== 'DELETE' && <th style={{ padding: '4px 8px', textAlign: 'left', color: '#2E7D32', fontWeight: 600 }}>New</th>}
          </tr>
        </thead>
        <tbody>
          {display.map(k => (
            <tr key={k} style={{ borderTop: '1px solid var(--border)' }}>
              <td style={{ padding: '4px 8px', fontWeight: 600, color: 'var(--text2)' }}>{k}</td>
              {row.action !== 'INSERT' && (
                <td style={{ padding: '4px 8px', color: '#C62828', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {oldVal[k] !== undefined ? String(oldVal[k]) : '—'}
                </td>
              )}
              {row.action !== 'DELETE' && (
                <td style={{ padding: '4px 8px', color: '#2E7D32', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                  {newVal[k] !== undefined ? String(newVal[k]) : '—'}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Audit Log</h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
            All system actions tracked in chronological order
          </p>
        </div>
        <span style={{ fontSize: 13, color: 'var(--text3)' }}>
          {total.toLocaleString()} record{total !== 1 ? 's' : ''}
        </span>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16, alignItems: 'flex-end' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            placeholder="Search by user…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ width: 180, fontSize: 13 }}
          />
          <button type="submit" className="btn btn-dark" style={{ padding: '7px 14px', fontSize: 13 }}>
            Search
          </button>
        </form>

        <select
          value={actionFilter}
          onChange={e => { setActionFilter(e.target.value); setPage(0) }}
          style={{ fontSize: 13, width: 130 }}
        >
          <option value="">All Actions</option>
          <option value="INSERT">INSERT</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>

        <select
          value={tableFilter}
          onChange={e => { setTableFilter(e.target.value); setPage(0) }}
          style={{ fontSize: 13, width: 150 }}
        >
          <option value="">All Tables</option>
          <option value="walk_ins">walk_ins</option>
          <option value="profiles">profiles</option>
          <option value="nudges">nudges</option>
        </select>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text3)' }}>From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={e => { setDateFrom(e.target.value); setPage(0) }}
            style={{ fontSize: 13, width: 140 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--text3)' }}>To</label>
          <input
            type="date"
            value={dateTo}
            onChange={e => { setDateTo(e.target.value); setPage(0) }}
            style={{ fontSize: 13, width: 140 }}
          />
        </div>

        {(search || actionFilter || tableFilter || dateFrom || dateTo) && (
          <button
            className="btn btn-outline btn-sm"
            onClick={() => {
              setSearch(''); setActionFilter(''); setTableFilter('')
              setDateFrom(''); setDateTo(''); setPage(0)
            }}
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Table ── */}
      <div style={{ background: 'var(--white)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>No records found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
            <colgroup>
              <col style={{ width: '5%' }} />
              <col style={{ width: '16%' }} />
              <col style={{ width: '10%' }} />
              <col style={{ width: '14%' }} />
              <col style={{ width: '18%' }} />
              <col style={{ width: '28%' }} />
              <col style={{ width: '9%' }} />
            </colgroup>
            <thead>
              <tr style={{ background: 'var(--surface)', borderBottom: '2px solid var(--border)' }}>
                <th style={{ fontSize: 11, padding: '9px 10px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600 }}>#</th>
                <th style={{ fontSize: 11, padding: '9px 10px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600 }}>Timestamp</th>
                <th style={{ fontSize: 11, padding: '9px 10px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600 }}>Action</th>
                <th style={{ fontSize: 11, padding: '9px 10px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600 }}>Table</th>
                <th style={{ fontSize: 11, padding: '9px 10px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600 }}>Performed By</th>
                <th style={{ fontSize: 11, padding: '9px 10px', textAlign: 'left', color: 'var(--text3)', fontWeight: 600 }}>Record / Summary</th>
                <th style={{ fontSize: 11, padding: '9px 10px', textAlign: 'center', color: 'var(--text3)', fontWeight: 600 }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <>
                  <tr
                    key={row.id}
                    style={{ borderBottom: '1px solid var(--border)', background: expanded[row.id] ? 'var(--surface)' : 'transparent' }}
                  >
                    <td style={{ fontSize: 11, padding: '8px 10px', color: 'var(--text3)' }}>
                      {page * PAGE_SIZE + i + 1}
                    </td>
                    <td style={{ fontSize: 12, padding: '8px 10px', color: 'var(--text2)' }}>
                      {formatDate(row.created_at)}
                    </td>
                    <td style={{ fontSize: 12, padding: '8px 10px' }}>
                      {actionBadge(row.action)}
                    </td>
                    <td style={{ fontSize: 12, padding: '8px 10px', fontFamily: 'monospace', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.table_name}
                    </td>
                    <td style={{ fontSize: 12, padding: '8px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.performed_by_name || <span style={{ color: 'var(--text3)' }}>System</span>}
                    </td>
                    <td style={{ fontSize: 12, padding: '8px 10px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text2)' }}>
                      {row.record_id
                        ? <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{row.record_id}</span>
                        : '—'}
                      {row.summary && <span style={{ marginLeft: 6, color: 'var(--text3)' }}>{row.summary}</span>}
                    </td>
                    <td style={{ fontSize: 12, padding: '8px 10px', textAlign: 'center' }}>
                      <button
                        onClick={() => toggleExpand(row.id)}
                        style={{
                          fontSize: 11, padding: '3px 10px', borderRadius: 4,
                          border: '1px solid var(--border)', background: 'transparent',
                          cursor: 'pointer', color: 'var(--text2)',
                        }}
                      >
                        {expanded[row.id] ? 'Hide ▲' : 'Show ▼'}
                      </button>
                    </td>
                  </tr>
                  {expanded[row.id] && (
                    <tr key={`${row.id}-detail`} style={{ background: '#FAFAFA', borderBottom: '1px solid var(--border)' }}>
                      <td colSpan={7} style={{ padding: '12px 16px' }}>
                        {renderDiff(row)}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          <span style={{ fontSize: 13, color: 'var(--text3)' }}>
            Page {page + 1} of {totalPages}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              className="btn btn-outline btn-sm"
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
            >
              ← Prev
            </button>
            <button
              className="btn btn-outline btn-sm"
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
