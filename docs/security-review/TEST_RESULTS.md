# NEXUS Security Review — Test Results

Every result below was produced by a command that was actually executed in the review environment. Nothing is projected, estimated, or copied from another run.

## 1. Environment

| Item | Value |
|---|---|
| Repository | `/home/user/nexus` at `d0ae072` (`main`) + this pull request's branch |
| Node | `v22.22.3` (npm from the image; `pnpm 10.4.1` installed with `npm i -g pnpm@10.15.1`) |
| Dependency install | `pnpm install --frozen-lockfile` → `Done in 11.2s` (lockfile respected; `@tailwindcss/oxide`, `core-js`, `esbuild` build scripts were skipped by pnpm's default policy, which does not affect the Vitest suite) |
| Test runner | Vitest 2.1.9 (`vitest.config.ts`, `include: server/**/*.{test,spec}.ts`) |
| Database | **None available.** No `DATABASE_URL`, no MySQL/MariaDB/SQLite binary, no Docker. Tenant-isolation tests therefore run against the in-memory Drizzle harness described in §5 |
| Browser | **None available** (`/usr/bin/chromium` absent), so the project's Playwright verification scripts were not run and no UI flow was executed |
| Production/live systems | **Not touched.** No external host was contacted; external services (Forge presign, OAuth token exchange, S3) are stubbed in tests |

## 2. Baseline before any change

```
$ pnpm test
 ✓ server/missions.test.ts (5 tests)
 ✓ server/auth.logout.test.ts (1 test)
 ✓ server/reports.test.ts (3 tests)
 Test Files  3 passed (3)
      Tests  9 passed (9)
```
The pre-existing suite covers only unauthenticated rejections, the admin-only user directory, and the logout cookie. It contained no test for ownership/assignment scoping, approvals, evidence, or provenance — matching the project's own roadmap item "the project should add unit tests for … ownership boundaries".

## 3. New tests added

| File | Tests | Covers |
|---|---|---|
| `server/security/authorization.test.ts` | 21 | Mission visibility per role (owner, analyst, reviewer, approver, unrelated user, administrator, unauthenticated); archived-mission filtering; sub-resource scoping (`activity`, `attachments`, `assignments`, `notifications`, `approvals`); owner/admin-only archive and assignment; admin-only user directory; mission creation; evidence upload scoping, attribution, filename sanitization, empty payload; report owner scoping and cross-owner `reportId` (IDOR); procedure allowlist (21 endpoints); client-supplied `ownerId`/`role` ignored |
| `server/security/approvalGate.test.ts` | 12 | Request/decide matrix for owner, admin, assigned approver, non-assigned approver, analyst, unrelated user, unauthenticated; non-pending re-decision; **self-assignment and self-decision rejection**; non-participant assignee (documented gap); audit attribution of requests and decisions; notification ledger row; demonstration that approvals do not gate mission state |
| `server/security/httpSurface.test.ts` | 9 | Real Express + tRPC over HTTP: authorized query, unauthenticated query, **GET mutation rejected**, form-urlencoded POST rejected, `text/plain` POST rejected, authorized POST executes and is attributed, unauthenticated POST rejected, no permissive CORS headers, forged OAuth `state` rejected |
| `server/security/storageProxy.test.ts` | 10 | Real `/manus-storage/*` handler over HTTP: anonymous evidence fetch denied, invalid/tampered session denied, non-participant denied, owner/analyst/approver/admin allowed, `Bearer`-only session allowed, traversal-shaped keys rejected, malformed mission keys rejected, public artwork still public, missing key, backend failure |
| `server/security/session.test.ts` | 8 | Session minted for this app accepted; `Bearer` fallback accepted; **foreign `appId` rejected**; foreign secret rejected; expired token rejected; empty name claim rejected; missing credentials rejected; cron identity sees no tenant missions |
| **Total new** | **60** | |

Test infrastructure (not tests): `server/security/inMemoryDb.ts` (in-memory Drizzle/MySQL fixture engine), `server/security/fixtures.ts` (synthetic role matrix), `server/security/harness.ts`, `server/security/httpClient.ts`, `server/security/testEnv.ts` (registered in `vitest.config.ts` `setupFiles`).

## 4. "Fails without the fix" evidence

Each fix was temporarily reverted in the working tree and the corresponding test re-run before restoring it. This is the evidence that the tests actually detect the defects (not that they merely pass).

### 4.1 Self-approval (`server/db.ts` guards reverted)

```
$ pnpm vitest run server/security/approvalGate.test.ts
 × approval requests > rejects a request that names the requester as its own approver
   → promise resolved "[ …(4) ]" instead of rejecting
 × approval decisions > denies a decision by the operator who raised the request (self-approval)
   → promise resolved "{ id: 900, missionId: 100, …(10) }" instead of rejecting
 Test Files  1 failed (1)
      Tests  2 failed | 10 passed (12)
```

### 4.2 Evidence access control (`server/_core/storageProxy.ts` reverted to `d0ae072`)

```
$ git show d0ae072:server/_core/storageProxy.ts > server/_core/storageProxy.ts
$ pnpm vitest run server/security/storageProxy.test.ts
 × denies an unauthenticated fetch of a mission evidence object        → expected 307 to be 401
 × denies a signed-in non-participant (horizontal privilege escalation) → expected 307 to be 404
 × rejects an invalid or tampered session token                        → expected 307 to be 401
 × rejects traversal-shaped keys regardless of session                 → 307 issued
 × fails closed for mission-prefixed keys that are not mission objects → 307 issued
 × keeps mission scoping for other sub-paths inside a mission prefix   → expected 307 to be 404
 Test Files  1 failed (1)
      Tests  6 failed | 4 passed (10)
```
A `307` here means the proxy returned a presigned URL — i.e. the object was retrievable.

### 4.3 Session app-id binding (`server/_core/sdk.ts` check reverted)

```
$ pnpm vitest run server/security/session.test.ts
 × rejects a token issued for a different application id
   → promise resolved "{ id: 1, openId: 'owner-a', …(7) }" instead of rejecting
 Test Files  1 failed (1)
      Tests  1 failed | 7 passed (8)
```

## 5. Final state after the fixes

```
$ pnpm test
 ✓ server/security/authorization.test.ts (21 tests)
 ✓ server/security/approvalGate.test.ts (12 tests)
 ✓ server/security/httpSurface.test.ts (9 tests)
 ✓ server/security/storageProxy.test.ts (10 tests)
 ✓ server/security/session.test.ts (8 tests)
 ✓ server/missions.test.ts (5 tests)
 ✓ server/auth.logout.test.ts (1 test)
 ✓ server/reports.test.ts (3 tests)
 Test Files  8 passed (8)
      Tests  69 passed (69)
```
```
$ pnpm check      # tsc --noEmit
(no output — exit code 0)
$ pnpm build      # vite build + esbuild server bundle
✓ built in 5.15s
  dist/index.js  56.7kb
⚡ Done in 7ms
```

### HTTP status codes observed (real server, synthetic fixtures)

| Request | Observed |
|---|---|
| `GET /api/trpc/missions.activity` (owner, batch query) | `200` + activity payload |
| `GET /api/trpc/missions.activity` (no session) | `200` envelope containing `UNAUTHORIZED` (no data) |
| `GET /api/trpc/missions.archive` (owner) | `405` `METHOD_NOT_SUPPORTED`; mission unchanged |
| `POST /api/trpc/missions.archive` with `application/x-www-form-urlencoded` (owner cookie) | `415` `UNSUPPORTED_MEDIA_TYPE`; mission unchanged |
| `POST /api/trpc/missions.archive` with `text/plain` (owner cookie) | `415`; mission unchanged |
| `POST /api/trpc/missions.archive` JSON, no session | `401` `UNAUTHORIZED`; mission unchanged |
| `POST /api/trpc/missions.archive` JSON, owner cookie | `200`; mission archived and an `mission_archived` activity row attributed to user 1 |
| `GET /manus-storage/missions/100/evidence/…` anonymous (pre-fix / post-fix) | `307` presigned / `401` |
| `GET /manus-storage/missions/100/evidence/…` non-participant (pre-fix / post-fix) | `307` presigned / `404` |
| `GET /manus-storage/nexus-mark_bc2a72c9.png` anonymous | `307` (public artwork preserved) |
| `GET /api/oauth/callback` with forged `state`, no nonce cookie | `403 invalid oauth state` |

## 6. Limitations and how to interpret these results

1. **The in-memory harness is not MySQL.** `server/security/inMemoryDb.ts` compiles the real SQL that Drizzle generates and evaluates it against synthetic rows, so the tests exercise the actual `WHERE` clauses and joins written by `server/db.ts`. It supports the statement shapes those helpers emit (`SELECT` with `inner/left join`, `WHERE`, `ORDER BY`, `LIMIT`, `INSERT … VALUES/ON DUPLICATE KEY UPDATE`, `UPDATE … SET … WHERE`) and throws on anything else. It does not model MySQL type coercion, collation, NULL semantics beyond equality, transactions, or isolation levels.
2. **Production code gained one test seam.** `server/db.ts` exports `__setTestDatabase()` so a Drizzle instance can be injected; `getDb()` returns it verbatim and production never calls it. This is the only production change made purely for testability, and it is additive (no behavior change).
3. **External services are stubbed.** The Forge presign call and the OAuth token exchange are replaced with local fakes; no network request leaves the machine. Consequently the *upstream* behavior of those services is not verified (see `FINDINGS.md` U-1/U-2).
4. **No browser, no UI execution.** Client-side gating, the evidence download experience after F-02's fix, and visual/interaction behavior were not executed. Cookie-mediated sessions are simulated with a minted `app_session_id` header; the `Bearer` path is simulated with an `Authorization` header.
5. **No production verification.** No deployed environment, real user record, or external target was accessed. The 69 passing tests are evidence about the reviewed commit's server-side logic, not a statement that the application is secure.
6. **Tests are not a coverage metric.** No coverage tooling was run and no coverage percentage is claimed.
7. **Re-run before relying on these results.** The commands are `pnpm install --frozen-lockfile && pnpm test && pnpm check && pnpm build` (see `README.md`).
