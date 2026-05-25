import { useState } from 'react'
import NewWalkIn from './NewWalkIn'
import MySubmissions from './MySubmissions'
import MyLeads from './MyLeads'

export default function AgentDashboard({ profile, branches, toast, pendingCount }) {
  const [tab, setTab] = useState('new')

  return (
    <div>
      <div className="tabs">
        <button className={`tab-btn ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>New Walk-in</button>
        <button className={`tab-btn ${tab === 'submissions' ? 'active' : ''}`} onClick={() => setTab('submissions')}>My Submissions</button>
        <button className={`tab-btn ${tab === 'leads' ? 'active' : ''}`} onClick={() => setTab('leads')}>
          My Leads {pendingCount > 0 && <span className="notif-count">{pendingCount}</span>}
        </button>
      </div>
      {tab === 'new' && <NewWalkIn profile={profile} branches={branches} toast={toast} />}
      {tab === 'submissions' && <MySubmissions profile={profile} branches={branches} />}
      {tab === 'leads' && <MyLeads profile={profile} branches={branches} toast={toast} />}
    </div>
  )
}
