import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { parseWhatsApp } from '../../lib/utils'
import { Spinner } from '../../components/UI'

export default function NewWalkIn({ profile, branches, toast, onDraftSaved }) {
  const [paste, setPaste] = useState('')
  const [form, setForm] = useState({
    customer_name: '', phone: '', gold_type: 'Physical', grams: '',
    branch_id: '', visit_date: new Date().toISOString().split('T')[0]
  })
  const [loading, setLoading] = useState(false)
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [parsed, setParsed] = useState(false)

  function handleParse() {
    const result = parseWhatsApp(paste)
    if (!result) { toast('Could not parse. Format: Name, Phone, Gold Type, Grams', 'error'); return }
    setForm(f => ({ ...f, ...result }))
    setParsed(true)
    toast('Parsed! Review and submit.', 'success')
  }

  async function handleHold() {
    const { customer_name, phone, gold_type, grams, branch_id, visit_date } = form
    if (!customer_name || !phone || !grams || !branch_id || !visit_date) {
      toast('Fill all required fields before saving as draft.', 'error'); return
    }
    setLoadingDraft(true)
    try {
      const { error } = await supabase.from('walk_ins').insert({
        customer_name: customer_name.trim(), phone: phone.trim(),
        gold_type, grams: parseFloat(grams), branch_id: parseInt(branch_id),
        visit_date, submitted_by: profile.id, status: 'draft'
      })
      if (error) throw error
      toast('Draft saved! Find it in "My Drafts" tab.', 'success')
      setForm({ customer_name: '', phone: '', gold_type: 'Physical', grams: '', branch_id: '', visit_date: new Date().toISOString().split('T')[0] })
      setPaste(''); setParsed(false)
      onDraftSaved?.()
    } catch (e) { toast(e.message, 'error') }
    finally { setLoadingDraft(false) }
  }

  async function handleSubmit() {
    const { customer_name, phone, gold_type, grams, branch_id, visit_date } = form
    if (!customer_name || !phone || !grams || !branch_id || !visit_date) {
      toast('Fill all required fields.', 'error'); return
    }
    setLoading(true)
    try {
      const { error } = await supabase.from('walk_ins').insert({
        customer_name: customer_name.trim(), phone: phone.trim(),
        gold_type, grams: parseFloat(grams), branch_id: parseInt(branch_id),
        visit_date, submitted_by: profile.id, status: 'pending'
      })
      if (error) throw error
      toast('Walk-in submitted! Awaiting TL approval.', 'success')
      setForm({ customer_name: '', phone: '', gold_type: 'Physical', grams: '', branch_id: '', visit_date: new Date().toISOString().split('T')[0] })
      setPaste(''); setParsed(false)
    } catch (e) { toast(e.message, 'error') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">📋 Smart Paste from WhatsApp</div>
            <div className="card-subtitle">Paste the message and auto-fill the form below</div>
          </div>
        </div>
        <div className="form-group">
          <label>WhatsApp Message</label>
          <textarea value={paste} onChange={e => setPaste(e.target.value)}
            placeholder="Ravi Kumar, 9876543210, Physical, 10.5g" />
          <span className="form-hint">Format: Customer Name, Phone, Gold Type (Physical/Release), Grams</span>
        </div>
        <button className="btn btn-outline" style={{ marginTop: 8 }} onClick={handleParse} disabled={!paste.trim()}>
          ⚡ Auto-Parse
        </button>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">
            Walk-in Details
            {parsed && <span style={{ color: 'var(--green)', fontSize: 12, fontWeight: 500, marginLeft: 8 }}>✓ Auto-filled</span>}
          </div>
        </div>
        <div className="form-grid">
          <div className="form-group">
            <label>Customer Name *</label>
            <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Full name" />
          </div>
          <div className="form-group">
            <label>Phone Number *</label>
            <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="10-digit" maxLength={10} />
          </div>
          <div className="form-group">
            <label>Gold Type *</label>
            <select value={form.gold_type} onChange={e => setForm(f => ({ ...f, gold_type: e.target.value }))}>
              <option value="Physical">Physical</option>
              <option value="Release">Release</option>
            </select>
          </div>
          <div className="form-group">
            <label>Grams *</label>
            <input type="number" step="0.1" value={form.grams} onChange={e => setForm(f => ({ ...f, grams: e.target.value }))} placeholder="e.g. 10.5" />
          </div>
          <div className="form-group">
            <label>Branch *</label>
            <select value={form.branch_id} onChange={e => setForm(f => ({ ...f, branch_id: e.target.value }))}>
              <option value="">— Select Branch —</option>
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label>Walk-in Date *</label>
            <input type="date" value={form.visit_date} onChange={e => setForm(f => ({ ...f, visit_date: e.target.value }))} />
          </div>
        </div>
        <hr className="section-sep" />
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={handleSubmit} disabled={loading || loadingDraft}>
            {loading ? <><Spinner dark /> Submitting…</> : '🚀 Submit Walk-in'}
          </button>
          <button className="btn btn-amber" onClick={handleHold} disabled={loading || loadingDraft}>
            {loadingDraft ? <><Spinner /> Saving…</> : '🕐 Hold'}
          </button>
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>Hold saves a draft — not sent to TL yet</span>
        </div>
      </div>
    </div>
  )
}
