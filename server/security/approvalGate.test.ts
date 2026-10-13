/**
 * Approval-gate tests: who may request an approval, who may decide it, and
 * whether the resulting audit records attribute the action correctly.
 *
 * The "self-approval" cases assert the separation-of-duties property the
 * product documents ("A mission never advances on a silent side effect",
 * "role-aware approvals"): the operator who raises a request must not be able
 * to decide it alone.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { APPROVALS, MISSIONS, USERS } from "./fixtures";
import { callerFor, setupSecurityDatabase, testUser } from "./harness";

let harness: ReturnType<typeof setupSecurityDatabase>;

const owner = () => testUser(USERS.owner);
const analyst = () => testUser(USERS.analyst);
const reviewer = () => testUser(USERS.reviewer);
const approver = () => testUser(USERS.approver);
const outsider = () => testUser(USERS.outsider);
const admin = () => testUser(USERS.admin, "admin");
const unassignedApprover = () => testUser(USERS.unassignedApprover);

beforeEach(() => {
  harness = setupSecurityDatabase();
});

describe("approval requests", () => {
  it("lets the mission owner request an approval for a mission participant", async () => {
    const queue = await callerFor(owner()).missions.requestApproval({
      missionId: MISSIONS.owned,
      type: "evidence review",
      summary: "Second review of the evidence package.",
      assignedApproverId: USERS.approver,
    });
    const created = queue?.find((approval) => approval.summary === "Second review of the evidence package.");
    expect(created).toMatchObject({ requestedById: USERS.owner, assignedApproverId: USERS.approver, status: "pending" });

    // The delivery ledger records the pending-approval alert.
    const notifications = harness.tables.mission_notifications;
    expect(notifications.some((row) => row.approvalId === created?.id)).toBe(true);
  });

  it("rejects approval requests from an unauthenticated caller or a non-participant", async () => {
    const input = { missionId: MISSIONS.owned, type: "evidence review", summary: "Not allowed.", assignedApproverId: null };
    await expect(callerFor(null).missions.requestApproval(input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(callerFor(outsider()).missions.requestApproval(input)).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("accepts requests from any assigned participant, including a reviewer (documented gap: assignment role is not enforced)", async () => {
    const queue = await callerFor(reviewer()).missions.requestApproval({
      missionId: MISSIONS.owned,
      type: "scope expansion",
      summary: "Reviewer-raised request.",
      assignedApproverId: USERS.approver,
    });
    expect(queue?.some((approval) => approval.summary === "Reviewer-raised request.")).toBe(true);
  });

  it("rejects a request that names the requester as its own approver", async () => {
    await expect(
      callerFor(owner()).missions.requestApproval({
        missionId: MISSIONS.owned,
        type: "self approval",
        summary: "Approve my own request.",
        assignedApproverId: USERS.owner,
      }),
    ).rejects.toThrow(/cannot be assigned to its own requester/i);

    await expect(
      callerFor(admin()).missions.requestApproval({
        missionId: MISSIONS.owned,
        type: "self approval",
        summary: "Administrator self-assignment.",
        assignedApproverId: USERS.admin,
      }),
    ).rejects.toThrow(/cannot be assigned to its own requester/i);
  });
});

describe("approval decisions", () => {
  it("lets the assigned approver decide a pending request and records the decision", async () => {
    const decided = await callerFor(approver()).missions.decideApproval({
      approvalId: APPROVALS.pendingAssigned,
      decision: "approved",
      decisionNote: "Evidence package checked.",
    });
    expect(decided).toMatchObject({ id: APPROVALS.pendingAssigned, status: "approved", decidedById: USERS.approver });
    expect(decided?.decidedAt).toBeTruthy();

    const audit = harness.tables.mission_activity.filter((row) => row.action === "approval_approved");
    expect(audit).toHaveLength(1);
    expect(audit[0]?.actorId).toBe(USERS.approver);
    expect(audit[0]?.missionId).toBe(MISSIONS.owned);
  });

  it("lets an administrator decide any pending request, including an unassigned one", async () => {
    const decided = await callerFor(admin()).missions.decideApproval({
      approvalId: APPROVALS.pendingUnassigned,
      decision: "rejected",
      decisionNote: "Scope evidence incomplete.",
    });
    expect(decided).toMatchObject({ status: "rejected", decidedById: USERS.admin });
  });

  it("denies an operator who is not the assigned approver", async () => {
    await expect(
      callerFor(unassignedApprover()).missions.decideApproval({ approvalId: APPROVALS.pendingAssigned, decision: "approved", decisionNote: "" }),
    ).rejects.toThrow(/assigned approver or an administrator/i);

    await expect(
      callerFor(analyst()).missions.decideApproval({ approvalId: APPROVALS.pendingAssigned, decision: "approved", decisionNote: "" }),
    ).rejects.toThrow(/assigned approver or an administrator/i);

    await expect(
      callerFor(outsider()).missions.decideApproval({ approvalId: APPROVALS.pendingAssigned, decision: "approved", decisionNote: "" }),
    ).rejects.toThrow(/assigned approver or an administrator/i);
  });

  it("denies unauthenticated decisions", async () => {
    await expect(
      callerFor(null).missions.decideApproval({ approvalId: APPROVALS.pendingAssigned, decision: "approved", decisionNote: "" }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("refuses to re-decide an approval that is no longer pending", async () => {
    await expect(
      callerFor(approver()).missions.decideApproval({ approvalId: APPROVALS.approved, decision: "rejected", decisionNote: "Second thoughts." }),
    ).rejects.toThrow(/pending approval/i);
  });

  it("denies a decision by the operator who raised the request (self-approval)", async () => {
    const queue = await callerFor(owner()).missions.requestApproval({
      missionId: MISSIONS.owned,
      type: "release",
      summary: "Owner-raised request decided by the owner.",
      assignedApproverId: USERS.approver,
    });
    const created = queue?.find((approval) => approval.summary === "Owner-raised request decided by the owner.");
    expect(created).toBeTruthy();

    // Simulate the historical row shape directly (requester === assigned approver),
    // which is what the client could produce before this rule existed.
    harness.tables.mission_approvals.push({
      id: 900,
      missionId: MISSIONS.owned,
      requestedById: USERS.owner,
      assignedApproverId: USERS.owner,
      type: "self approval",
      summary: "Requester is also the assigned approver.",
      status: "pending",
      decisionNote: null,
      decidedById: null,
      decidedAt: null,
      createdAt: new Date("2026-01-02T00:00:00Z"),
      updatedAt: new Date("2026-01-02T00:00:00Z"),
    });

    await expect(
      callerFor(owner()).missions.decideApproval({ approvalId: 900, decision: "approved", decisionNote: "Self-approved." }),
    ).rejects.toThrow(/own approval|separation of duties/i);

    const stored = harness.tables.mission_approvals.find((row) => row.id === 900);
    expect(stored?.status).toBe("pending");
    expect(stored?.decidedById).toBeNull();
  });

  it("documents that a non-participant named as approver can still decide (gap, not fixed in this review)", async () => {
    const queue = await callerFor(owner()).missions.requestApproval({
      missionId: MISSIONS.owned,
      type: "external review",
      summary: "Assigned to an operator outside the mission.",
      assignedApproverId: USERS.unassignedApprover,
    });
    const created = queue?.find((approval) => approval.summary === "Assigned to an operator outside the mission.");

    const decided = await callerFor(unassignedApprover()).missions.decideApproval({
      approvalId: created!.id,
      decision: "approved",
      decisionNote: "Decided without mission membership.",
    });
    expect(decided).toMatchObject({ status: "approved", decidedById: USERS.unassignedApprover });
  });
});

describe("approval gate scope", () => {
  it("leaves mission lifecycle state untouched: approvals are advisory today", async () => {
    await callerFor(approver()).missions.decideApproval({ approvalId: APPROVALS.pendingAssigned, decision: "approved", decisionNote: "ok" });
    await callerFor(admin()).missions.decideApproval({ approvalId: APPROVALS.pendingUnassigned, decision: "approved", decisionNote: "ok" });

    const mission = harness.tables.missions.find((row) => row.id === MISSIONS.owned);
    // No procedure consults approval state, so an approved gate does not advance
    // the mission; conversely this means there is no approval bypass to exploit yet.
    expect(mission).toMatchObject({ status: "active", stage: "Target", progress: 0 });
  });
});
