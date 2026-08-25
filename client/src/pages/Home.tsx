/**
 * NEXUS design reminder: a restrained Forensic Timeline workspace where chronology,
 * scope, evidence, and approval are visible without neon decoration or dashboard noise.
 */
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  Activity,
  AlertTriangle,
  Archive,
  BadgeCheck,
  Bot,
  BrainCircuit,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  CircleX,
  Clock3,
  FileCheck2,
  FileText,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Menu,
  Network,
  Pause,
  Play,
  Radar,
  RotateCcw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Terminal,
  UserRound,
  Wrench,
} from "lucide-react";
import FunctionalWorkspace from "@/components/FunctionalWorkspace";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Missions", icon: Radar },
  { label: "Attack Surface", icon: Network },
  { label: "Findings", icon: AlertTriangle },
  { label: "Evidence", icon: Archive },
  { label: "Agents", icon: Bot },
  { label: "Tools", icon: Wrench },
  { label: "Terminal", icon: Terminal },
  { label: "Reports", icon: FileText },
  { label: "Settings", icon: SlidersHorizontal },
];

const stages = [
  { id: 1, title: "Target", time: "14:37:10", icon: Radar, count: "2 items", tone: "done" },
  { id: 2, title: "Scope", time: "14:38:02", icon: ShieldCheck, count: "1 item", tone: "done" },
  { id: 3, title: "Recon", time: "14:45:11", icon: Search, count: "12 items", tone: "done" },
  { id: 4, title: "Attack Surface", time: "14:52:33", icon: Network, count: "18 items", tone: "done" },
  { id: 5, title: "Test", time: "15:04:57", icon: FlaskConical, count: "31 items", tone: "done" },
  { id: 6, title: "Hypothesis", time: "15:16:22", icon: BrainCircuit, count: "2 branches", tone: "active" },
  { id: 7, title: "Critic", time: "15:20:31", icon: GitBranch, count: "2 reviews", tone: "active" },
  { id: 8, title: "Validation", time: "15:28:14", icon: BadgeCheck, count: "2 decisions", tone: "active" },
  { id: 9, title: "Evidence", time: "15:42:18", icon: Archive, count: "6 items", tone: "pending" },
  { id: 10, title: "Report", time: "15:42:18", icon: FileText, count: "Draft v0.9", tone: "pending" },
];

const stageDetails: Record<number, { title: string; summary: string; rows: [string, string][]; tools: string[]; agent: string }> = {
  1: { title: "Target identified", summary: "A contained demonstration environment is attached to this mission.", rows: [["Asset class", "Web application"], ["Target", "demo.nexus.lab"]], tools: ["Target intake"], agent: "PlannerAgent" },
  2: { title: "Scope confirmed", summary: "The mission permits active validation only within the approved local range.", rows: [["CIDR", "10.10.0.0/16"], ["Rules", "3 allow / 0 deny"]], tools: ["Scope-check"], agent: "ScopeGuard" },
  3: { title: "Hosts discovered", summary: "Discovery produced a compact service inventory with confidence retained per source.", rows: [["Hosts", "142"], ["Open ports", "27"]], tools: ["Nmap", "DNSenum"], agent: "ReconAgent" },
  4: { title: "Attack surface mapped", summary: "Potential vectors are grouped by service and attached to the mission record.", rows: [["Services", "59"], ["Potential vectors", "8"]], tools: ["ASER", "Shodan"], agent: "SurfaceAgent" },
  5: { title: "Tests executed", summary: "Each test remains traceable to the approval state that permitted it.", rows: [["Executed", "87"], ["Findings", "4"]], tools: ["Nuclei", "Metasploit"], agent: "TestAgent" },
  6: { title: "Hypotheses branched", summary: "Two explanations are being compared against the captured evidence set.", rows: [["Hypotheses", "2"], ["Current confidence", "78%"]], tools: ["AI planner"], agent: "AnalystAgent" },
  7: { title: "Critic review", summary: "The critic attempts to disprove conclusions before a finding can advance.", rows: [["Rejected", "1"], ["Approved", "1"]], tools: ["Evidence diff"], agent: "CriticAgent" },
  8: { title: "Validation decision", summary: "Validation defines whether evidence is sufficient for the report record.", rows: [["Validated", "1"], ["Not validated", "1"]], tools: ["Validation suite"], agent: "ValidatorAgent" },
  9: { title: "Evidence preserved", summary: "Artifacts are stored with a clear chain of custody and source context.", rows: [["Artifacts", "6"], ["Integrity", "Intact"]], tools: ["Evidence vault"], agent: "EvidenceAgent" },
  10: { title: "Report pending", summary: "The report is ready for operator review once the next action is approved.", rows: [["Draft", "v0.9"], ["Validated findings", "1"]], tools: ["Report builder"], agent: "ReportAgent" },
};

const agents = [
  ["PlannerAgent", "Completed 14:37:10", "100%"],
  ["ScopeGuard", "Completed 14:38:02", "100%"],
  ["ReconAgent", "Completed 14:45:11", "98%"],
  ["SurfaceAgent", "Completed 14:52:33", "94%"],
  ["TestAgent", "Completed 15:04:57", "91%"],
  ["CriticAgent", "Active", "83%"],
  ["ValidatorAgent", "Active", "91%"],
];

function StatusPill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "success" | "danger" | "warning" | "neutral" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

export default function Home() {
  // The useAuth hook provides authentication state.
  // To implement login/logout, call logout(), or start login from an event
  // handler: onClick={() => startLogin()} (imported from "@/const"). Never call
  // startLogin() during render (no href={startLogin()}) — it mints a one-time
  // nonce cookie and must run only at the moment of navigation.
  let { user, loading, error, isAuthenticated, logout } = useAuth();

  const [activeNav, setActiveNav] = useState("Missions");
  const [selectedStage, setSelectedStage] = useState(6);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isApproved, setIsApproved] = useState(false);
  const [selectedHypothesis, setSelectedHypothesis] = useState<"HYP-01" | "HYP-02">("HYP-02");
  const [evidenceTab, setEvidenceTab] = useState<"Evidence preview" | "Agent log" | "Raw output">("Evidence preview");
  const [workspaceStatus, setWorkspaceStatus] = useState<string | null>(null);
  const detail = stageDetails[selectedStage];
  const selectedStageData = stages.find((stage) => stage.id === selectedStage) ?? stages[0];

  useEffect(() => {
    if (!isPlaying) return;
    const replay = window.setInterval(() => {
      setSelectedStage((stage) => {
        if (stage >= 10) {
          setIsPlaying(false);
          return 10;
        }
        return stage + 1;
      });
    }, 1100);
    return () => window.clearInterval(replay);
  }, [isPlaying]);

  useEffect(() => {
    if (!workspaceStatus) return;
    const timer = window.setTimeout(() => setWorkspaceStatus(null), 2800);
    return () => window.clearTimeout(timer);
  }, [workspaceStatus]);

  const stepTimeline = (direction: 1 | -1) => {
    setIsPlaying(false);
    setSelectedStage((stage) => Math.min(10, Math.max(1, stage + direction)));
  };

  const changeWorkspace = (workspace: string) => {
    setActiveNav(workspace);
    setWorkspaceStatus(workspace === "Missions" ? "Mission timeline restored. Replay position remains preserved." : `${workspace} workspace opened. Context is linked to the current mission.`);
  };

  useEffect(() => {
    const keyboardNavigate: Record<string, string> = {
      "1": "Dashboard",
      "2": "Missions",
      "3": "Attack Surface",
      "4": "Findings",
      "5": "Evidence",
      "6": "Agents",
      "7": "Tools",
      "8": "Terminal",
      "9": "Reports",
      "0": "Settings",
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.altKey && keyboardNavigate[event.key]) {
        event.preventDefault();
        changeWorkspace(keyboardNavigate[event.key]);
        return;
      }
      if (event.key === " ") {
        event.preventDefault();
        setIsPlaying((value) => !value);
        setWorkspaceStatus(isPlaying ? "Replay paused at the current decision record." : "Timeline replay started. Each stage advances in sequence.");
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        stepTimeline(-1);
        setWorkspaceStatus("Replayed the previous mission stage.");
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        stepTimeline(1);
        setWorkspaceStatus("Advanced to the next mission stage.");
      }
      if (event.key === "?") {
        setWorkspaceStatus("Shortcuts: Space play/pause · ←/→ step timeline · Alt+1–0 switch workspaces.");
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isPlaying]);

  const currentEvent = useMemo(
    () => (isApproved ? "Approval recorded — mission may advance to evidence review." : "Validation: HYP-02 is awaiting operator approval."),
    [isApproved],
  );

  return (
    <main className="nexus-shell">
      <aside className="sidebar" aria-label="NEXUS navigation">
        <div className="brand-lockup">
          <img src="/manus-storage/nexus-mark_bc2a72c9.png" alt="NEXUS mark" className="brand-mark" />
          <div>
            <p className="brand-name">NEXUS</p>
            <p className="brand-subtitle">AI-Powered Security</p>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map(({ label, icon: Icon }) => (
            <button key={label} className={`nav-item ${activeNav === label ? "selected" : ""}`} onClick={() => changeWorkspace(label)}>
              <Icon size={16} strokeWidth={1.7} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <div className="operator-card">
          <img src="/manus-storage/nexus-agent-silhouette_7e5a7e89.png" alt="Abstract NEXUS operator profile" />
          <div className="operator-copy">
            <span className="eyebrow">NEXUS Operator</span>
            <span>Operator</span>
            <span className="online-dot">Online</span>
          </div>
          <span className="operator-version">v2.3.1</span>
        </div>
      </aside>

      <section className="workspace">
        <header className="mission-header" style={{ backgroundImage: "linear-gradient(90deg, rgba(9, 12, 12, .98), rgba(9, 12, 12, .87)), url('/manus-storage/nexus-mission-field_ae773504.png')" }}>
          <div className="header-main">
            <div className="header-identity"><ShieldCheck size={18} /><span>Safety &amp; authorization</span><small>All actions are authorized and within scope</small></div>
            <div className="header-meta"><span>Mission:</span><strong>ACME Internal Network Assessment</strong><small>Mission ID: MIS-2025-05-21-1437</small></div>
            <div className="header-meta"><span>Scope:</span><strong>10.10.0.0/16, acme.internal</strong><small>Auth: operator@nexus.local (Security Engineer)</small></div>
            <div className="header-meta header-rules"><span>Ruleset:</span><strong>NEXUS PT v2.3</strong><small><i /> In scope</small></div>
            <div className="header-meta header-rules"><span>Data handling:</span><strong>Encrypted</strong><small><i /> Logging: full</small></div>
          </div>
          <div className="header-status">
            <span className="mission-time-label">Mission time</span>
            <strong>01:42:18</strong>
            <small>21 May 2025 · 14:37:10 UTC</small>
            <StatusPill tone="success"><ShieldCheck size={13} /> Authorized</StatusPill>
          </div>
        </header>

        <section className="content-area">
          <div className="workspace-titlebar">
            <div>
              <div className="title-row"><h1>Mission timeline replay</h1><span className="template-tag">Timeline G</span></div>
              <p>Replay ID: RPL-2025-05-21-1437 <span className="divider-dot">·</span> View: Full mission <ChevronDown size={14} /> <span className="shortcut-hint"><kbd>?</kbd> Shortcuts</span></p>
            </div>
            <div className="utility-controls" aria-label="Timeline utilities">
              <button title="Inspect evidence register" onClick={() => changeWorkspace("Evidence")}><Search size={16} /></button><button title="Restart replay from target" onClick={() => { setIsPlaying(false); setSelectedStage(1); setWorkspaceStatus("Replay rewound to the target record."); }}><RotateCcw size={16} /></button><button title="Open mission desk" onClick={() => changeWorkspace("Dashboard")}><Menu size={16} /></button><button title="Open mission settings" onClick={() => changeWorkspace("Settings")}><SlidersHorizontal size={16} /></button>
            </div>
          </div>

          <section className="timeline-wrap" aria-label="Mission stages">
            <div className="spine-caption">
              <div className="spine-brand"><img src="/manus-storage/nexus-mark_bc2a72c9.png" alt="" /><span>Mission spine</span><small>10 stage ledger</small></div>
              <p>Every decision, hypothesis, and evidence record attaches to the moment it entered this mission.</p>
            </div>
            <div className="timeline-line" />
            <div className="stage-grid">
              {stages.map((stage) => {
                const Icon = stage.icon;
                return (
                  <button key={stage.id} onClick={() => setSelectedStage(stage.id)} className={`stage-node ${selectedStage === stage.id ? "is-selected" : ""} ${stage.tone}`} aria-pressed={selectedStage === stage.id}>
                    <span className="stage-icon"><Icon size={17} strokeWidth={1.7} /></span>
                    <span className="stage-name">{stage.id}. {stage.title}</span>
                    <small>{stage.time}</small>
                    <span className="stage-dot" />
                  </button>
                );
              })}
            </div>
          </section>

          <section className="timeline-content">
            <article className="stage-card overview-card" aria-live="polite">
              <div className="card-topline"><span>{selectedStageData.count}</span><button aria-label="Collapse stage detail"><ChevronDown size={15} /></button></div>
              <h2>{detail.title}</h2>
              <p>{detail.summary}</p>
              <dl>
                {detail.rows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
              </dl>
              <div className="tool-tags">{detail.tools.map((tool) => <span key={tool}>{tool}</span>)}</div>
              <div className="assigned-agent"><Bot size={15} /> <span>{detail.agent}</span><strong>Active</strong></div>
            </article>

            <div className="stage-branch-area">
              <span className="branch-provenance">Linked to stage 6 · hypothesis record</span>
              <div className="branch-connector one" />
              <article className={`hypothesis-card ${selectedHypothesis === "HYP-01" ? "focused" : ""} rejected`} onClick={() => setSelectedHypothesis("HYP-01")} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelectedHypothesis("HYP-01")}>
                <div className="hyp-card-top"><span>HYP-01</span><StatusPill tone="danger"><CircleX size={12} /> Rejected</StatusPill></div>
                <h3>Privilege escalation via unquoted service path</h3>
                <p>Service binary path permits a weak-write hypothesis.</p>
                <div className="confidence-row"><span>Confidence</span><strong>62%</strong><i className="spark red" /></div>
                <div className="evidence-chip">EVD-2147</div>
              </article>
              <article className={`hypothesis-card ${selectedHypothesis === "HYP-02" ? "focused" : ""} approved`} onClick={() => setSelectedHypothesis("HYP-02")} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setSelectedHypothesis("HYP-02")}>
                <div className="hyp-card-top"><span>HYP-02</span><StatusPill tone="success"><CircleCheck size={12} /> Approved</StatusPill></div>
                <h3>Write access to web root leads to RCE</h3>
                <p>Writable directory in the webroot could allow code execution.</p>
                <div className="confidence-row"><span>Confidence</span><strong>78%</strong><i className="spark green" /></div>
                <div className="evidence-chip">EVD-2161 <span /> EVD-2162</div>
              </article>
            </div>

            <article className="decision-stack">
              <div className="decision-card rejected"><div><StatusPill tone="danger">Rejected</StatusPill><strong>CriticAgent</strong><small>15:20:31</small></div><p>Service path is quoted and points to a valid binary. No user-controllable write access found.</p><div className="confidence-row"><span>Confidence</span><strong>---</strong><i className="spark red" /></div></div>
              <div className="decision-card pending"><div><StatusPill tone="warning">Not validated</StatusPill><strong>ValidatorAgent</strong><small>15:28:14</small></div><p>Upstream hypothesis rejected. No destructive validation was executed.</p><div className="confidence-row"><span>Confidence</span><strong>---</strong><i className="spark amber" /></div></div>
              <div className="decision-card approved"><div><StatusPill tone="success">Validated</StatusPill><strong>ValidatorAgent</strong><small>15:28:16</small></div><p>Directory permissions support the webroot write hypothesis; review evidence before advancing.</p><div className="confidence-row"><span>Confidence</span><strong>91%</strong><i className="spark green" /></div></div>
            </article>

            <article className="evidence-column">
              <div className="evidence-art"><img src="/manus-storage/nexus-evidence-seal_14d175ff.png" alt="Abstract evidence chain of custody seal" /></div>
              <div className="evidence-head"><span>Evidence items</span><strong>6</strong></div>
              {["EVD-2147 · Process capture", "EVD-2148 · Service config dump", "EVD-2161 · Directory permissions", "EVD-2162 · IIS config dump"].map((item, index) => <button key={item} className="evidence-list-item"><span>{item}</span><small>{index < 2 ? "15:18" : "15:28"}</small></button>)}
              <div className="chain-status"><span>Chain of custody</span><StatusPill tone="success">Intact</StatusPill></div>
            </article>

            <article className="report-card">
              <span className="eyebrow">Report status</span><h2>{isApproved ? "Custody review ready" : "Pending approval"}</h2><div className="report-metric"><span>Report draft</span><strong>v0.9</strong></div><div className="report-findings"><span>Findings</span><div><i className="valid-dot" /> 1 validated</div><div><i className="reject-dot" /> 1 rejected</div><div><i className="pending-dot" /> 2 informational</div></div><p>Consequence<br /><strong>{isApproved ? "Evidence review is now permitted" : "No report action can advance yet"}</strong></p><button className={`review-report ${isApproved ? "approval-complete" : ""}`} onClick={() => setIsApproved((value) => !value)}>{isApproved ? <><CircleCheck size={15} /> Custody review authorized</> : "Authorize evidence review"}</button>
            </article>
          </section>

          <section className="micro-timeline" aria-label="Replay position">
            <span>14:37:10</span><div className="micro-line">{Array.from({ length: 18 }).map((_, index) => <i key={index} className={index === 12 ? "current" : index === 11 ? "hyp" : ""} />)}</div><div className="legend"><span><i className="reject-dot" /> Rejected</span><span><i className="valid-dot" /> Approved</span><span><i className="valid-dot" /> Validated</span><span><i className="pending-dot" /> Pending</span><span><i className="active-dot" /> Test activity</span></div>
          </section>

          <section className="lower-grid">
            <article className="replay-controls"><h2>Replay controls</h2><button className="primary-control" onClick={() => { setIsPlaying((value) => !value); setWorkspaceStatus(isPlaying ? "Replay paused at the current decision record." : "Timeline replay started. Each stage advances in sequence."); }}>{isPlaying ? <Pause size={17} /> : <Play size={17} />}{isPlaying ? "Pause replay" : "Play replay"}</button><div className="control-pair"><button onClick={() => { stepTimeline(-1); setWorkspaceStatus("Replayed the previous mission stage."); }}><RotateCcw size={15} /> Step back</button><button onClick={() => { stepTimeline(1); setWorkspaceStatus("Advanced to the next mission stage."); }}>Step forward <RotateCcw size={15} className="mirror" /></button></div><button className="secondary-control" onClick={() => changeWorkspace("Evidence")}><GitBranch size={15} /> Compare evidence</button><button className={`approval-action ${isApproved ? "approved" : ""}`} onClick={() => { setIsApproved((value) => !value); setWorkspaceStatus(isApproved ? "Evidence review authorization withdrawn." : "Evidence review authorized. The report record may advance."); }}>{isApproved ? <><CircleCheck size={16} /> Evidence review authorized</> : <><BadgeCheck size={16} /> Authorize evidence review</>}</button></article>
            <article className="event-details"><h2>Event details</h2><p className="current-event">{currentEvent}</p><dl><div><dt>Timestamp</dt><dd>15:28:16 (21 May 2025)</dd></div><div><dt>Agent</dt><dd>ValidatorAgent</dd></div><div><dt>Action</dt><dd>Validation completed</dd></div><div><dt>Result</dt><dd><StatusPill tone={isApproved ? "success" : "warning"}>{isApproved ? "Approved" : "Validated"}</StatusPill></dd></div><div><dt>Confidence</dt><dd>91% <i className="spark green" /></dd></div><div><dt>Evidence</dt><dd><span className="evidence-chip">EVD-2163</span> <span className="evidence-chip">EVD-2164</span></dd></div></dl></article>
            <article className="evidence-preview"><div className="tab-row">{(["Evidence preview", "Agent log", "Raw output"] as const).map((tab) => <button key={tab} onClick={() => setEvidenceTab(tab)} className={evidenceTab === tab ? "active" : ""}>{tab}</button>)}</div><div className="preview-content"><div className="preview-title"><span>{evidenceTab}</span><small>Captured: 21 May 2025 15:28:45</small></div>{evidenceTab === "Evidence preview" ? <pre>{`C:\\inetpub\\wwwroot> whoami\nIIS APPPOOL\\acme_web\n\nC:\\inetpub\\wwwroot> icacls uploads\nuploads  IIS APPPOOL\\acme_web:(M)\n         BUILTIN\\Administrators:(F)\n\nValidation: write access confirmed\nScope: 10.10.0.0/16`}</pre> : evidenceTab === "Agent log" ? <pre>{`[15:28:11] ValidatorAgent: compare permission records\n[15:28:14] EvidenceAgent: chain preserved (2 items)\n[15:28:16] ValidatorAgent: sufficient evidence\n[15:28:18] ScopeGuard: action requires approval`}</pre> : <pre>{`{\n  "finding": "HYP-02",\n  "confidence": 0.91,\n  "validation": "sufficient",\n  "scope": "approved",\n  "evidence": ["EVD-2163", "EVD-2164"]\n}`}</pre>}</div></article>
            <article className="agent-presence"><h2>Agent presence</h2>{agents.map(([name, status, progress], index) => <div className="agent-row" key={name}><span className="agent-avatar">{index + 1}</span><div><strong>{name}</strong><small>{status}</small></div><span className="agent-meter"><i style={{ width: progress }} /></span><b>{progress}</b></div>)}</article>
          </section>
        </section>
        {activeNav !== "Missions" && <FunctionalWorkspace key={activeNav} view={activeNav} onReturn={() => changeWorkspace("Missions")} onNavigate={changeWorkspace} />}
        {workspaceStatus && <div className="workspace-feedback" role="status"><CircleCheck size={16} /><span>{workspaceStatus}</span></div>}
      </section>
    </main>
  );
}
