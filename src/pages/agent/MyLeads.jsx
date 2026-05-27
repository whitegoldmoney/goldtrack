import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Empty, Loading, Spinner } from '../../components/UI'

const LEAD_SOURCES = [
  'Google', 'WhatsApp Calls', 'Call Centre', 'CHATBOT', 'WEBFORM',
  'Kerala Leads', 'Suvarna News', 'ROK Bus Campaign', 'Hordings Bus Shelters',
  'Website', 'JUSTDAIL', 'Zee Kannada', 'Call Back', 'OLD CRM',
  'BMTC Bus Campaign', 'Andhra Pradesh Calls', 'TV 9', 'Signage',
  'Hathway', 'Social Media', 'LED Boards', 'Colors Kannada', 'Public TV',
  'Vijaya Karnataka', 'Gnani', 'Social Media New', 'DEN Cable',
  'Newspaper', 'News 18'
]

const WALKIN_STATUS = [
  { value: 'NL', label: 'NL — New Lead' },
  { value: 'CM', label: 'CM — Current Month' },
  { value: 'PM', label: 'PM — Previous Month' },
]


const today = new Date().toISOString().split('T')[0]

const fieldLabel = {
  fontSize: 10, fontWeight: 600, color: 'var(--text3)',
  textTransform: 'uppercase', letterSpacing: '.04em',
  display: 'block', marginBottom: 4
}
const fieldSelect = {
  width: '100%', fontSize: 13, padding: '8px 12px',
  borderRadius: 6, border: '1px solid var(--border2)',
  background: 'var(--white)', color: 'var(--text)',
  fontFamily: 'inherit'
}

export default function MyLeads({ profile, branches, toast }) {
  const [rows, setRows]   = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState({})
  const [form, setForm]   = useState({})

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('walk_ins').select('*')
      .eq('assigned_agent_id', profile.id).eq('status', 'assigned')
      .order('created_at', { ascending: false })
    setRows(data || [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  function setF(id, key, val) {
    setForm(f => ({ ...f, [id]: { ...(f[id] || {}), [key]: val } }))
  }

  async function lockLead(id) {
    const f = form[id] || {}
    if (!f.lead_source)   { toast('Select a lead source.', 'error'); return }
    if (!f.walkin_status) { toast('Select a walk-in status.', 'error'); return }
    if (f.walkin_status === 'PM' && !f.pm_date) { toast('Select the walk-in date for Previous Month.', 'error'); return }
    setSaving(s => ({ ...s, [id]: true }))
    const updates = {
      lead_source: f.lead_source,
      walkin_status: f.walkin_status,
      status: 'completed',
      ...(f.walkin_status === 'PM' && f.pm_date ? { visit_date: f.pm_date } : {})
    }
    const { error } = await supabase.from('walk_ins')
      .update(updates)
      .eq('id', id).eq('assigned_agent_id', profile.id).eq('status', 'assigned')
    if (error) toast(error.message, 'error')
    else { toast('Lead locked and saved!', 'success'); load() }
    setSaving(s => ({ ...s, [id]: false }))
  }

  const branchName = id => (branches.find(b => b.id === id) || {}).name || '—'

  if (loading) return <Loading />
  if (!rows.length) return <Empty icon="🎯" text="No leads assigned to you yet." />

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
        <strong>{rows.length}</strong> lead{rows.length !== 1 ? 's' : ''} assigned to you
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, alignItems: 'start' }}>
        {rows.map(r => {
          const f = form[r.id] || {}
          return (
            <div key={r.id} className="sticky-card">

              {/* ── Customer info ── */}
              <div className="sticky-card-name">{r.customer_name}</div>

              <div className="sticky-card-row">
                <span>📞</span>
                <span style={{ fontFamily: 'DM Mono' }}>{r.phone}</span>
              </div>

              {r.alternate_phone && (
                <div className="sticky-card-row">
                  <span>📱</span>
                  <span style={{ fontFamily: 'DM Mono' }}>{r.alternate_phone}</span>
                </div>
              )}

              <div className="sticky-card-row">
                <span>🏦</span>
                <span>{branchName(r.branch_id)}</span>
              </div>

              <div className="sticky-card-row" style={{ marginBottom: 12 }}>
                <span>⚖️</span>
                <span>{r.gold_type} · {r.grams}g</span>
              </div>

              {/* ── Lead Source ── */}
              <div style={{ marginBottom: 10 }}>
                <label style={fieldLabel}>Lead Source *</label>
                <select style={fieldSelect} value={f.lead_source || ''} onChange={e => setF(r.id, 'lead_source', e.target.value)}>
                  <option value="">— Select Source —</option>
                  {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>

              {/* ── Walk-in Status ── */}
              <div style={{ marginBottom: 10 }}>
                <label style={fieldLabel}>Walk-in Status *</label>
                <select style={fieldSelect} value={f.walkin_status || ''} onChange={e => setF(r.id, 'walkin_status', e.target.value)}>
                  <option value="">— Select —</option>
                  {WALKIN_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>

              {/* ── PM date picker ── */}
              {f.walkin_status === 'PM' && (
                <div style={{ marginBottom: 10 }}>
                  <label style={fieldLabel}>Actual Walk-in Date *</label>
                  <input
                    type="date"
                    max={today}
                    value={f.pm_date || ''}
                    onChange={e => setF(r.id, 'pm_date', e.target.value)}
                    style={{ ...fieldSelect }}
                  />
                  <span className="form-hint" style={{ fontSize: 10, marginTop: 3, display: 'block' }}>Select the actual date of the walk-in</span>
                </div>
              )}


              {/* ── Lock & Save ── */}
              <button
                className="btn btn-success"
                style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                onClick={() => lockLead(r.id)}
                disabled={saving[r.id]}
              >
                {saving[r.id] ? <><Spinner /> Saving…</> : '🔒 Lock & Save'}
              </button>

            </div>
          )
        })}
      </div>
    </div>
  )
}
