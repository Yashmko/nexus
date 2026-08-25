/** NEXUS database helpers keep report records scoped to the authenticated owner. */
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, missionActivity, missionApprovals, missionAssignments, missionAttachments, missionNotifications, missions, reportRecords, users } from "../drizzle/schema";
import { ENV } from "./_core/env";
import { notifyOwner } from "./_core/notification";
import { storagePut } from "./storage";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export type ReportRecordInput = {
  missionId: string;
  title: string;
  scope: string;
  status: string;
  summary: string;
  findingSnapshot: unknown;
  evidenceSnapshot: unknown;
};

export async function saveReportRecord(ownerId: number, input: ReportRecordInput) {
  const db = await getDb();
  if (!db) throw new Error("Report storage is unavailable. Configure the project database and try again.");
  await db.insert(reportRecords).values({ ownerId, ...input });
  return getLatestReportRecord(ownerId, input.missionId);
}

export async function getLatestReportRecord(ownerId: number, missionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Report storage is unavailable. Configure the project database and try again.");
  const result = await db
    .select()
    .from(reportRecords)
    .where(and(eq(reportRecords.ownerId, ownerId), eq(reportRecords.missionId, missionId)))
    .orderBy(desc(reportRecords.updatedAt), desc(reportRecords.id))
    .limit(1);
  return result[0] ?? null;
}

export async function getReportHistory(ownerId: number, missionId: string) {
  const db = await getDb();
  if (!db) throw new Error("Report storage is unavailable. Configure the project database and try again.");
  return db
    .select()
    .from(reportRecords)
    .where(and(eq(reportRecords.ownerId, ownerId), eq(reportRecords.missionId, missionId)))
    .orderBy(desc(reportRecords.updatedAt), desc(reportRecords.id));
}

export async function getReportOwner(ownerId: number, reportId: number) {
  const db = await getDb();
  if (!db) throw new Error("Report storage is unavailable. Configure the project database and try again.");
  const result = await db
    .select({
      reportId: reportRecords.id,
      ownerId: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
    })
    .from(reportRecords)
    .innerJoin(users, eq(reportRecords.ownerId, users.id))
    .where(and(eq(reportRecords.id, reportId), eq(reportRecords.ownerId, ownerId)))
    .limit(1);
  return result[0] ?? null;
}

export type CreateMissionInput = {
  missionKey: string;
  title: string;
  account: string;
  scope: string;
  risk: "critical" | "high" | "medium" | "low" | "info";
};

type Actor = { id: number; role: "user" | "admin" };

async function getAccessibleMissionIds(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  const assignments = await db.select({ missionId: missionAssignments.missionId }).from(missionAssignments).where(eq(missionAssignments.userId, userId));
  return assignments.map((assignment) => assignment.missionId);
}

function accessCondition(actor: Actor, assignedMissionIds: number[]) {
  if (actor.role === "admin") return undefined;
  if (!assignedMissionIds.length) return eq(missions.ownerId, actor.id);
  return or(eq(missions.ownerId, actor.id), inArray(missions.id, assignedMissionIds));
}

export async function listMissions(actor: Actor, includeArchived = false) {
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  const assignedMissionIds = await getAccessibleMissionIds(actor.id);
  const conditions = [accessCondition(actor, assignedMissionIds)];
  if (!includeArchived) conditions.push(eq(missions.archived, false));
  return db
    .select({
      id: missions.id,
      missionKey: missions.missionKey,
      ownerId: missions.ownerId,
      title: missions.title,
      account: missions.account,
      scope: missions.scope,
      status: missions.status,
      risk: missions.risk,
      stage: missions.stage,
      progress: missions.progress,
      evidenceCount: missions.evidenceCount,
      findingCount: missions.findingCount,
      archived: missions.archived,
      createdAt: missions.createdAt,
      updatedAt: missions.updatedAt,
      ownerName: users.name,
      ownerEmail: users.email,
    })
    .from(missions)
    .innerJoin(users, eq(missions.ownerId, users.id))
    .where(and(...conditions))
    .orderBy(desc(missions.updatedAt), desc(missions.id));
}

export async function getMission(actor: Actor, missionId: number) {
  const missionList = await listMissions(actor, true);
  return missionList.find((mission) => mission.id === missionId) ?? null;
}

export async function createMission(ownerId: number, input: CreateMissionInput) {
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  await db.insert(missions).values({ ownerId, ...input });
  const result = await db.select().from(missions).where(eq(missions.missionKey, input.missionKey)).limit(1);
  const mission = result[0];
  if (!mission) throw new Error("Mission could not be created.");
  await db.insert(missionAssignments).values({ missionId: mission.id, userId: ownerId, assignedById: ownerId, role: "analyst" });
  await recordMissionActivity(mission.id, ownerId, "mission_created", `Created mission ${mission.missionKey}.`, { account: mission.account, scope: mission.scope, risk: mission.risk });
  return mission;
}

export async function archiveMission(actor: Actor, missionId: number) {
  const mission = await getMission(actor, missionId);
  if (!mission) return null;
  if (actor.role !== "admin" && mission.ownerId !== actor.id) throw new Error("Only a mission owner or administrator can archive this mission.");
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  await db.update(missions).set({ archived: true, status: "archived" }).where(eq(missions.id, missionId));
  await recordMissionActivity(missionId, actor.id, "mission_archived", `Archived mission ${mission.missionKey}.`);
  return getMission(actor, missionId);
}

export async function listAssignableUsers() {
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role }).from(users).orderBy(users.name);
}

export async function listMissionAssignments(actor: Actor, missionId: number) {
  const mission = await getMission(actor, missionId);
  if (!mission) return null;
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  return db
    .select({ id: missionAssignments.id, missionId: missionAssignments.missionId, userId: missionAssignments.userId, role: missionAssignments.role, assignedById: missionAssignments.assignedById, createdAt: missionAssignments.createdAt, name: users.name, email: users.email })
    .from(missionAssignments)
    .innerJoin(users, eq(missionAssignments.userId, users.id))
    .where(eq(missionAssignments.missionId, missionId));
}

export async function assignMission(actor: Actor, missionId: number, userId: number, role: "analyst" | "reviewer" | "approver") {
  const mission = await getMission(actor, missionId);
  if (!mission) return null;
  if (actor.role !== "admin" && mission.ownerId !== actor.id) throw new Error("Only a mission owner or administrator can assign operators.");
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  const existing = await db.select().from(missionAssignments).where(and(eq(missionAssignments.missionId, missionId), eq(missionAssignments.userId, userId))).limit(1);
  if (existing[0]) {
    await db.update(missionAssignments).set({ role, assignedById: actor.id }).where(eq(missionAssignments.id, existing[0].id));
  } else {
    await db.insert(missionAssignments).values({ missionId, userId, assignedById: actor.id, role });
  }
  await recordMissionActivity(missionId, actor.id, "assignment_updated", `Updated ${role} assignment for user ${userId}.`, { userId, role });
  return listMissionAssignments(actor, missionId);
}

export async function requestMissionApproval(actor: Actor, missionId: number, input: { type: string; summary: string; assignedApproverId?: number | null }) {
  const mission = await getMission(actor, missionId);
  if (!mission) return null;
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  await db.insert(missionApprovals).values({ missionId, requestedById: actor.id, type: input.type, summary: input.summary, assignedApproverId: input.assignedApproverId ?? null });
  const inserted = await db.select().from(missionApprovals).where(and(eq(missionApprovals.missionId, missionId), eq(missionApprovals.requestedById, actor.id))).orderBy(desc(missionApprovals.id)).limit(1);
  const approval = inserted[0];
  if (approval) {
    await recordMissionActivity(missionId, actor.id, "approval_requested", `Requested ${input.type} approval.`, { approvalId: approval.id, assignedApproverId: input.assignedApproverId ?? null });
    await notifyPendingApproval(missionId, approval.id, input.assignedApproverId ?? null, mission.missionKey, input.type, input.summary);
  }
  return listMissionApprovals(actor, missionId);
}

export async function listMissionApprovals(actor: Actor, missionId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  const assignedMissionIds = await getAccessibleMissionIds(actor.id);
  const actorMissionScope = accessCondition(actor, assignedMissionIds);
  const scope = missionId ? and(eq(missionApprovals.missionId, missionId), actorMissionScope) : actorMissionScope;
  return db
    .select({ id: missionApprovals.id, missionId: missionApprovals.missionId, missionKey: missions.missionKey, missionTitle: missions.title, requestedById: missionApprovals.requestedById, assignedApproverId: missionApprovals.assignedApproverId, type: missionApprovals.type, summary: missionApprovals.summary, status: missionApprovals.status, decisionNote: missionApprovals.decisionNote, decidedById: missionApprovals.decidedById, decidedAt: missionApprovals.decidedAt, createdAt: missionApprovals.createdAt })
    .from(missionApprovals)
    .innerJoin(missions, eq(missionApprovals.missionId, missions.id))
    .where(scope)
    .orderBy(desc(missionApprovals.updatedAt), desc(missionApprovals.id));
}

export async function decideMissionApproval(actor: Actor, approvalId: number, decision: "approved" | "rejected", decisionNote: string) {
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  const approval = await db.select().from(missionApprovals).where(eq(missionApprovals.id, approvalId)).limit(1);
  const record = approval[0];
  if (!record) return null;
  if (record.status !== "pending") throw new Error("Only a pending approval can be decided.");
  if (actor.role !== "admin" && record.assignedApproverId !== actor.id) throw new Error("Only the assigned approver or an administrator can decide this request.");
  await db.update(missionApprovals).set({ status: decision, decisionNote, decidedById: actor.id, decidedAt: new Date() }).where(eq(missionApprovals.id, approvalId));
  await recordMissionActivity(record.missionId, actor.id, `approval_${decision}`, `${decision === "approved" ? "Approved" : "Rejected"} ${record.type} request.`, { approvalId, decisionNote });
  return db.select().from(missionApprovals).where(eq(missionApprovals.id, approvalId)).limit(1);
}

export async function recordMissionActivity(missionId: number, actorId: number | null, action: string, summary: string, metadata?: unknown) {
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  await db.insert(missionActivity).values({ missionId, actorId, action, summary, metadata: metadata ?? null });
}

export async function listMissionActivity(actor: Actor, missionId: number) {
  const mission = await getMission(actor, missionId);
  if (!mission) return null;
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  return db
    .select({ id: missionActivity.id, missionId: missionActivity.missionId, actorId: missionActivity.actorId, action: missionActivity.action, summary: missionActivity.summary, metadata: missionActivity.metadata, createdAt: missionActivity.createdAt, actorName: users.name, actorEmail: users.email })
    .from(missionActivity)
    .leftJoin(users, eq(missionActivity.actorId, users.id))
    .where(eq(missionActivity.missionId, missionId))
    .orderBy(desc(missionActivity.createdAt), desc(missionActivity.id));
}

type AttachmentInput = { fileName: string; mimeType: string; contentBase64: string };

export async function uploadMissionAttachment(actor: Actor, missionId: number, input: AttachmentInput) {
  const mission = await getMission(actor, missionId);
  if (!mission) return null;
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  const safeFileName = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 180) || "evidence.bin";
  const content = Buffer.from(input.contentBase64, "base64");
  if (!content.length) throw new Error("Evidence attachment is empty.");
  if (content.byteLength > 5 * 1024 * 1024) throw new Error("Evidence attachments are limited to 5 MB.");
  const { key, url } = await storagePut(`missions/${missionId}/evidence/${safeFileName}`, content, input.mimeType);
  await db.insert(missionAttachments).values({ missionId, uploadedById: actor.id, fileName: safeFileName, mimeType: input.mimeType, fileKey: key, url, sizeBytes: content.byteLength });
  await recordMissionActivity(missionId, actor.id, "evidence_attached", `Attached evidence file ${safeFileName}.`, { fileName: safeFileName, mimeType: input.mimeType, sizeBytes: content.byteLength });
  return listMissionAttachments(actor, missionId);
}

export async function listMissionAttachments(actor: Actor, missionId: number) {
  const mission = await getMission(actor, missionId);
  if (!mission) return null;
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  return db
    .select({ id: missionAttachments.id, missionId: missionAttachments.missionId, uploadedById: missionAttachments.uploadedById, fileName: missionAttachments.fileName, mimeType: missionAttachments.mimeType, url: missionAttachments.url, sizeBytes: missionAttachments.sizeBytes, createdAt: missionAttachments.createdAt, uploaderName: users.name, uploaderEmail: users.email })
    .from(missionAttachments)
    .innerJoin(users, eq(missionAttachments.uploadedById, users.id))
    .where(eq(missionAttachments.missionId, missionId))
    .orderBy(desc(missionAttachments.createdAt), desc(missionAttachments.id));
}

async function notifyPendingApproval(missionId: number, approvalId: number, recipientId: number | null, missionKey: string, type: string, summary: string) {
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  const title = `NEXUS approval pending: ${missionKey}`;
  const content = `${type}: ${summary}`;
  await db.insert(missionNotifications).values({ missionId, approvalId, recipientId, title, content, status: "queued" });
  const inserted = await db.select().from(missionNotifications).where(and(eq(missionNotifications.missionId, missionId), eq(missionNotifications.approvalId, approvalId))).orderBy(desc(missionNotifications.id)).limit(1);
  const notification = inserted[0];
  if (!notification) return;
  const delivered = await notifyOwner({ title, content });
  await db.update(missionNotifications).set({ status: delivered ? "sent" : "failed", deliveredAt: new Date() }).where(eq(missionNotifications.id, notification.id));
}

export async function listMissionNotifications(actor: Actor, missionId?: number) {
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  const assignedMissionIds = await getAccessibleMissionIds(actor.id);
  const actorMissionScope = accessCondition(actor, assignedMissionIds);
  const scope = missionId ? and(eq(missionNotifications.missionId, missionId), actorMissionScope) : actorMissionScope;
  return db
    .select({ id: missionNotifications.id, missionId: missionNotifications.missionId, approvalId: missionNotifications.approvalId, recipientId: missionNotifications.recipientId, title: missionNotifications.title, content: missionNotifications.content, status: missionNotifications.status, createdAt: missionNotifications.createdAt, deliveredAt: missionNotifications.deliveredAt })
    .from(missionNotifications)
    .innerJoin(missions, eq(missionNotifications.missionId, missions.id))
    .where(scope)
    .orderBy(desc(missionNotifications.createdAt), desc(missionNotifications.id));
}
