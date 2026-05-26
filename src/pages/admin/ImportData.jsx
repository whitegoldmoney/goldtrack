import { useState } from 'react'
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
  'Customer Name', 'Phone', 'Gold Type', 'Grams', 'Branch Name',
  'Visit Date (YYYY-MM-DD)', 'Walk-in Type', 'Agent Name',
  'Lead Source', 'Walk-in Status', 'Status', 'Rejection Reason'
]

const SAMPLE_ROWS = [
  ['Ravi Kumar',  '9876543210', 'Physical', '10.5', 'Main Branch', '2025-11-15', 'tele_sales', 'Agent Name', 'Google',         'CM', 'completed', ''],
  ['Priya Nair',  '9123456789', 'Release',  '8.2',  'City Branch', '2025-10-20', 'direct',     '',           'WhatsApp Calls',  'PM', 'completed', ''],
  ['Suresh Babu', '9988776655', 'Physical', '15.0', 'Main Branch', '2025-09-10', 'tele_sales', 'Agent Name', 'Social Media',   'NL', 'completed', ''],
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
  }).filter(cols => cols[0]) // skip blank rows
}

export default function ImportData({ branches, agents, profile, toast }) {
  const [preview, setPreview] = useState(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState(null)

  function handleFile(e) {
    const file = e.target.files[0]
    if (!file) return
    setResult(null)
    const reader = new FileReader()
    reader.onload = ev => {
      const rows = parseCSV(ev.target.result)
      const mapped = rows.map((cols, i) => {
        const [
          customer_name, phone, gold_type, grams, branch_name,
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
          gold_type: gold_type || 'Physical',
          grams: parseFloat(grams) || 0,
          branch_name, branch_id: branch?.id || null,
          visit_date,
          walk_in_type: walk_in_type || null,
          agent_name, assigned_agent_id: agent?.id || null,
          lead_source: lead_source || null,
          walkin_status: walkin_status || null,
          status: status || 'completed',
          rejection_reason: rejection_reason || null,
        }
      })
      setPreview(mapped)
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  async function handleImport() {
    const valid = preview.filter(r => !r._error)
    if (!valid.length) { toast('No valid rows to import.', 'error'); return }
    setImporting(true)
    let success = 0, failed = 0
    const now = new Date().toISOString()

    // Insert in chunks of 50
    for (let i = 0; i < valid.length; i += 50) {
      const chunk = valid.slice(i, i + 50).map(r => ({
        customer_name:    r.customer_name,
        phone:            r.phone,
        gold_type:        r.gold_type,
        grams:            r.grams,
        branch_id:        r.branch_id,
        visit_date:       r.visit_date,
        walk_in_type:     r.walk_in_type,
        assigned_agent_id:r.assigned_agent_id,
        lead_source:      r.lead_source,
        walkin_status:    r.walkin_status,
        status:           r.status,
        rejection_reason: r.rejection_reason,
        submitted_by:     profile.id,
        approved_by:      profile.id,
        approved_at:      now,
      }))
      const { error } = await supabase.from('walk_ins').insert(chunk)
      if (error) { failed += chunk.length; toast(`Chunk error: ${error.message}`, 'error') }
      else success += chunk.length
    }

    setResult({ success, failed })
    setImporting(false)
    if (success > 0) {
      toast(`${success} records imported successfully!`, 'success')
      setPreview(null)
    }
  }

  const validCount = preview?.filter(r => !r._error).length ?? 0
  const errorCount = preview?.filter(r => r._error).length ?? 0

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
            <li>Fix any highlighted errors, then click <strong>Import</strong></li>
          </ol>
          <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8, fontSize: 12 }}>
            {[
              ['Gold Type', 'Physical · Release'],
              ['Walk-in Type', 'tele_sales · direct'],
              ['Walk-in Status', 'NL · CM · PM'],
              ['Status', 'completed · rejected · pending'],
              ['Visit Date', 'YYYY-MM-DD  e.g. 2025-11-20'],
            ].map(([k, v]) => (
              <span key={k} style={{ background: 'var(--white)', border: '1px solid var(--border)', borderRadius: 4, padding: '3px 10px' }}>
                <strong>{k}:</strong> {v}
              </span>
            ))}
          </div>
        </div>
        <div className="form-group">
          <label>Upload CSV File</label>
          <input type="file" accept=".csv,.txt" onChange={handleFile}
            style={{ padding: '8px 0', fontSize: 13 }} />
        </div>
      </div>

      {/* Preview */}
      {preview && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Preview — {preview.length} rows detected</div>
              <div className="card-subtitle" style={{ display: 'flex', gap: 16 }}>
                <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓ {validCount} ready to import</span>
                {errorCount > 0 && <span style={{ color: 'var(--red)', fontWeight: 600 }}>✗ {errorCount} errors (will be skipped)</span>}
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleImport}
              disabled={importing || validCount === 0}>
              {importing
                ? <><Spinner dark /> Importing…</>
                : `⬆ Import ${validCount} Records`}
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr>
                <th>#</th><th>Customer</th><th>Phone</th><th>Gold</th><th>Grams</th>
                <th>Branch</th><th>Date</th><th>Type</th><th>Agent</th>
                <th>Lead Source</th><th>W-Status</th><th>Status</th><th>Issue</th>
              </tr></thead>
              <tbody>
                {preview.map(r => (
                  <tr key={r._row} style={{ background: r._error ? 'var(--red-bg)' : undefined }}>
                    <td style={{ fontSize: 11, color: 'var(--text3)' }}>{r._row}</td>
                    <td className="td-name">{r.customer_name}</td>
                    <td className="td-phone">{r.phone}</td>
                    <td style={{ fontSize: 12 }}>{r.gold_type}</td>
                    <td style={{ fontSize: 12 }}>{r.grams}g</td>
                    <td style={{ fontSize: 12, color: r.branch_id ? 'inherit' : 'var(--red)', fontWeight: r.branch_id ? 'normal' : 600 }}>{r.branch_name}</td>
                    <td style={{ fontSize: 12 }}>{r.visit_date}</td>
                    <td style={{ fontSize: 12 }}>{r.walk_in_type || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.agent_name || '—'}</td>
                    <td style={{ fontSize: 11 }}>{r.lead_source || '—'}</td>
                    <td style={{ fontSize: 12, fontWeight: 600, color: 'var(--blue)' }}>{r.walkin_status || '—'}</td>
                    <td style={{ fontSize: 12 }}>{r.status}</td>
                    <td style={{ fontSize: 11, color: 'var(--red)' }}>{r._error || ''}</td>
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
