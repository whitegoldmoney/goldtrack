import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

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

  // ── Data fetching ─────────────────────────────────────────────
  async function load() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('walk_ins')
      .select('*')
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

    // Validate: grams_sold required when Sold
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
      .eq('id', row.id)
      .eq('submitted_by', profile.id)

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
  function branchName(id) {
    return branches.find(b => b.id === id)?.name || '—'
  }

  function formatTime(ts) {
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
    <div style={{ maxWidth: 760 }}>

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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map(row => {
            const locked      = isLocked(row)
            const phone       = row.customer_mobile || row.phone || '—'
            const activeRemark = localRemarks[row.id] ?? row.remarks ?? ''

            return (
              <div key={row.id} style={{
                background:   locked ? 'var(--surface)' : 'var(--white)',
                borderRadius: 10,
                border:       '1px solid var(--border)',
                borderLeft:   `3px solid ${locked ? 'var(--green)' : 'var(--gold)'}`,
                padding:      16,
                transition:   'background 0.2s, border-color 0.2s',
              }}>

                {/* ── Info grid ── */}
                <div style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  gap: '4px 16px', marginBottom: 14,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    👤 {row.customer_name}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                    📞 {phone}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    🏦 {branchName(row.branch_id)}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                    ⚖️ {row.walk_in_type === 'tele_sales' ? 'Tele Sales' : 'Direct'}
                    {row.gold_weight ? ` · ${row.gold_weight}g` : ''}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', gridColumn: '1 / -1' }}>
                    🕐 Submitted: {formatTime(row.created_at)}
                  </div>
                </div>

                {/* ── Remarks dropdown ── */}
                <div style={{ marginBottom: 10 }}>
                  <label style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--text3)',
                    display: 'block', marginBottom: 4, letterSpacing: '0.04em',
                  }}>
                    REMARKS (optional)
                  </label>
                  <select
                    disabled={locked}
                    value={activeRemark}
                    onChange={e => setLocalRemarks(r => ({ ...r, [row.id]: e.target.value }))}
                    style={{
                      width: '100%', fontSize: 13,
                      opacity:    locked ? 0.6 : 1,
                      background: locked ? 'var(--surface)' : 'var(--white)',
                      cursor:     locked ? 'not-allowed' : 'default',
                    }}
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

                {/* ── Sold Grams — only when Sold is selected ── */}
                {activeRemark === 'Sold' && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{
                      fontSize: 11, fontWeight: 600, color: 'var(--text3)',
                      display: 'block', marginBottom: 4, letterSpacing: '0.04em',
                    }}>
                      SOLD GRAMS *{' '}
                      <span style={{ color: 'var(--red)', fontSize: 10, fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                        Required when Sold
                      </span>
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="Enter grams sold e.g. 10.5"
                      disabled={locked}
                      value={localSoldGrams[row.id] ?? row.grams_sold ?? ''}
                      onChange={e => setLocalSoldGrams(s => ({ ...s, [row.id]: e.target.value }))}
                      style={{
                        width: '100%', fontSize: 13,
                        opacity:    locked ? 0.6 : 1,
                        background: locked ? 'var(--surface)' : 'var(--white)',
                        cursor:     locked ? 'not-allowed' : 'default',
                      }}
                    />
                  </div>
                )}

                {/* ── Saved grams display on locked card ── */}
                {locked && row.remarks === 'Sold' && row.grams_sold && (
                  <div style={{ fontSize: 12, color: 'var(--green)', marginBottom: 10, fontWeight: 500 }}>
                    💰 Sold: {row.grams_sold}g
                  </div>
                )}

                {/* ── BM Remarks textarea ── */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--text3)',
                    display: 'block', marginBottom: 4, letterSpacing: '0.04em',
                  }}>
                    BRANCH MANAGER REMARKS (optional)
                  </label>
                  <textarea
                    disabled={locked}
                    value={localBMRemarks[row.id] ?? row.bm_remarks ?? ''}
                    onChange={e => setLocalBMRemarks(r => ({ ...r, [row.id]: e.target.value }))}
                    placeholder="e.g. Customer will come tomorrow, branch manager confirmed..."
                    style={{
                      width: '100%', minHeight: 60, fontSize: 13,
                      boxSizing: 'border-box',
                      opacity:    locked ? 0.6 : 1,
                      background: locked ? 'var(--surface)' : 'var(--white)',
                      cursor:     locked ? 'not-allowed' : 'default',
                      resize:     locked ? 'none' : 'vertical',
                    }}
                  />
                </div>

                {/* ── Action row ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {locked ? (
                    <>
                      <button
                        className="btn btn-success btn-sm"
                        disabled
                        style={{ opacity: 0.85, cursor: 'default' }}
                      >
                        ✓ Remarks Saved
                        {row.remarks_updated_at && (
                          <span style={{ fontSize: 11, marginLeft: 6, fontWeight: 400 }}>
                            at {savedTimeStr(row)}
                          </span>
                        )}
                      </button>
                      <button
                        className="btn btn-outline btn-sm"
                        style={{ fontSize: 11 }}
                        onClick={() => unlockCard(row.id)}
                      >
                        ✏️ Edit
                      </button>
                    </>
                  ) : (
                    <button
                      className="btn btn-dark btn-sm"
                      style={{ padding: '7px 18px', fontSize: 13 }}
                      onClick={() => saveRemarks(row)}
                      disabled={saving[row.id]}
                    >
                      {saving[row.id]
                        ? <><span className="spinner" style={{ borderTopColor: 'var(--gold)', width: 12, height: 12, borderWidth: 2, marginRight: 6 }} />Saving…</>
                        : '💾 Save Remarks'}
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
