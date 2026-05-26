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

export default function MyLeads({ profile, branches, toast }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [form, setForm] = useState({}) // { [id]: { lead_source, walkin_status, pm_date } }

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('walk_ins').select('*')
      .eq('assigned_agent_id', profile.id).eq('status', 'assigned')
      .order('created_at', { ascending: false })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  function setF(id, key, val) {
    setForm(f => ({ ...f, [id]: { ...(f[id] || {}), [key]: val } }))
  }

  async function lockLead(id) {
    const f = form[id] || {}
    if (!f.lead_source) { toast('Select a lead source.', 'error'); return }
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
      {rows.map(r => {
        const f = form[r.id] || {}
        return (
          <div key={r.id} className="approval-card" style={{ borderLeftColor: 'var(--blue)' }}>
            <div className="approval-card-info">
              <div className="approval-card-field"><label>Customer</label><p>{r.customer_name}</p></div>
              <div className="approval-card-field"><label>Phone</label><p style={{ fontFamily: 'DM Mono', fontSize: 13 }}>{r.phone}</p></div>
              <div className="approval-card-field"><label>Gold / Grams</label><p>{r.gold_type} · {r.grams}g</p></div>
              <div className="approval-card-field"><label>Branch</label><p>{branchName(r.branch_id)}</p></div>
            </div>
            <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
              <div className="form-group" style={{ flex: 2, minWidth: 200 }}>
                <label>Lead Source *</label>
                <select value={f.lead_source || ''} onChange={e => setF(r.id, 'lead_source', e.target.value)}>
                  <option value="">— Select Source —</option>
                  {LEAD_SOURCES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                <label>Walk-in Status *</label>
                <select value={f.walkin_status || ''} onChange={e => setF(r.id, 'walkin_status', e.target.value)}>
                  <option value="">— Select —</option>
                  {WALKIN_STATUS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              {f.walkin_status === 'PM' && (
                <div className="form-group" style={{ flex: 1, minWidth: 160 }}>
                  <label>Actual Walk-in Date *</label>
                  <input
                    type="date"
                    value={f.pm_date || ''}
                    max={today}
                    onChange={e => setF(r.id, 'pm_date', e.target.value)}
                  />
                  <span className="form-hint">Select the actual date of the walk-in</span>
                </div>
              )}
            </div>
            <button className="btn btn-success" onClick={() => lockLead(r.id)} disabled={saving[r.id]}>
              {saving[r.id] ? <><Spinner /> Saving…</> : '🔒 Lock & Save'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
