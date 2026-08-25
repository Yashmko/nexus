/** NEXUS database helpers keep report records scoped to the authenticated owner. */
import { desc, eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, reportRecords, users } from "../drizzle/schema";
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
