import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Empty, Loading, Spinner } from '../../components/UI'

const srcLabel = { today: "Today's Lead", this_month: "This Month", previous_month: "Previous Month" }

export default function MyLeads({ profile, branches, toast }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState({})
  const [sources, setSources] = useState({})

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('walk_ins').select('*')
      .eq('assigned_agent_id', profile.id).eq('status', 'assigned')
      .order('created_at', { ascending: false })
    setRows(data || []); setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function lockLead(id) {
    if (!sources[id]) { toast('Select a lead source first.', 'error'); return }
    setSaving(s => ({ ...s, [id]: true }))
    const { error } = await supabase.from('walk_ins')
      .update({ lead_source: sources[id], status: 'completed' })
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
      {rows.map(r => (
        <div key={r.id} className="approval-card" style={{ borderLeftColor: 'var(--blue)' }}>
          <div className="approval-card-info">
            <div className="approval-card-field"><label>Customer</label><p>{r.customer_name}</p></div>
            <div className="approval-card-field"><label>Phone</label><p style={{ fontFamily: 'DM Mono', fontSize: 13 }}>{r.phone}</p></div>
            <div className="approval-card-field"><label>Gold / Grams</label><p>{r.gold_type} · {r.grams}g</p></div>
            <div className="approval-card-field"><label>Branch</label><p>{branchName(r.branch_id)}</p></div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '.04em', display: 'block', marginBottom: 8 }}>
              Lead Source *
            </label>
            <div className="lead-source-options">
              {['today', 'this_month', 'previous_month'].map(s => (
                <button key={s} className={`lead-source-btn ${sources[r.id] === s ? 'selected' : ''}`}
                  onClick={() => setSources(sv => ({ ...sv, [r.id]: s }))}>
                  {srcLabel[s]}
                </button>
              ))}
            </div>
          </div>
          <button className="btn btn-success" onClick={() => lockLead(r.id)} disabled={saving[r.id]}>
            {saving[r.id] ? <><Spinner /> Saving…</> : '🔒 Lock & Save'}
          </button>
        </div>
      ))}
    </div>
  )
}
