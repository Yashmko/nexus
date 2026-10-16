# NEXUS Security Review — Security Controls

Status legend: **Implemented & verified** (code exists and a test executes it), **Implemented, not verified** (code exists; the test environment cannot confirm it), **Partial**, **Missing**, **Advisory only**. Controls marked "Advisory only" are documented as if they were enforcement points but do not affect behavior.

## 1. Identity and session

| Control | Status | Where | Notes |
|---|---|---|---|
| OAuth login bound to a one-time nonce cookie (`__Host-oauth_state`) | Implemented & verified | `server/_core/oauth.ts:22-34`, `shared/const.ts:11` | Forged/missing `state` → `403` |
| Session JWT verified with `HS256`, expiry, and required claims | Implemented & verified | `server/_core/sdk.ts:199-240` | Missing/empty `openId`, `appId`, `name` or bad signature → rejected |
| Session bound to this application id | **Implemented & verified (added by this review)** | `server/_core/sdk.ts:222-227` | Previously the `appId` claim was read but never compared (F-03) |
| `Bearer` header session fallback (cookie-blocked browsers) | Implemented & verified | `server/_core/sdk.ts:270-277`, `client/src/main.tsx:43-63` | Server-side equivalent authorization; enables the preview flow |
| Session cookie hardening (`httpOnly`, `path=/`, `secure` when HTTPS) | Implemented, not verified | `server/_core/cookies.ts:24-48` | `secure` depends on `X-Forwarded-Proto` (U-3); `sameSite: "none"` is required by the iframe preview |
| Server-side session revocation / rotation | **Missing** | — | 1-year tokens, logout only clears the cookie (F-12) |
| Cron pseudo-user confined to `id=-1`, `role=user`, no tenant data | Implemented & verified | `server/_core/sdk.ts:305-330` | Test asserts zero visible missions |
| Administrator role assignment | Implemented & verified | `server/db.ts:39-47` (`OWNER_OPEN_ID`) | Role is read from the DB per request; no self-service elevation |
| User enumeration constrained to administrators | Implemented & verified | `server/routers.ts:63` | Non-admin → `FORBIDDEN` |

## 2. Tenant isolation and authorization (server-side)

| Control | Status | Where | Notes |
|---|---|---|---|
| Every procedure authenticated unless explicitly public | Implemented & verified | `server/_core/trpc.ts:11-22`, `server/routers.ts` | Public surface: `auth.me`, `auth.logout`, `system.health` only |
| Mission read scoping = owner ∪ assigned ∪ administrator | Implemented & verified | `server/db.ts:144-148, 150-186` | Tests cover all five non-admin roles plus admin |
| Sub-resource scoping (`activity`, `attachments`, `assignments`, `approvals`, `notifications`) | Implemented & verified | `server/db.ts:265-277, 300-357, 359-378` | Non-participants get `NOT_FOUND` (or an empty notification list) |
| Archive / assignment restricted to owner or administrator | Implemented & verified | `server/db.ts:199-242` | Denials throw, action not applied |
| Evidence upload restricted to mission participants | Implemented & verified | `server/db.ts:318-334` | Non-participants → `NOT_FOUND` |
| Evidence **download** restricted to mission participants | **Implemented & verified (added by this review)** | `server/_core/storageProxy.ts:61, 105-145` | Previously unauthenticated for any known key (F-02) |
| Evidence download works without third-party cookies (client sends the session explicitly) | **Implemented; browser behaviour not verified (U-5)** | `client/src/lib/evidenceDownload.ts`, `client/src/components/MissionAuditPanel.tsx` | Fetches with `credentials: "include"` + `Authorization: Bearer` when mirrored, saves a blob; falls back to direct navigation if the object store sends no CORS headers (U-8) |
| Report records scoped to the owning user; version history append-only | Implemented & verified | `server/db.ts:80-131` | Cross-owner `reportId` lookups return `null` (IDOR checked) |
| Assignment **role** (analyst/reviewer/approver) enforced | **Missing** | — | Roles are stored and displayed only (F-04) |
| Approval assignee validated (exists, holds `approver`, is a participant) | **Missing** | — | Any user id can be named, including non-participants (F-05) |
| Separation of duties on approvals | **Implemented & verified (added by this review)** | `server/db.ts:249-252, 287-291` | Requester cannot be the assignee and cannot decide their own request (F-01) |
| Authorization denials expressed as `FORBIDDEN` | **Partial** | `server/db.ts`, `server/routers.ts` | Owner/admin checks throw plain `Error` → `INTERNAL_SERVER_ERROR` (F-10) |
| Rate limiting / quotas on mutations and uploads | **Missing** | — | Acknowledged in the project roadmap; no limits exist |

## 3. Approval gate

| Control | Status | Notes |
|---|---|---|
| Durable approval records with requester, assignee, decision, note, timestamp | Implemented & verified | `mission_approvals`, audited via `mission_activity` |
| Only the assigned approver or an administrator can decide | Implemented & verified | Pre-existing rule, retained; self-decision now excluded (F-01) |
| Only pending approvals can be decided | Implemented & verified | Re-decision rejected |
| Approval state gates any mission transition | **Advisory only** | Nothing reads approval status; no bypass exists because nothing is conditional (F-06) |
| Notification delivery ledger for pending approvals | Implemented & verified | Row created on request; delivery status updated by `notifyOwner` |
| Notification visibility scoped to the addressed recipient | **Partial** | Mission-scoped, so participants can read each other's alerts (F-11) |

## 4. Audit and provenance

| Control | Status | Notes |
|---|---|---|
| Server-side activity attribution for lifecycle, assignment, upload, approval events | Implemented & verified | `actorId` = session identity; asserted in three test files |
| No API path to create, update, or delete activity rows | Implemented & verified | Activity is written only by internal helpers |
| Activity readable only by mission participants | Implemented & verified | Outsider → `NOT_FOUND` |
| Tamper-evidence (hash chain, sequence, append-only privileges) | **Missing** | The schema calls the table "immutable"; nothing enforces it (F-08) |
| Audit coverage of report writes and evidence reads | **Missing** | `reports.save` writes no activity row (F-08) |
| Evidence integrity proof (server-computed digest) | **Missing** | No hash stored; roadmap item (F-09) |
| Evidence provenance fields (uploader, mission, key, size, MIME, time) | Implemented & verified | `mission_attachments`; uploader attribution asserted |
| Evidence counters (`evidenceCount`, `findingCount`) kept accurate | **Missing** | Never incremented; portfolio shows 0 artifacts (F-09) |

## 5. Transport, CSRF and input handling

| Control | Status | Notes |
|---|---|---|
| Mutations are POST-only (no HTTP method override) | Implemented & verified | `GET` to a mutation → `405` |
| Non-JSON bodies rejected | Implemented & verified | urlencoded/`text/plain` → `415` (this is what makes form-based CSRF fail today) |
| No permissive CORS headers | Implemented & verified | No `Access-Control-Allow-*` emitted; cross-site fetch cannot read responses |
| Explicit `Origin`/`Sec-Fetch-Site` validation on mutations | **Missing** | Current protection is incidental and fragile (F-07) |
| Input validation on every procedure | Implemented & verified | zod schemas bound every input; extra fields stripped (ownership cannot be forged) |
| Evidence file-name sanitization before key construction | Implemented & verified | `../../etc/passwd` → flat key inside the mission prefix |
| Storage-key validation (traversal, absolute paths) | **Implemented & verified (added by this review)** | `server/_core/storageProxy.ts:20-29` |
| Body-size limits | Implemented | `express.json({ limit: "50mb" })`, 5 MB logical limit on evidence (F-10 notes the absence of quotas) |
| Security headers (HSTS, `X-Content-Type-Options`, CSP, frame-ancestors) | **Missing** | Not set by the application; depends on the hosting platform (U-3) |

## 6. Secrets and data handling

| Control | Status | Notes |
|---|---|---|
| No secrets in the repository | Implemented & verified | No `.env` present; `.gitignore` excludes env files and build output |
| Secrets read from environment at startup | Implemented | `server/_core/env.ts` |
| Server-side credentials never returned to the client | Implemented & verified | No procedure returns Forge/DB/OAuth material |
| Raw evidence bytes kept out of relational columns | Implemented | Metadata only in `mission_attachments` |
| Development debug logs redact credentials | **Implemented & verified (added by this review)** | `client/public/__manus__/debug-collector.js:43,109-130,509,541` | Request/response header values matching the credential policy are replaced with `"[REDACTED]"` before buffering, so the periodic report and the unload beacon cannot carry them; non-sensitive headers are preserved (F-13) |
| Stack traces hidden in production error responses | Implemented & verified | Stacks are only serialized when `isDev` (verified in a `NODE_ENV=production` process: no `stack` field) |
| Authorization denial messages hidden from clients | **Missing** | tRPC always serializes `error.message`; a production-mode run returned "Only a mission owner or administrator can archive this mission." verbatim (F-10) |
| Object-storage namespace isolation per project | **Unverified** | Depends on the Forge backend (U-1); non-`missions/` keys remain publicly presignable |

## 7. Testing and process

| Control | Status | Notes |
|---|---|---|
| CI runs install, type check, tests, production build on PRs to `main` | Implemented | `.github/workflows/ci.yml`; the new suite runs under `pnpm test` with no extra configuration |
| Unauthenticated-rejection tests | Implemented & verified | Pre-existing + new |
| Ownership/assignment boundary tests | **Implemented & verified (added by this review)** | 60 new tests across five files |
| Regression test for each applied fix | **Implemented & verified** | Each was re-run against the reverted code to confirm it fails (see `TEST_RESULTS.md` §4) |
| Dependency/vulnerability scanning, SBOM | **Missing** | Not part of the review; `pnpm audit` not run (U-7) |
| Browser/end-to-end security tests | **Missing** | No browser available; the project's Playwright scripts cover UI flows only, not authorization |

## 8. Known gaps requiring a product decision (do not fix by guesswork)

1. **Assignment-role capability matrix** (F-04) — which role may upload evidence, request approvals, or decide them.
2. **Approver eligibility rules** (F-05) — must the approver hold the `approver` assignment, or is any participant acceptable?
3. **Approval enforcement point** (F-06) — what a future execution adapter must check before acting.
4. **Session model** (F-12) — token lifetime, rotation, and revocation.
5. **Audit retention/export and tamper-evidence** (F-08) — hash chain vs. database privileges; retention schedule.
6. ~~**Client-side evidence download rework** (F-02 follow-up, U-5)~~ — implemented (`client/src/lib/evidenceDownload.ts`); what remains is browser confirmation in a cookie-blocked session, and whether the object store serves CORS headers (U-8), which decides whether the blob path or the navigation fallback is used.
