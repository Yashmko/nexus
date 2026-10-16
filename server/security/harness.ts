/**
 * Shared helpers for the NEXUS security test-suite.
 *
 * Every test builds an isolated in-memory database from synthetic fixtures and
 * drives the real routers / data-access layer. Nothing here talks to a network
 * service, a real database, or production data.
 */
import type { User } from "../../drizzle/schema";
import { __setTestDatabase } from "../db";
import { appRouter } from "../routers";
import { createContext } from "../_core/context";
import type { TrpcContext } from "../_core/context";
import { securityFixtures } from "./fixtures";
import { createInMemoryDatabase, type FixtureTables } from "./inMemoryDb";

export type Actor = { id: number; role: "user" | "admin" };

export function testUser(id: number, role: "user" | "admin" = "user", openId = `user-${id}`): User {
  return {
    id,
    openId,
    name: `NEXUS ${openId}`,
    email: `${openId}@nexus.test`,
    loginMethod: "manus",
    role,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    lastSignedIn: new Date("2026-01-01T00:00:00Z"),
  };
}

/** Builds a fresh in-memory database from the fixtures and injects it into `server/db.ts`. */
export function setupSecurityDatabase(overrides: Partial<FixtureTables> = {}) {
  const { seed, defaults, uniqueKeys } = securityFixtures();
  for (const [table, rows] of Object.entries(overrides)) {
    seed[table] = rows ?? [];
  }
  const harness = createInMemoryDatabase(seed, { defaults, uniqueKeys });
  __setTestDatabase(harness.db);
  return harness;
}

export function resetTestDatabase(): void {
  __setTestDatabase(null);
}

/** Minimal tRPC context; `req`/`res` are stubs because these tests never serve HTTP. */
export function trpcContext(user: User | null): TrpcContext {
  return {
    user,
    req: { protocol: "https", headers: {}, cookies: {} } as unknown as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

export function callerFor(user: User | null) {
  return appRouter.createCaller(trpcContext(user));
}

export { appRouter, createContext };
