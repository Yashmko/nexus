import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function context(role: "user" | "admin" | null): TrpcContext {
  return {
    user: role ? {
      id: 1,
      openId: "nexus-test-user",
      name: "NEXUS Test User",
      email: "test@nexus.local",
      loginMethod: "manus",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("missions router", () => {
  it("rejects mission portfolio retrieval without an authenticated user", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.missions.list()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects mission creation without an authenticated user", async () => {
    const caller = appRouter.createCaller(context(null));
    await expect(caller.missions.create({ missionKey: "MIS-TEST-01", title: "Test mission", account: "Test account", scope: "127.0.0.1", risk: "low" })).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("restricts assignable-user enumeration to administrators", async () => {
    const caller = appRouter.createCaller(context("user"));
    await expect(caller.missions.users()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
