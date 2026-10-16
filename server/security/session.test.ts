/**
 * Session verification tests: which tokens can authenticate against NEXUS, and
 * what the synthetic cron identity is allowed to see.
 */
import type { Request } from "express";
import { SignJWT } from "jose";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../../shared/const";
import { ENV } from "../_core/env";
import { sdk } from "../_core/sdk";
import { setupSecurityDatabase } from "./harness";

const reqWith = (headers: Record<string, string | undefined>) => ({ headers }) as unknown as Request;
const cookieHeader = (token: string) => ({ cookie: `${COOKIE_NAME}=${token}` });

beforeEach(() => {
  setupSecurityDatabase();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

async function signWithForeignSecret(payload: Record<string, unknown>, secret: string): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setExpirationTime(Math.floor(Date.now() / 1000) + 60)
    .sign(new TextEncoder().encode(secret));
}

describe("session verification", () => {
  it("authenticates a session minted for this application", async () => {
    const token = await sdk.createSessionToken("owner-a", { name: "NEXUS owner-a" });
    const user = await sdk.authenticateRequest(reqWith(cookieHeader(token)));
    expect(user).toMatchObject({ id: 1, openId: "owner-a", role: "user" });
  });

  it("authenticates the Authorization-header fallback used when cookies are blocked", async () => {
    const token = await sdk.createSessionToken("analyst-a", { name: "NEXUS analyst-a" });
    const user = await sdk.authenticateRequest(reqWith({ authorization: `Bearer ${token}` }));
    expect(user.id).toBe(2);
  });

  it("rejects a token issued for a different application id", async () => {
    const foreign = await sdk.signSession({ openId: "owner-a", appId: "another-nexus-app", name: "NEXUS owner-a" });
    await expect(sdk.authenticateRequest(reqWith(cookieHeader(foreign)))).rejects.toThrow(/invalid session cookie/i);
  });

  it("rejects a token signed with a different secret", async () => {
    const forged = await signWithForeignSecret({ openId: "owner-a", appId: ENV.appId, name: "NEXUS owner-a" }, "attacker-secret");
    await expect(sdk.authenticateRequest(reqWith(cookieHeader(forged)))).rejects.toThrow(/invalid session cookie/i);
  });

  it("rejects an expired token", async () => {
    const expired = await sdk.createSessionToken("owner-a", { name: "NEXUS owner-a", expiresInMs: -1000 });
    await expect(sdk.authenticateRequest(reqWith(cookieHeader(expired)))).rejects.toThrow(/invalid session cookie/i);
  });

  it("rejects a token with an empty name claim", async () => {
    const anonymous = await sdk.createSessionToken("owner-a", { name: "" });
    await expect(sdk.authenticateRequest(reqWith(cookieHeader(anonymous)))).rejects.toThrow(/invalid session cookie/i);
  });

  it("rejects requests that carry no credentials", async () => {
    await expect(sdk.authenticateRequest(reqWith({}))).rejects.toThrow(/invalid session cookie/i);
    await expect(sdk.authenticateRequest(reqWith({ cookie: `${COOKIE_NAME}=` }))).rejects.toThrow(/invalid session cookie/i);
  });

  it("gives the cron identity no access to tenant missions", async () => {
    // The OAuth round-trip is an external dependency that tests must not reach,
    // so the token-exchange result is stubbed; the cron branching logic under
    // test runs as in production.
    vi.spyOn(sdk, "getUserInfoWithJwt").mockResolvedValue({
      openId: "cron_nexus",
      name: "Scheduled task",
      taskUid: "task-1",
    } as Awaited<ReturnType<typeof sdk.getUserInfoWithJwt>>);

    const cronToken = await sdk.createSessionToken("cron_nexus", { name: "Scheduled task" });
    const cron = await sdk.authenticateRequest(reqWith(cookieHeader(cronToken)));
    expect(cron).toMatchObject({ id: -1, isCron: true, role: "user" });

    const { listMissions } = await import("../db");
    const visible = await listMissions({ id: cron.id, role: "user" }, true);
    expect(visible).toHaveLength(0);
  });
});
