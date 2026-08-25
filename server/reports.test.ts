/** NEXUS report persistence must never expose authenticated workspace records publicly. */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function unauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("reports router", () => {
  it("rejects report retrieval without an authenticated workspace user", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.reports.latest({ missionId: "MIS-2025-05-21-1437" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects report history retrieval without an authenticated workspace user", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.reports.history({ missionId: "MIS-2025-05-21-1437" })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  it("rejects report-owner retrieval without an authenticated workspace user", async () => {
    const caller = appRouter.createCaller(unauthenticatedContext());
    await expect(caller.reports.owner({ reportId: 1 })).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
