import { index, int, json, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type ReportRecord = typeof reportRecords.$inferSelect;
export type InsertReportRecord = typeof reportRecords.$inferInsert;
