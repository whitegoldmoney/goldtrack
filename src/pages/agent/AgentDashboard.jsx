import NewWalkIn from './NewWalkIn'
import MyDrafts from './MyDrafts'
import MySubmissions from './MySubmissions'
import MyLeads from './MyLeads'
import MyHistory from './MyHistory'
import RemarksUpdate from './RemarksUpdate'

export default function AgentDashboard({
  activePage, profile, branches, toast,
  pendingCount, draftCount, onDraftCountChange, onDraftSaved,
  onRemarksCountChange,
}) {
  return (
    <div>
      {activePage === 'new'         && <NewWalkIn    profile={profile} branches={branches} toast={toast} onDraftSaved={onDraftSaved} />}
      {activePage === 'drafts'      && <MyDrafts     profile={profile} branches={branches} toast={toast} onCountChange={onDraftCountChange} />}
      {activePage === 'submissions' && <MySubmissions profile={profile} branches={branches} />}
      {activePage === 'remarks'     && <RemarksUpdate profile={profile} branches={branches} toast={toast} onCountChange={onRemarksCountChange} />}
      {activePage === 'leads'       && <MyLeads      profile={profile} branches={branches} toast={toast} />}
      {activePage === 'history'     && <MyHistory    profile={profile} branches={branches} />}
    </div>
  )
}
