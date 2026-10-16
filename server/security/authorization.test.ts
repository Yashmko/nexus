/**
 * Authorization / access-control regression tests for the NEXUS tRPC surface.
 *
 * Each test drives the real router and the real data-access layer against an
 * isolated in-memory database built from synthetic fixtures (see fixtures.ts).
 * Allowed and denied cases are covered for every relevant role.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "../routers";
import { MISSIONS, USERS } from "./fixtures";
import { callerFor, setupSecurityDatabase, testUser } from "./harness";

let harness: ReturnType<typeof setupSecurityDatabase>;

const owner = () => testUser(USERS.owner);
const analyst = () => testUser(USERS.analyst);
const reviewer = () => testUser(USERS.reviewer);
const approver = () => testUser(USERS.approver);
const outsider = () => testUser(USERS.outsider);
const admin = () => testUser(USERS.admin, "admin");

const ids = (rows: Array<{ id: number }>) => rows.map((row) => row.id).sort((a, b) => a - b);

beforeEach(() => {
  harness = setupSecurityDatabase();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("mission visibility (horizontal privilege)", () => {
  it("owner sees only their own active missions", async () => {
    const missions = await callerFor(owner()).missions.list();
    expect(ids(missions)).toEqual([MISSIONS.owned]);
  });

  it("each assigned operator role sees the assigned mission but not other owners' missions", async () => {
    for (const user of [analyst(), reviewer(), approver()]) {
      const missions = await callerFor(user).missions.list();
      expect(ids(missions)).toEqual([MISSIONS.owned]);
      expect(missions.some((mission) => mission.id === MISSIONS.outsiderOwned)).toBe(false);
    }
  });

  it("administrator sees every active mission and archived missions on request", async () => {
    const caller = callerFor(admin());
    expect(ids(await caller.missions.list())).toEqual([MISSIONS.owned, MISSIONS.outsiderOwned]);
    expect(ids(await caller.missions.list({ includeArchived: true }))).toEqual([
      MISSIONS.owned,
      MISSIONS.outsiderOwned,
      MISSIONS.archived,
    ]);
  });

  it("archived missions are hidden from the default portfolio listing", async () => {
    expect(ids(await callerFor(owner()).missions.list())).toEqual([MISSIONS.owned]);
    expect(ids(await callerFor(owner()).missions.list({ includeArchived: true }))).toEqual([
      MISSIONS.owned,
      MISSIONS.archived,
    ]);
  });

  it("rejects unauthenticated mission access", async () => {
    await expect(callerFor(null).missions.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("scopes sub-resources to mission participants and reports NOT_FOUND to outsiders", async () => {
    const outsiderCaller = callerFor(outsider());
    await expect(outsiderCaller.missions.activity({ missionId: MISSIONS.owned })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(outsiderCaller.missions.attachments({ missionId: MISSIONS.owned })).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(outsiderCaller.missions.assignments({ missionId: MISSIONS.owned })).rejects.toMatchObject({ code: "NOT_FOUND" });
    // Notifications apply the same scope predicate but return an empty list
    // instead of NOT_FOUND (no records are disclosed either way).
    expect(await outsiderCaller.missions.notifications({ missionId: MISSIONS.owned })).toHaveLength(0);

    const analystCaller = callerFor(analyst());
    expect(await analystCaller.missions.activity({ missionId: MISSIONS.owned })).toHaveLength(2);
    expect(await analystCaller.missions.attachments({ missionId: MISSIONS.owned })).toHaveLength(1);
    expect(await analystCaller.missions.assignments({ missionId: MISSIONS.owned })).toHaveLength(4);
    expect(await analystCaller.missions.notifications({ missionId: MISSIONS.owned })).toHaveLength(1);
  });

  it("scopes the approval and notification queues to visible missions", async () => {
    const outsiderApprovals = await callerFor(outsider()).missions.approvals();
    expect(outsiderApprovals).toHaveLength(0);

    const analystApprovals = await callerFor(analyst()).missions.approvals();
    expect(analystApprovals.map((approval) => approval.id).sort()).toEqual([700, 701, 702]);

    const outsiderNotifications = await callerFor(outsider()).missions.notifications();
    expect(outsiderNotifications).toHaveLength(0);
  });
});

describe("owner / administrator controls", () => {
  it("allows the owner and an administrator to archive, and denies other participants", async () => {
    expect(await callerFor(owner()).missions.archive({ missionId: MISSIONS.owned })).toMatchObject({ archived: true, status: "archived" });

    for (const user of [analyst(), reviewer(), approver()]) {
      await expect(callerFor(user).missions.archive({ missionId: MISSIONS.owned })).rejects.toThrow(/owner or administrator/i);
    }

    await expect(callerFor(outsider()).missions.archive({ missionId: MISSIONS.owned })).rejects.toMatchObject({ code: "NOT_FOUND" });

    setupSecurityDatabase();
    expect(await callerFor(admin()).missions.archive({ missionId: MISSIONS.owned })).toMatchObject({ archived: true });
  });

  it("allows the owner and an administrator to assign operators, and denies other participants", async () => {
    const assigned = await callerFor(owner()).missions.assign({ missionId: MISSIONS.owned, userId: USERS.reviewer, role: "approver" });
    expect(assigned?.find((assignment) => assignment.userId === USERS.reviewer)?.role).toBe("approver");

    for (const user of [analyst(), reviewer(), approver()]) {
      await expect(
        callerFor(user).missions.assign({ missionId: MISSIONS.owned, userId: USERS.outsider, role: "reviewer" }),
      ).rejects.toThrow(/owner or administrator/i);
    }

    await expect(
      callerFor(outsider()).missions.assign({ missionId: MISSIONS.owned, userId: USERS.outsider, role: "reviewer" }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("restricts the assignable-user directory to administrators", async () => {
    await expect(callerFor(owner()).missions.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(analyst()).missions.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(callerFor(null).missions.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
    const directory = await callerFor(admin()).missions.users();
    expect(directory.length).toBe(7);
  });

  it("rejects mission creation from an unauthorized or unauthenticated caller", async () => {
    await expect(
      callerFor(null).missions.create({ missionKey: "MIS-NEW", title: "New mission", account: "acct", scope: "10.0.3.0/24", risk: "low" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const created = await callerFor(outsider()).missions.create({
      missionKey: "MIS-NEW",
      title: "New mission",
      account: "acct",
      scope: "10.0.3.0/24",
      risk: "low",
    });
    expect(created.ownerId).toBe(USERS.outsider);
  });
});

describe("evidence attachments", () => {
  function stubForge() {
    const calls: string[] = [];
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url.includes("presign/put")) {
        return new Response(JSON.stringify({ url: "https://s3.invalid/put-signed" }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response("", { status: 200 });
    });
    return calls;
  }

  it("rejects evidence upload without an authenticated user or from a non-participant", async () => {
    const payload = { missionId: MISSIONS.owned, fileName: "notes.txt", mimeType: "text/plain", contentBase64: Buffer.from("hello").toString("base64") };
    await expect(callerFor(null).missions.attachEvidence(payload)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(callerFor(outsider()).missions.attachEvidence(payload)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("records uploader attribution and a mission-scoped storage key", async () => {
    stubForge();
    const caller = callerFor(analyst());
    const attachments = await caller.missions.attachEvidence({
      missionId: MISSIONS.owned,
      fileName: "../../etc/passwd",
      mimeType: "text/plain",
      contentBase64: Buffer.from("evidence-bytes").toString("base64"),
    });
    const created = attachments?.find((attachment) => attachment.fileName.includes("passwd"));
    expect(created?.uploadedById).toBe(USERS.analyst);
    // Path traversal characters are neutralised before the key is built: no
    // ".." path segment can escape the mission's evidence prefix.
    const segments = (created?.url ?? "").split("/");
    expect(segments).not.toContain("..");
    expect(created?.url?.startsWith(`/manus-storage/missions/${MISSIONS.owned}/evidence/`)).toBe(true);

    const activity = harness.tables.mission_activity.filter((row) => row.action === "evidence_attached");
    expect(activity).toHaveLength(1);
    expect(activity[0]?.actorId).toBe(USERS.analyst);
  });

  it("accepts uploads from any assigned participant role (documented gap: assignment role is not enforced)", async () => {
    stubForge();
    for (const user of [analyst(), reviewer(), approver()]) {
      const attachments = await callerFor(user).missions.attachEvidence({
        missionId: MISSIONS.owned,
        fileName: "role-check.txt",
        mimeType: "text/plain",
        contentBase64: Buffer.from("x").toString("base64"),
      });
      expect(attachments?.length).toBeGreaterThan(0);
    }
  });

  it("rejects empty evidence payloads", async () => {
    stubForge();
    await expect(
      callerFor(owner()).missions.attachEvidence({ missionId: MISSIONS.owned, fileName: "empty.txt", mimeType: "text/plain", contentBase64: "" }),
    ).rejects.toBeTruthy();
  });
});

describe("report version access", () => {
  it("scopes report reads to the authenticated owner", async () => {
    const ownerCaller = callerFor(owner());
    const owned = await ownerCaller.reports.latest({ missionId: "MIS-OWNED" });
    expect(owned?.ownerId).toBe(USERS.owner);

    // Another owner querying the same mission key gets nothing, not the record above.
    const outsiderLatest = await callerFor(outsider()).reports.latest({ missionId: "MIS-OWNED" });
    expect(outsiderLatest).toBeNull();
    expect(await callerFor(outsider()).reports.history({ missionId: "MIS-OWNED" })).toHaveLength(0);

    expect(await callerFor(owner()).reports.history({ missionId: "MIS-OUTSIDER" })).toHaveLength(0);
  });

  it("refuses to disclose another owner's report-owner record (IDOR)", async () => {
    expect(await callerFor(owner()).reports.owner({ reportId: 1 })).toMatchObject({ reportId: 1, ownerId: USERS.owner });
    // Report 2 belongs to the outsider; the owner must not be able to resolve it.
    expect(await callerFor(owner()).reports.owner({ reportId: 2 })).toBeNull();
    expect(await callerFor(outsider()).reports.owner({ reportId: 1 })).toBeNull();
  });

  it("stamps saved report versions with the authenticated owner", async () => {
    const saved = await callerFor(analyst()).reports.save({
      missionId: "MIS-OWNED",
      title: "Analyst report",
      scope: "10.0.0.0/24",
      status: "draft",
      summary: "Analyst-scoped summary",
      findingSnapshot: [],
      evidenceSnapshot: [],
    });
    expect(saved?.ownerId).toBe(USERS.analyst);
    expect(await callerFor(owner()).reports.latest({ missionId: "MIS-OWNED" })).toMatchObject({ id: 1, ownerId: USERS.owner });
  });
});

describe("API surface", () => {
  it("matches the reviewed procedure allowlist", () => {
    const definition = appRouter._def as unknown as { procedures: Record<string, unknown> };
    const surface = Object.keys(definition.procedures).sort();
    // Any new endpoint must be reviewed deliberately and added to this list.
    expect(surface).toEqual(
      [
        "auth.logout",
        "auth.me",
        "missions.activity",
        "missions.approvals",
        "missions.archive",
        "missions.assign",
        "missions.assignments",
        "missions.attachEvidence",
        "missions.attachments",
        "missions.create",
        "missions.decideApproval",
        "missions.list",
        "missions.notifications",
        "missions.requestApproval",
        "missions.users",
        "reports.history",
        "reports.latest",
        "reports.owner",
        "reports.save",
        "system.health",
        "system.notifyOwner",
      ].sort(),
    );
  });
});

describe("actor identity", () => {
  it("ignores client-supplied ownership and role fields", async () => {
    // Extra input keys are stripped by zod; ownership comes from the session.
    const created = await callerFor(owner()).missions.create({
      missionKey: "MIS-FORGED",
      title: "Forged ownership",
      account: "acct",
      scope: "10.0.9.0/24",
      risk: "low",
      ownerId: USERS.outsider,
      role: "admin",
    } as unknown as { missionKey: string; title: string; account: string; scope: string; risk: "low" });
    expect(created.ownerId).toBe(USERS.owner);
  });

  it("denies a non-owner even when the payload claims administrator identity", async () => {
    await expect(
      callerFor(analyst()).missions.archive({ missionId: MISSIONS.owned, role: "admin", userId: USERS.admin } as unknown as { missionId: number }),
    ).rejects.toThrow(/owner or administrator/i);
  });
});
