import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { Spinner } from '../../components/UI'

const LEAD_SOURCES = [
  'Google', 'WhatsApp Calls', 'Call Centre', 'CHATBOT', 'WEBFORM',
  'Kerala Leads', 'Suvarna News', 'ROK Bus Campaign', 'Hordings Bus Shelters',
  'Website', 'JUSTDAIL', 'Zee Kannada', 'Call Back', 'OLD CRM',
  'BMTC Bus Campaign', 'Andhra Pradesh Calls', 'TV 9', 'Signage',
  'Hathway', 'Social Media', 'LED Boards', 'Colors Kannada', 'Public TV',
  'Vijaya Karnataka', 'Gnani', 'Social Media New', 'DEN Cable',
  'Newspaper', 'News 18'
]

const HEADERS = [
  'Customer Name', 'Phone', 'Alternate Phone', 'Gold Type', 'Grams', 'Branch Name',
  'Walk-in Date (YYYY-MM-DD)', 'Walk-in Type', 'Agent Name',
  'Lead Source', 'Walk-in Status', 'Status', 'Rejection Reason'
]

const SAMPLE_ROWS = [
  ['Ravi Kumar',  '9876543210', '9000000001', 'Physical', '10.5', 'Main Branch', '2025-11-15', 'tele_sales', 'Agent Name', 'Google',         'CM', 'completed', ''],
  ['Priya Nair',  '9123456789', '',           'Release',  '8.2',  'City Branch', '2025-10-20', 'direct',     '',           'WhatsApp Calls',  'PM', 'completed', ''],
  ['Suresh Babu', '9988776655', '',           'Physical', '15.0', 'Main Branch', '2025-09-10', 'tele_sales', 'Agent Name', 'Social Media',   'NL', 'completed', ''],
]

function toCSVLine(cols) {
  return cols.map(v => `"${(v ?? '').toString().replace(/"/g, '""')}"`).join(',')
}

function downloadTemplate() {
  const lines = [
    '# GoldTrack Walk-in Import Template',
    '# -----------------------------------------------',
    `# Gold Type       : Physical | Release`,
    `# Walk-in Type    : tele_sales | direct`,
    `# Walk-in Status  : NL | CM | PM`,
    `# Status          : completed | rejected | pending`,
    `# Lead Sources    : ${LEAD_SOURCES.join(' | ')}`,
    '# -----------------------------------------------',
    toCSVLine(HEADERS),
    ...SAMPLE_ROWS.map(toCSVLine),
  ]
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'walkin_import_template.csv'; a.click()
  URL.revokeObjectURL(url)
}

// Simple but robust CSV parser (handles quoted fields with commas inside)
function parseCSV(text) {
  const lines = text
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))

  if (lines.length < 2) return []

  return lines.slice(1).map(line => {
    const cols = []; let cur = '', inQ = false
    for (let i = 0; i < line.length; i++) {
      const c = line[i]
      if (c === '"') { inQ = !inQ }
      else if (c === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
      else { cur += c }
    }
    cols.push(cur.trim())
    return cols.map(c => c.replace(/^"|"$/g, ''))
  }).filter(cols => cols[0])
}

// ── Editable cell ─────────────────────────────────────────────────
function EditableCell({ rowIndex, field, editingCell, setEditingCell, getCellValue, setCellValue, errors }) {
  const isEditing  = editingCell?.rowIndex === rowIndex && editingCell?.field === field
  const hasError   = errors[rowIndex]?.[field]
  const currentVal = getCellValue(rowIndex, field)

  if (isEditing) {
    return (
      <input
        autoFocus
        value={currentVal}
        onChange={e => setCellValue(rowIndex, field, e.target.value)}
        onBlur={() => setEditingCell(null)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingCell(null) }}
        style={{
          width: '100%', padding: '3px 6px', fontSize: 12,
          border: `1px solid ${hasError ? 'var(--red)' : 'var(--gold)'}`,
          borderRadius: 4, outline: 'none',
          background: hasError ? 'var(--red-bg)' : '#FFFDE7',
          boxSizing: 'border-box',
        }}
      />
    )
  }

  return (
    <div
      onClick={() => setEditingCell({ rowIndex, field })}
      title="Click to edit"
      style={{
        padding: '3px 6px', cursor: 'text', borderRadius: 4,
        minHeight: 24, fontSize: 12,
        border: `1px solid ${hasError ? 'var(--red)' : 'transparent'}`,
        background: hasError ? 'rgba(220,53,69,0.06)' : 'transparent',
        transition: 'background 0.1s',
        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
      }}
      onMouseEnter={e => { if (!hasError) e.currentTarget.style.background = 'rgba(201,168,76,0.08)' }}
      onMouseLeave={e => { if (!hasError) e.currentTarget.style.background = 'transparent' }}
    >
      {currentVal !== '' && currentVal != null
        ? currentVal
        : <span style={{ color: 'var(--text3)', fontStyle: 'italic' }}>empty</span>}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function ImportData({ branches, agents, profile, toast }) {
  const fileInputRef             = useRef(null)
  const [previewRows, setPreviewRows] = useState([])
  const [editedRows,  setEditedRows]  = useState({})
  const [editingCell, setEditingCell] = useState(null)
  const [errors,      setErrors]      = useState({})
  const [importing,   setImporting]   = useState(false)
  const [result,      setResult]      = useState(null)

  // ── Cell value helpers ────────────────────────────────────────
  function getCellValue(rowIndex, field) {
    return editedRows[rowIndex]?.[field] ?? previewRows[rowIndex]?.[field] ?? ''
  }
  function setCellValue(rowIndex, field, value) {
    setEditedRows(prev => ({
      ...prev,
      [rowIndex]: { ...(prev[rowIndex] || {}), [field]: value },
    }))
  }

  // ── Delete a preview row ──────────────────────────────────────
  function deletePreviewRow(rowIndex) {
    setPreviewRows(prev => prev.filter((_, i) => i !== rowIndex))
    setEditedRows(prev => {
      const next = {}
      Object.entries(prev).forEach(([k, v]) => {
        const idx = parseInt(k)
        if (idx < rowIndex)  next[idx]     = v
        else if (idx > rowIndex) next[idx - 1] = v
      })
      return next
    })
  }

  // ── Cancel ───────────────────────────────────────────────────
  function handleCancel() {
    if (Object.keys(editedRows).length > 0) {
      if (!window.confirm('You have unsaved edits. Are you sure you want to cancel?')) return
    }
    setPreviewRows([])
    setEditedRows({})
    setEditingCell(null)
    setErrors({})
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── File upload ───────────────────────────────────────────────
  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setResult(null)
    setEditedRows({})
    setEditingCell(null)
    setErrors({})
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSV(ev.target.result)
      const mapped = rows.map((cols, i) => {
        const [
          customer_name, phone, alternate_phone, gold_type, grams, branch_name,
          visit_date, walk_in_type, agent_name, lead_source,
          walkin_status, status, rejection_reason
        ] = cols

        const branch = branches.find(b =>
          b.name.trim().toLowerCase() === (branch_name || '').trim().toLowerCase()
        )
        const agent = agents.find(a =>
          a.name.trim().toLowerCase() === (agent_name || '').trim().toLowerCase()
        )

        let error = null
        if (!customer_name) error = 'Missing customer name'
        else if (!phone) error = 'Missing phone'
        else if (!branch) error = `Branch "${branch_name}" not found`
        else if (!grams || isNaN(parseFloat(grams))) error = 'Invalid grams'
        else if (!visit_date || !/^\d{4}-\d{2}-\d{2}$/.test(visit_date)) error = 'Date must be YYYY-MM-DD'

        return {
          _row: i + 2, _error: error,
          customer_name, phone,
          alternate_phone: alternate_phone?.trim() || '',
          gold_type: gold_type || 'Physical',
          grams: grams || '',
          branch_name: branch_name || '', branch_id: branch?.id || null,
          visit_date: visit_date || '',
          walk_in_type: walk_in_type || '',
          agent_name: agent_name || '', assigned_agent_id: agent?.id || null,
          lead_source: lead_source || '',
          walkin_status: walkin_status || '',
          status: status || 'completed',
          rejection_reason: rejection_reason || '',
        }
      })
      setPreviewRows(mapped)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  // ── Import ────────────────────────────────────────────────────
  async function handleImport() {
    // Merge edits, re-resolve branch/agent, re-validate
    const finalRows = previewRows.map((row, index) => {
      const edited = editedRows[index] || {}
      const merged = { ...row, ...edited }

      const branch = branches.find(b =>
        b.name.trim().toLowerCase() === (merged.branch_name || '').trim().toLowerCase()
      )
      merged.branch_id = branch?.id || null

      const agent = agents.find(a =>
        a.name.trim().toLowerCase() === (merged.agent_name || '').trim().toLowerCase()
      )
      merged.assigned_agent_id = agent?.id || null

      // Re-validate after edits
      let error = null
      if (!merged.customer_name) error = 'Missing customer name'
      else if (!merged.phone) error = 'Missing phone'
      else if (!merged.branch_id) error = `Branch "${merged.branch_name}" not found`
      else if (!merged.grams || isNaN(parseFloat(merged.grams))) error = 'Invalid grams'
      else if (!merged.visit_date || !/^\d{4}-\d{2}-\d{2}$/.test(merged.visit_date)) error = 'Date must be YYYY-MM-DD'
      merged._error = error

      return merged
    })

    const valid = finalRows.filter(r => !r._error)
    if (!valid.length) { toast('No valid rows to import.', 'error'); return }

    setImporting(true)
    let success = 0, failed = 0
    const now = new Date().toISOString()

    for (let i = 0; i < valid.length; i += 50) {
      const chunk = valid.slice(i, i + 50).map(r => ({
        customer_name:     r.customer_name,
        phone:             r.phone,
        alternate_phone:   r.alternate_phone || null,
        gold_type:         r.gold_type,
        grams:             parseFloat(r.grams),
        branch_id:         r.branch_id,
        visit_date:        r.visit_date,
        walk_in_type:      r.walk_in_type || null,
        assigned_agent_id: r.assigned_agent_id || null,
        lead_source:       r.lead_source || null,
        walkin_status:     r.walkin_status || null,
        status:            r.status || 'completed',
        rejection_reason:  r.rejection_reason || null,
        submitted_by:      profile.id,
        approved_by:       profile.id,
        approved_at:       now,
      }))
      const { error } = await supabase.from('walk_ins').insert(chunk)
      if (error) { failed += chunk.length; toast(`Chunk error: ${error.message}`, 'error') }
      else success += chunk.length
    }

    setResult({ success, failed })
    setImporting(false)
    if (success > 0) {
      toast(`${success} records imported successfully!`, 'success')
      setPreviewRows([])
      setEditedRows({})
      setEditingCell(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const validCount  = previewRows.filter((r, i) => {
    const edited = editedRows[i] || {}
    const merged = { ...r, ...edited }
    // Quick check: if there's an original error but branch/grams/date might be fixed
    return !r._error || Object.keys(edited).length > 0
  }).length
  const errorCount  = previewRows.filter(r => r._error).length
  const editedCount = Object.keys(editedRows).length

  // Fields shown as editable columns (label → field key)
  const COLS = [
    { label: 'Customer',    field: 'customer_name' },
    { label: 'Phone',       field: 'phone' },
    { label: 'Alt Phone',   field: 'alternate_phone' },
    { label: 'Gold Type',   field: 'gold_type' },
    { label: 'Grams',       field: 'grams' },
    { label: 'Branch',      field: 'branch_name' },
    { label: 'Date',        field: 'visit_date' },
    { label: 'Type',        field: 'walk_in_type' },
    { label: 'Agent',       field: 'agent_name' },
    { label: 'Lead Source', field: 'lead_source' },
    { label: 'W-Status',    field: 'walkin_status' },
    { label: 'Status',      field: 'status' },
  ]

  return (
    <div>
      {/* Instructions card */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">📥 Import Historical Walk-in Data</div>
            <div className="card-subtitle">Bulk upload past records — up to 6 months of data</div>
          </div>
          <button className="btn btn-outline" onClick={downloadTemplate}>⬇ Download Template</button>
        </div>
        <div style={{ background: 'var(--surface2)', borderRadius: 'var(--radius-sm)', padding: '14px 16px', fontSize: 13, marginBottom: 16 }}>
          <strong style={{ display: 'block', marginBottom: 8 }}>How to use:</strong>
          <ol style={{ paddingLeft: 20, color: 'var(--text2)', lineHeight: 2 }}>
            <li>Click <strong>Download Template</strong> — open in Excel or Google Sheets</li>
            <li>Fill in your historical data (delete the 3 sample rows first)</li>
            <li>Save / Export as <strong>CSV (.csv)</strong></li>
            <li>Upload below — preview will show before anything is saved</li>
            <li>Click any cell to edit inline, then click <strong>Import</strong></li>
          </ol>
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
            {[
              ['Gold Type', 'Physical · Release'],
              ['Walk-in Type', 'tele_sales · direct'],
              ['Walk-in Status', 'NL · CM · PM'],
              ['Status', 'completed · rejected · pending'],
              ['Walk-in Date', 'YYYY-MM-DD  e.g. 2025-11-20'],
            ].map(([k, v]) => (
              <span key={k} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 10px' }}>
                <strong>{k}:</strong> {v}
              </span>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Upload CSV File</label>
          <input
            ref={fileInputRef}
            type="file" accept=".csv,.txt" onChange={handleFile}
            style={{ padding: '8px 0', fontSize: 13 }}
          />
        </div>
      </div>

      {/* Preview */}
      {previewRows.length > 0 && (
        <div className="card">

          {/* ── Header bar ── */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 12, padding: '10px 14px',
            background: 'var(--surface2)', borderRadius: 8, border: '1px solid var(--border)',
          }}>
            <div>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Preview</span>
              <span style={{ fontSize: 12, color: 'var(--text3)', marginLeft: 8 }}>
                {previewRows.length} rows
                {editedCount > 0 && <> · <span style={{ color: 'var(--gold)', fontWeight: 600 }}>{editedCount} edited</span></>}
                {errorCount > 0 && <> · <span style={{ color: 'var(--red)', fontWeight: 600 }}>{errorCount} errors</span></>}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-primary btn-sm" onClick={handleImport}
                disabled={importing || previewRows.length === 0}>
                {importing
                  ? <><Spinner dark /> Importing…</>
                  : `📥 Import ${previewRows.length} rows`}
              </button>
              <button className="btn btn-danger btn-sm" onClick={handleCancel}>
                ✕ Cancel
              </button>
            </div>
          </div>

          {/* ── Edit hint ── */}
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 10 }}>
            💡 Click any cell to edit · Press Enter or Escape to confirm · Click ✕ on a row to remove it
          </div>

          <div className="table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ width: 36 }}>#</th>
                  {COLS.map(c => <th key={c.field}>{c.label}</th>)}
                  <th style={{ width: 44 }}>Issue</th>
                  <th style={{ width: 36 }}></th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((r, rowIndex) => (
                  <tr key={rowIndex} style={{
                    borderBottom: '1px solid var(--border)',
                    background: r._error
                      ? 'var(--red-bg)'
                      : editedRows[rowIndex]
                        ? 'rgba(201,168,76,0.05)'
                        : 'transparent',
                  }}>
                    {/* Row number + edited dot */}
                    <td style={{ padding: '6px 8px', fontSize: 11, color: 'var(--text3)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {rowIndex + 1}
                      {editedRows[rowIndex] && (
                        <span title="Row edited" style={{
                          display: 'inline-block', width: 6, height: 6,
                          background: 'var(--gold)', borderRadius: '50%',
                          marginLeft: 4, verticalAlign: 'middle',
                        }} />
                      )}
                    </td>

                    {/* Editable cells */}
                    {COLS.map(c => (
                      <td key={c.field} style={{ padding: '2px 4px', maxWidth: 120 }}>
                        <EditableCell
                          rowIndex={rowIndex}
                          field={c.field}
                          editingCell={editingCell}
                          setEditingCell={setEditingCell}
                          getCellValue={getCellValue}
                          setCellValue={setCellValue}
                          errors={errors}
                        />
                      </td>
                    ))}

                    {/* Error */}
                    <td style={{ fontSize: 10, color: 'var(--red)', padding: '4px 6px', whiteSpace: 'nowrap' }}>
                      {r._error || ''}
                    </td>

                    {/* Delete row */}
                    <td style={{ padding: '4px 6px', textAlign: 'center' }}>
                      <button
                        title="Remove this row"
                        onClick={() => deletePreviewRow(rowIndex)}
                        style={{
                          fontSize: 11, padding: '2px 7px', cursor: 'pointer',
                          color: 'var(--red)', background: 'rgba(220,53,69,0.08)',
                          border: '1px solid rgba(220,53,69,0.25)', borderRadius: 4,
                          lineHeight: 1.4,
                        }}>
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className={`alert ${result.failed ? 'alert-error' : 'alert-success'}`} style={{ marginTop: 0 }}>
          {result.success > 0 && `✅ ${result.success} records imported successfully.`}
          {result.failed > 0 && ` ⚠ ${result.failed} records failed — check constraints.`}
        </div>
      )}
    </div>
  )
}
