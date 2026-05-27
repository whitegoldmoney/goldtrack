import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

const LBL = {
  fontSize: 10, fontWeight: 600, color: 'var(--text2)',
  textTransform: 'uppercase', letterSpacing: '.04em',
  display: 'block', marginBottom: 3,
}
const SEL = {
  width: '100%', padding: '6px 10px', fontSize: 12,
  borderRadius: 6, border: '1px solid var(--border2)',
  marginBottom: 8, background: 'var(--white)',
  fontFamily: 'inherit',
}
const INP = {
  width: '100%', padding: '6px 10px', fontSize: 12,
  borderRadius: 6, border: '1px solid var(--border2)',
  marginBottom: 8, boxSizing: 'border-box',
}
const TA = {
  width: '100%', padding: '6px 10px', fontSize: 12,
  minHeight: 50, maxHeight: 80, borderRadius: 6,
  border: '1px solid var(--border2)', resize: 'none',
  marginBottom: 8, boxSizing: 'border-box', fontFamily: 'inherit',
}

export default function RemarksUpdate({ profile, branches, toast, onCountChange }) {
  const [rows, setRows]                         = useState([])
  const [loading, setLoading]                   = useState(false)
  const [localRemarks, setLocalRemarks]         = useState({})
  const [localBMRemarks, setLocalBMRemarks]     = useState({})
  const [localSoldGrams, setLocalSoldGrams]     = useState({})
  const [saving, setSaving]                     = useState({})
  const [manuallyUnlocked, setManuallyUnlocked] = useState({})

  // ── Lock logic ────────────────────────────────────────────────
  function isLocked(row) {
    return !!row.remarks_updated_at && !manuallyUnlocked[row.id]
  }
  function unlockCard(id) {
    setManuallyUnlocked(u => ({ ...u, [id]: true }))
  }

  // ── Data ──────────────────────────────────────────────────────
  async function load() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('walk_ins').select('*')
      .eq('submitted_by', profile.id)
      .gte('created_at', today + 'T00:00:00')
      .lte('created_at', today + 'T23:59:59')
      .not('status', 'eq', 'draft')
      .order('created_at', { ascending: false })
    setRows(data || [])
    if (onCountChange) onCountChange((data || []).filter(w => !w.remarks).length)
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // ── Save ──────────────────────────────────────────────────────
  async function saveRemarks(row) {
    const remarks = localRemarks[row.id] ?? row.remarks ?? null
    if (remarks === 'Sold') {
      const grams = localSoldGrams[row.id] ?? row.grams_sold
      if (!grams || parseFloat(grams) <= 0) {
        toast('Sold Grams is required when Sold is selected.', 'error')
        return
      }
    }
    setSaving(s => ({ ...s, [row.id]: true }))
    const { error } = await supabase
      .from('walk_ins')
      .update({
        remarks,
        bm_remarks:         localBMRemarks[row.id] ?? row.bm_remarks ?? null,
        grams_sold:         remarks === 'Sold'
                              ? parseFloat(localSoldGrams[row.id] ?? row.grams_sold)
                              : null,
        remarks_updated_at: new Date().toISOString(),
        remarks_updated_by: profile.id,
      })
      .eq('id', row.id).eq('submitted_by', profile.id)
    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Remarks saved!', 'success')
      setManuallyUnlocked(u => { const n = { ...u }; delete n[row.id]; return n })
      load()
    }
    setSaving(s => ({ ...s, [row.id]: false }))
  }

  // ── Helpers ───────────────────────────────────────────────────
  const branchName = id => branches.find(b => b.id === id)?.name || '—'

  function fmt(ts) {
    if (!ts) return '—'
    return new Date(ts).toLocaleString('en-IN', {
      day: '2-digit', month: 'short',
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  }

  function savedTimeStr(row) {
    if (!row.remarks_updated_at) return ''
    return new Date(row.remarks_updated_at).toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: true,
    })
  }

  // ── Render ────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Loading…</div>
  )

  return (
    <div>
      {/* ── Header ── */}
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Remarks Update</h2>
        <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          Today's submitted walk-ins — add remarks and branch manager notes
        </p>
      </div>

      {/* ── Empty state ── */}
      {rows.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '60px 20px',
          background: 'var(--white)', borderRadius: 12,
          border: '1px solid var(--border)',
        }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📝</div>
          <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 6 }}>
            No walk-ins submitted today yet.
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)' }}>
            Walk-ins you submit today will appear here for remarks update.
          </div>
        </div>
      ) : (
        /* ── Grid ── */
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
          alignItems: 'start',
        }}>
          {rows.map(row => {
            const locked       = isLocked(row)
            const phone        = row.customer_mobile || row.phone || '—'
            const activeRemark = localRemarks[row.id] ?? row.remarks ?? ''

            return (
              <div key={row.id} style={{
                background:  locked ? 'var(--surface)' : '#FFFDE7',
                borderRadius: 12,
                border:      '1px solid var(--border)',
                borderLeft:  `4px solid ${locked ? 'var(--green)' : 'var(--gold)'}`,
                padding:     14,
                boxShadow:   '0 3px 10px rgba(0,0,0,0.06)',
              }}>

                {/* ── Customer info ── */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                    {row.customer_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text2)', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span>📞 {phone}</span>
                    <span>🏦 {branchName(row.branch_id)}</span>
                    {(row.gold_type || row.walk_in_type) && (
                      <span>⚖️ {row.gold_type || (row.walk_in_type === 'tele_sales' ? 'Tele Sales' : 'Direct')}
                        {(row.grams || row.gold_weight) ? ` · ${row.grams || row.gold_weight}g` : ''}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                    🕐 {fmt(row.created_at)}
                  </div>
                </div>

                {/* ── Locked: show saved values ── */}
                {locked && row.remarks && (
                  <div style={{
                    fontSize: 11, color: 'var(--text2)', marginBottom: 6,
                    padding: '4px 8px', background: 'var(--white)', borderRadius: 4,
                  }}>
                    📝 {row.remarks}
                    {row.grams_sold && (
                      <span style={{ color: 'var(--green)', marginLeft: 6 }}>
                        · 💰 {row.grams_sold}g
                      </span>
                    )}
                  </div>
                )}
                {locked && row.bm_remarks && (
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 8, fontStyle: 'italic' }}>
                    "{row.bm_remarks}"
                  </div>
                )}

                {/* ── Editable fields (hidden when locked) ── */}
                {!locked && (
                  <>
                    {/* Remarks */}
                    <div>
                      <label style={LBL}>Remarks</label>
                      <select
                        value={activeRemark}
                        onChange={e => setLocalRemarks(r => ({ ...r, [row.id]: e.target.value }))}
                        style={SEL}
                      >
                        <option value="">— Select Remarks —</option>
                        <option value="Price Enquiry">Price Enquiry</option>
                        <option value="Taken Quotation">Taken Quotation</option>
                        <option value="Sold">Sold</option>
                        <option value="Not Interested">Not Interested</option>
                        <option value="Call Back">Call Back</option>
                        <option value="Already Pledged">Already Pledged</option>
                        <option value="Came for Release">Came for Release</option>
                      </select>
                    </div>

                    {/* Sold Grams — conditional */}
                    {activeRemark === 'Sold' && (
                      <div>
                        <label style={{ ...LBL, color: 'var(--red)' }}>Sold Grams *</label>
                        <input
                          type="number" step="0.1" min="0"
                          placeholder="e.g. 10.5"
                          value={localSoldGrams[row.id] ?? row.grams_sold ?? ''}
                          onChange={e => setLocalSoldGrams(s => ({ ...s, [row.id]: e.target.value }))}
                          style={{ ...INP, border: '1px solid var(--red)' }}
                        />
                      </div>
                    )}

                    {/* BM Remarks */}
                    <div>
                      <label style={LBL}>BM Remarks</label>
                      <textarea
                        value={localBMRemarks[row.id] ?? row.bm_remarks ?? ''}
                        onChange={e => setLocalBMRemarks(r => ({ ...r, [row.id]: e.target.value }))}
                        placeholder="Branch manager notes…"
                        style={TA}
                      />
                    </div>
                  </>
                )}

                {/* ── Action row ── */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: locked ? 4 : 0 }}>
                  {locked ? (
                    <>
                      <button
                        className="btn btn-sm"
                        disabled
                        style={{
                          background: '#eafaf1', color: 'var(--green)',
                          border: '1px solid #a9dfbf', fontSize: 11, padding: '4px 10px',
                          cursor: 'default', opacity: 0.9,
                        }}
                      >
                        ✓ Saved {savedTimeStr(row)}
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => unlockCard(row.id)}
                        style={{ fontSize: 11, padding: '4px 10px' }}
                      >
                        ✏️ Edit
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-dark btn-sm"
                      onClick={() => saveRemarks(row)}
                      disabled={saving[row.id]}
                      style={{ fontSize: 11, padding: '5px 12px' }}
                    >
                      {saving[row.id]
                        ? <><span className="spinner" style={{ borderTopColor: 'var(--gold)', width: 12, height: 12, borderWidth: 2, marginRight: 6 }} />Saving…</>
                        : '💾 Save'}
                    </button>
                  )}
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
