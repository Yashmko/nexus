import { useMemo, useState } from "react";
import { ArrowLeft, ChevronRight, Globe2, Search, ShieldCheck } from "lucide-react";

type PortfolioWorkspaceProps = {
  onReturn: () => void;
  onNavigate: (view: string) => void;
};

const missions = [
  { id: "MIS-2025-05-21-1437", title: "ACME Internal Network Assessment", account: "ACME / Internal", scope: "10.10.0.0/16 · acme.internal", status: "In review", risk: "High", stage: "Validation", progress: 80, evidence: 6, findings: 1, updated: "15:42 UTC", owner: "NEXUS Operator", authorization: "Active", note: "One evidence-backed route is awaiting operator authorization." },
  { id: "MIS-2025-05-20-0921", title: "Helios API Exposure Review", account: "Helios / Production API", scope: "api.helios.example · approved routes", status: "Active", risk: "Critical", stage: "Test", progress: 54, evidence: 11, findings: 2, updated: "14:18 UTC", owner: "R. Singh", authorization: "Active", note: "Priority route validation is constrained to the approved API surface." },
  { id: "MIS-2025-05-19-1840", title: "Northstar Identity Boundary", account: "Northstar / Identity", scope: "id.northstar.example · SSO boundary", status: "Paused", risk: "Medium", stage: "Critic", progress: 67, evidence: 9, findings: 0, updated: "Yesterday", owner: "M. Chen", authorization: "Paused", note: "Mission is paused pending a new authorization window." },
  { id: "MIS-2025-05-18-1113", title: "Cinder Partner Portal Review", account: "Cinder / Partner Portal", scope: "partners.cinder.example", status: "Complete", risk: "Low", stage: "Report", progress: 100, evidence: 14, findings: 0, updated: "18 May", owner: "NEXUS Operator", authorization: "Closed", note: "Report record was completed with no validated findings." },
];

function LedgerStamp({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "danger" | "warning" }) {
  return <span className={`ledger-stamp ${tone}`}>{children}</span>;
}

export default function PortfolioWorkspace({ onReturn, onNavigate }: PortfolioWorkspaceProps) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [riskFilter, setRiskFilter] = useState("All");
  const [selectedId, setSelectedId] = useState(missions[0].id);

  const filteredMissions = useMemo(() => missions.filter((mission) => {
    const term = query.trim().toLowerCase();
    const matchesQuery = !term || [mission.id, mission.title, mission.account, mission.scope, mission.owner, mission.stage].join(" ").toLowerCase().includes(term);
    return matchesQuery && (statusFilter === "All" || mission.status === statusFilter) && (riskFilter === "All" || mission.risk === riskFilter);
  }), [query, statusFilter, riskFilter]);
  const selectedMission = missions.find((mission) => mission.id === selectedId) ?? missions[0];
  const priorityCount = missions.filter((mission) => ["Critical", "High"].includes(mission.risk)).length;

  const stampTone = (mission: typeof missions[number]): "neutral" | "success" | "danger" | "warning" => {
    if (mission.status === "Complete" || mission.authorization === "Active" && mission.risk === "Low") return "success";
    if (mission.risk === "Critical" || mission.risk === "High") return "danger";
    if (mission.status === "Paused" || mission.risk === "Medium") return "warning";
    return "neutral";
  };

  return <section className="portfolio-workspace">
    <header className="functional-header">
      <button className="return-mission" onClick={onReturn}><ArrowLeft size={15} /> Mission timeline</button>
      <div className="functional-heading"><span className="workspace-icon"><Globe2 size={20} /></span><div><p>Authorized case ledger</p><h1>Mission portfolio</h1></div></div>
      <div className="functional-header-actions"><label className="workspace-search"><Search size={14} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search mission, account, owner…" aria-label="Search mission portfolio" /></label><button className="workspace-action" onClick={() => { setQuery(""); setStatusFilter("All"); setRiskFilter("All"); setSelectedId(missions[0].id); }}>Reset portfolio</button></div>
    </header>

    <section className="portfolio-overview"><article><span>Authorized missions</span><strong>{missions.filter((mission) => mission.authorization === "Active").length}</strong><small>within approval window</small></article><article><span>Priority review paths</span><strong>{priorityCount}</strong><small>critical or high risk</small></article><article><span>Evidence artifacts</span><strong>{missions.reduce((total, mission) => total + mission.evidence, 0)}</strong><small>across visible portfolio</small></article><article><span>Portfolio posture</span><strong>Guarded</strong><small>all scope states visible</small></article></section>
    <section className="portfolio-filter-bar"><div className="filter-group">{["All", "Active", "In review", "Paused", "Complete"].map((status) => <button key={status} className={statusFilter === status ? "active" : ""} onClick={() => setStatusFilter(status)}>{status}</button>)}</div><div className="risk-filter-row">{["All", "Critical", "High", "Medium", "Low"].map((risk) => <button key={risk} className={`${riskFilter === risk ? "active" : ""} risk-${risk.toLowerCase()}`} onClick={() => setRiskFilter(risk)}>{risk}</button>)}</div><span>{filteredMissions.length} mission{filteredMissions.length === 1 ? "" : "s"} shown</span></section>
    <section className="portfolio-layout"><aside className="portfolio-ledger"><div className="section-label"><span>Case ledger</span><small>Owner-scoped portfolio</small></div>{filteredMissions.length ? filteredMissions.map((mission) => <button key={mission.id} className={`portfolio-mission-row ${selectedMission.id === mission.id ? "selected" : ""}`} onClick={() => setSelectedId(mission.id)}><div><span className={`asset-risk-dot risk-${mission.risk.toLowerCase()}`} /><strong>{mission.title}</strong></div><small>{mission.id} · {mission.account}</small><footer><LedgerStamp tone={stampTone(mission)}>{mission.status}</LedgerStamp><span>{mission.updated}</span></footer></button>) : <p className="register-empty">No missions match these portfolio filters.</p>}</aside><article className="portfolio-case"><div className="record-title"><div><span className="eyebrow">{selectedMission.id}</span><h2>{selectedMission.title}</h2><p>{selectedMission.account}</p></div><div className="portfolio-status-stack"><LedgerStamp tone={selectedMission.authorization === "Active" ? "success" : "warning"}>{selectedMission.authorization} authorization</LedgerStamp><LedgerStamp tone={stampTone(selectedMission)}>{selectedMission.risk} risk</LedgerStamp></div></div><div className="portfolio-progress"><div><span>Mission progression</span><strong>{selectedMission.stage}</strong></div><i><b style={{ width: `${selectedMission.progress}%` }} /></i><small>{selectedMission.progress}% recorded</small></div><div className="portfolio-detail-grid"><p><strong>Authorized scope</strong>{selectedMission.scope}</p><p><strong>Assigned owner</strong>{selectedMission.owner}</p><p><strong>Evidence ledger</strong>{selectedMission.evidence} preserved artifacts</p><p><strong>Validated findings</strong>{selectedMission.findings} material record{selectedMission.findings === 1 ? "" : "s"}</p></div><div className="portfolio-note"><span>Current operator context</span><p>{selectedMission.note}</p></div><div className="record-actions"><button onClick={() => onNavigate("Missions")}>Open mission timeline <ChevronRight size={14} /></button><button onClick={() => onNavigate("Evidence")}>Review custody ledger</button><button onClick={() => onNavigate("Reports")}>Open report record</button></div></article><aside className="portfolio-governance"><span className="eyebrow">Portfolio controls</span><h2>Scope posture</h2><p>Each case card shows approved scope, mission owner, evidence count, and material risk without implying live access or execution.</p><dl><div><dt>Active authorizations</dt><dd>{missions.filter((mission) => mission.authorization === "Active").length}</dd></div><div><dt>Paused mission</dt><dd>{missions.filter((mission) => mission.status === "Paused").length}</dd></div><div><dt>Report-ready cases</dt><dd>{missions.filter((mission) => mission.stage === "Report").length}</dd></div></dl><button className="workspace-action" onClick={() => onNavigate("Settings")}>Review mission settings <ChevronRight size={14} /></button></aside></section>
  </section>;
}
