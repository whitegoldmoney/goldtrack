import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import NewWalkIn from './NewWalkIn'
import MyDrafts from './MyDrafts'
import MySubmissions from './MySubmissions'
import MyLeads from './MyLeads'

export default function AgentDashboard({ profile, branches, toast, pendingCount }) {
  const [tab, setTab] = useState('new')
  const [draftCount, setDraftCount] = useState(0)

  async function loadDraftCount() {
    const { count } = await supabase.from('walk_ins')
      .select('id', { count: 'exact', head: true })
      .eq('submitted_by', profile.id).eq('status', 'draft')
    setDraftCount(count || 0)
  }

  useEffect(() => { loadDraftCount() }, [])

  return (
    <div>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <div className="tabs">
        <button className={`tab-btn ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>
          New Walk-in
        </button>
        <button className={`tab-btn ${tab === 'drafts' ? 'active' : ''}`} onClick={() => setTab('drafts')}>
          My Drafts {draftCount > 0 && <span className="notif-count" style={{ background: '#E67E22' }}>{draftCount}</span>}
        </button>
        <button className={`tab-btn ${tab === 'submissions' ? 'active' : ''}`} onClick={() => setTab('submissions')}>
          My Submissions
        </button>
        <button className={`tab-btn ${tab === 'leads' ? 'active' : ''}`} onClick={() => setTab('leads')}>
          My Leads {pendingCount > 0 && <span className="notif-count">{pendingCount}</span>}
        </button>
      </div>
      </div>

      {tab === 'new' && (
        <NewWalkIn profile={profile} branches={branches} toast={toast} onDraftSaved={loadDraftCount} />
      )}
      {tab === 'drafts' && (
        <MyDrafts profile={profile} branches={branches} toast={toast} onCountChange={setDraftCount} />
      )}
      {tab === 'submissions' && (
        <MySubmissions profile={profile} branches={branches} />
      )}
      {tab === 'leads' && (
        <MyLeads profile={profile} branches={branches} toast={toast} />
      )}
    </div>
  )
}
