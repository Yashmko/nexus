/**
 * Synthetic fixtures for the NEXUS security test-suite.
 *
 * Everything here is invented test data. No production records, credentials, or
 * customer data are involved. Table columns mirror `drizzle/schema.ts`, and
 * `defaults` mirrors the schema's column defaults so INSERTs performed by
 * `server/db.ts` behave like MySQL.
 */
import type { FixtureRow, FixtureTables } from "./inMemoryDb";

export const NOW = new Date("2026-01-01T00:00:00Z");
const EARLIER = new Date("2025-12-01T00:00:00Z");

/**
 * Role matrix used across the suite:
 *  1 owner-a      -> owns mission 100 (and archived mission 300)
 *  2 analyst-a    -> assigned "analyst" on mission 100
 *  3 reviewer-a   -> assigned "reviewer" on mission 100
 *  4 approver-a   -> assigned "approver" on mission 100
 *  5 outsider     -> no relationship to mission 100; owns mission 200
 *  6 admin-a      -> global administrator role
 *  7 approver-b   -> exists, but is NOT assigned to mission 100
 */
export const USERS = {
  owner: 1,
  analyst: 2,
  reviewer: 3,
  approver: 4,
  outsider: 5,
  admin: 6,
  unassignedApprover: 7,
} as const;

export const MISSIONS = { owned: 100, outsiderOwned: 200, archived: 300 } as const;

export const APPROVALS = { pendingAssigned: 700, approved: 701, pendingUnassigned: 702 } as const;

function user(id: number, openId: string, role: "user" | "admin"): FixtureRow {
  return {
    id,
    openId,
    name: `NEXUS ${openId}`,
    email: `${openId}@nexus.test`,
    loginMethod: "manus",
    role,
    createdAt: NOW,
    updatedAt: NOW,
    lastSignedIn: NOW,
  };
}

export type SecurityFixtures = {
  seed: FixtureTables;
  defaults: Record<string, FixtureRow>;
  uniqueKeys: Record<string, string[]>;
};

export function securityFixtures(): SecurityFixtures {
  const seed: FixtureTables = {
    users: [
      user(1, "owner-a", "user"),
      user(2, "analyst-a", "user"),
      user(3, "reviewer-a", "user"),
      user(4, "approver-a", "user"),
      user(5, "outsider", "user"),
      user(6, "admin-a", "admin"),
      user(7, "approver-b", "user"),
    ],
    missions: [
      {
        id: MISSIONS.owned,
        missionKey: "MIS-OWNED",
        ownerId: 1,
        title: "Owned mission",
        account: "owner-a-account",
        scope: "10.0.0.0/24",
        status: "active",
        risk: "low",
        stage: "Target",
        progress: 0,
        evidenceCount: 0,
        findingCount: 0,
        archived: false,
        createdAt: EARLIER,
        updatedAt: NOW,
      },
      {
        id: MISSIONS.outsiderOwned,
        missionKey: "MIS-OUTSIDER",
        ownerId: 5,
        title: "Outsider mission",
        account: "outsider-account",
        scope: "10.0.1.0/24",
        status: "active",
        risk: "high",
        stage: "Target",
        progress: 0,
        evidenceCount: 0,
        findingCount: 0,
        archived: false,
        createdAt: EARLIER,
        updatedAt: NOW,
      },
      {
        id: MISSIONS.archived,
        missionKey: "MIS-ARCHIVED",
        ownerId: 1,
        title: "Archived mission",
        account: "owner-a-account",
        scope: "10.0.2.0/24",
        status: "archived",
        risk: "info",
        stage: "Report",
        progress: 100,
        evidenceCount: 0,
        findingCount: 0,
        archived: true,
        createdAt: EARLIER,
        updatedAt: EARLIER,
      },
    ],
    mission_assignments: [
      { id: 1, missionId: MISSIONS.owned, userId: 1, assignedById: 1, role: "analyst", createdAt: EARLIER },
      { id: 2, missionId: MISSIONS.owned, userId: 2, assignedById: 1, role: "analyst", createdAt: EARLIER },
      { id: 3, missionId: MISSIONS.owned, userId: 3, assignedById: 1, role: "reviewer", createdAt: EARLIER },
      { id: 4, missionId: MISSIONS.owned, userId: 4, assignedById: 1, role: "approver", createdAt: EARLIER },
      { id: 5, missionId: MISSIONS.outsiderOwned, userId: 5, assignedById: 5, role: "analyst", createdAt: EARLIER },
    ],
    mission_approvals: [
      {
        id: APPROVALS.pendingAssigned,
        missionId: MISSIONS.owned,
        requestedById: 1,
        assignedApproverId: 4,
        type: "evidence review",
        summary: "Confirm the evidence package.",
        status: "pending",
        decisionNote: null,
        decidedById: null,
        decidedAt: null,
        createdAt: EARLIER,
        updatedAt: EARLIER,
      },
      {
        id: APPROVALS.approved,
        missionId: MISSIONS.owned,
        requestedById: 1,
        assignedApproverId: 4,
        type: "scope expansion",
        summary: "Add one host.",
        status: "approved",
        decisionNote: "Approved earlier.",
        decidedById: 4,
        decidedAt: NOW,
        createdAt: EARLIER,
        updatedAt: NOW,
      },
      {
        id: APPROVALS.pendingUnassigned,
        missionId: MISSIONS.owned,
        requestedById: 2,
        assignedApproverId: null,
        type: "engagement close",
        summary: "Queue for an administrator.",
        status: "pending",
        decisionNote: null,
        decidedById: null,
        decidedAt: null,
        createdAt: EARLIER,
        updatedAt: EARLIER,
      },
    ],
    mission_activity: [
      { id: 1, missionId: MISSIONS.owned, actorId: 1, action: "mission_created", summary: "Created mission MIS-OWNED.", metadata: null, createdAt: EARLIER },
      { id: 2, missionId: MISSIONS.owned, actorId: 2, action: "approval_requested", summary: "Requested engagement close approval.", metadata: { approvalId: 702 }, createdAt: NOW },
    ],
    mission_attachments: [
      {
        id: 1,
        missionId: MISSIONS.owned,
        uploadedById: 2,
        fileName: "scan-output.txt",
        mimeType: "text/plain",
        fileKey: "missions/100/evidence/scan-output.txt_0f1e2d3c",
        url: "/manus-storage/missions/100/evidence/scan-output.txt_0f1e2d3c",
        sizeBytes: 2048,
        createdAt: NOW,
      },
    ],
    mission_notifications: [
      { id: 1, missionId: MISSIONS.owned, approvalId: 700, recipientId: 4, title: "NEXUS approval pending: MIS-OWNED", content: "evidence review: Confirm the evidence package.", status: "queued", createdAt: NOW, deliveredAt: null },
    ],
    report_records: [
      {
        id: 1,
        ownerId: 1,
        missionId: "MIS-OWNED",
        title: "Owner report",
        scope: "10.0.0.0/24",
        status: "draft",
        summary: "Owner-only summary.",
        findingSnapshot: { findings: [] },
        evidenceSnapshot: { evidence: [] },
        createdAt: EARLIER,
        updatedAt: NOW,
      },
      {
        id: 2,
        ownerId: 5,
        missionId: "MIS-OUTSIDER",
        title: "Outsider report",
        scope: "10.0.1.0/24",
        status: "draft",
        summary: "Outsider-only summary.",
        findingSnapshot: { findings: [] },
        evidenceSnapshot: { evidence: [] },
        createdAt: EARLIER,
        updatedAt: NOW,
      },
    ],
  };

  const defaults: Record<string, FixtureRow> = {
    users: { role: "user", createdAt: NOW, updatedAt: NOW, lastSignedIn: NOW },
    report_records: { status: "draft", createdAt: NOW, updatedAt: NOW },
    missions: {
      status: "active",
      risk: "info",
      stage: "Target",
      progress: 0,
      evidenceCount: 0,
      findingCount: 0,
      archived: false,
      createdAt: NOW,
      updatedAt: NOW,
    },
    mission_assignments: { createdAt: NOW },
    mission_approvals: { status: "pending", decisionNote: null, decidedById: null, decidedAt: null, createdAt: NOW, updatedAt: NOW },
    mission_activity: { actorId: null, metadata: null, createdAt: NOW },
    mission_attachments: { createdAt: NOW },
    mission_notifications: { status: "queued", recipientId: null, deliveredAt: null, createdAt: NOW },
  };

  return { seed, defaults, uniqueKeys: { users: ["openId"], missions: ["missionKey"] } };
}
