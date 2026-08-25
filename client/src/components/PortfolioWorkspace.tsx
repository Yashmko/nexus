import { FormEvent, useEffect, useMemo, useState } from "react";
import { Archive, ArrowLeft, Check, ChevronRight, CircleCheck, CircleX, Globe2, Plus, Search, ShieldCheck, UserPlus } from "lucide-react";
import { startLogin } from "@/const";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import MissionAuditPanel from "@/components/MissionAuditPanel";

type PortfolioWorkspaceProps = {
  onReturn: () => void;
  onNavigate: (view: string) => void;
};

const makeMissionKey = () => `MIS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

function LedgerStamp({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "danger" | "warning" }) {
  return <span className={`ledger-stamp ${tone}`}>{children}</span>;
}

function riskTone(risk: string): "neutral" | "success" | "danger" | "warning" {
  if (risk === "critical" || risk === "high") return "danger";
  if (risk === "medium") return "warning";
  return "neutral";
}

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

export default function PortfolioWorkspace({ onReturn, onNavigate }: PortfolioWorkspaceProps) {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const utils = trpc.useUtils();
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [newMission, setNewMission] = useState({ missionKey: makeMissionKey(), title: "", account: "", scope: "", risk: "medium" as "critical" | "high" | "medium" | "low" | "info" });
  const [assignmentUserId, setAssignmentUserId] = useState("");
  const [assignmentRole, setAssignmentRole] = useState<"analyst" | "reviewer" | "approver">("reviewer");
  const [approvalType, setApprovalType] = useState("Evidence review");
  const [approvalSummary, setApprovalSummary] = useState("");
  const [approvalAssignee, setApprovalAssignee] = useState("");

  const missionsQuery = trpc.missions.list.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const approvalsQuery = trpc.missions.approvals.useQuery(undefined, { enabled: isAuthenticated, retry: false });
  const usersQuery = trpc.missions.users.useQuery(undefined, { enabled: isAuthenticated && user?.role === "admin", retry: false });
  const missionList = missionsQuery.data ?? [];

  useEffect(() => {
    if (!selectedId && missionList[0]) setSelectedId(missionList[0].id);
    if (selectedId && !missionList.some((mission) => mission.id === selectedId)) setSelectedId(missionList[0]?.id ?? null);
  }, [missionList, selectedId]);

  const selectedMission = missionList.find((mission) => mission.id === selectedId) ?? null;
  const assignmentsQuery = trpc.missions.assignments.useQuery({ missionId: selectedMission?.id ?? 0 }, { enabled: isAuthenticated && Boolean(selectedMission), retry: false });
  const selectedApprovals = (approvalsQuery.data ?? []).filter((approval) => approval.missionId === selectedMission?.id);
  const pendingApprovals = (approvalsQuery.data ?? []).filter((approval) => approval.status === "pending");
  const filteredMissions = useMemo(() => missionList.filter((mission) => {
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || [mission.missionKey, mission.title, mission.account, mission.scope, mission.ownerName, mission.ownerEmail, mission.stage].join(" ").toLowerCase().includes(term);
    return matchesQuery && (statusFilter === "All" || mission.status === statusFilter.toLowerCase().replaceAll(" ", "_")) && (riskFilter === "All" || mission.risk === riskFilter.toLowerCase());
  }), [missionList, query, riskFilter, statusFilter]);

  const refreshPortfolio = async () => {
    await Promise.all([utils.missions.list.invalidate(), utils.missions.approvals.invalidate(), selectedMission ? utils.missions.assignments.invalidate({ missionId: selectedMission.id }) : Promise.resolve()]);
  };

  const createMutation = trpc.missions.create.useMutation({
    onSuccess: async (mission) => {
      setSelectedId(mission.id);
      setShowCreate(false);
      setNewMission({ missionKey: makeMissionKey(), title: "", account: "", scope: "", risk: "medium" });
      setNotice("Mission created in your authenticated portfolio.");
      await refreshPortfolio();
    },
    onError: (error) => setNotice(error.message),
  });
  const archiveMutation = trpc.missions.archive.useMutation({ onSuccess: async () => { setNotice("Mission archived. It is no longer shown in the active portfolio."); await refreshPortfolio(); }, onError: (error) => setNotice(error.message) });
  const assignMutation = trpc.missions.assign.useMutation({ onSuccess: async () => { setNotice("Mission assignment updated."); setAssignmentUserId(""); await refreshPortfolio(); }, onError: (error) => setNotice(error.message) });
  const requestMutation = trpc.missions.requestApproval.useMutation({ onSuccess: async () => { setNotice("Approval request placed in the mission queue."); setApprovalSummary(""); await refreshPortfolio(); }, onError: (error) => setNotice(error.message) });
  const decideMutation = trpc.missions.decideApproval.useMutation({ onSuccess: async () => { setNotice("Approval decision recorded."); await refreshPortfolio(); }, onError: (error) => setNotice(error.message) });

  const submitMission = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createMutation.mutate(newMission);
  };
  const canManageMission = Boolean(selectedMission && user && (user.role === "admin" || selectedMission.ownerId === user.id));
  const canDecide = (approval: { assignedApproverId: number | null }) => Boolean(user && (user.role === "admin" || approval.assignedApproverId === user.id));

  if (!isAuthenticated) return <section className="functional-workspace portfolio-workspace"><header className="functional-header"><button className="return-mission" onClick={onReturn}><ArrowLeft size={15} /> Mission timeline</button><div className="functional-heading"><span className="workspace-icon"><Globe2 size={20} /></span><div><p>Authenticated case ledger</p><h1>Mission portfolio</h1></div></div></header><section className="portfolio-auth-state"><ShieldCheck size={26} /><h2>{authLoading ? "Checking workspace session" : "Sign in to manage missions"}</h2><p>Mission creation, archival, assignments, and approval queues are stored in the authenticated NEXUS workspace. No portfolio records are shown in a local session.</p>{!authLoading && <button className="workspace-action" onClick={startLogin}>Sign in to NEXUS</button>}</section></section>;

  return <section className="functional-workspace portfolio-workspace">
    <header className="functional-header"><button className="return-mission" onClick={onReturn}><ArrowLeft size={15} /> Mission timeline</button><div className="functional-heading"><span className="workspace-icon"><Globe2 size={20} /></span><div><p>Authenticated case ledger</p><h1>Mission portfolio</h1></div></div><div className="functional-header-actions"><label className="workspace-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mission, account, owner…" aria-label="Search mission portfolio" /></label><button className="workspace-action" onClick={() => setShowCreate((value) => !value)}><Plus size={14} /> New mission</button></div></header>
    {notice && <div className="report-notice"><CircleCheck size={14} /> {notice}</div>}
    {showCreate && <form className="mission-create-form" onSubmit={submitMission}><div><label>Mission key<input value={newMission.missionKey} onChange={(event) => setNewMission((state) => ({ ...state, missionKey: event.target.value.toUpperCase() }))} required /></label><label>Assessment title<input value={newMission.title} onChange={(event) => setNewMission((state) => ({ ...state, title: event.target.value }))} required /></label><label>Account<input value={newMission.account} onChange={(event) => setNewMission((state) => ({ ...state, account: event.target.value }))} required /></label><label>Initial risk<select value={newMission.risk} onChange={(event) => setNewMission((state) => ({ ...state, risk: event.target.value as typeof state.risk }))}><option value="critical">Critical</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="info">Info</option></select></label></div><label>Authorized scope<textarea value={newMission.scope} onChange={(event) => setNewMission((state) => ({ ...state, scope: event.target.value }))} required placeholder="Describe the system boundary and authorization." /></label><footer><button type="button" onClick={() => setShowCreate(false)}>Cancel</button><button className="workspace-action" type="submit" disabled={createMutation.isPending}>{createMutation.isPending ? "Creating…" : "Create mission"}</button></footer></form>}
    <section className="portfolio-overview"><article><span>Active missions</span><strong>{missionList.filter((mission) => mission.status !== "archived").length}</strong><small>visible to your workspace</small></article><article><span>Priority review paths</span><strong>{missionList.filter((mission) => ["critical", "high"].includes(mission.risk)).length}</strong><small>critical or high risk</small></article><article><span>Evidence artifacts</span><strong>{missionList.reduce((total, mission) => total + mission.evidenceCount, 0)}</strong><small>across active portfolio</small></article><article><span>Pending approvals</span><strong>{pendingApprovals.length}</strong><small>awaiting recorded decision</small></article></section>
    <section className="portfolio-filter-bar"><div className="filter-group">{["All", "active", "in review", "paused", "complete"].map((status) => <button key={status} className={statusFilter.toLowerCase() === status ? "active" : ""} onClick={() => setStatusFilter(status === "All" ? "All" : status)}>{status}</button>)}</div><div className="risk-filter-row">{["All", "critical", "high", "medium", "low"].map((risk) => <button key={risk} className={`${riskFilter.toLowerCase() === risk ? "active" : ""} risk-${risk}`} onClick={() => setRiskFilter(risk === "All" ? "All" : risk)}>{risk}</button>)}</div><span>{filteredMissions.length} mission{filteredMissions.length === 1 ? "" : "s"} shown</span></section>
    {missionsQuery.isLoading ? <div className="portfolio-auth-state"><ShieldCheck size={24} /><h2>Loading mission ledger</h2></div> : !missionList.length ? <section className="portfolio-auth-state"><Globe2 size={25} /><h2>No missions in your workspace</h2><p>Create an authorized mission to establish its scope, owner, evidence ledger, and approval queue.</p><button className="workspace-action" onClick={() => setShowCreate(true)}><Plus size={14} /> Create first mission</button></section> : <><section className="portfolio-layout"><aside className="portfolio-ledger"><div className="section-label"><span>Case ledger</span><small>Owner and assignment scoped</small></div>{filteredMissions.length ? filteredMissions.map((mission) => <button key={mission.id} className={`portfolio-mission-row ${selectedMission?.id === mission.id ? "selected" : ""}`} onClick={() => setSelectedId(mission.id)}><div><span className={`asset-risk-dot risk-${mission.risk}`} /><strong>{mission.title}</strong></div><small>{mission.missionKey} · {mission.account}</small><footer><LedgerStamp tone={riskTone(mission.risk)}>{statusLabel(mission.status)}</LedgerStamp><span>{new Date(mission.updatedAt).toLocaleDateString()}</span></footer></button>) : <p className="register-empty">No missions match these portfolio filters.</p>}</aside>{selectedMission && <><article className="portfolio-case"><div className="record-title"><div><span className="eyebrow">{selectedMission.missionKey}</span><h2>{selectedMission.title}</h2><p>{selectedMission.account}</p></div><div className="portfolio-status-stack"><LedgerStamp tone={selectedMission.status === "active" ? "success" : "warning"}>{statusLabel(selectedMission.status)}</LedgerStamp><LedgerStamp tone={riskTone(selectedMission.risk)}>{selectedMission.risk} risk</LedgerStamp></div></div><div className="portfolio-progress"><div><span>Mission progression</span><strong>{selectedMission.stage}</strong></div><i><b style={{ width: `${selectedMission.progress}%` }} /></i><small>{selectedMission.progress}% recorded</small></div><div className="portfolio-detail-grid"><p><strong>Authorized scope</strong>{selectedMission.scope}</p><p><strong>Assigned owner</strong>{selectedMission.ownerName ?? selectedMission.ownerEmail ?? "Workspace owner"}</p><p><strong>Evidence ledger</strong>{selectedMission.evidenceCount} preserved artifacts</p><p><strong>Validated findings</strong>{selectedMission.findingCount} material record{selectedMission.findingCount === 1 ? "" : "s"}</p></div><div className="portfolio-note"><span>Mission governance</span><p>Mission actions are stored in the authenticated workspace and constrained by role and ownership boundaries.</p></div><div className="record-actions"><button onClick={() => onNavigate("Missions")}>Open mission timeline <ChevronRight size={14} /></button><button onClick={() => onNavigate("Evidence")}>Review custody ledger</button><button onClick={() => onNavigate("Reports")}>Open report record</button>{canManageMission && <button className="danger-action" onClick={() => archiveMutation.mutate({ missionId: selectedMission.id })} disabled={archiveMutation.isPending}><Archive size={14} /> Archive</button>}</div></article><aside className="portfolio-governance"><span className="eyebrow">Assignments &amp; approvals</span><h2>Control queue</h2><div className="assignment-ledger"><strong>Assigned operators</strong>{assignmentsQuery.isLoading ? <p>Loading assignments…</p> : assignmentsQuery.data?.map((assignment) => <p key={assignment.id}><span>{assignment.name ?? assignment.email ?? `User ${assignment.userId}`}</span><LedgerStamp tone="neutral">{assignment.role}</LedgerStamp></p>)}</div>{canManageMission && user?.role === "admin" && <div className="assignment-form"><select aria-label="Assign operator" value={assignmentUserId} onChange={(event) => setAssignmentUserId(event.target.value)}><option value="">Select operator</option>{usersQuery.data?.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name ?? candidate.email ?? `User ${candidate.id}`}</option>)}</select><select aria-label="Assignment role" value={assignmentRole} onChange={(event) => setAssignmentRole(event.target.value as typeof assignmentRole)}><option value="analyst">Analyst</option><option value="reviewer">Reviewer</option><option value="approver">Approver</option></select><button onClick={() => assignmentUserId && assignMutation.mutate({ missionId: selectedMission.id, userId: Number(assignmentUserId), role: assignmentRole })} disabled={!assignmentUserId || assignMutation.isPending}><UserPlus size={13} /> Assign</button></div>}{canManageMission && <div className="approval-form"><strong>Request approval</strong><input value={approvalType} onChange={(event) => setApprovalType(event.target.value)} aria-label="Approval type" /><textarea value={approvalSummary} onChange={(event) => setApprovalSummary(event.target.value)} aria-label="Approval summary" placeholder="State what must be authorized and why." /><select aria-label="Assigned approver" value={approvalAssignee} onChange={(event) => setApprovalAssignee(event.target.value)}><option value="">Unassigned administrator queue</option>{usersQuery.data?.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name ?? candidate.email ?? `User ${candidate.id}`}</option>)}</select><button onClick={() => approvalSummary && requestMutation.mutate({ missionId: selectedMission.id, type: approvalType, summary: approvalSummary, assignedApproverId: approvalAssignee ? Number(approvalAssignee) : null })} disabled={!approvalSummary || requestMutation.isPending}><ShieldCheck size={13} /> Request approval</button></div>}<div className="approval-queue"><strong>Mission approval queue</strong>{selectedApprovals.length ? selectedApprovals.map((approval) => <div key={approval.id}><p><span>{approval.type}</span><LedgerStamp tone={approval.status === "approved" ? "success" : approval.status === "rejected" ? "danger" : "warning"}>{approval.status}</LedgerStamp></p><small>{approval.summary}</small>{approval.status === "pending" && canDecide(approval) && <footer><button onClick={() => decideMutation.mutate({ approvalId: approval.id, decision: "approved", decisionNote: "Approved in NEXUS queue." })}><Check size={12} /> Approve</button><button onClick={() => decideMutation.mutate({ approvalId: approval.id, decision: "rejected", decisionNote: "Rejected in NEXUS queue." })}><CircleX size={12} /> Reject</button></footer>}</div>) : <p>No approval records for this mission.</p>}</div></aside></>}</section>{selectedMission && <MissionAuditPanel missionId={selectedMission.id} canManage={canManageMission} />}</>}
  </section>;
}
