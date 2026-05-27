import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { Loading, Empty, Spinner } from '../../components/UI'

export default function TeamManagement({ toast }) {
  const [allProfiles, setAllProfiles] = useState([])
  const [loading, setLoading]         = useState(true)
  const [busy, setBusy]               = useState({})
  const [loadKey, setLoadKey]         = useState(0)   // forces select remount after load

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('profiles')
      .select('id, name, email, role, assigned_tl')
      .order('name')
    setAllProfiles(data || [])
    setLoading(false)
    setLoadKey(k => k + 1)
  }

  useEffect(() => { load() }, [])

  const tls        = allProfiles.filter(p => p.role === 'tl')
  const agents     = allProfiles.filter(p => p.role === 'agent')
  const unassigned = agents.filter(a => !a.assigned_tl)

  const teamMap = {}
  tls.forEach(tl => {
    teamMap[tl.id] = agents.filter(a => a.assigned_tl === tl.id)
  })

  async function assignAgent(agentId, tlId) {
    setBusy(b => ({ ...b, [agentId]: true }))
    const { error } = await supabase
      .from('profiles')
      .update({ assigned_tl: tlId })
      .eq('id', agentId)
    if (error) toast(error.message, 'error')
    else { toast('Agent assigned successfully!', 'success'); load() }
    setBusy(b => ({ ...b, [agentId]: false }))
  }

  async function removeAgent(agentId) {
    setBusy(b => ({ ...b, [agentId]: true }))
    const { error } = await supabase
      .from('profiles')
      .update({ assigned_tl: null })
      .eq('id', agentId)
    if (error) toast(error.message, 'error')
    else { toast('Agent removed from team.', 'success'); load() }
    setBusy(b => ({ ...b, [agentId]: false }))
  }

  if (loading) return <Loading />

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>

      {/* ── Left: TL cards ── */}
      <div>
        {tls.length === 0 ? (
          <Empty icon="👥" text="No Team Leads found." />
        ) : tls.map(tl => {
          const teamAgents = teamMap[tl.id] || []
          return (
            <div key={tl.id} className="team-card">
              <div className="team-card-header">
                <div>
                  <h3>👤 {tl.name}</h3>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3 }}>
                    {tl.email}
                  </div>
                </div>
                <span>{teamAgents.length} agent{teamAgents.length !== 1 ? 's' : ''}</span>
              </div>

              <div className="team-card-body">
                {teamAgents.length === 0 ? (
                  <div style={{ color: 'var(--text3)', fontSize: 12, padding: '10px 0', textAlign: 'center' }}>
                    No agents assigned yet
                  </div>
                ) : teamAgents.map(agent => (
                  <div key={agent.id} className="agent-row">
                    <span>• {agent.name}</span>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                      {/* Move To another TL */}
                      <select
                        key={`move-${agent.id}-${loadKey}`}
                        defaultValue=""
                        disabled={busy[agent.id]}
                        onChange={e => { if (e.target.value) assignAgent(agent.id, e.target.value) }}
                        style={{
                          fontSize: 11, padding: '3px 6px', borderRadius: 4,
                          border: '1px solid var(--border2)', color: 'var(--text2)',
                          background: 'var(--white)', cursor: 'pointer', maxWidth: 110,
                        }}
                      >
                        <option value="">Move To…</option>
                        {tls.filter(t => t.id !== tl.id).map(t => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>

                      {/* Remove from this TL */}
                      <button
                        className="btn btn-danger btn-sm"
                        style={{ fontSize: 11, padding: '3px 8px', minHeight: 'unset' }}
                        disabled={busy[agent.id]}
                        onClick={() => removeAgent(agent.id)}
                      >
                        {busy[agent.id] ? <Spinner /> : 'Remove'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Right: Unassigned agents ── */}
      <div>
        <div className="unassigned-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <span style={{ fontSize: 20 }}>⚠️</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#B7950B' }}>Unassigned Agents</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                {unassigned.length === 0
                  ? 'All agents are assigned to a team'
                  : `${unassigned.length} agent${unassigned.length !== 1 ? 's' : ''} without a team`}
              </div>
            </div>
          </div>

          {unassigned.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--green)', fontSize: 13, fontWeight: 500 }}>
              ✅ Everyone is on a team!
            </div>
          ) : unassigned.map(agent => (
            <div key={agent.id} className="agent-row" style={{ padding: '10px 0' }}>
              <span style={{ fontSize: 13 }}>{agent.name}</span>
              <select
                key={`assign-${agent.id}-${loadKey}`}
                defaultValue=""
                disabled={busy[agent.id]}
                onChange={e => { if (e.target.value) assignAgent(agent.id, e.target.value) }}
                style={{
                  fontSize: 12, padding: '5px 8px', borderRadius: 6,
                  border: '1px solid var(--border2)', background: 'var(--white)',
                  color: 'var(--text)', cursor: 'pointer', minWidth: 130,
                }}
              >
                <option value="">— Assign To —</option>
                {tls.map(tl => (
                  <option key={tl.id} value={tl.id}>{tl.name}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
