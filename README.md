<div align="center">

<img src="docs/nexus-mark.svg" width="120" alt="NEXUS mark — four converging evidence paths" />

# NEXUS

### Security missions, not scanner dashboards. 🛡️

**NEXUS is a governance-first security mission-control workspace for authorized security testing.** It turns an assessment into a traceable mission ledger — where every action has scope, every conclusion has evidence, and every consequential transition has an accountable decision.

`TypeScript` · `React 19` · `Vite 7` · `Tailwind CSS 4` · `Express` · `tRPC 11` · `Drizzle ORM` · `MySQL-compatible` · `S3-compatible storage`

![License: MIT](https://img.shields.io/badge/license-MIT-8DA4B5?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square)
![Vite](https://img.shields.io/badge/Vite-7-646CFF?style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-38BDF8?style=flat-square)
![Express](https://img.shields.io/badge/Express-4-9CA3AF?style=flat-square)
![tRPC](https://img.shields.io/badge/tRPC-11-0F172A?style=flat-square)
![Drizzle ORM](https://img.shields.io/badge/Drizzle%20ORM-0.44-C7F564?style=flat-square)
![Vitest](https://img.shields.io/badge/Vitest-ready-ACC267?style=flat-square)
![Governance first](https://img.shields.io/badge/philosophy-governance%20before%20automation-8DA4B5?style=flat-square)

📖 Full technical description → **[NEXUS_PROJECT_DETAILS.md](NEXUS_PROJECT_DETAILS.md)**

</div>

---

## 🔭 Why NEXUS exists

Conventional security tooling drowns operators in scanner output while hiding the operational decision trail. A typical dashboard will show a host, a finding, or a severity score — but rarely *whether the target was authorized, which approval enabled the action, which evidence supports the conclusion, or which hypothesis was rejected*.

NEXUS inverts that model. A security assessment is treated as a **controlled mission** with a visible chain of reasoning. Every important state answers four questions:

> **What was permitted? → What was attempted? → What evidence supports the conclusion? → Who approved the next action?**

## ⚔️ The NEXUS difference

| Instead of a… | NEXUS gives you a… |
|---|---|
| Scanner dashboard | **Replayable forensic mission timeline** |
| Generic "run" button | **Durable approval gate** — with actor, note, and timestamp |
| Detached file list | **Evidence wired into hypotheses, findings, and decisions** |
| Opaque automation | **Governance before automation** — scope, audit, and approval designed in *before* any tool is allowed to act |
| Neon cyberpunk UI | **Restrained forensic-ledger operations room** |

## 📦 What's inside

### 🎯 Mission Timeline Replay
The visual spine of NEXUS — a chronological ten-stage mission spine:

```
TARGET → SCOPE → RECON → ATTACK SURFACE → TEST → HYPOTHESIS → CRITIC → VALIDATION → EVIDENCE → REPORT
```

Play, pause, step, and reset the whole assessment like a case file. Select any stage to inspect its metadata, tools, assigned agent, hypotheses, and evidence context — with keyboard shortcuts for rapid operator navigation.

### 🛡️ Approval-gated governance
Role-aware access (owners, analysts, reviewers, approvers), visible authorization posture, durable approval requests and decisions, and a notification delivery ledger. A mission never advances on a silent side effect.

### 🧾 Evidence custody
Evidence is a first-class, decision-linked artifact — chain-of-custody metadata, uploader ownership, provenance, and links back to findings and approvals. Raw bytes are designed for S3-compatible object storage; the database keeps the metadata and the trail.

### 🗺️ Interactive Attack Surface
A topology-style map of assets and services with live search, type/risk filters, a detailed asset inspector (services, exposures, evidence provenance), and direct navigation into linked findings and evidence.

### 📋 Findings & Evidence registers
Searchable, filterable forensic registers with full review states — validated, rejected, carried into the report — and detailed provenance views.

### 📚 Authenticated multi-mission Portfolio
A real case ledger, not a fixture list: create missions, filter by risk and status, manage analyst/reviewer/approver assignments, request approvals, inspect posture, and archive — all behind secured, owner-scoped tRPC procedures.

### 📄 Reports with history
Persisted report records with mission scope, findings and evidence snapshots, ownership context, version history, and browser-side **Markdown / JSON / PDF** export.

### 🔍 Audit ledger
An owner-scoped operational history covering lifecycle changes, assignments, approvals, attachments, and notifications — an immutable-style record of *what happened, when, and who decided*.

### 🧰 Safe tooling surfaces
A tool registry and terminal staging interface that communicate status, command context, and execution boundaries as UI state — deliberately **non-executing** until governed adapters exist.

## 🏗️ Architecture

```text
Authenticated browser
        │
        ▼
React 19 + TypeScript + Tailwind CSS
        │
        │  typed tRPC client · React Query cache · SuperJSON
        ▼
Express server + tRPC router
        │
        ├──▶ Manus OAuth session context
        ├──▶ Drizzle ORM ──▶ MySQL-compatible database
        ├──▶ S3-compatible object storage (evidence bytes & artifacts)
        └──▶ Future isolated execution service
                └── approval-aware adapter workers · redacted output · audit events
```

## 🧰 Technology stack

| Layer | Technology | Role |
|---|---|---|
| Language | **TypeScript** | Shared type safety across client, server, schema, and tests |
| UI | **React 19** + **Vite 7** | Component-based workspace, dev server, HMR, production bundling |
| Styling | **Tailwind CSS 4** + custom CSS | Responsive layout plus the forensic-ledger visual system |
| Typography | **Space Grotesk** + **IBM Plex Mono** | Display hierarchy; machine/evidence data treatment |
| Icons | **Lucide React** | Consistent operational iconography |
| Server | **Express 4** | HTTP server and application host |
| API | **tRPC 11** + **SuperJSON** | End-to-end typed client/server procedures with structured values |
| Client data | **TanStack React Query** | Query caching, mutation state, invalidation |
| Auth | **Manus OAuth** | Authenticated browser sessions and server-side user context |
| ORM | **Drizzle ORM** | Type-safe relational schema and queries |
| Database | **MySQL-compatible** (TiDB-style) | Mission, report, approval, audit, and metadata records |
| Object storage | **S3-compatible helpers** | Evidence and artifact bytes outside the relational DB |
| Reports | **jsPDF** + browser Markdown/JSON | Local report export formats |
| Validation | **Vitest**, **tsc**, **Playwright Core** | Unit tests, static checks, browser interaction tests |

## 📁 Repository layout

```
client/    React 19 SPA — mission shell, timeline replay, workspaces, portfolio, audit panel
server/    Express + tRPC — protected procedures, database helpers, storage, tests
shared/    Shared types, constants, and error contracts
drizzle/   Drizzle schema, relations, and SQL migrations
docs/      Brand assets
```

**Data model:** `users` · `report_records` · `missions` · `mission_assignments` · `mission_approvals` · `mission_activity` · `mission_attachments` · `mission_notifications` — separating identity, governance, operational history, evidence metadata, and report snapshots.

## 🚀 Getting started

```bash
pnpm install   # install dependencies
pnpm dev       # start the development server
```

| Command | What it does |
|---|---|
| `pnpm check` | Type-checks the entire workspace (no emit) |
| `pnpm test` | Runs the Vitest suite |
| `pnpm build` | Produces client and server production bundles |
| `pnpm db:push` | Generates & applies Drizzle migrations |

## ⚠️ Safety boundary — read this

NEXUS is designed for **authorized security testing only**. The current implementation is a governed investigation and reporting workspace — **it does not scan public targets, silently execute offensive tools, or claim operations that were never run**. That is an architectural decision, not a limitation to be hacked around.

Before any future execution adapter may act, the platform must enforce the full sequence:

```text
Mission exists → user authenticated → permitted role → target in scope
→ compatible approval → approval current & not revoked → execution intent audited
→ adapter runs with bounded permissions & timeout → output redacted & stored with provenance
→ operator reviews evidence and conclusion
```

## 🗺️ Roadmap

| Phase | Focus |
|---|---|
| **A — Core execution service** | Python `nexus-core` package + CLI with local SQLite model, language-neutral contract |
| **B — Governed adapter contract** | Capability declaration, safe command construction, redaction, evidence registration — one adapter at a time, authorized lab only |
| **C — Tauri sidecar** | Local desktop distribution with a narrow loopback IPC contract — never a remote execution endpoint |
| **D — AI orchestration** | Agents that *propose, prioritize, and challenge* — never silently expand scope or execute destructive actions |
| **E — Authorized demo lab** | An isolated, clearly-marked vulnerable lab for adapter validation |
| **F — Production readiness** | Logging, audit export, retention, authorization expiry, hardening, CI, observability |

## 🎨 Design language

Charcoal and slate surfaces. Off-white content. **Signal Slate `#8DA4B5`** reserved for the active timeline point, keyboard focus, and selected mission context. Semantic red, amber, and green appear *only* when communicating a real security or approval state. It should feel like a serious forensic operations room — not a neon cyberpunk dashboard.

## 📜 License

MIT — but remember: NEXUS is a governance instrument. Use it on systems you are explicitly authorized to test.
