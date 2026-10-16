/**
 * Regression tests for the debug collector's credential handling.
 *
 * `client/public/__manus__/debug-collector.js` is a standalone browser script
 * (a plain IIFE, no module system), so it is loaded here into a Node `vm`
 * sandbox that provides a minimal, DOM-free environment: stub `window`,
 * `document`, `location`, `history`, `navigator` and `XMLHttpRequest`, plus a
 * recording `fetch`.
 *
 * The recording `fetch` plays the role the collector's own `/__manus__/logs`
 * POST plays in the browser, so every assertion is made against the exact
 * payload a dev server writes into `.manus-logs/*.log` (see
 * `vite.config.ts` → `writeToLogFile`). The tests therefore look for the raw
 * secret values in the serialized payloads, not only at the redaction marker.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const COLLECTOR_PATH = fileURLToPath(
  new URL("../../public/__manus__/debug-collector.js", import.meta.url)
);
const COLLECTOR_SOURCE = readFileSync(COLLECTOR_PATH, "utf8");

// Distinctive, obviously synthetic values: if any of them shows up in a
// payload, the collector leaked it verbatim.
const BEARER_TOKEN = "nxs_live_9f3c1d7a5b2e4f6089abcdef01234567";
const COOKIE_VALUE = "app_session_id=eyJhbGciOiJIUzI1NiJ9.cookie-value-4b1c9e";
const REFRESHED_COOKIE_VALUE = "app_session_id=eyJhbGciOiJIUzI1NiJ9.refreshed-7a2d0f; Path=/; HttpOnly";
const API_KEY_VALUE = "forge_live_8c1f4e2a9d7b3506fe4c1a80b2d9e7f3";
const XHR_SECRET = "nxs_xhr_5b0a1c7e9d3f2846aabbccdd00112233";
const SECRETS = [BEARER_TOKEN, COOKIE_VALUE, REFRESHED_COOKIE_VALUE, API_KEY_VALUE, XHR_SECRET];

/** One recorded `fetch` call, plus the body if it went to the report endpoint. */
interface FetchCall {
  url: string;
  init: { method?: string; headers?: unknown; body?: unknown };
}

interface CollectorStore {
  consoleLogs: Array<{ args: unknown[] }>;
  networkRequests: unknown[];
  uiEvents: unknown[];
}

interface CollectorHarness {
  store: CollectorStore;
  /** The sandbox console, as replaced by the collector. */
  console: Record<"log" | "debug" | "info" | "warn" | "error", (...args: unknown[]) => void>;
  fetchCalls: FetchCall[];
  /** Bodies POSTed to `/__manus__/logs` — this is what lands in `.manus-logs`. */
  reportBodies: string[];
  /** Payload strings handed to `navigator.sendBeacon` on unload. */
  beaconBodies: string[];
  fetch: (input: unknown, init?: FetchCall["init"]) => Promise<unknown>;
  /** Wait until the collector has buffered at least `count` network entries. */
  waitForNetworkEntries: (count: number) => Promise<void>;
  /** Trigger the collector's periodic report and return the parsed payloads. */
  flushReports: () => Promise<any[]>;
  fireUnload: () => void;
  XhrStub: new () => XhrStub;
}

/** Headers implementation that preserves the casing it was given. */
class CasePreservingHeaders {
  private readonly all: Array<[string, string]>;

  constructor(init: Record<string, string> = {}) {
    this.all = Object.entries(init);
  }

  get(name: string): string | null {
    const wanted = name.toLowerCase();
    const found = this.all.find(([key]) => key.toLowerCase() === wanted);
    return found ? found[1] : null;
  }

  entries(): IterableIterator<[string, string]> {
    return this.all[Symbol.iterator]();
  }
}

/** Response double used to hand the collector header names it must not assume to be lowercase. */
class CasePreservingResponse {
  readonly status: number;
  readonly statusText: string;
  readonly headers: CasePreservingHeaders;
  private readonly payload: string;

  constructor(
    payload = '{"ok":true}',
    options: { status?: number; headers?: Record<string, string> } = {}
  ) {
    this.payload = payload;
    this.status = options.status ?? 200;
    this.statusText = "OK";
    this.headers = new CasePreservingHeaders(options.headers ?? {});
  }

  clone(): CasePreservingResponse {
    return new CasePreservingResponse(this.payload, { status: this.status });
  }

  text(): Promise<string> {
    return Promise.resolve(this.payload);
  }
}

class XhrStub {
  listeners: Record<string, Array<() => void>> = {};
  responseText = '{"ok":true}';
  status = 200;
  statusText = "OK";
  sentBody: unknown = null;
  /** Headers set by the caller — the collector has no API that observes these. */
  requestHeaders: Record<string, string> = {};
  private readonly responseHeaders: Record<string, string> = { "content-type": "application/json" };

  open(method: string, url: string): void {
    void method;
    void url;
  }

  setRequestHeader(name: string, value: string): void {
    this.requestHeaders[name] = value;
  }

  getResponseHeader(name: string): string | null {
    return this.responseHeaders[name.toLowerCase()] ?? null;
  }

  addEventListener(type: string, fn: () => void): void {
    (this.listeners[type] ??= []).push(fn);
  }

  send(body?: unknown): void {
    this.sentBody = body;
  }

  dispatch(type: string): void {
    for (const fn of this.listeners[type] ?? []) fn();
  }
}

function loadCollector(respond?: (url: string) => unknown): CollectorHarness {
  const fetchCalls: FetchCall[] = [];
  const reportBodies: string[] = [];
  const beaconBodies: string[] = [];
  const windowListeners: Record<string, Array<() => void>> = {};
  const consoleStub = {
    log: () => {},
    debug: () => {},
    info: () => {},
    warn: () => {},
    error: () => {},
  };

  const fetchStub = (input: unknown, init?: FetchCall["init"]) => {
    const url =
      typeof input === "string"
        ? input
        : ((input as { url?: string })?.url ??
           (input as { href?: string })?.href ??
           String(input));
    const call: FetchCall = { url, init: init ?? {} };
    fetchCalls.push(call);
    if (url === "/__manus__/logs" && typeof call.init.body === "string") {
      reportBodies.push(call.init.body);
    }
    const response = respond
      ? respond(url)
      : new Response('{"ok":true}', {
          status: 200,
          headers: { "content-type": "application/json" },
        });
    return Promise.resolve(response);
  };

  const windowStub: Record<string, unknown> = {
    fetch: fetchStub,
    addEventListener: (type: string, fn: () => void) => {
      (windowListeners[type] ??= []).push(fn);
    },
    innerWidth: 1280,
    innerHeight: 720,
    scrollX: 0,
    scrollY: 0,
  };

  const sandbox: Record<string, unknown> = {
    window: windowStub,
    document: {
      addEventListener: () => {},
      documentElement: { scrollHeight: 1000 },
    },
    location: { href: "http://localhost:4599/portfolio" },
    history: { pushState: () => {}, replaceState: () => {} },
    navigator: {
      sendBeacon: (_url: string, data: unknown) => {
        beaconBodies.push(String(data));
        return true;
      },
    },
    console: consoleStub,
    Headers,
    Element: class Element {},
    XMLHttpRequest: XhrStub,
    setInterval: () => 0,
  };

  vm.createContext(sandbox);
  vm.runInContext(COLLECTOR_SOURCE, sandbox, { filename: COLLECTOR_PATH });

  const collector = (windowStub as { __MANUS_DEBUG_COLLECTOR__?: Record<string, any> })
    .__MANUS_DEBUG_COLLECTOR__;
  if (!collector) throw new Error("debug collector did not initialize in the sandbox");

  const store = collector.store as CollectorStore;

  const waitForNetworkEntries = async (count: number) => {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (store.networkRequests.length >= count) return;
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    throw new Error(
      `collector buffered ${store.networkRequests.length} network entries, expected ${count}`
    );
  };

  return {
    store,
    console: consoleStub,
    fetchCalls,
    reportBodies,
    beaconBodies,
    fetch: (input, init) => (windowStub.fetch as CollectorHarness["fetch"])(input, init),
    waitForNetworkEntries,
    flushReports: async () => {
      await collector.forceReport();
      return reportBodies.map((body) => JSON.parse(body));
    },
    fireUnload: () => {
      for (const fn of windowListeners.beforeunload ?? []) fn();
    },
    XhrStub,
  };
}

function expectSecretFree(payload: unknown): void {
  const serialized = typeof payload === "string" ? payload : JSON.stringify(payload);
  for (const secret of SECRETS) {
    expect(serialized).not.toContain(secret);
  }
}

describe("debug collector credential redaction", () => {
  it("redacts Authorization, Cookie and API-key request headers before they are buffered", async () => {
    const harness = loadCollector();

    await harness.fetch("http://localhost:4599/api/trpc/mission.archive", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${BEARER_TOKEN}`,
        Cookie: COOKIE_VALUE,
        "X-Api-Key": API_KEY_VALUE,
        "X-Request-Id": "req-42",
      },
      body: JSON.stringify({ missionId: 100 }),
    });
    await harness.waitForNetworkEntries(1);

    // The in-memory buffer must be clean too: it is what the unload beacon,
    // the periodic report and `__MANUS_DEBUG_COLLECTOR__.store` expose.
    expectSecretFree(harness.store.networkRequests);

    const [entry] = harness.store.networkRequests as Array<{
      request: { headers: Record<string, string> };
    }>;
    expect(entry.request.headers.authorization).toBe("[REDACTED]");
    expect(entry.request.headers.cookie).toBe("[REDACTED]");
    expect(entry.request.headers["x-api-key"]).toBe("[REDACTED]");

    // Non-sensitive debugging information is preserved.
    expect(entry.request.headers["content-type"]).toBe("application/json");
    expect(entry.request.headers.accept).toBe("application/json");
    expect(entry.request.headers["x-request-id"]).toBe("req-42");

    const [report] = await harness.flushReports();
    expectSecretFree(harness.reportBodies[0]);
    expectSecretFree(report);
    expect(report.networkRequests[0].request.headers.authorization).toBe("[REDACTED]");
  });

  it("redacts sensitive response headers, including Set-Cookie", async () => {
    const harness = loadCollector(
      () =>
        new Response('{"ok":true}', {
          status: 200,
          headers: {
            "content-type": "application/json",
            "set-cookie": REFRESHED_COOKIE_VALUE,
            "x-session-token": BEARER_TOKEN,
          },
        })
    );

    await harness.fetch("http://localhost:4599/api/trpc/missions.list", { method: "GET" });
    await harness.waitForNetworkEntries(1);

    const [entry] = harness.store.networkRequests as Array<{
      response: { headers: Record<string, string> };
    }>;
    expect(entry.response.headers["set-cookie"]).toBe("[REDACTED]");
    expect(entry.response.headers["x-session-token"]).toBe("[REDACTED]");
    expect(entry.response.headers["content-type"]).toBe("application/json");

    const [report] = await harness.flushReports();
    expectSecretFree(harness.reportBodies[0]);
    expectSecretFree(report);
  });

  it("redacts header names case-insensitively even when the platform preserves casing", async () => {
    const harness = loadCollector(
      () =>
        new CasePreservingResponse('{"ok":true}', {
          headers: {
            "Content-Type": "application/json",
            "Set-Cookie": REFRESHED_COOKIE_VALUE,
            Authorization: `Bearer ${BEARER_TOKEN}`,
            "X-Api-Key": API_KEY_VALUE,
          },
        })
    );

    await harness.fetch("http://localhost:4599/api/trpc/missions.list", {
      method: "GET",
      // `Headers` lowercases, but the redaction must not depend on that.
      headers: { AUTHORIZATION: `Bearer ${BEARER_TOKEN}`, COOKIE: COOKIE_VALUE },
    });
    await harness.waitForNetworkEntries(1);

    const [entry] = harness.store.networkRequests as Array<{
      request: { headers: Record<string, string> };
      response: { headers: Record<string, string> };
    }>;
    for (const name of Object.keys(entry.request.headers)) {
      if (["authorization", "cookie"].includes(name.toLowerCase())) {
        expect(entry.request.headers[name]).toBe("[REDACTED]");
      }
    }
    expect(entry.response.headers["Set-Cookie"]).toBe("[REDACTED]");
    expect(entry.response.headers["Authorization"]).toBe("[REDACTED]");
    expect(entry.response.headers["X-Api-Key"]).toBe("[REDACTED]");
    expect(entry.response.headers["Content-Type"]).toBe("application/json");

    const [report] = await harness.flushReports();
    expectSecretFree(harness.reportBodies[0]);
    expectSecretFree(report);
  });

  it("does not leak credentials through the unload beacon payload", async () => {
    const harness = loadCollector();

    await harness.fetch("http://localhost:4599/api/trpc/mission.archive", {
      method: "POST",
      headers: { Authorization: `Bearer ${BEARER_TOKEN}`, Cookie: COOKIE_VALUE },
      body: JSON.stringify({ missionId: 100 }),
    });
    await harness.waitForNetworkEntries(1);

    harness.fireUnload();

    expect(harness.beaconBodies).toHaveLength(1);
    expectSecretFree(harness.beaconBodies[0]);
  });

  it("captures no XHR header values and keeps XHR payloads secret-free", async () => {
    const harness = loadCollector();
    const xhr = new harness.XhrStub();

    xhr.open("POST", "http://localhost:4599/api/trpc/mission.archive");
    // The collector never patches setRequestHeader, so this value must not
    // reach its buffers by any route.
    xhr.setRequestHeader("Authorization", `Bearer ${XHR_SECRET}`);
    xhr.setRequestHeader("Cookie", COOKIE_VALUE);
    xhr.send(JSON.stringify({ missionId: 100 }));
    xhr.dispatch("load");

    const [entry] = harness.store.networkRequests as Array<{ request: Record<string, unknown> }>;
    expect(entry.request.headers).toBeUndefined();
    expectSecretFree(harness.store.networkRequests);

    const [report] = await harness.flushReports();
    expectSecretFree(report);
  });

  it("redacts sensitive header names inside console arguments", async () => {
    const harness = loadCollector();

    // Console output is the collector's other ingestion path for request
    // options; its keys are matched by the shared `sensitiveFields` policy.
    harness.console.log({
      url: "/api/trpc",
      init: { headers: { Authorization: `Bearer ${BEARER_TOKEN}`, "X-Api-Key": API_KEY_VALUE } },
    });

    expectSecretFree(harness.store.consoleLogs);

    const logged = harness.store.consoleLogs.find((entry) =>
      JSON.stringify(entry.args).includes("/api/trpc")
    );
    expect(logged).toBeDefined();
    const [{ init }] = logged?.args as Array<{ init: { headers: Record<string, string> } }>;
    expect(init.headers.Authorization).toBe("[REDACTED]");
    expect(init.headers["X-Api-Key"]).toBe("[REDACTED]");
  });
});
