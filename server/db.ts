/** NEXUS database helpers keep report records scoped to the authenticated owner. */
import { and, desc, eq, inArray, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, missionApprovals, missionAssignments, missions, reportRecords, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

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
  return mission;
}

export async function archiveMission(actor: Actor, missionId: number) {
  const mission = await getMission(actor, missionId);
  if (!mission) return null;
  if (actor.role !== "admin" && mission.ownerId !== actor.id) throw new Error("Only a mission owner or administrator can archive this mission.");
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  await db.update(missions).set({ archived: true, status: "archived" }).where(eq(missions.id, missionId));
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
  return listMissionAssignments(actor, missionId);
}

export async function requestMissionApproval(actor: Actor, missionId: number, input: { type: string; summary: string; assignedApproverId?: number | null }) {
  const mission = await getMission(actor, missionId);
  if (!mission) return null;
  const db = await getDb();
  if (!db) throw new Error("Mission storage is unavailable. Configure the project database and try again.");
  await db.insert(missionApprovals).values({ missionId, requestedById: actor.id, type: input.type, summary: input.summary, assignedApproverId: input.assignedApproverId ?? null });
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
  return db.select().from(missionApprovals).where(eq(missionApprovals.id, approvalId)).limit(1);
}
