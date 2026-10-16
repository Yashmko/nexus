/**
 * HTTP-surface tests for the Express + tRPC stack.
 *
 * These answer "can the approval gate / state-changing procedures be reached
 * through an alternate route or a direct API request?": the tests drive the
 * real Express middleware chain and the real router with the same wiring as
 * `server/_core/index.ts` (body parsers + `/api/trpc`), over real HTTP.
 */
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { COOKIE_NAME } from "../../shared/const";
import { appRouter } from "../routers";
import { createContext } from "../_core/context";
import { sdk } from "../_core/sdk";
import { MISSIONS, USERS } from "./fixtures";
import { setupSecurityDatabase } from "./harness";
import { listen, request } from "./httpClient";

let server: { port: number; close: () => Promise<void> };
let harness: ReturnType<typeof setupSecurityDatabase>;
let ownerCookie: string;

const batch = (payload: unknown) => `batch=1&input=${encodeURIComponent(JSON.stringify(payload))}`;
const mutationBody = (payload: unknown) => JSON.stringify({ 0: { json: payload } });

function isArchived(): boolean {
  return Boolean(harness.tables.missions.find((row) => row.id === MISSIONS.owned)?.archived);
}

beforeEach(async () => {
  harness = setupSecurityDatabase();
  ownerCookie = `${COOKIE_NAME}=${await sdk.createSessionToken("owner-a", { name: "NEXUS owner-a" })}`;

  const app = express();
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
  server = await listen(app);
});

afterEach(async () => {
  await server.close();
});

describe("batched tRPC transport", () => {
  it("serves an authorized query for the mission owner", async () => {
    const response = await request(server.port, {
      method: "GET",
      path: `/api/trpc/missions.activity?${batch({ 0: { json: { missionId: MISSIONS.owned } } })}`,
      headers: { cookie: ownerCookie },
    });
    expect(response.status).toBe(200);
    expect(response.body).toContain("mission_created");
  });

  it("does not disclose mission data without a session", async () => {
    const response = await request(server.port, {
      method: "GET",
      path: `/api/trpc/missions.activity?${batch({ 0: { json: { missionId: MISSIONS.owned } } })}`,
    });
    expect(response.body).toContain("UNAUTHORIZED");
    expect(response.body).not.toContain("mission_created");
  });

  it("refuses to run a state-changing procedure over GET", async () => {
    const response = await request(server.port, {
      method: "GET",
      path: `/api/trpc/missions.archive?${batch({ 0: { json: { missionId: MISSIONS.owned } } })}`,
      headers: { cookie: ownerCookie },
    });
    expect(response.status).toBe(405);
    expect(isArchived()).toBe(false);
  });

  it("executes an authorized mutation over POST and attributes it in the audit ledger", async () => {
    const response = await request(server.port, {
      method: "POST",
      path: "/api/trpc/missions.archive?batch=1",
      headers: { cookie: ownerCookie, "content-type": "application/json" },
      body: mutationBody({ missionId: MISSIONS.owned }),
    });
    expect(response.status).toBe(200);
    expect(isArchived()).toBe(true);

    const audit = harness.tables.mission_activity.filter((row) => row.action === "mission_archived");
    expect(audit).toHaveLength(1);
    expect(audit[0]?.actorId).toBe(USERS.owner);
  });

  it("rejects a state-changing request without a session", async () => {
    const response = await request(server.port, {
      method: "POST",
      path: "/api/trpc/missions.archive?batch=1",
      headers: { "content-type": "application/json" },
      body: mutationBody({ missionId: MISSIONS.owned }),
    });
    expect(response.body).toContain("UNAUTHORIZED");
    expect(isArchived()).toBe(false);
  });
});

describe("cross-site request forgery surface", () => {
  it("rejects an HTML-form shaped POST (urlencoded body) without executing the mutation", async () => {
    const response = await request(server.port, {
      method: "POST",
      path: "/api/trpc/missions.archive?batch=1",
      headers: { cookie: ownerCookie, "content-type": "application/x-www-form-urlencoded" },
      body: `0=${encodeURIComponent(JSON.stringify({ json: { missionId: MISSIONS.owned } }))}`,
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(isArchived()).toBe(false);
  });

  it("rejects a text/plain POST without executing the mutation", async () => {
    const response = await request(server.port, {
      method: "POST",
      path: "/api/trpc/missions.archive?batch=1",
      headers: { cookie: ownerCookie, "content-type": "text/plain" },
      body: mutationBody({ missionId: MISSIONS.owned }),
    });
    expect(response.status).toBeGreaterThanOrEqual(400);
    expect(isArchived()).toBe(false);
  });

  it("does not emit permissive CORS headers for foreign origins", async () => {
    const response = await request(server.port, {
      method: "GET",
      path: `/api/trpc/missions.list?${batch({ 0: { json: null } })}`,
      headers: { cookie: ownerCookie, origin: "https://attacker.invalid" },
    });
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
    expect(response.headers["access-control-allow-credentials"]).toBeUndefined();
  });
});

describe("oauth callback CSRF guard", () => {
  it("rejects a forged oauth state", async () => {
    const app = express();
    const { registerOAuthRoutes } = await import("../_core/oauth");
    registerOAuthRoutes(app);
    const oauthServer = await listen(app);
    try {
      const forged = Buffer.from(JSON.stringify({ redirectUri: "https://attacker.invalid/cb", nonce: "attacker" })).toString("base64");
      const response = await request(oauthServer.port, {
        method: "GET",
        path: `/api/oauth/callback?code=attacker-code&state=${encodeURIComponent(forged)}`,
      });
      expect(response.status).toBe(403);
      expect(response.body).toContain("invalid oauth state");
    } finally {
      await oauthServer.close();
    }
  });
});
