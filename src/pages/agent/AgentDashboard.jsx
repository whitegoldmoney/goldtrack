import NewWalkIn from './NewWalkIn'
import MyDrafts from './MyDrafts'
import MySubmissions from './MySubmissions'
import MyLeads from './MyLeads'
import MyHistory from './MyHistory'

export default function AgentDashboard({
  activePage, profile, branches, toast,
  pendingCount, draftCount, onDraftCountChange, onDraftSaved,
}) {
  return (
    <div>
      {activePage === 'new'         && <NewWalkIn profile={profile} branches={branches} toast={toast} onDraftSaved={onDraftSaved} />}
      {activePage === 'drafts'      && <MyDrafts  profile={profile} branches={branches} toast={toast} onCountChange={onDraftCountChange} />}
      {activePage === 'submissions' && <MySubmissions profile={profile} branches={branches} />}
      {activePage === 'leads'       && <MyLeads   profile={profile} branches={branches} toast={toast} />}
      {activePage === 'history'     && <MyHistory profile={profile} branches={branches} />}
    </div>
  )
}
