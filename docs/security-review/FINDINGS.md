# NEXUS Security Review — Findings

Severity is assigned with the rubric below and reflects impact **and** demonstrated reachability. Nothing here is rated on the basis of a pattern alone: every finding lists the code path that was traced and the test that exercises it.

| Severity | Meaning |
|---|---|
| **High** | Directly enables unauthorized access to mission data or defeats the product's central governance control with a reachable request |
| **Medium** | Weakens a documented control, or enables escalation that depends on a design decision that is not enforced |
| **Low** | Defense-in-depth gap, robustness issue, or information-disclosure risk with limited practical impact |
| **Info** | Observation, hardening opportunity, or documentation/implementation mismatch |

Legend for status: **Fixed** (patch included in this pull request), **Gap** (confirmed but intentionally not changed — behavior change needs a product decision), **Unverified** (could not be confirmed here).

---

## F-01 — Self-approval: one account could raise and decide the same approval — High — **Fixed**

**Affected code**
- `server/db.ts:244` `requestMissionApproval` — persists `assignedApproverId` straight from client input, with no check that it differs from the requester, that the target user exists, or that the target is a mission participant.
- `server/db.ts:279` `decideMissionApproval` — authorizes with `actor.role !== "admin" && record.assignedApproverId !== actor.id`, so `requester === assignedApprover` passed the check.
- `server/routers.ts:65,70` — both procedures are `protectedProcedure` (any authenticated user with mission access).
- `client/src/components/PortfolioWorkspace.tsx:89` — the client's own `canDecide` mirrors the same rule, and the approval form's approver picker lists all users for administrators, so self-selection was reachable from the UI as well.

**Impact.** The product's stated purpose is that "a mission never advances on a silent side effect" and that approvals are "role-aware". With this defect a single account could create an approval request, assign it to itself, and approve it, producing an approval record that looks authentic in the audit ledger (`approval_requested` and `approval_approved` by the same actor). Any consequential flow later built on approval state would have accepted it. Prior to this review nothing *reads* approval status (F-06), so the practical impact today is a forgeable governance record for a mission the attacker already participates in — hence High rather than Critical.

**Evidence** (synthetic fixtures, in-memory database):
```
$ pnpm vitest run server/security/approvalGate.test.ts        # with the guards reverted
× approval requests > rejects a request that names the requester as its own approver
  → promise resolved "[ …(4) ]" instead of rejecting
× approval decisions > denies a decision by the operator who raised the request (self-approval)
  → promise resolved "{ id: 900, missionId: 100, …(10) }" instead of rejecting
Tests  2 failed | 10 passed (12)
```
After the fix the same two tests pass and `harness.tables.mission_approvals[900].status` remains `"pending"`.

**Reproduction (pre-fix, any authenticated participant with mission access)**
1. `missions.requestApproval({ missionId, type: "release", summary: "…", assignedApproverId: <own user id> })`
2. `missions.decideApproval({ approvalId, decision: "approved", decisionNote: "…" })`

**Remediation applied**
- `requestMissionApproval` rejects a request whose `assignedApproverId` equals the requester (`server/db.ts:249-252`).
- `decideMissionApproval` refuses to decide a request raised by the acting operator, for every role including administrators (`server/db.ts:287-291`).

**Verification.** `server/security/approvalGate.test.ts` (12 tests) covers owner, admin, assigned approver, non-assigned approver, asserter-equals-requester, and already-decided cases. Administrator override on *other* operators' requests is preserved and tested.

**Residual risk.** A user with two accounts (A5) can still name the second account as approver and approve from it. That is inherent to identity issuance, not to this code path; see F-05.

---

## F-02 — Mission evidence bytes were readable without authentication — High — **Fixed (behavior change, see risk note)**

**Affected code**
- `server/_core/storageProxy.ts` (pre-fix) — `GET /manus-storage/*` minted a presigned URL for **any** key with no session check and no key validation.
- `server/db.ts:327` (`uploadMissionAttachment`) — evidence keys are `missions/<missionId>/evidence/<sanitized fileName>_<8 hex>`.
- `client/src/components/MissionAuditPanel.tsx:74` — evidence rows render `<a href={attachment.url} target="_blank">`, i.e. the `/manus-storage/...` URL is handed to the browser and opened as a plain navigation.

**Impact.** Evidence bytes — tool output, screenshots, configuration dumps — were readable by anyone who possessed the URL, and by anyone who could guess the key (mission id + file name + 32-bit random suffix). Confidentiality rested entirely on URL secrecy, contradicting the collection's owner/assignment scoping: the same objects are deliberately restricted on the tRPC side. Because the route accepted arbitrary keys, the endpoint also acted as a generic presign oracle for the whole storage namespace reachable with the server's API key.

**Evidence** (real Express handler over HTTP; storage backend stubbed):
```
$ pnpm vitest run server/security/storageProxy.test.ts        # against the original handler
× denies an unauthenticated fetch of a mission evidence object      → expected 307 to be 401
× denies a signed-in non-participant (horizontal privilege escalation) → expected 307 to be 404
× rejects an invalid or tampered session token                      → expected 307 to be 401
× rejects traversal-shaped keys regardless of session               → 307 issued
× fails closed for mission-prefixed keys that are not mission objects → 307 issued
× keeps mission scoping for other sub-paths inside a mission prefix  → expected 307 to be 404
Tests  6 failed | 4 passed (10)
```
The `307` responses carried a presigned `Location` header, i.e. the bytes were retrievable.

**Reproduction (pre-fix)**
1. Obtain or guess a key (e.g. from browser history, a shared link, proxy logs, or by guessing a common file name plus enumerating the suffix).
2. `curl -i https://<host>/manus-storage/missions/100/evidence/scan-output.txt_0f1e2d3c` → `307` to a signed object URL, no cookie required.

**Remediation applied**
- `missions/**` keys now require an authenticated session (cookie or `Bearer` fallback) and mission access — owner, assigned operator, or administrator (`server/_core/storageProxy.ts:61,105`).
- Unauthenticated → `401`; no mission access or unknown mission → `404` (indistinguishable, so the endpoint cannot be used to probe mission ids).
- Traversal-shaped keys (`.` / `..` segments, absolute prefixes, over-long keys) → `400` for all keys, closing the proxy off as a path-traversal pivot.
- Storage/database failures fail closed (`503`) instead of falling through to a presign.

**Verification.** `server/security/storageProxy.test.ts` (10 tests): anonymous, invalid/tampered session, non-participant, owner, three assignment roles, administrator, bearer-only session, traversal keys, malformed mission keys, public artwork, missing key, backend failure.

**Behavior change, and the client follow-up (implemented).** Non-mission assets (`nexus-mark_*.png` etc.) remain public so the landing page keeps working. Evidence access now needs the session, and a plain `<a href>` cannot attach the `Authorization` fallback that cookie-blocked browsers (Safari ITP, some WebViews) depend on. The client therefore performs the download itself: `client/src/lib/evidenceDownload.ts` fetches the object with `credentials: "include"` plus, when the runtime mirrored a session, `Authorization: Bearer <token>`, converts the response to a blob, and saves it under the evidence file name (`MissionAuditPanel` intercepts the click and keeps the anchor as a copyable link). Two consequences to note:

- If the object store does not send CORS headers for the redirect target, the fetch fails; the client then falls back to a direct navigation of the `/manus-storage/...` URL, which is the pre-fix behaviour and works wherever cookies are available. The exact CORS behaviour of the deployed bucket is unverified (U-8).
- The download path is covered by unit tests against a fake transport, and the helper was driven against a local HTTP server with a bearer-only session in this review (200 + blob, and 401 with nothing saved when unauthenticated). No real browser has executed this code — see U-5.

**Remaining risk.** Any non-`missions/` object in the same storage namespace with a known key is still publicly presignable, and whether Forge restricts the key namespace is unverified (A3/U-1). The fallback described above uses the cookie-authenticated navigation path; it does not widen server-side authorization.

---

## F-03 — Session tokens were not bound to this application id — Low (hardening) — **Fixed**

**Affected code.** `server/_core/sdk.ts:199` `verifySession` read `appId` from the JWT and required it to be a non-empty string, but never compared it with `ENV.appId`.

**Impact.** A token signed with the same `JWT_SECRET` but issued for another application id authenticated successfully as the user named in the token. Whether this is exploitable depends on secret provisioning (A1/U-2) — if the OAuth portal issues per-app secrets and `JWT_SECRET` is unique per deployment, the practical exposure is a misconfiguration/wrong-secret rotation, not a live attack. It is reported and fixed as defense-in-depth.

**Evidence**
```
$ pnpm vitest run server/security/session.test.ts             # with the check reverted
× rejects a token issued for a different application id
  → promise resolved "{ id: 1, openId: 'owner-a', …(7) }" instead of rejecting
Tests  1 failed | 7 passed (8)
```

**Reproduction (pre-fix).** Mint a session through `sdk.signSession({ openId, appId: "<other app>", name })` and present it as `app_session_id`; `sdk.authenticateRequest` returns the user row for `openId`.

**Remediation applied.** `verifySession` rejects any session whose `appId` differs from `ENV.appId` (`server/_core/sdk.ts:222-227`). Tokens are always minted with `ENV.appId` (`createSessionToken`), so legitimately issued sessions are unaffected; a token whose app id is empty cannot be minted in the first place because the claim must be non-empty.

**Verification.** `server/security/session.test.ts` (8 tests): valid session, bearer fallback, foreign app id, foreign secret, expired token, empty name claim, missing credentials, cron identity isolation.

---

## F-04 — Assignment roles are recorded but never enforced — Medium — **Gap**

**Affected code.** `drizzle/schema.ts` (`mission_assignments.role`: `analyst | reviewer | approver`), `server/routers.ts` (`missions.assign`), `server/db.ts`. A repository-wide search shows the assignment role is written and displayed but never read by an authorization decision; `missionActor(ctx.user)` carries only the global `user | admin` role plus the user id.

**Impact / evidence.** Any assigned participant — including a `reviewer` or an `analyst` — can:
- raise approval requests (`approvalGate.test.ts` → "accepts requests from any assigned participant, including a reviewer"),
- upload evidence (`authorization.test.ts` → "accepts uploads from any assigned participant role").

The client is *narrower* than the server: the approval form and the evidence-upload control are rendered only for the owner/administrator (`PortfolioWorkspace.tsx:88`, `MissionAuditPanel` `canManage`), so the server also accepts requests the UI never offers. `NEXUS_PROJECT_DETAILS.md` states "Role-aware access | Limits mission operations according to ownership, assignment role, administrator status, and authenticated identity" — the assignment-role half of that claim is not implemented.

**Why it is not fixed here.** The intended capability matrix is undocumented (should a reviewer upload evidence? may an analyst request approvals? is `approver` intended to be required for `assignedApproverId`?). Guessing would change product behavior and could lock out legitimate workflows. **Recommendation:** define the matrix explicitly, encode it as a single `can(actor, mission, capability)` helper, enforce it in the procedures (not the client), and add an allowed/denied test per role/capability. `assignMission` should also stop accepting a role assignment without a corresponding capability change.

---

## F-05 — Approval assignees are unvalidated; a non-participant can decide — Medium — **Gap**

**Affected code.** `server/db.ts:244` (assignee comes from the client: no existence check, no participation check, no `approver`-role check), `server/db.ts:279` (`decideMissionApproval` loads the approval by id with no mission-scope predicate — authorization is only `admin || assignedApproverId === actor.id`).

**Impact / evidence.** A mission owner can name any user id as approver, including an id with no relationship to the mission; that account can then decide that approval (and reads the approval row back in the response) without ever being assigned to the mission. `approvalGate.test.ts` → "documents that a non-participant named as approver can still decide (gap, not fixed in this review)" asserts this current behavior deliberately, so a future change is visible in the test diff. A non-existent id produces an approval only an administrator can ever decide (silent dead end).

**Why it is not fixed here.** Requiring the assignee to be an `approver`-role participant, or requiring participation for any decision, is a policy change (it interacts with F-04 and with the "unassigned administrator queue" flow). **Recommendation:** validate that `assignedApproverId` references an existing user, that the user holds the `approver` assignment for that mission, and that the decider is still a mission participant at decision time; otherwise deny with a `FORBIDDEN` tRPC error.

---

## F-06 — Approvals are advisory: no transition consults approval state — Medium (governance) — **Gap**

**Affected code.** No procedure reads `mission_approvals.status` outside listing it (`listMissionApprovals`, `decideMissionApproval`). Mission lifecycle fields (`status`, `stage`, `progress`, `findingCount`, `evidenceCount`) are written only by `createMission` and `archiveMission`.

**Impact.** The approval queue is an evidentiary record, not a gate: nothing can be "bypassed" because nothing is conditional on it yet. This matters for how the collection is described — `NEXUS_PROJECT_DETAILS.md` §11.5 says approval "is represented as a state transition", and the roadmap plans an execution layer whose contract is `mission -> role -> scope -> compatible approval -> execution`. Evidence: `approvalGate.test.ts` → "leaves mission lifecycle state untouched: approvals are advisory today" approves every pending request and asserts `{ status: "active", stage: "Target", progress: 0 }` is unchanged.

**Recommendation.** When the execution layer lands, define and test the enforcement point (a single helper that resolves "does this mission hold a current, non-revoked approval of type X?"), and add expiry/revocation fields. Until then, documentation should not imply enforcement.

---

## F-07 — CSRF protection is implicit; it holds today but is fragile — Low — **Verified as currently blocked / hardening recommended**

**Current behavior (verified over real HTTP against the same middleware chain as `server/_core/index.ts`).** Session cookies are issued with `sameSite: "none"` so browser-issued cross-site requests do carry the session — but every state-changing path is still blocked for an attacker-controlled HTML form or `<img>`/navigations:

| Attempt | Result |
|---|---|
| `GET /api/trpc/missions.archive?batch=1&input=…` (method override) | `405 METHOD_NOT_SUPPORTED`, mission not archived |
| `POST` with `Content-Type: application/x-www-form-urlencoded` (what an HTML form can send) | `415 UNSUPPORTED_MEDIA_TYPE`, mission not archived |
| `POST` with `Content-Type: text/plain` | `415 UNSUPPORTED_MEDIA_TYPE`, mission not archived |
| `POST application/json` without a session | `401 UNAUTHORIZED` |
| Cross-origin request with `Origin: https://attacker.invalid` | no `Access-Control-Allow-Origin` / `-Credentials` header, so a cross-site `fetch` cannot read the response |
| Forged OAuth `state` without the `__Host-oauth_state` nonce cookie | `403 invalid oauth state` |

**Why it is a finding anyway.** The protection comes from three incidental properties (JSON-only bodies, POST-only mutations, no CORS middleware). Changing any one of them — for example enabling form bodies or `allowMethodOverride` to match a legacy client — reintroduces CSRF against every mutation without any obvious signal. **Recommendation:** add an explicit `Origin`/`Sec-Fetch-Site` check for `/api/trpc` mutations and the OAuth callback, and a test that fails if that guard is removed. Evidence: `server/security/httpSurface.test.ts` (9 tests).

---

## F-08 — Audit ledger has no tamper-evidence and skips key events — Low/Medium — **Gap**

**Current controls (verified).** `mission_activity` rows are written server-side only (`recordMissionActivity`, `server/db.ts:297`); there is no procedure that updates or deletes activity rows; attribution uses the session identity and was verified for archive, assignment, evidence upload, approval request, and approval decision (`authorization.test.ts`, `approvalGate.test.ts`, `httpSurface.test.ts`). Reads are mission-scoped, so a non-participant receives `NOT_FOUND` rather than the ledger.

**Gaps.**
- No hash chain, sequence number, or append-only enforcement at the database level; the application's own DB credential can rewrite history. The schema comment calls the table an "Immutable operational history" — that is aspirational, not enforced.
- `actorId` is nullable and renders as "NEXUS system": system-attributed rows are indistinguishable from a missing actor.
- Report activity is not audited at all — `reports.save` writes a new version with no `mission_activity` row, so "who changed the deliverable" is only implicit in `ownerId`.
- Read access (evidence download, report history view) is not recorded.
- `metadata` is free-form JSON; the approval decision note is duplicated into both `decisionNote` and `metadata`.

**Recommendation.** Append-only DB privileges (or a hash-chained ledger with periodic anchoring), mandatory `actorId` with an explicit `system` sentinel, and events for report creation and evidence download. Retention/export are already listed in the project roadmap; this finding is a confirmed gap, not a regression.

---

## F-09 — Evidence provenance is metadata-only and partly inaccurate — Low/Medium — **Gap**

**Evidence.** `missionAttachments` stores file name, MIME type, size, key, URL, uploader, mission, and timestamp. There is no content digest, capture source/tool, or custody transition beyond `evidence_attached`. Consequences and observations:
- No integrity proof: bytes can be replaced in the object store (or in a presigned PUT) without detection, and the ledger cannot distinguish the change. The roadmap already lists "evidence integrity checks" as future work.
- `missions.evidenceCount` / `findingCount` are never incremented by `uploadMissionAttachment`; the portfolio therefore reports "0 preserved artifacts" while attachments exist (`authorization.test.ts` asserts attachments are listed after upload; the counter stays 0) — a record-accuracy defect visible to users.
- The client-declared MIME type is stored and forwarded to storage verbatim. Uploading `text/html` evidence is not a stored-XSS on the application origin because bytes are served from the storage origin after a redirect, but this was not verified end-to-end (U-4).
- Upload limits: `attachEvidence` accepts ~5 MB decoded per request after a `7,000,000`-char base64 envelope, with a `50 MB` JSON body limit and no per-account quota or rate limit.

**Recommendation.** Store a SHA-256 digest computed server-side, record the capture source/tool, update counters in the same transaction, and force a safe content disposition/content type.

---

## F-10 — Authorization denials surface as 500s; report writes are unbounded — Low — **Gap**

- Owner-only denials throw plain `Error` from `server/db.ts` (`archiveMission`, `assignMission`, `decideMissionApproval`), so tRPC returns `INTERNAL_SERVER_ERROR` (HTTP 500) rather than `FORBIDDEN`. Functionally the action is still denied (verified), but the error semantics are wrong for clients, dashboards, and alerting — a denied action looks like an outage.
- **Correction (verified 2026-10-13):** an earlier revision of this finding said production "masks" the message. It does not. tRPC's `getErrorShape` gates only the stack trace on `isDev`; `error.message` is always serialized. Running the real router in a `NODE_ENV=production` process returned, verbatim and with no `stack` field: `An approval request cannot be assigned to its own requester.` (self-approval guard) and `Only a mission owner or administrator can archive this mission.` Both with `httpStatus: 500`. So authorization denial messages are disclosed to any authenticated caller, and denials are indistinguishable from server faults by status code.
- `reports.save` (`server/routers.ts:44`, `server/db.ts:80`) accepts arbitrary `findingSnapshot` / `evidenceSnapshot` JSON up to the 50 MB body limit, with no per-owner quota, rate limit, or validation that the referenced mission belongs to the caller. It is owner-scoped, so this is a resource-exhaustion/abuse surface rather than a confidentiality issue. Rate limiting is an acknowledged roadmap item.

**Recommendation.** Raise `TRPCError({ code: "FORBIDDEN" })` for authorization denials (keeping messages generic), cap snapshot sizes explicitly, and add per-account quotas/rate limits.

---

## F-11 — Approval-alert notifications are mission-scoped, not recipient-scoped — Low — **Info**

`listMissionNotifications` (`server/db.ts:359`) scopes by mission access only; `recipientId` is stored but not used in the read predicate, so every mission participant can read the alert content addressed to a specific approver. The content duplicates the approval summary that participants can already read, so the disclosure is limited (`authorization.test.ts` asserts an analyst sees the notification). **Recommendation:** scope by `recipientId` (plus administrators) unless shared visibility is intended, and document the intent.

---

## F-12 — Session lifetime and revocation — Low — **Info**

`ONE_YEAR_MS` sessions, no `jti`/server-side revocation list, and logout only clears the cookie (`server/routers.ts:35`) plus the mirrored `sessionStorage` token in the client. A leaked token is valid for a year; there is no way to invalidate sessions after a compromise other than rotating `JWT_SECRET` (which logs everyone out). **Recommendation:** shorter access tokens with rotation, session records with server-side revocation, and an explicit "sign out everywhere" path. Not fixed: it changes the session model and needs a product decision.

---

## Unverified areas (could not be confirmed or refuted with the tools available)

| ID | Area | Why unverified | What would settle it |
|---|---|---|---|
| U-1 | Forge/object-storage namespace isolation, `path` normalization upstream, presigned-URL lifetime and audience | External service; no credentials or network access to it | Backend team review of presign scoping; integration test against a staging bucket |
| U-2 | Whether `JWT_SECRET` is unique per deployment/app | Provisioning-time configuration, not visible in the repository | Platform configuration review; log/inspect a second app's secret provisioning |
| U-3 | Cookie attributes as seen by real browsers in the deployed environment (`Secure` depends on `X-Forwarded-Proto`; `__Host-` cookie acceptance on plain HTTP) | No browser and no deployed environment here | Manual browser check against the deployed URL (devtools → Application → Cookies) |
| U-4 | Stored-XSS/rendering behavior of uploaded evidence (`Content-Type`, `Content-Disposition`, `nosniff`) on the storage origin | Same as U-1 | Upload an HTML file and inspect the response headers of the signed URL |
| U-5 | Browser execution of the evidence-download helper (blob save, cookie-blocked session) | No browser in the review environment. The helper's logic is unit-tested, and it was driven against a local HTTP server with a bearer-only session (200 + blob; 401 with nothing saved when unauthenticated), but no real browser has run the click path | Click an evidence attachment in Chrome and in a cookie-blocked browser/WebView; confirm the file saves and, in the blocked case, that no 401 appears in the network tab |
| U-6 | MySQL-level enforcement (grants, triggers, `sql_mode`, replication) and any production data state | No database in the review environment; out of scope by instruction | DBA review of instance privileges/schema deployment |
| U-7 | Dependency/supply-chain vulnerabilities | Not requested; no `pnpm audit`/advisory data available offline | `pnpm audit`, SBOM, update cadence in CI |
| U-8 | CORS headers on the signed object-store URL that `/manus-storage/*` redirects to | External service; no credentials/network access from the review environment | Fetch an evidence URL from the app origin in a browser and inspect whether the cross-origin redirect is readable (the client falls back to a direct navigation when it is not) |

## Positive confirmations (reviewed, no defect found)

- Every protected procedure rejects unauthenticated callers (`UNAUTHORIZED`) and `missions.users` is administrator-only (`FORBIDDEN`) — `authorization.test.ts`, plus the pre-existing `missions.test.ts`/`reports.test.ts`.
- Report records are owner-scoped on read (`latest`, `history`, `owner`); a second owner querying the same mission key receives `null`/`[]`, and cross-owner `reportId` lookups return `null` (IDOR checked).
- Mission sub-resources (`activity`, `attachments`, `assignments`, `approvals`, `notifications`) apply the owner/assignment scope predicate; non-participants receive `NOT_FOUND` or an empty list, never foreign rows.
- Archive and assignment are owner/administrator-only, and the acting identity comes from the session — client-supplied `ownerId`/`role` fields are stripped by the zod schemas (`authorization.test.ts`).
- Evidence file names are sanitized before the object key is built; a `../../etc/passwd` upload produced a flat key inside the mission prefix with no `.` segment.
- The OAuth callback enforces the one-time nonce cookie and clears it; malformed or missing `state` is rejected with `403`.
- The cron pseudo-user is confined to `id = -1`, `role = "user"`, and sees no tenant missions.
