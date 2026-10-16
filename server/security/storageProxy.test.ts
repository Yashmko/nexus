/**
 * Evidence-byte access control for the `/manus-storage/*` proxy.
 *
 * Regression tests for the confirmed finding that mission evidence objects were
 * fetchable without authentication (see docs/security-review/FINDINGS.md).
 * The proxy is exercised over real HTTP with the real Express handler; the
 * object-storage backend is stubbed because these tests must never reach a
 * network service.
 */
import express from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../../shared/const";
import { sdk } from "../_core/sdk";
import { registerStorageProxy } from "../_core/storageProxy";
import { USERS } from "./fixtures";
import { setupSecurityDatabase } from "./harness";
import { listen, request, type HttpResponse } from "./httpClient";

const EVIDENCE_KEY = "missions/100/evidence/scan-output.txt_0f1e2d3c";
const PUBLIC_ASSET_KEY = "nexus-mark_bc2a72c9.png";

let server: { port: number; close: () => Promise<void> };
let forgeCalls: string[];

async function sessionCookie(openId: string): Promise<string> {
  const token = await sdk.createSessionToken(openId, { name: `NEXUS ${openId}` });
  return `${COOKIE_NAME}=${token}`;
}

function isAllowed(response: HttpResponse): boolean {
  return response.status === 307 && String(response.headers.location).startsWith("https://s3.invalid/");
}

beforeEach(async () => {
  setupSecurityDatabase();
  forgeCalls = [];
  vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("presign/get")) {
      forgeCalls.push(url);
      return new Response(JSON.stringify({ url: "https://s3.invalid/signed-get" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }
    return new Response("", { status: 200 });
  });

  const app = express();
  registerStorageProxy(app);
  server = await listen(app);
});

afterEach(async () => {
  await server.close();
  vi.unstubAllGlobals();
});

describe("storage proxy: mission evidence objects", () => {
  it("denies an unauthenticated fetch of a mission evidence object", async () => {
    const response = await request(server.port, { method: "GET", path: `/manus-storage/${EVIDENCE_KEY}` });
    expect(response.status).toBe(401);
    expect(forgeCalls).toHaveLength(0);
  });

  it("denies a signed-in non-participant (horizontal privilege escalation)", async () => {
    const response = await request(server.port, {
      method: "GET",
      path: `/manus-storage/${EVIDENCE_KEY}`,
      headers: { cookie: await sessionCookie("outsider") },
    });
    expect(response.status).toBe(404);
    expect(forgeCalls).toHaveLength(0);
  });

  it("allows the mission owner, an assigned analyst and an administrator", async () => {
    for (const [openId, id] of [
      ["owner-a", USERS.owner],
      ["analyst-a", USERS.analyst],
      ["approver-a", USERS.approver],
      ["admin-a", USERS.admin],
    ] as const) {
      forgeCalls = [];
      const response = await request(server.port, {
        method: "GET",
        path: `/manus-storage/${EVIDENCE_KEY}`,
        headers: { cookie: await sessionCookie(openId) },
      });
      expect({ openId, allowed: isAllowed(response) }).toEqual({ openId, allowed: true });
      expect(forgeCalls).toHaveLength(1);
      expect(response.headers["cache-control"]).toBe("no-store");
      void id;
    }
  });

  it("accepts the Authorization-header session used when iframe cookies are blocked", async () => {
    const token = await sdk.createSessionToken("analyst-a", { name: "NEXUS analyst-a" });
    const response = await request(server.port, {
      method: "GET",
      path: `/manus-storage/${EVIDENCE_KEY}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(isAllowed(response)).toBe(true);
  });

  it("rejects an invalid or tampered session token", async () => {
    const response = await request(server.port, {
      method: "GET",
      path: `/manus-storage/${EVIDENCE_KEY}`,
      headers: { cookie: `${COOKIE_NAME}=not.a.jwt` },
    });
    expect(response.status).toBe(401);
  });

  it("rejects traversal-shaped keys regardless of session", async () => {
    const owner = await sessionCookie("owner-a");
    for (const key of ["missions/../secrets.txt", "missions/100/../200/evidence/a.txt", "./missions/100/evidence/a.txt"]) {
      const withSession = await request(server.port, {
        method: "GET",
        path: `/manus-storage/${key}`,
        headers: { cookie: owner },
      });
      expect({ key, status: withSession.status }).toEqual({ key, status: 400 });

      const anonymous = await request(server.port, { method: "GET", path: `/manus-storage/${key}` });
      expect({ key, anonymous: anonymous.status }).toEqual({ key, anonymous: 400 });
    }
  });

  it("fails closed for mission-prefixed keys that are not mission objects", async () => {
    for (const key of ["missions/not-a-number/evidence/a.txt", "missions/0/evidence/a.txt"]) {
      const response = await request(server.port, {
        method: "GET",
        path: `/manus-storage/${key}`,
        headers: { cookie: await sessionCookie("owner-a") },
      });
      expect({ key, status: response.status }).toEqual({ key, status: 404 });
    }
  });

  it("keeps mission scoping for other sub-paths inside a mission prefix", async () => {
    const key = "missions/100/findings/notes.txt";
    const owner = await request(server.port, {
      method: "GET",
      path: `/manus-storage/${key}`,
      headers: { cookie: await sessionCookie("owner-a") },
    });
    expect(isAllowed(owner)).toBe(true);

    const outsider = await request(server.port, {
      method: "GET",
      path: `/manus-storage/${key}`,
      headers: { cookie: await sessionCookie("outsider") },
    });
    expect(outsider.status).toBe(404);
  });
});

describe("storage proxy: public assets", () => {
  it("keeps non-mission assets public for the unauthenticated landing page", async () => {
    const response = await request(server.port, { method: "GET", path: `/manus-storage/${PUBLIC_ASSET_KEY}` });
    expect(isAllowed(response)).toBe(true);
  });

  it("returns 400 when no key is provided and 502 when the backend fails", async () => {
    const missing = await request(server.port, { method: "GET", path: "/manus-storage/" });
    expect([400, 404]).toContain(missing.status);

    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
    const failed = await request(server.port, { method: "GET", path: `/manus-storage/${PUBLIC_ASSET_KEY}` });
    expect(failed.status).toBe(502);
  });
});
