# NEXUS — Project Details and Technical Description

> **NEXUS is a governance-first security mission-control workspace for authorized security testing.** It organizes mission scope, approvals, findings, evidence, agent activity, report records, and operator decisions into a traceable forensic timeline rather than presenting security work as an opaque collection of scanner outputs.

This document is the long-form description of the NEXUS project. It is written so that it can be reused in a GitHub repository, portfolio, technical proposal, product specification, project presentation, or README. It distinguishes the capabilities implemented in the current repository from capabilities intentionally reserved for future engineering phases.

## 1. Executive Summary

NEXUS is an AI-oriented cybersecurity operations interface designed for teams performing **authorized, explicitly scoped security assessments**. Its central idea is that a security assessment should be treated as a controlled mission with a visible chain of reasoning. Every important state should answer four questions: what was permitted, what was attempted, what evidence supports the conclusion, and who approved the next action.

The current implementation provides a serious web-based mission-control experience with a restrained monochrome forensic-ledger design. The interface contains a replayable mission timeline, scope and authorization indicators, hypotheses, validation decisions, findings, evidence records, agent activity, tool status, terminal staging, reports, settings, and an authenticated multi-mission portfolio. The backend persists report records and mission-governance records through secured tRPC procedures backed by MySQL-compatible storage.

The current system is a **governance and investigation workspace**, not a production autonomous scanner. It does not silently scan public targets, execute offensive tools against external systems, fabricate security findings, or claim that AI agents have completed operations that were not actually executed. Scanner execution, Python orchestration, provider integrations, SQLite core services, and a fully local desktop sidecar remain future engineering phases.

## 2. Short Descriptions You Can Reuse

### One-sentence description

NEXUS is a forensic, governance-first security mission-control platform that makes authorized testing traceable through explicit scope, approval gates, evidence provenance, audit records, and report history.

### Short product description

NEXUS is an AI-oriented security testing workspace for authorized operators. It combines a replayable mission timeline with governed mission records, role-aware approvals, evidence custody, activity auditing, findings review, and report persistence. Instead of hiding assessment logic behind a scanner dashboard, NEXUS exposes the operational context and decision trail that connect authorization to evidence and evidence to conclusions.

### Portfolio or resume description

Designed and implemented NEXUS, a full-stack cybersecurity mission-control workspace using React, TypeScript, Tailwind CSS, Express, tRPC, Drizzle ORM, MySQL-compatible persistence, Manus OAuth, and S3-backed evidence metadata. Built a forensic Mission Timeline Replay interface, authenticated mission portfolio, role-aware assignment and approval workflows, owner-scoped audit records, evidence attachment metadata, report versioning, local PDF export, interactive attack-surface visualization, and safe non-executing tool-readiness flows.

### Technical abstract

NEXUS is a web application that models authorized security testing as a governed mission lifecycle. The React client presents a timeline-centric operator workspace, while an Express server exposes typed tRPC procedures for authentication, report persistence, mission operations, assignments, approval decisions, activity records, evidence metadata, and notification delivery records. Drizzle ORM maps the domain model to MySQL-compatible tables. Raw files are designed to remain in object storage, with database rows retaining ownership, provenance, and access metadata. The architecture intentionally separates UI governance from future execution adapters so that scope validation, approval state, auditability, and evidence handling can be implemented before any tool is allowed to act on a target.

## 3. The Problem NEXUS Solves

Security assessment tooling often produces large quantities of output without making the operational decision trail easy to understand. A conventional scanner interface may show a host, a finding, or a severity score, but it may not clearly communicate whether the target was authorized, which approval enabled an action, which evidence supports the conclusion, which hypothesis was rejected, or how the final report changed over time.

NEXUS addresses this gap by treating an assessment as a **mission ledger**. The mission has an owner, a defined scope, an authorization posture, a lifecycle status, a risk level, assignments, approval requests, activity events, evidence references, notification records, and report snapshots. The interface connects these records to an operator-friendly timeline so that chronology and provenance remain visible.

The project is also designed around a safety boundary: a platform can be useful before it becomes dangerous. NEXUS can model and govern actions before actual tool execution is connected. This allows the authorization model, audit behavior, evidence workflow, and operator experience to be tested independently of offensive automation.

## 4. Core Product Concepts

| Concept | Meaning in NEXUS |
|---|---|
| Mission | An owner-scoped security assessment case with a title, account, scope, lifecycle status, risk, stage, progress, and evidence/finding counters. |
| Mission Timeline Replay | The primary operator view. It presents assessment stages chronologically, including target, scope, recon, attack surface, testing, hypotheses, critique, validation, evidence, and reporting. |
| Scope | The explicit network, application, account, or asset boundary within which authorized work may occur. |
| Approval gate | A recorded request and decision that must exist before a governed action is allowed to advance. |
| Hypothesis | A testable explanation for an observed security condition, retained with confidence and supporting evidence. |
| Finding | A security observation that can be reviewed, validated, rejected, or carried into a report. |
| Evidence | A captured artifact or evidence reference with source context and chain-of-custody intent. |
| Activity ledger | An immutable-style operational history of mission lifecycle, assignment, approval, attachment, and notification events. |
| Report record | A persisted structured snapshot containing mission scope, status, summary, finding data, and evidence data. |
| Operator | An authenticated user interacting with the mission workspace. Ownership and role boundaries determine which records and actions are available. |

## 5. How NEXUS Works

### 5.1 Operator entry and mission context

The operator enters the NEXUS workspace through the React client. The shell presents a persistent navigation structure and a mission header containing safety posture, mission identity, scope, authorization, ruleset, and data-handling context. The current timeline view is a controlled local interface that preserves replay position, selected stage, hypothesis focus, evidence tab, and approval state within the browser interaction model.

### 5.2 Mission timeline

The timeline is the visual spine of NEXUS. It is composed of ten conceptual stages: Target, Scope, Recon, Attack Surface, Test, Hypothesis, Critic, Validation, Evidence, and Report. Selecting a stage changes its detail card, associated metadata, tools, assigned agent, and evidence context. Replay controls allow the operator to play, pause, step backward, step forward, or reset the sequence. The interface also provides keyboard shortcuts for rapid operator navigation.

### 5.3 Mission portfolio and governance

The Portfolio workspace is the authenticated case ledger. It is designed for multiple mission records rather than a single hard-coded assessment. An authorized user can create a mission, search and filter mission records, inspect mission posture, view owner and scope context, archive a mission, manage assignments, request approval, and review approval decisions according to backend permission rules.

### 5.4 Audit, evidence, and alerts

The selected mission exposes an audit panel containing activity records, evidence attachment metadata, and approval-alert delivery records. Evidence bytes are intended to live in object storage while the database keeps metadata such as file name, MIME type, size, storage key, URL, uploader, mission, and creation time. Approval-related notification rows provide a delivery ledger instead of treating an alert as an untraceable side effect.

### 5.5 Reports

The Reports workspace supports a structured report record containing mission identity, scope, status, summary, finding snapshot, and evidence snapshot. The interface retains report history and ownership context. It also supports browser-side Markdown, JSON, and PDF export for the locally displayed report state. The persistence model is designed to support future version comparison when real authenticated report records exist.

### 5.6 Findings and evidence review

Findings and Evidence workspaces provide searchable, filterable registers. Operators can locate records by text and apply meaningful state or severity filters. Selecting a record opens a detailed forensic view containing status, provenance, evidence references, and review context.

### 5.7 Attack Surface workspace

The Attack Surface workspace presents an interactive topology-style map of assets and services. Operators can search assets, filter by type and risk, select a node, inspect service and exposure details, and navigate toward related findings or evidence. The topology is a visual reasoning aid; it is not an autonomous discovery engine in the current implementation.

### 5.8 Tools and terminal surfaces

The current active repository contains a Tool registry and Terminal staging interface. These surfaces communicate tool status, command or output context, and execution boundaries as UI state. They do not provide an unrestricted shell or silently invoke scanners against targets. Actual tool adapters and governed execution workers are future work and must be connected only after authorization and scope enforcement are complete.

## 6. Security Governance Model

NEXUS is intentionally designed for **authorized security testing only**. The governance model is part of the product architecture rather than a disclaimer added after the interface is built.

| Control | Purpose |
|---|---|
| Explicit scope | Records the approved target range, application, asset group, or environment. |
| Authorization posture | Keeps the operator aware of whether the current mission is authorized and in scope. |
| Role-aware access | Limits mission operations according to ownership, assignment role, administrator status, and authenticated identity. |
| Approval requests | Creates a durable request describing an action or transition that requires review. |
| Approval decisions | Records approval status, decision note, deciding user, and decision time. |
| Audit activity | Retains operational history for mission changes and governance events. |
| Evidence provenance | Associates evidence metadata with the mission and uploader while keeping raw bytes separate from relational records. |
| Notification delivery ledger | Records pending-approval alert intent and delivery state. |
| Secret separation | Keeps environment credentials and storage configuration outside source code. |
| Safe execution boundary | Prevents the current prototype from carrying out external scanning or offensive actions. |

A future execution layer must not be allowed to interpret a button click as permission by itself. It should require a validated mission, an in-scope target, a compatible approval decision, a non-expired authorization state, an auditable execution intent, and a redacted result path.

## 7. Architecture

### 7.1 High-level architecture

```text
Authenticated browser
        |
        v
React 19 + TypeScript + Tailwind CSS
        |
        | typed tRPC client, React Query cache, SuperJSON serialization
        v
Express server + tRPC router
        |
        +--> Manus OAuth session context
        +--> Drizzle ORM
        |       |
        |       v
        |   MySQL-compatible database
        |
        +--> S3-compatible object storage
        |       |
        |       v
        |   Evidence bytes and stored artifacts
        |
        +--> Future isolated execution service
                |
                +--> approval-aware adapter workers
                +--> redacted output and audit events
```

### 7.2 Frontend layers

The frontend is a React single-page application. `Home.tsx` provides the NEXUS shell, mission header, persistent navigation, timeline replay, hypothesis selection, evidence tabs, report approval interaction, keyboard shortcuts, and workspace transitions. `FunctionalWorkspace.tsx` renders the Dashboard, Attack Surface, Findings, Evidence, Agents, Tools, Terminal, Reports, and Settings workspaces. `PortfolioWorkspace.tsx` renders authenticated mission governance. Shared UI primitives are supplied by the shadcn/Radix-oriented component set in `client/src/components/ui`.

The design system uses a charcoal and slate base, off-white content, Signal Slate `#8DA4B5` for active or selected states, and semantic red, amber, and green only when communicating a meaningful security or approval state. Space Grotesk establishes display hierarchy, while IBM Plex Mono identifies machine data, timestamps, identifiers, commands, and evidence output.

### 7.3 Backend layers

The server uses Express as the HTTP host and tRPC as the typed API boundary. Procedures are categorized as public, protected, or administrator-only. Authentication context is created from the Manus OAuth session, and protected procedures receive the authenticated user through server context. Database helpers in `server/db.ts` centralize owner and assignment constraints. `server/routers.ts` exposes the application contract consumed by the client.

### 7.4 Persistence layers

The relational model uses Drizzle ORM with a MySQL-compatible database connection. The current schema contains users, report records, missions, mission assignments, mission approvals, mission activity, mission attachments, and mission notifications. File bytes are not intended to be stored in relational columns; attachment rows retain object-storage references and metadata.

### 7.5 Storage and secrets

The application is configured for built-in storage and object-storage helpers. Environment values such as database connection strings, OAuth configuration, session signing material, built-in API endpoints, and storage credentials are injected through the project environment. Secrets are not committed to source control and should be configured through the project’s secret-management flow.

## 8. Technology Stack

| Layer | Technology | Role |
|---|---|---|
| Language | TypeScript | Shared type safety across client, server, schema, and tests. |
| UI framework | React 19 | Component-based browser interface and stateful workspace behavior. |
| Build tooling | Vite 7 | Development server, HMR, and production client bundling. |
| Styling | Tailwind CSS 4 and custom CSS | Responsive layout utilities plus the NEXUS forensic-ledger visual system. |
| Typography | Space Grotesk and IBM Plex Mono | Display hierarchy and machine/evidence data treatment. |
| Icons | Lucide React | Consistent operational iconography. |
| Server | Express 4 | HTTP server and application host. |
| API contract | tRPC 11 | End-to-end typed client/server procedures under the application API. |
| Client data | TanStack React Query | Query caching, mutation state, invalidation, and loading/error behavior. |
| Serialization | SuperJSON | Typed transport of structured values such as dates. |
| Authentication | Manus OAuth | Authenticated browser sessions and server-side user context. |
| ORM | Drizzle ORM | Type-safe relational schema and query construction. |
| Database | MySQL-compatible database/TiDB-style connection | Persistent mission, report, approval, audit, and metadata records. |
| Object storage | S3-compatible storage helpers | Evidence and artifact bytes outside the relational database. |
| Report export | jsPDF plus browser-side Markdown/JSON generation | Local report export formats. |
| Validation | Vitest, TypeScript compiler, Playwright Core | Unit tests, static checks, and browser interaction tests. |
| Browser automation | Chromium through Playwright Core | Repeatable non-live UI verification. |
| Package manager | pnpm | Dependency installation and project scripts. |
| Optional desktop direction | Tauri 2 planned/previously prepared in the broader workstream | A native shell is a future distribution choice and is not part of the stable active repository snapshot described here. |

## 9. Data Model

| Table | Main responsibility |
|---|---|
| `users` | OAuth-linked user identity, role, timestamps, and sign-in state. |
| `report_records` | Owner-scoped report snapshots with mission key, scope, status, summary, findings, and evidence data. |
| `missions` | Mission identity, owner, account, scope, lifecycle status, risk, stage, progress, and counters. |
| `mission_assignments` | Explicit analyst, reviewer, or approver assignments for a mission. |
| `mission_approvals` | Approval requests, assigned approvers, status, decision notes, deciding user, and decision time. |
| `mission_activity` | Operational history for mission governance and lifecycle events. |
| `mission_attachments` | Evidence attachment metadata and object-storage references. |
| `mission_notifications` | Approval-alert delivery intent and delivery status. |

The model separates **identity**, **governance**, **operational history**, **evidence metadata**, and **report snapshots**. This separation makes it possible to add an execution service later without allowing raw tool output or arbitrary file bytes to become the only source of truth.

## 10. Main User Workspaces

| Workspace | What the operator can understand or do |
|---|---|
| Dashboard | Review overall mission posture and jump into active operational areas. |
| Portfolio | Manage multiple authenticated mission records, ownership, status, risk, assignments, approvals, and selected-case detail. |
| Missions | Replay the current mission chronology and inspect stage-specific reasoning. |
| Attack Surface | Search and filter a topology of assets and services, inspect selected nodes, and follow evidence links. |
| Findings | Search, filter, select, and review finding records and validation states. |
| Evidence | Search and inspect evidence records and chain-of-custody context. |
| Agents | Review agent presence, state, confidence, and activity presentation. |
| Tools | Inspect the current tool registry/status surface and understand the non-executing boundary. |
| Terminal | Stage or inspect terminal-like command context without creating an unrestricted external execution path. |
| Reports | Review report state, ownership, history, comparison context, and local exports. |
| Settings | Control interface preferences, compact presentation options, and local operator settings. |

## 11. What Makes NEXUS Different

### 11.1 Governance before automation

Many security products begin with tool execution and add workflow controls around it. NEXUS reverses that order. The authorization model, mission scope, approval records, evidence references, and audit trail are designed before any production scanner worker is connected. This makes safety and traceability architectural requirements rather than optional UI decoration.

### 11.2 Forensic timeline instead of scanner dashboard

The primary screen is a chronological mission spine. It shows how the assessment moved from target identification to scope confirmation, discovery, testing, hypothesis, critique, validation, evidence, and reporting. The emphasis is on the reasoning trail and decision context, not only on severity cards or numerical metrics.

### 11.3 Hypothesis and critique as first-class concepts

NEXUS presents competing hypotheses and explicit critic or validator states. A finding is not treated as true merely because a tool emitted a line of text. The intended workflow is to preserve the proposed explanation, confidence, evidence, counterargument, validation state, and final report consequence.

### 11.4 Evidence is linked to decisions

Evidence is not a detached file list. The interface connects evidence to hypotheses, findings, activity, approval context, and report state. The data model is prepared to keep artifact bytes in object storage while preserving provenance and ownership in the application database.

### 11.5 Human approval is visible

Approval is represented as a state transition with an actor, timestamp, note, and notification record. This is more explicit than a generic “run” button because it allows a reviewer to understand which action was requested and why it was allowed or rejected.

### 11.6 Operator-grade visual language

The visual system is intentionally restrained: charcoal surfaces, technical typography, ledger lines, compact metadata, and semantic color only where it communicates a decision or risk state. The product aims to feel like a serious forensic operations room rather than a neon cyberpunk dashboard.

### 11.7 Safe extensibility

Future scanners and AI agents can be integrated behind a governed adapter contract. The UI does not need to trust an adapter merely because it is installed. A future adapter should declare capability, target class, risk, required approval type, output handling, and cancellation behavior before it can be selected for a mission.

## 12. Security and Safety Boundaries

NEXUS is intended for systems where the operator has explicit permission to test. It must not be used to scan, exploit, persist in, or disrupt systems without authorization. The current implementation does not run a public-target assessment and does not claim that a target was tested when no executor was connected.

The current product also does not implement a production Python backend, unrestricted local shell, autonomous exploitation, stealth or persistence, exploit chaining, or cloud-provider model calls. These are not hidden capabilities. They are explicit boundaries that keep the current workspace useful for governance and review without pretending that an execution engine exists.

A production execution layer should enforce at least the following sequence:

```text
Mission exists
  -> user is authenticated
  -> operator has a permitted role
  -> target is inside the recorded scope
  -> requested action has a compatible approval
  -> approval is current and not revoked
  -> execution intent is written to the audit trail
  -> adapter runs with bounded permissions and timeout
  -> output is redacted and stored with provenance
  -> operator reviews evidence and conclusion
```

## 13. Current Implementation Status

### Implemented in the active repository

The current repository contains the React/Tailwind NEXUS shell, the interactive Mission Timeline Replay, persistent navigation, workspace transitions, keyboard shortcuts, findings and evidence search/filter interfaces, Attack Surface topology interaction, agent and tool surfaces, terminal staging, browser-side report exports, authenticated report persistence, report ownership/history UI, authenticated mission portfolio operations, assignments, approval requests and decisions, audit activity, evidence attachment metadata, notification delivery records, database migrations, tests, and TypeScript/build configuration.

The repository also includes the full-stack server template integration for Manus OAuth, Express, tRPC, Drizzle ORM, MySQL-compatible persistence, and built-in object-storage helpers. The project can be developed with the included scripts and validated with unit, type, build, and browser checks.

### Intentionally not implemented in the active repository

The active repository snapshot does not contain a Python `nexus-core` backend or CLI, a SQLite core model, actual BBOT/Subfinder/HTTPX/Nmap/Nuclei/FFUF/Playwright scanner execution, an autonomous multi-agent orchestrator, local Ollama integration, cloud AI-provider integration, an intentionally vulnerable demonstration lab, automated assessment execution against a local lab, or a fully packaged native desktop sidecar that bundles the backend.

The active repository snapshot also does not include the unfinished iPhone-responsive redesign work; that enhancement was deliberately deferred so the stable desktop/web state could be exported separately.

### Verification status

The implementation has been validated through project checks and non-live browser flows for the available features. Authenticated mission creation, real evidence upload, activity rendering, approval-alert delivery, and report-history comparison still require a real user mission record. No synthetic mission data should be inserted merely to make a screenshot or test appear successful.

## 14. Development and Validation

The principal project commands are:

```bash
pnpm install
pnpm dev
pnpm check
pnpm test
pnpm build
```

`pnpm dev` starts the development server. `pnpm check` runs the TypeScript compiler without emitting files. `pnpm test` runs the Vitest suite. `pnpm build` creates the client production bundle and server bundle. Browser verification scripts use Chromium through Playwright Core and are intended for local, non-live interaction checks.

Before connecting any future execution adapter, the project should add unit tests for scope validation, approval compatibility, authorization expiry, cancellation, redaction, adapter failure, audit completeness, and ownership boundaries. Browser tests should verify mobile and desktop layouts only after the iPhone enhancement is explicitly resumed.

## 15. Recommended Future Roadmap

### Phase A — Core execution service

Create a Python `nexus-core` package and CLI with a local SQLite model for development and desktop operation. Define mission, scope, approval, execution-intent, evidence, finding, and report entities in a language-neutral contract. Keep the web database as the server system of record when deployed, while allowing the local core to operate as a controlled desktop service.

### Phase B — Governed adapter contract

Define an adapter interface that includes installation detection, capability declaration, target requirements, safe command construction, approval requirements, timeout, cancellation, output schema, redaction, and evidence registration. Begin with read-only or low-risk local checks. Add one adapter at a time and test only against an explicitly authorized local lab.

### Phase C — Tauri sidecar integration

If desktop distribution is selected, package the local Python service as a Tauri sidecar bound to loopback. The desktop shell should never expose an arbitrary remote execution endpoint. It should use a narrow IPC contract, authenticated local requests, explicit mission scope, and audited intent IDs.

### Phase D — AI orchestration

Add an orchestration layer only after the governance contract is stable. AI agents should propose hypotheses, prioritize evidence, summarize output, or challenge conclusions; they should not silently expand scope or execute destructive actions. Integrate local Ollama and cloud providers behind a provider abstraction with secret isolation, model capability checks, prompt/output redaction, and human approval for consequential transitions.

### Phase E — Authorized demonstration lab

Create or connect an intentionally vulnerable local lab. Use it to test adapter behavior, evidence capture, report generation, cancellation, and failure handling. Keep the lab isolated and clearly marked as non-production. Do not use public targets for feature verification.

### Phase F — Production readiness

Add structured logging, audit export, retention policies, authorization expiry, evidence integrity checks, CSRF/session hardening review, rate limits, role administration, backup/restore procedures, observability, CI, dependency scanning, and documented incident response. Only then should the system be considered for controlled deployment.

## 16. Suggested Project Description for GitHub

### Recommended GitHub About text

> NEXUS is a governance-first security mission-control workspace for authorized testing, combining a forensic mission timeline with scope authorization, approval workflows, evidence provenance, audit records, findings review, and report history.

### Recommended GitHub long description

NEXUS is an AI-oriented cybersecurity mission-control platform designed to make authorized security testing traceable, reviewable, and safe by construction. It replaces the conventional scanner-dashboard experience with a forensic mission ledger that connects scope, hypotheses, validation decisions, evidence, approvals, activity history, and report state.

The current full-stack web implementation uses React 19, TypeScript, Vite, Tailwind CSS, Express, tRPC, TanStack React Query, SuperJSON, Drizzle ORM, MySQL-compatible persistence, Manus OAuth, and S3-backed evidence metadata. It provides a replayable Mission Timeline, authenticated multi-mission portfolio, role-aware assignments, approval requests and decisions, owner-scoped audit activity, evidence attachment metadata, notification delivery records, interactive Attack Surface topology, searchable Findings and Evidence registers, report persistence, and local Markdown/JSON/PDF export.

NEXUS is deliberately honest about its current boundary: the active repository is a governed investigation and reporting workspace, not an unrestricted autonomous scanner. Production tool adapters, Python orchestration, SQLite desktop core, AI provider integrations, isolated demonstration-lab execution, and a fully local desktop sidecar are future roadmap items. No public target is scanned or tested by the current prototype.

## 17. Suggested Feature List

| Area | Description |
|---|---|
| Mission replay | Chronological ten-stage mission spine with play, pause, step, reset, stage focus, and event context. |
| Scope governance | Visible authorization posture, mission scope, owner context, and approval-oriented state. |
| Portfolio management | Authenticated mission ledger with search, risk/status filters, selected-case details, and archival controls. |
| Role-aware operations | Assignment roles for analysts, reviewers, and approvers with protected procedures. |
| Approval workflow | Approval requests, decisions, decision notes, timestamps, and notification delivery state. |
| Audit trail | Mission activity records for governance and lifecycle changes. |
| Evidence custody | S3-oriented attachment metadata, uploader ownership, chain-of-custody presentation, and evidence links. |
| Attack Surface | Interactive topology map with asset search, type/risk filters, inspector, and linked evidence. |
| Findings and Evidence | Searchable and filterable registers with detailed forensic review. |
| Reporting | Persisted report records, ownership/history states, and browser-side Markdown/JSON/PDF export. |
| Operator interface | Restrained forensic-ledger design, keyboard shortcuts, semantic status color, and workspace feedback. |
| Safe tooling boundary | Tool registry and terminal staging without silent external scanning or unrestricted execution. |

## 18. Technical Evidence Index

The following repository files are the primary evidence for the claims in this document:

| Reference | File | Demonstrates |
|---|---|---|
| [1] | [`package.json`](./package.json) | Scripts, runtime dependencies, React/Vite/Express/tRPC/Drizzle/validation stack. |
| [2] | [`client/src/pages/Home.tsx`](./client/src/pages/Home.tsx) | NEXUS shell, navigation, Mission Timeline Replay, stage model, hypotheses, evidence, replay controls, and reports. |
| [3] | [`client/src/components/FunctionalWorkspace.tsx`](./client/src/components/FunctionalWorkspace.tsx) | Dashboard, Attack Surface, Findings, Evidence, Agents, Tools, Terminal, Reports, and Settings workspace behavior. |
| [4] | [`client/src/components/PortfolioWorkspace.tsx`](./client/src/components/PortfolioWorkspace.tsx) | Authenticated mission portfolio, mission operations, assignments, approvals, and selected-case context. |
| [5] | [`client/src/components/MissionAuditPanel.tsx`](./client/src/components/MissionAuditPanel.tsx) | Mission activity, evidence attachment metadata, upload interaction, and notification ledger presentation. |
| [6] | [`server/routers.ts`](./server/routers.ts) | Typed public/protected/admin procedure boundaries and application API contract. |
| [7] | [`server/db.ts`](./server/db.ts) | Database helpers, ownership boundaries, mission operations, report persistence, and audit/evidence metadata handling. |
| [8] | [`drizzle/schema.ts`](./drizzle/schema.ts) | Relational domain model for users, reports, missions, assignments, approvals, activity, attachments, and notifications. |
| [9] | [`client/src/index.css`](./client/src/index.css) | Forensic-ledger design system, typography, semantic colors, timeline styling, and workspace layout rules. |
| [10] | [`server/missions.test.ts`](./server/missions.test.ts) | Backend mission-governance test coverage. |
| [11] | [`server/reports.test.ts`](./server/reports.test.ts) | Backend report persistence and authorization test coverage. |
| [12] | [`verify-interactions.mjs`](./verify-interactions.mjs) | Browser validation for persistence, keyboard shortcuts, findings, and report ownership gates. |
| [13] | [`verify-surface-map.mjs`](./verify-surface-map.mjs) | Browser validation for Attack Surface search, risk filtering, selection, and navigation. |
| [14] | [`verify-portfolio.mjs`](./verify-portfolio.mjs) | Browser validation for unauthenticated Portfolio access gating. |
| [15] | [`ideas.md`](./ideas.md) | Project design context and source ideas. |

## 19. Final Positioning

NEXUS should be presented as a **security operations and governance platform under active development**, not as a finished autonomous penetration-testing engine. Its strongest current value is the mission-control layer: it makes authorization, chronology, reasoning, evidence, and accountability visible in one workspace. That foundation is deliberately designed to support future adapters and AI orchestration without allowing automation to bypass scope or human review.

The defining product promise is simple:

> **NEXUS turns authorized security testing into a traceable mission—where every action has scope, every conclusion has evidence, and every consequential transition has an accountable decision.**

## References

[1]: ./package.json "NEXUS package manifest"
[2]: ./client/src/pages/Home.tsx "NEXUS Mission Timeline Replay shell"
[3]: ./client/src/components/FunctionalWorkspace.tsx "NEXUS functional workspaces"
[4]: ./client/src/components/PortfolioWorkspace.tsx "NEXUS authenticated mission portfolio"
[5]: ./client/src/components/MissionAuditPanel.tsx "NEXUS mission audit, evidence, and alerts"
[6]: ./server/routers.ts "NEXUS tRPC procedures"
[7]: ./server/db.ts "NEXUS database helpers"
[8]: ./drizzle/schema.ts "NEXUS Drizzle schema"
[9]: ./client/src/index.css "NEXUS forensic-ledger design system"
[10]: ./server/missions.test.ts "NEXUS mission tests"
[11]: ./server/reports.test.ts "NEXUS report tests"
[12]: ./verify-interactions.mjs "NEXUS interaction verification"
[13]: ./verify-surface-map.mjs "NEXUS Attack Surface verification"
[14]: ./verify-portfolio.mjs "NEXUS Portfolio verification"
[15]: ./ideas.md "NEXUS project ideas"
