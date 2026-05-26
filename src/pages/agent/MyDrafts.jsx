import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fmt } from '../../lib/utils'
import { Empty, Loading, Spinner } from '../../components/UI'

export default function MyDrafts({ profile, branches, toast, onCountChange }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState({})
  const [deleting, setDeleting] = useState({})

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('walk_ins').select('*')
      .eq('submitted_by', profile.id).eq('status', 'draft')
      .order('created_at', { ascending: false })
    const list = data || []
    setRows(list)
    setLoading(false)
    onCountChange?.(list.length)
  }

  useEffect(() => { load() }, [])

  async function submitToTL(id) {
    setSubmitting(s => ({ ...s, [id]: true }))
    const { error } = await supabase.from('walk_ins')
      .update({ status: 'pending' })
      .eq('id', id).eq('submitted_by', profile.id).eq('status', 'draft')
    if (error) toast(error.message, 'error')
    else { toast('Submitted to TL for approval! ✅', 'success'); load() }
    setSubmitting(s => ({ ...s, [id]: false }))
  }

  async function deleteDraft(id, name) {
    if (!window.confirm(`Delete draft for "${name}"? This cannot be undone.`)) return
    setDeleting(d => ({ ...d, [id]: true }))
    const { error } = await supabase.from('walk_ins')
      .delete()
      .eq('id', id).eq('submitted_by', profile.id).eq('status', 'draft')
    if (error) toast(error.message, 'error')
    else { toast('Draft deleted.', 'success'); load() }
    setDeleting(d => ({ ...d, [id]: false }))
  }

  const branchName = id => (branches.find(b => b.id === id) || {}).name || '—'

  if (loading) return <Loading />
  if (!rows.length) return (
    <Empty icon="🕐" text='No drafts saved yet. Use the "Hold" button on the New Walk-in form to save a draft here.' />
  )

  return (
    <div>
      <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 16 }}>
        <strong>{rows.length}</strong> draft{rows.length !== 1 ? 's' : ''} saved — not visible to TL until you submit
      </div>

      {rows.map(r => (
        <div key={r.id} className="approval-card" style={{ borderLeftColor: '#E67E22' }}>
          {/* Draft header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, color: '#E67E22',
              background: '#FEF0D9', padding: '3px 10px', borderRadius: 20,
              border: '1px solid #F5CBA7', letterSpacing: '.03em'
            }}>
              ⚠️ Not submitted to TL yet
            </span>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Saved {fmt(r.created_at)}</span>
          </div>

          {/* Info grid */}
          <div className="approval-card-info" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
            <div className="approval-card-field">
              <label>Customer</label>
              <p>{r.customer_name}</p>
            </div>
            <div className="approval-card-field">
              <label>Phone</label>
              <p style={{ fontFamily: 'DM Mono', fontSize: 13 }}>{r.phone}</p>
            </div>
            {r.alternate_phone && (
              <div className="approval-card-field">
                <label>Alt Phone</label>
                <p style={{ fontFamily: 'DM Mono', fontSize: 13 }}>{r.alternate_phone}</p>
              </div>
            )}
            <div className="approval-card-field">
              <label>Gold / Grams</label>
              <p>{r.gold_type} · {r.grams}g</p>
            </div>
            <div className="approval-card-field">
              <label>Branch</label>
              <p>{branchName(r.branch_id)}</p>
            </div>
            <div className="approval-card-field">
              <label>Walk-in Date</label>
              <p>{r.visit_date || '—'}</p>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              className="btn btn-success"
              onClick={() => submitToTL(r.id)}
              disabled={submitting[r.id] || deleting[r.id]}
            >
              {submitting[r.id] ? <><Spinner /> Submitting…</> : '✅ Submit to TL'}
            </button>
            <button
              className="btn btn-danger"
              onClick={() => deleteDraft(r.id, r.customer_name)}
              disabled={submitting[r.id] || deleting[r.id]}
            >
              {deleting[r.id] ? <><Spinner /> Deleting…</> : '🗑 Delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
