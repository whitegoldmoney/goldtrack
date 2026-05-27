import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function RemarksUpdate({ profile, branches, toast, onCountChange }) {
  const [rows, setRows]                     = useState([])
  const [loading, setLoading]               = useState(false)
  const [localRemarks, setLocalRemarks]     = useState({})
  const [localBMRemarks, setLocalBMRemarks] = useState({})
  const [saving, setSaving]                 = useState({})
  const [savedAt, setSavedAt]               = useState({})   // id → Date — also doubles as lock flag

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

  async function saveRemarks(row) {
    setSaving(s => ({ ...s, [row.id]: true }))
    const { error } = await supabase
      .from('walk_ins')
      .update({
        remarks:            localRemarks[row.id]   ?? row.remarks    ?? null,
        bm_remarks:         localBMRemarks[row.id] ?? row.bm_remarks ?? null,
        remarks_updated_at: new Date().toISOString(),
        remarks_updated_by: profile.id,
      })
      .eq('id', row.id)
      .eq('submitted_by', profile.id)

    if (error) {
      toast(error.message, 'error')
    } else {
      toast('Remarks saved!', 'success')
      setSavedAt(s => ({ ...s, [row.id]: new Date() }))  // lock the card
      load()
    }
    setSaving(s => ({ ...s, [row.id]: false }))
  }

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
            // Lock if saved in this session OR if DB shows remarks were previously saved
            const isLocked = !!savedAt[row.id] || !!row.remarks_updated_at
            const savedTime = savedAt[row.id]
              ? savedAt[row.id].toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
              : row.remarks_updated_at
                ? new Date(row.remarks_updated_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
                : null
            const phone    = row.customer_mobile || row.phone || '—'

            return (
              <div key={row.id} style={{
                background:    isLocked ? '#f4f4f4' : 'var(--white)',
                borderRadius:  10,
                border:       `1px solid ${isLocked ? '#ccc' : 'var(--border)'}`,
                borderLeft:   `3px solid ${isLocked ? '#999' : 'var(--gold)'}`,
                padding:       16,
                position:      'relative',
                opacity:       isLocked ? 0.65 : 1,
                pointerEvents: isLocked ? 'none' : 'auto',
                transition:    'opacity 0.25s, background 0.25s',
              }}>

                {/* ── Saved overlay stamp ── */}
                {isLocked && (
                  <div style={{
                    position: 'absolute', top: 12, right: 14,
                    background: '#1e1e1e', color: '#fff',
                    fontSize: 11, fontWeight: 700,
                    padding: '3px 10px', borderRadius: 20,
                    letterSpacing: '0.03em',
                  }}>
                    ✓ Saved {savedTime}
                  </div>
                )}

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
                    disabled={isLocked}
                    value={localRemarks[row.id] ?? row.remarks ?? ''}
                    onChange={e => setLocalRemarks(r => ({ ...r, [row.id]: e.target.value }))}
                    style={{ width: '100%', fontSize: 13 }}
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

                {/* ── BM Remarks textarea ── */}
                <div style={{ marginBottom: 12 }}>
                  <label style={{
                    fontSize: 11, fontWeight: 600, color: 'var(--text3)',
                    display: 'block', marginBottom: 4, letterSpacing: '0.04em',
                  }}>
                    BRANCH MANAGER REMARKS (optional)
                  </label>
                  <textarea
                    disabled={isLocked}
                    value={localBMRemarks[row.id] ?? row.bm_remarks ?? ''}
                    onChange={e => setLocalBMRemarks(r => ({ ...r, [row.id]: e.target.value }))}
                    placeholder="e.g. Customer will come tomorrow, branch manager confirmed..."
                    style={{ width: '100%', minHeight: 60, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>

                {/* ── Save button ── */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    className="btn btn-dark"
                    style={{ padding: '7px 18px', fontSize: 13 }}
                    onClick={() => saveRemarks(row)}
                    disabled={saving[row.id] || isLocked}
                  >
                    {saving[row.id] ? 'Saving…' : '💾 Save Remarks'}
                  </button>
                </div>

              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
