import { boolean, index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing the Manus OAuth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

/**
 * Persisted report summaries; retain structured snapshots rather than raw artifact bytes.
 * Raw evidence belongs in the evidence store/S3 layer when that backend is introduced.
 */
export const reportRecords = mysqlTable(
  "report_records",
  {
    id: int("id").autoincrement().primaryKey(),
    ownerId: int("ownerId").notNull(),
    missionId: varchar("missionId", { length: 128 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    scope: text("scope").notNull(),
    status: varchar("status", { length: 64 }).notNull(),
    summary: text("summary").notNull(),
    findingSnapshot: json("findingSnapshot").notNull(),
    evidenceSnapshot: json("evidenceSnapshot").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("report_records_owner_mission_idx").on(table.ownerId, table.missionId)],
);

/**
 * Owner-bound assessment missions. The mission record holds operational metadata only;
 * raw evidence and tool output remain external to the database.
 */
export const missions = mysqlTable(
  "missions",
  {
    id: int("id").autoincrement().primaryKey(),
    missionKey: varchar("missionKey", { length: 128 }).notNull().unique(),
    ownerId: int("ownerId").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    account: varchar("account", { length: 255 }).notNull(),
    scope: text("scope").notNull(),
    status: mysqlEnum("status", ["active", "in_review", "paused", "complete", "archived"]).default("active").notNull(),
    risk: mysqlEnum("risk", ["critical", "high", "medium", "low", "info"]).default("info").notNull(),
    stage: varchar("stage", { length: 64 }).default("Target").notNull(),
    progress: int("progress").default(0).notNull(),
    evidenceCount: int("evidenceCount").default(0).notNull(),
    findingCount: int("findingCount").default(0).notNull(),
    archived: boolean("archived").default(false).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("missions_owner_active_idx").on(table.ownerId, table.archived), index("missions_status_risk_idx").on(table.status, table.risk)],
);

/** Assignment ledger. A mission owner can be assisted by explicit operator roles. */
export const missionAssignments = mysqlTable(
  "mission_assignments",
  {
    id: int("id").autoincrement().primaryKey(),
    missionId: int("missionId").notNull(),
    userId: int("userId").notNull(),
    assignedById: int("assignedById").notNull(),
    role: mysqlEnum("role", ["analyst", "reviewer", "approver"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  (table) => [index("mission_assignments_mission_user_idx").on(table.missionId, table.userId), index("mission_assignments_user_idx").on(table.userId)],
);

/** Approval requests enforce an explicit, auditable transition before a mission can advance. */
export const missionApprovals = mysqlTable(
  "mission_approvals",
  {
    id: int("id").autoincrement().primaryKey(),
    missionId: int("missionId").notNull(),
    requestedById: int("requestedById").notNull(),
    assignedApproverId: int("assignedApproverId"),
    type: varchar("type", { length: 128 }).notNull(),
    summary: text("summary").notNull(),
    status: mysqlEnum("status", ["pending", "approved", "rejected", "cancelled"]).default("pending").notNull(),
    decisionNote: text("decisionNote"),
    decidedById: int("decidedById"),
    decidedAt: timestamp("decidedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  (table) => [index("mission_approvals_mission_status_idx").on(table.missionId, table.status), index("mission_approvals_approver_status_idx").on(table.assignedApproverId, table.status)],
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ReportRecord = typeof reportRecords.$inferSelect;
export type InsertReportRecord = typeof reportRecords.$inferInsert;
export type Mission = typeof missions.$inferSelect;
export type InsertMission = typeof missions.$inferInsert;
export type MissionAssignment = typeof missionAssignments.$inferSelect;
export type MissionApproval = typeof missionApprovals.$inferSelect;
