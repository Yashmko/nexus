# NEXUS Security Review — Threat Model

- **Scope of review:** the repository at commit `d0ae072` (branch `main`) plus the fixes included in the audit pull request.
- **Method:** manual source review of the server, schema, client flows, and tests; targeted regression tests executed locally against an isolated in-memory database (see `TEST_RESULTS.md`). No production system, deployed environment, real user record, or external target was accessed.
- **Assurance statement:** passing tests demonstrate that the specific enumerated behaviors below hold. They do **not** prove the application is free of vulnerabilities.

## 1. System under review

NEXUS is a governance-first security mission-control workspace. An assessment ("mission") has an owner, a scope, a lifecycle status, assignments, approval requests, activity records, evidence attachments, and report versions.

| Component | Location | Notes |
|---|---|---|
| React 19 client | `client/src` | Timeline, portfolio, evidence, report workspaces |
| Express + tRPC server | `server/_core/index.ts`, `server/routers.ts` | `/api/trpc`, `/api/oauth/callback`, `/manus-storage/*` |
| Data access layer | `server/db.ts` | All ownership/assignment scoping lives here |
| Schema | `drizzle/schema.ts` | users, missions, assignments, approvals, activity, attachments, notifications, reports |
| Object storage | `server/storage.ts`, `server/_core/storageProxy.ts` | Bytes in S3-compatible storage; DB keeps metadata |
| Identity | `server/_core/sdk.ts`, `server/_core/oauth.ts` | Manus OAuth + signed session cookie (JWT/HS256) |

## 2. Assets

| Asset | Why it matters |
|---|---|
| Mission records (scope, account, risk, status) | Reveals what the customer's engagement targets and boundaries are |
| Evidence bytes (attachments) | Raw tool output, screenshots, and config dumps — often the most sensitive artifact in an engagement |
| Evidence metadata + activity ledger | Provenance and attribution: who did what, who approved what |
| Approval decisions | The governance signature that makes a consequential transition accountable |
| Report versions + snapshots | Deliverable content, historical versions |
| User directory (name, email, role) | Tenant membership and privilege mapping |
| Session tokens (`app_session_id` cookie, `Authorization: Bearer` fallback) | Full account access for one year |
| Storage/Forge API key, `JWT_SECRET`, OAuth app id | Server-side secrets; must never reach the client or logs |

## 3. Actors and roles

| Actor | Obtained by | Intended capability (as implemented) |
|---|---|---|
| Anonymous visitor | none | Public landing page and public artwork only |
| Authenticated user | Manus OAuth (`users` row, global `role = "user"`) | Own missions |
| Mission owner | creates the mission (`missions.ownerId`) | Archive, assign operators, request approvals, upload evidence, read everything on the mission, own-scoped reports |
| Assigned analyst / reviewer / approver | added by the owner (`mission_assignments`) | Read mission, sub-resources, evidence; request approvals; upload evidence — the assignment **role** itself is not enforced (see F-04) |
| Assigned approver of a specific request | `mission_approvals.assignedApproverId` | Decide that one approval |
| Administrator | global `role = "admin"` | Every mission, every approval, user directory, `system.notifyOwner` |
| Cron pseudo-user | externally issued session whose `openId` starts with `cron_` | Synthetic id `-1`, `role = "user"`; verified to see no tenant missions |

## 4. Trust boundaries

1. **Browser ↔ server.** The session cookie is `httpOnly`, `path=/`, `sameSite=none`, `secure` when the request is seen as HTTPS. Because `sameSite=none`, the cookie is attached to cross-site requests, so state-changing endpoints rely on transport-level protections (JSON content type, no CORS, POST-only mutations) rather than `SameSite` alone. The client mirrors the session into `sessionStorage` and replays it as a `Bearer` header for environments that block iframe cookies (`client/src/main.tsx`).
2. **Server ↔ MySQL-compatible database.** All tenant isolation is enforced in application code (`server/db.ts`); no row-level security, triggers, or per-tenant database credentials exist. A SQL injection or a missing `WHERE` clause is therefore a full tenant-boundary failure.
3. **Server ↔ Forge / object storage.** `/manus-storage/*` exchanges a key for a presigned URL using a server-side API key. Key possession previously equaled read access (see F-02).
4. **Server ↔ OAuth portal.** Session JWTs are minted by this service; the OAuth portal is trusted for user identity claims at login.
5. **Client ↔ server code shape.** Authorization is only meaningful server-side. Client gating (`PortfolioWorkspace.canManageMission`, `canDecide`) is treated as UX only; several client gates are narrower than the server rules (F-04).

## 5. Attack scenarios considered

| # | Scenario | Result |
|---|---|---|
| S1 | Anonymous attacker fetches another tenant's mission metadata or evidence by id/key | Metadata: blocked (`NOT_FOUND`). Evidence bytes: **was allowed** for known keys → F-02 (fixed) |
| S2 | Authenticated user enumerates or reads missions/reports/approvals they are not part of | Blocked by owner/assignment scoping; verified for every read procedure |
| S3 | Assigned operator escalates to owner-only actions (archive, assign) | Blocked (`Only a mission owner or administrator…`) |
| S4 | Single account raises an approval and approves it themselves | **Was allowed** → F-01 (fixed) |
| S5 | Operator assigns an approval decision to an account outside the mission and lets it approve | Allowed by design today → F-05 (gap, not fixed) |
| S6 | Approval bypass through an alternate route/method (GET, form POST, batch trick, direct API) | Blocked: 405 for GET mutations, 415 for form/text bodies, no method override; verified over HTTP |
| S7 | Privilege escalation to administrator | No self-service role change (role is only written from internal callers/`OWNER_OPEN_ID`); user directory is admin-only |
| S8 | Cross-application token confusion (token minted for a different app id accepted here) | **Was accepted** if signed with the same secret → F-03 (hardened) |
| S9 | Evidence exfiltration through the storage proxy (object key brute force / leaked URL) | Keys combine mission id + sanitized file name + 8 hex chars; after F-02 keys no longer grant read access by themselves |
| S10 | Audit-log forgery or silent action | Activity rows are attributed server-side; no update/delete endpoint exists; no tamper-evidence beyond that (F-08) |
| S11 | Stored XSS via evidence upload (client-declared MIME type) | Bytes are served from the storage origin, not the app origin; not verified end-to-end (U-4) |
| S12 | Credential/secret exposure through API responses or errors | Session cookie is not returned by any procedure; stack traces appear in non-production error payloads only |

## 6. Assumptions

- **A1** The deployment sets `JWT_SECRET`, `VITE_APP_ID`, `OAUTH_SERVER_URL`, `OWNER_OPEN_ID`, and Forge credentials correctly, and the secrets stay out of source (the repository contains no `.env`; `.gitignore` excludes it).
- **A2** The platform terminates TLS and forwards `X-Forwarded-Proto: https` (the session cookie is `secure` only when the request appears HTTPS).
- **A3** The Forge presign API is scoped to this project's namespace. *Not verified in this review.*
- **A4** The MySQL-compatible database is reachable only by the application; there is no shared-tenant database.
- **A5** OAuth is the only identity source, and one human may hold multiple accounts (relevant to F-05: a second account can be named as an approver).
- **A6** No production data, live system, or external target was used to produce this document; all tests use synthetic fixtures.

## 7. Out of scope

- Availability/DDoS behavior under load, cost-based abuse of storage, and infrastructure hardening of the hosting platform.
- The Python `nexus-core`/desktop roadmap, execution adapters, and AI providers (not present in this repository).
- Dependency-level vulnerabilities (`pnpm audit`, SBOM, supply chain) — the lockfile was not audited here.
- Mobile/iPhone layout work and browser visual behavior (no browser is available in the review environment).
