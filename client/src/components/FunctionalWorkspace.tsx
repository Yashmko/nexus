/**
 * NEXUS design reminder: functional workspace screens follow the restrained Forensic Timeline
 * system—ledger-like metadata, no decorative dashboard clutter, and semantic color only for decisions.
 */
import { useEffect, useMemo, useState } from "react";
import { jsPDF } from "jspdf";
import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { trpc } from "@/lib/trpc";
import PortfolioWorkspace from "@/components/PortfolioWorkspace";
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeft,
  BadgeCheck,
  Bot,
  Check,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock3,
  Download,
  FileText,
  Filter,
  Gauge,
  GitCompareArrows,
  Globe2,
  Network,
  Play,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Terminal,
  Wrench,
} from "lucide-react";

type WorkspaceProps = {
  view: string;
  onReturn: () => void;
  onNavigate: (view: string) => void;
};

const findings = [
  { id: "FND-042", title: "Write access to web root", severity: "High", state: "Validated", confidence: "91%", evidence: 2, detail: "Directory permissions allow the application pool identity to modify a web-accessible directory." },
  { id: "FND-037", title: "Unquoted service path", severity: "Medium", state: "Rejected", confidence: "62%", evidence: 1, detail: "Critic review found the executable path quoted and no controllable write boundary." },
  { id: "FND-025", title: "Verbose error disclosure", severity: "Low", state: "In review", confidence: "47%", evidence: 3, detail: "Detailed server error responses require a second review against application configuration." },
];

const evidence = [
  { id: "EVD-2161", title: "Directory permissions", kind: "Tool output", stage: "Validation", time: "15:28:02", integrity: "Intact" },
  { id: "EVD-2162", title: "IIS configuration dump", kind: "Configuration", stage: "Validation", time: "15:28:11", integrity: "Intact" },
  { id: "EVD-2147", title: "Process capture", kind: "Command output", stage: "Critic", time: "15:20:15", integrity: "Intact" },
  { id: "EVD-2148", title: "Service config dump", kind: "Command output", stage: "Critic", time: "15:20:22", integrity: "Intact" },
];

const agents = [
  { name: "PlannerAgent", role: "Mission orchestration", status: "Completed", confidence: 100, note: "Locked the target, scope, and initial evidence plan." },
  { name: "ScopeGuard", role: "Scope enforcement", status: "Completed", confidence: 100, note: "Verified the authorized range before active stages began." },
  { name: "ReconAgent", role: "Asset discovery", status: "Completed", confidence: 98, note: "Recorded 142 hosts and preserved collection sources." },
  { name: "CriticAgent", role: "Finding challenge", status: "Active", confidence: 83, note: "Testing rival explanations for the current hypothesis." },
  { name: "ValidatorAgent", role: "Evidence validation", status: "Active", confidence: 91, note: "Determining whether evidence is sufficient for a report record." },
];

const tools = [
  { name: "Nmap", category: "Network", status: "Available", version: "7.95", check: "Checked 6m ago" },
  { name: "Nuclei", category: "Web", status: "Available", version: "3.3.6", check: "Checked 6m ago" },
  { name: "HTTPX", category: "Recon", status: "Available", version: "1.6.3", check: "Checked 6m ago" },
  { name: "BBOT", category: "Recon", status: "Available", version: "2.0.0", check: "Checked 8m ago" },
  { name: "FFUF", category: "Web", status: "Degraded", version: "2.1.0", check: "Checked 12m ago" },
];

const surfaceAssets = [
  { id: "acme.internal", label: "acme.internal", kind: "Domain", risk: "Info", confidence: "100%", source: "ScopeGuard", exposure: "Authorized root", service: "DNS / internal zone", evidence: "EVD-2103", relation: "Mission root", x: "46%", y: "14%", finding: null },
  { id: "api.acme.internal", label: "api.acme.internal", kind: "Application", risk: "High", confidence: "95%", source: "ReconAgent", exposure: "Internet-facing API", service: "HTTPS :443 · IIS 10", evidence: "EVD-2161", relation: "Route /upload", x: "24%", y: "43%", finding: "FND-042" },
  { id: "vpn.acme.internal", label: "vpn.acme.internal", kind: "Gateway", risk: "Medium", confidence: "92%", source: "ReconAgent", exposure: "Remote access gateway", service: "SSL VPN :443", evidence: "EVD-2114", relation: "Identity boundary", x: "73%", y: "34%", finding: null },
  { id: "mail.acme.internal", label: "mail.acme.internal", kind: "Application", risk: "Low", confidence: "88%", source: "SurfaceAgent", exposure: "Internal messaging", service: "SMTP :25 · IMAPS :993", evidence: "EVD-2120", relation: "Service host", x: "76%", y: "66%", finding: null },
  { id: "dev.acme.internal", label: "dev.acme.internal", kind: "Application", risk: "Medium", confidence: "90%", source: "SurfaceAgent", exposure: "Development environment", service: "HTTPS :8443 · Git", evidence: "EVD-2131", relation: "Deployment path", x: "51%", y: "75%", finding: "FND-025" },
  { id: "10.10.20.15", label: "10.10.20.15", kind: "Host", risk: "High", confidence: "94%", source: "ReconAgent", exposure: "Windows application host", service: "WinRM :5985 · SMB :445", evidence: "EVD-2147", relation: "API backing host", x: "28%", y: "78%", finding: "FND-037" },
  { id: "POST /upload", label: "POST /upload", kind: "Route", risk: "Critical", confidence: "91%", source: "ValidatorAgent", exposure: "Writable web route", service: "POST /upload · write path", evidence: "EVD-2162", relation: "API attack path", x: "18%", y: "60%", finding: "FND-042" },
];

const PREFS_STORAGE_KEY = "nexus-forensic-frontend.preferences.v1";
const REGISTERS_STORAGE_KEY = "nexus-forensic-frontend.registers.v1";

type Preferences = {
  compact: boolean;
  prompts: boolean;
  redaction: boolean;
  provider: string;
};

function loadPreferences(): Preferences {
  const fallback: Preferences = { compact: true, prompts: true, redaction: true, provider: "Ollama (local)" };
  try {
    const saved = window.localStorage.getItem(PREFS_STORAGE_KEY);
    return saved ? { ...fallback, ...JSON.parse(saved) } : fallback;
  } catch {
    return fallback;
  }
}

function loadRegisters() {
  const fallback = { findingFilter: "All", findingQuery: "", evidenceQuery: "", evidenceKind: "All" };
  try {
    const saved = window.localStorage.getItem(REGISTERS_STORAGE_KEY);
    return saved ? { ...fallback, ...JSON.parse(saved) } : fallback;
  } catch {
    return fallback;
  }
}

function LedgerStamp({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "success" | "danger" | "warning" }) {
  return <span className={`ledger-stamp ${tone}`}>{children}</span>;
}

function WorkspaceHeader({ title, kicker, icon: Icon, onReturn, children }: { title: string; kicker: string; icon: typeof Activity; onReturn: () => void; children?: React.ReactNode }) {
  return <header className="functional-header">
    <button className="return-mission" onClick={onReturn}><ArrowLeft size={15} /> Mission timeline</button>
    <div className="functional-heading"><span className="workspace-icon"><Icon size={20} /></span><div><p>{kicker}</p><h1>{title}</h1></div></div>
    <div className="functional-header-actions">{children}</div>
  </header>;
}

function EmptyExecutionNotice() {
  return <p className="execution-notice"><ShieldCheck size={13} /> Local frontend prototype — no security tool or shell process is connected.</p>;
}

export default function FunctionalWorkspace({ view, onReturn, onNavigate }: WorkspaceProps) {
  const { user, isAuthenticated, loading: authLoading, logout } = useAuth();
  const reportUtils = trpc.useUtils();
  const [savedRegisters] = useState(loadRegisters);
  const [selectedFindingId, setSelectedFindingId] = useState("FND-042");
  const [findingFilter, setFindingFilter] = useState(savedRegisters.findingFilter);
  const [findingQuery, setFindingQuery] = useState(savedRegisters.findingQuery);
  const [selectedEvidence, setSelectedEvidence] = useState("EVD-2161");
  const [evidenceQuery, setEvidenceQuery] = useState(savedRegisters.evidenceQuery);
  const [evidenceKind, setEvidenceKind] = useState(savedRegisters.evidenceKind);
  const [selectedAgent, setSelectedAgent] = useState("CriticAgent");
  const [toolRows, setToolRows] = useState(tools);
  const [terminalCommand, setTerminalCommand] = useState("nexus scope show");
  const [terminalEntries, setTerminalEntries] = useState<string[]>(["NEXUS frontend console", "Execution engine: disconnected", "Use this console to prepare a command for the backend integration."]);
  const [reportFormat, setReportFormat] = useState<"Markdown" | "JSON" | "PDF">("Markdown");
  const [reportNotice, setReportNotice] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [comparisonReportId, setComparisonReportId] = useState<number | null>(null);
  const [settings, setSettings] = useState(loadPreferences);
  const [surfaceAsset, setSurfaceAsset] = useState("api.acme.internal");
  const [surfaceQuery, setSurfaceQuery] = useState("");
  const [surfaceKind, setSurfaceKind] = useState("All");
  const [surfaceRisk, setSurfaceRisk] = useState("All");

  const reportQuery = trpc.reports.latest.useQuery(
    { missionId: "MIS-2025-05-21-1437" },
    { enabled: view === "Reports" && isAuthenticated, retry: false },
  );
  const reportHistoryQuery = trpc.reports.history.useQuery(
    { missionId: "MIS-2025-05-21-1437" },
    { enabled: view === "Reports" && isAuthenticated, retry: false },
  );

  const selectedFinding = findings.find((finding) => finding.id === selectedFindingId) ?? findings[0];
  const filteredFindings = findings.filter((finding) => {
    const matchesFilter = findingFilter === "All" || finding.state === findingFilter;
    const query = findingQuery.trim().toLowerCase();
    const matchesQuery = !query || [finding.id, finding.title, finding.severity, finding.state, finding.detail].join(" ").toLowerCase().includes(query);
    return matchesFilter && matchesQuery;
  });
  const filteredEvidence = evidence.filter((item) => {
    const matchesKind = evidenceKind === "All" || item.kind === evidenceKind;
    const query = evidenceQuery.trim().toLowerCase();
    const matchesQuery = !query || [item.id, item.title, item.kind, item.stage, item.integrity].join(" ").toLowerCase().includes(query);
    return matchesKind && matchesQuery;
  });
  const currentEvidence = evidence.find((item) => item.id === selectedEvidence) ?? evidence[0];
  const currentAgent = agents.find((agent) => agent.name === selectedAgent) ?? agents[0];
  const filteredSurfaceAssets = surfaceAssets.filter((asset) => {
    const query = surfaceQuery.trim().toLowerCase();
    const matchesQuery = !query || [asset.label, asset.kind, asset.risk, asset.service, asset.exposure, asset.evidence].join(" ").toLowerCase().includes(query);
    const matchesKind = surfaceKind === "All" || asset.kind === surfaceKind;
    const matchesRisk = surfaceRisk === "All" || asset.risk === surfaceRisk;
    return matchesQuery && matchesKind && matchesRisk;
  });
  const selectedSurfaceAsset = surfaceAssets.find((asset) => asset.id === surfaceAsset) ?? surfaceAssets[0];
  const reportHistory = reportHistoryQuery.data ?? [];
  const storedReport = reportQuery.data;
  const selectedStoredReport = reportHistory.find((record) => record.id === selectedReportId) ?? storedReport;
  const comparisonReport = reportHistory.find((record) => record.id === comparisonReportId) ?? null;
  const displayedReport = selectedStoredReport ?? storedReport;
  const reportOwnerQuery = trpc.reports.owner.useQuery(
    { reportId: displayedReport?.id ?? 0 },
    { enabled: view === "Reports" && isAuthenticated && Boolean(displayedReport?.id), retry: false },
  );
  const reportOwner = reportOwnerQuery.data;
  const reportTitle = displayedReport?.title ?? "ACME Internal Network Assessment";
  const reportScope = displayedReport?.scope ?? "10.10.0.0/16 and acme.internal";
  const reportSummary = displayedReport?.summary ?? "One finding has sufficient evidence for review. One competing path was rejected. All displayed actions are confined to the recorded scope.";

  const saveReportMutation = trpc.reports.save.useMutation({
    onSuccess: async (record) => {
      setSelectedReportId(record?.id ?? null);
      setComparisonReportId(null);
      await Promise.all([
        reportUtils.reports.latest.invalidate({ missionId: "MIS-2025-05-21-1437" }),
        reportUtils.reports.history.invalidate({ missionId: "MIS-2025-05-21-1437" }),
      ]);
      setReportNotice("Report record saved to your authenticated NEXUS workspace.");
    },
    onError: (error) => setReportNotice(error.message),
  });

  useEffect(() => {
    window.localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(REGISTERS_STORAGE_KEY, JSON.stringify({ findingFilter, findingQuery, evidenceQuery, evidenceKind }));
  }, [findingFilter, findingQuery, evidenceQuery, evidenceKind]);

  const exportReport = () => {
    const contents = reportFormat === "Markdown"
      ? `# NEXUS Mission Record\n\n## Scope\n${reportScope}\n\n## Finding\n${selectedFinding.title}\n\nState: ${selectedFinding.state}\nConfidence: ${selectedFinding.confidence}\n\n## Evidence\n${evidence.map((item) => `- ${item.id}: ${item.title}`).join("\n")}`
      : JSON.stringify({ mission: "MIS-2025-05-21-1437", scope: reportScope, finding: selectedFinding, evidence, storedReportId: storedReport?.id ?? null }, null, 2);
    if (reportFormat === "PDF") {
      const document = new jsPDF({ unit: "pt", format: "letter" });
      const margin = 48;
      let y = 58;
      const addLine = (text: string, size = 10, color: [number, number, number] = [50, 61, 60]) => {
        document.setFont("courier", size >= 14 ? "bold" : "normal");
        document.setFontSize(size);
        document.setTextColor(...color);
        const lines = document.splitTextToSize(text, 516);
        document.text(lines, margin, y);
        y += lines.length * (size + 5) + 8;
      };
      document.setFillColor(9, 13, 14);
      document.rect(0, 0, 612, 792, "F");
      addLine("NEXUS / MISSION RECORD", 17, [218, 232, 225]);
      addLine(reportTitle, 12, [141, 164, 181]);
      y += 8;
      addLine("SCOPE", 10, [165, 197, 143]);
      addLine(reportScope);
      addLine("FINDING", 10, [165, 197, 143]);
      addLine(`${selectedFinding.id} — ${selectedFinding.title}`);
      addLine(`State: ${selectedFinding.state} | Confidence: ${selectedFinding.confidence}`);
      addLine("EVIDENCE CUSTODY", 10, [165, 197, 143]);
      evidence.forEach((item) => addLine(`${item.id} — ${item.title} (${item.integrity})`));
      addLine("This record was exported by the NEXUS frontend prototype. Connect the NEXUS core for live mission evidence.", 8, [169, 181, 177]);
      document.save("nexus-mission-record.pdf");
      setReportNotice("PDF report exported to your device.");
      return;
    }
    const blob = new Blob([contents], { type: reportFormat === "Markdown" ? "text/markdown" : "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `nexus-mission-record.${reportFormat === "Markdown" ? "md" : "json"}`;
    anchor.click();
    URL.revokeObjectURL(url);
    setReportNotice(`${reportFormat} report exported to your device.`);
  };

  const saveReportRecord = () => {
    if (!isAuthenticated) {
      setReportNotice("Sign in to save this report record to your NEXUS workspace.");
      startLogin();
      return;
    }
    saveReportMutation.mutate({
      missionId: "MIS-2025-05-21-1437",
      title: "ACME Internal Network Assessment",
      scope: "10.10.0.0/16 and acme.internal",
      status: selectedFinding.state,
      summary: "One finding has sufficient evidence for review. One competing path was rejected. All displayed actions are confined to the recorded scope.",
      findingSnapshot: selectedFinding,
      evidenceSnapshot: evidence,
    });
  };

  const renderDashboard = () => <>
    <WorkspaceHeader title="Mission desk" kicker="Current assessment" icon={Gauge} onReturn={onReturn}>
      <LedgerStamp tone="success"><CircleCheck size={12} /> Scope valid</LedgerStamp>
      <button className="workspace-action" onClick={() => onNavigate("Missions")}>Open replay <ChevronRight size={15} /></button>
    </WorkspaceHeader>
    <section className="dashboard-grid">
      <article className="ledger-summary span-two"><span className="summary-label">Current decision</span><h2>Evidence supports HYP-02; operator authorization is needed before evidence review.</h2><p>All actions remain within the mission scope. The critic has closed one competing explanation.</p><div className="summary-actions"><button onClick={() => onNavigate("Findings")}>Review finding</button><button onClick={() => onNavigate("Evidence")}>Inspect custody record</button></div></article>
      <article className="ledger-stat"><span>Mission stage</span><strong>8 / 10</strong><small>Validation</small></article>
      <article className="ledger-stat"><span>Evidence captured</span><strong>6</strong><small>Chain intact</small></article>
      <article className="ledger-list"><div className="section-label"><span>Recent decision records</span><button onClick={() => onNavigate("Missions")}>Replay</button></div>{["Critic rejected HYP-01", "Validator marked HYP-02 sufficient", "ScopeGuard confirmed the approval gate"].map((item, index) => <button key={item} className="ledger-row" onClick={() => onNavigate(index === 1 ? "Findings" : "Missions")}><span>{item}</span><small>15:{20 + index * 4}:1{index}</small></button>)}</article>
      <article className="ledger-list"><div className="section-label"><span>Tool health</span><button onClick={() => onNavigate("Tools")}>Inspect</button></div>{toolRows.slice(0, 3).map((tool) => <button key={tool.name} className="ledger-row" onClick={() => onNavigate("Tools")}><span><i className="valid-dot" /> {tool.name}</span><small>{tool.status}</small></button>)}</article>
      <article className="ledger-list span-two"><div className="section-label"><span>Mission constraints</span><button onClick={() => onNavigate("Settings")}>Settings</button></div><div className="constraint-grid"><p><strong>Scope</strong>10.10.0.0/16<br />acme.internal</p><p><strong>Approval</strong>Evidence review<br />required</p><p><strong>Provider</strong>{settings.provider}<br />No requests made</p></div></article>
    </section>
  </>;

  const renderSurface = () => <>
    <WorkspaceHeader title="Attack surface" kicker="Evidence-linked topology" icon={Network} onReturn={onReturn}><label className="workspace-search"><Search size={14} /><input value={surfaceQuery} onChange={(event) => setSurfaceQuery(event.target.value)} placeholder="Search asset, service, evidence…" aria-label="Search attack surface" /></label><div className="filter-group surface-filters">{["All", "Application", "Host", "Route", "Gateway"].map((kind) => <button key={kind} onClick={() => setSurfaceKind(kind)} className={surfaceKind === kind ? "active" : ""}>{kind}</button>)}</div><button className="workspace-action" onClick={() => { setSurfaceQuery(""); setSurfaceKind("All"); setSurfaceRisk("All"); setSurfaceAsset("api.acme.internal"); }}>Reset view</button></WorkspaceHeader>
    <section className="surface-summary-line"><span>{filteredSurfaceAssets.length} topology entities shown</span><div className="risk-filter-row">{["All", "Critical", "High", "Medium", "Low"].map((risk) => <button key={risk} className={`${surfaceRisk === risk ? "active" : ""} risk-${risk.toLowerCase()}`} onClick={() => setSurfaceRisk(risk)}>{risk}</button>)}</div></section>
    <section className="surface-upgrade"><aside className="surface-ledger"><div className="section-label"><span>Surface ledger</span><small>Recorded discovery</small></div><div className="surface-metrics"><p><strong>{surfaceAssets.length}</strong><span>mapped entities</span></p><p><strong>{surfaceAssets.filter((asset) => ["Critical", "High"].includes(asset.risk)).length}</strong><span>priority paths</span></p></div><div className="surface-asset-list">{filteredSurfaceAssets.length ? filteredSurfaceAssets.map((asset) => <button key={asset.id} className={`surface-asset-row ${surfaceAsset === asset.id ? "selected" : ""}`} onClick={() => setSurfaceAsset(asset.id)}><span className={`asset-risk-dot risk-${asset.risk.toLowerCase()}`} /><div><strong>{asset.label}</strong><small>{asset.kind} · {asset.service}</small></div><LedgerStamp tone={asset.risk === "Critical" || asset.risk === "High" ? "danger" : asset.risk === "Medium" ? "warning" : "neutral"}>{asset.risk}</LedgerStamp></button>) : <p className="register-empty">No topology entity matches the active search and risk filters.</p>}</div></aside><article className="topology-board upgraded"><div className="topology-note"><span>Observed relationships</span><small>Selection opens preserved context; no live network query is performed in this frontend map.</small></div><div className="topology-map topology-map-upgraded"><i className="surface-link link-api" /><i className="surface-link link-vpn" /><i className="surface-link link-mail" /><i className="surface-link link-dev" /><i className="surface-link link-host" /><i className="surface-link link-route" />{filteredSurfaceAssets.map((asset) => <button key={asset.id} style={{ left: asset.x, top: asset.y }} className={`topology-node surface-node risk-${asset.risk.toLowerCase()} ${surfaceAsset === asset.id ? "selected" : ""}`} onClick={() => setSurfaceAsset(asset.id)}><span>{asset.kind.slice(0, 1)}</span><strong>{asset.label}</strong><small>{asset.risk}</small></button>)}<div className="surface-legend"><span><i className="risk-critical" /> Critical</span><span><i className="risk-high" /> High</span><span><i className="risk-medium" /> Medium</span><span><i className="risk-low" /> Low / info</span></div></div></article><aside className="asset-inspector surface-inspector"><div className="record-title"><div><span className="eyebrow">Selected asset</span><h2>{selectedSurfaceAsset.label}</h2></div><LedgerStamp tone={selectedSurfaceAsset.risk === "Critical" || selectedSurfaceAsset.risk === "High" ? "danger" : selectedSurfaceAsset.risk === "Medium" ? "warning" : "neutral"}>{selectedSurfaceAsset.risk}</LedgerStamp></div><p className="asset-exposure">{selectedSurfaceAsset.exposure}</p><dl><div><dt>Asset type</dt><dd>{selectedSurfaceAsset.kind}</dd></div><div><dt>Observed service</dt><dd>{selectedSurfaceAsset.service}</dd></div><div><dt>Confidence</dt><dd>{selectedSurfaceAsset.confidence}</dd></div><div><dt>Discovery source</dt><dd>{selectedSurfaceAsset.source}</dd></div><div><dt>Evidence provenance</dt><dd>{selectedSurfaceAsset.evidence}</dd></div><div><dt>Relationship</dt><dd>{selectedSurfaceAsset.relation}</dd></div></dl><div className="asset-path-note"><span>Risk rationale</span><p>{selectedSurfaceAsset.risk === "Critical" || selectedSurfaceAsset.risk === "High" ? "This entity intersects an evidence-backed priority path and should be reviewed alongside its linked custody record." : "This entity remains recorded for context; risk is derived from the displayed mission evidence."}</p></div><div className="asset-actions"><button className="workspace-action" onClick={() => onNavigate("Evidence")}>Open evidence <ChevronRight size={14} /></button>{selectedSurfaceAsset.finding && <button className="workspace-action subtle" onClick={() => onNavigate("Findings")}>Review {selectedSurfaceAsset.finding} <ChevronRight size={14} /></button>}</div></aside></section>
  </>;

  const renderFindings = () => <>
    <WorkspaceHeader title="Findings register" kicker="Validated security record" icon={AlertTriangle} onReturn={onReturn}><label className="workspace-search"><Search size={14} /><input value={findingQuery} onChange={(event) => setFindingQuery(event.target.value)} placeholder="Search finding, ID, severity..." aria-label="Search findings" /></label><div className="filter-group">{["All", "Validated", "Rejected", "In review"].map((filter) => <button key={filter} onClick={() => setFindingFilter(filter)} className={findingFilter === filter ? "active" : ""}>{filter}</button>)}</div></WorkspaceHeader>
    <section className="register-result-line"><span>{filteredFindings.length} record{filteredFindings.length === 1 ? "" : "s"} shown</span>{(findingQuery || findingFilter !== "All") && <button onClick={() => { setFindingQuery(""); setFindingFilter("All"); }}>Clear search and filters</button>}</section><section className="findings-layout"><aside className="finding-list">{filteredFindings.length ? filteredFindings.map((finding) => <button key={finding.id} className={`finding-list-item ${selectedFinding.id === finding.id ? "selected" : ""}`} onClick={() => setSelectedFindingId(finding.id)}><span className={`severity ${finding.severity.toLowerCase()}`}>{finding.severity}</span><strong>{finding.title}</strong><small>{finding.id} · {finding.confidence}</small><LedgerStamp tone={finding.state === "Validated" ? "success" : finding.state === "Rejected" ? "danger" : "warning"}>{finding.state}</LedgerStamp></button>) : <p className="register-empty">No findings match this query. Adjust the search terms or clear the active filter.</p>}</aside><article className="finding-record"><div className="record-title"><div><span className="eyebrow">{selectedFinding.id}</span><h2>{selectedFinding.title}</h2></div><LedgerStamp tone={selectedFinding.state === "Validated" ? "success" : selectedFinding.state === "Rejected" ? "danger" : "warning"}>{selectedFinding.state}</LedgerStamp></div><div className="record-grid"><p><strong>Hypothesis</strong>{selectedFinding.detail}</p><p><strong>Critic result</strong>{selectedFinding.state === "Rejected" ? "The current record does not support a controllable escalation path." : "Competing explanations have been reduced to an insufficient alternative."}</p><p><strong>Validation</strong>{selectedFinding.state === "Validated" ? "Reproducible evidence supports an operator review." : "More evidence is required before any report claim."}</p><p><strong>Impact</strong>Classification remains tied to validated evidence and the authorized mission scope.</p></div><div className="record-actions"><button onClick={() => onNavigate("Evidence")}>Open {selectedFinding.evidence} linked evidence items</button><button onClick={() => onNavigate("Reports")}>Open report record</button></div></article></section>
  </>;

  const renderEvidence = () => <>
    <WorkspaceHeader title="Evidence custody" kicker="Preserved artifacts" icon={Archive} onReturn={onReturn}><label className="workspace-search"><Search size={14} /><input value={evidenceQuery} onChange={(event) => setEvidenceQuery(event.target.value)} placeholder="Search artifact, ID, stage..." aria-label="Search evidence" /></label><div className="filter-group">{["All", "Tool output", "Configuration", "Command output"].map((kind) => <button key={kind} onClick={() => setEvidenceKind(kind)} className={evidenceKind === kind ? "active" : ""}>{kind === "Configuration" ? "Config" : kind === "Command output" ? "Command" : kind}</button>)}</div><LedgerStamp tone="success"><BadgeCheck size={12} /> Chain intact</LedgerStamp></WorkspaceHeader>
    <section className="register-result-line"><span>{filteredEvidence.length} artifact{filteredEvidence.length === 1 ? "" : "s"} shown</span>{(evidenceQuery || evidenceKind !== "All") && <button onClick={() => { setEvidenceQuery(""); setEvidenceKind("All"); }}>Clear search and filters</button>}</section><section className="evidence-layout"><aside className="evidence-register">{filteredEvidence.length ? filteredEvidence.map((item) => <button key={item.id} className={selectedEvidence === item.id ? "selected" : ""} onClick={() => setSelectedEvidence(item.id)}><span>{item.id}</span><strong>{item.title}</strong><small>{item.kind} · {item.time}</small></button>) : <p className="register-empty">No evidence matches this query. Adjust the search terms or clear the active filter.</p>}</aside><article className="evidence-record"><div className="record-title"><div><span className="eyebrow">{currentEvidence.id}</span><h2>{currentEvidence.title}</h2></div><LedgerStamp tone="success">{currentEvidence.integrity}</LedgerStamp></div><dl><div><dt>Artifact type</dt><dd>{currentEvidence.kind}</dd></div><div><dt>Mission stage</dt><dd>{currentEvidence.stage}</dd></div><div><dt>Captured</dt><dd>21 May 2025 · {currentEvidence.time}</dd></div><div><dt>Handling</dt><dd>Redacted at capture</dd></div></dl><pre>{`Evidence record: ${currentEvidence.id}\nSource: ${currentEvidence.kind}\nIntegrity: ${currentEvidence.integrity}\n\nRecorded action was contained within the approved\nlocal demonstration scope. No external target data is present.`}</pre><button className="workspace-action" onClick={() => onNavigate("Findings")}>Return to linked finding <ChevronRight size={14} /></button></article></section>
  </>;

  const renderAgents = () => <>
    <WorkspaceHeader title="Agent ledger" kicker="Coordinated specialists" icon={Bot} onReturn={onReturn}><LedgerStamp tone="neutral">5 agents recorded</LedgerStamp><button className="workspace-action" onClick={() => setSelectedAgent("CriticAgent")}>Inspect active agent</button></WorkspaceHeader>
    <section className="agents-layout"><div className="agent-list-panel">{agents.map((agent) => <button key={agent.name} className={`agent-ledger-row ${selectedAgent === agent.name ? "selected" : ""}`} onClick={() => setSelectedAgent(agent.name)}><span className="agent-avatar">{agent.name.slice(0, 1)}</span><div><strong>{agent.name}</strong><small>{agent.role}</small></div><span className="agent-confidence"><i style={{ width: `${agent.confidence}%` }} />{agent.confidence}%</span></button>)}</div><article className="agent-detail"><span className="eyebrow">Selected specialist</span><h2>{currentAgent.name}</h2><p>{currentAgent.role}</p><div className="agent-detail-status"><LedgerStamp tone={currentAgent.status === "Active" ? "success" : "neutral"}>{currentAgent.status}</LedgerStamp><strong>{currentAgent.confidence}% confidence</strong></div><p className="agent-note">{currentAgent.note}</p><button className="workspace-action" onClick={() => onNavigate("Missions")}>Locate on mission spine <ChevronRight size={14} /></button></article></section>
  </>;

  const renderTools = () => <>
    <WorkspaceHeader title="Tool registry" kicker="Execution adapter health" icon={Wrench} onReturn={onReturn}><button className="workspace-action" onClick={() => setToolRows((items) => items.map((item) => ({ ...item, check: "Checked just now", status: item.name === "FFUF" ? "Available" : item.status })))}><RefreshCw size={14} /> Run local health check</button></WorkspaceHeader>
    <section className="tool-table"><div className="tool-table-head"><span>Tool</span><span>Category</span><span>Version</span><span>Status</span><span>Latest check</span></div>{toolRows.map((tool) => <div className="tool-table-row" key={tool.name}><strong>{tool.name}</strong><span>{tool.category}</span><span>{tool.version}</span><LedgerStamp tone={tool.status === "Available" ? "success" : "warning"}>{tool.status}</LedgerStamp><span>{tool.check}</span></div>)}</section><EmptyExecutionNotice />
  </>;

  const renderTerminal = () => <>
    <WorkspaceHeader title="Command console" kicker="Prepared command session" icon={Terminal} onReturn={onReturn}><button className="workspace-action" onClick={() => setTerminalEntries([])}>Clear console</button></WorkspaceHeader>
    <section className="terminal-layout"><article className="terminal-output">{terminalEntries.length ? terminalEntries.map((entry, index) => <p key={`${entry}-${index}`}>{entry}</p>) : <p className="terminal-muted">Console cleared. No process history is retained in this frontend session.</p>}</article><div className="terminal-input-row"><span>nexus&gt;</span><input value={terminalCommand} onChange={(event) => setTerminalCommand(event.target.value)} aria-label="NEXUS command" /><button onClick={() => setTerminalEntries((entries) => [...entries, `> ${terminalCommand}`, "[frontend] Command staged. Connect the NEXUS core to execute this process."])}><Play size={14} /> Stage command</button></div><EmptyExecutionNotice /></section>
  </>;

  const renderReports = () => <>
    <WorkspaceHeader title="Report record" kicker="Exportable mission summary" icon={FileText} onReturn={onReturn}><div className="format-switch"><button className={reportFormat === "Markdown" ? "active" : ""} onClick={() => setReportFormat("Markdown")}>Markdown</button><button className={reportFormat === "JSON" ? "active" : ""} onClick={() => setReportFormat("JSON")}>JSON</button><button className={reportFormat === "PDF" ? "active" : ""} onClick={() => setReportFormat("PDF")}>PDF</button></div><button className="workspace-action" onClick={exportReport}><Download size={14} /> Export {reportFormat}</button></WorkspaceHeader>
    <section className="report-layout">{reportNotice && <div className="report-notice"><CircleCheck size={14} /> {reportNotice}</div>}<aside className="report-history-panel"><div className="section-label"><span><Clock3 size={13} /> Version history</span><small>{isAuthenticated ? `${reportHistory.length} saved` : "Private"}</small></div>{!isAuthenticated ? <p className="history-empty">Sign in to view and create owner-scoped report versions.</p> : reportHistoryQuery.isFetching ? <p className="history-empty">Loading private report history…</p> : reportHistory.length ? reportHistory.map((record, index) => <button key={record.id} className={`report-history-item ${displayedReport?.id === record.id ? "selected" : ""}`} onClick={() => { setSelectedReportId(record.id); setComparisonReportId(null); }}><span>v{reportHistory.length - index}</span><strong>{record.status}</strong><small>{new Date(record.updatedAt).toLocaleString()}</small></button>) : <p className="history-empty">No saved versions yet. Save the current draft to establish the report ledger.</p>}{isAuthenticated && reportHistory.length > 1 && <button className="compare-toggle" onClick={() => setComparisonReportId((current) => current ? null : reportHistory.find((record) => record.id !== displayedReport?.id)?.id ?? null)}><GitCompareArrows size={14} /> {comparisonReport ? "Close comparison" : "Compare selected"}</button>}</aside><article className="report-preview"><span className="eyebrow">NEXUS / Mission record</span><h2>{reportTitle}</h2><div className="report-sync-line"><LedgerStamp tone={displayedReport ? "success" : "warning"}>{reportQuery.isFetching ? "Loading report record" : displayedReport ? `Saved record #${displayedReport.id}` : "Local draft only"}</LedgerStamp>{displayedReport?.updatedAt && <span>Last synced {new Date(displayedReport.updatedAt).toLocaleString()}</span>}</div>{comparisonReport && displayedReport && <div className="report-comparison"><div><span className="eyebrow">Comparison</span><h3>Selected report vs previous version</h3></div><p><strong>Current status</strong>{displayedReport.status}</p><p><strong>Compared status</strong>{comparisonReport.status}</p><p><strong>Scope</strong>{displayedReport.scope === comparisonReport.scope ? "Unchanged" : "Scope differs between saved versions"}</p><p><strong>Evidence snapshot</strong>{JSON.stringify(displayedReport.evidenceSnapshot) === JSON.stringify(comparisonReport.evidenceSnapshot) ? "Unchanged" : "Evidence snapshot differs between saved versions"}</p></div>}<div className="report-section"><strong>Executive status</strong><p>{reportSummary}</p></div><div className="report-section"><strong>Scope</strong><p>{reportScope}</p></div><div className="report-section"><strong>Finding</strong><p>{selectedFinding.title} · {displayedReport?.status ?? selectedFinding.state} · {selectedFinding.confidence} confidence</p></div><div className="report-section"><strong>Evidence</strong><p>{evidence.length} preserved artifacts with intact custody records.</p></div></article><aside className="report-side"><span className="eyebrow">Report ownership</span><h2>{authLoading ? "Checking session" : isAuthenticated ? "Private to you" : "Sign-in required"}</h2><p>{isAuthenticated ? `${reportOwner?.name ?? reportOwner?.email ?? user?.name ?? user?.email ?? "Authenticated operator"} owns and can view these report versions. Records are scoped to the signed-in workspace.` : "Local exports remain available. Sign in to save private report versions and inspect their history."}</p>{isAuthenticated && <div className="owner-control"><span>Role</span><strong>{reportOwner?.role ?? user?.role ?? "user"}</strong><button onClick={() => void logout()}>Sign out</button></div>}<button className="workspace-action" onClick={saveReportRecord} disabled={saveReportMutation.isPending}>{saveReportMutation.isPending ? "Saving version…" : isAuthenticated ? "Save new version" : "Sign in to save"}</button><span className="eyebrow report-export-label">Export preview</span><p>{reportFormat === "PDF" ? "Creates a styled, downloadable PDF record directly in the browser." : "The download is generated locally from the visible report record."}</p><button className="workspace-action" onClick={exportReport}><Download size={14} /> Export {reportFormat}</button></aside></section>
  </>;

  const renderSettings = () => <>
    <WorkspaceHeader title="Mission settings" kicker="Frontend preferences" icon={Settings2} onReturn={onReturn}><LedgerStamp tone="success">Saved in this browser</LedgerStamp></WorkspaceHeader>
    <section className="settings-layout"><article className="settings-section"><h2>Operator preferences</h2>{([ ["compact", "Compact evidence ledger", "Keeps dense technical metadata visible."], ["prompts", "Approval prompts", "Requires an explicit operator decision in the interface."], ["redaction", "Secret redaction preview", "Masks credential-like values in visible evidence."] ] as const).map(([key, title, description]) => <label className="setting-toggle" key={key}><div><strong>{title}</strong><small>{description}</small></div><input type="checkbox" checked={settings[key]} onChange={() => setSettings((state) => ({ ...state, [key]: !state[key] }))} /><span /></label>)}</article><article className="settings-section"><h2>AI provider display</h2><p>The interface does not make provider requests in this frontend build.</p><div className="provider-list">{["Ollama (local)", "OpenAI", "Anthropic", "Gemini"].map((provider) => <button key={provider} className={settings.provider === provider ? "selected" : ""} onClick={() => setSettings((state) => ({ ...state, provider }))}>{settings.provider === provider && <Check size={14} />}{provider}</button>)}</div></article></section>
  </>;

  const body = useMemo(() => {
    if (view === "Dashboard") return renderDashboard();
    if (view === "Portfolio") return <PortfolioWorkspace onReturn={onReturn} onNavigate={onNavigate} />;
    if (view === "Attack Surface") return renderSurface();
    if (view === "Findings") return renderFindings();
    if (view === "Evidence") return renderEvidence();
    if (view === "Agents") return renderAgents();
    if (view === "Tools") return renderTools();
    if (view === "Terminal") return renderTerminal();
    if (view === "Reports") return renderReports();
    if (view === "Settings") return renderSettings();
    return renderDashboard();
  }, [view, user, isAuthenticated, authLoading, storedReport, displayedReport, comparisonReport, reportHistory, reportHistoryQuery.isFetching, reportQuery.isFetching, saveReportMutation.isPending, selectedFindingId, selectedReportId, comparisonReportId, findingFilter, findingQuery, selectedEvidence, evidenceQuery, evidenceKind, selectedAgent, toolRows, terminalCommand, terminalEntries, reportFormat, reportNotice, settings, surfaceAsset, surfaceQuery, surfaceKind, surfaceRisk]);

  return <section className="functional-workspace">{body}</section>;
}
