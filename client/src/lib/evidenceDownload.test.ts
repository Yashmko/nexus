/** Unit tests for the evidence download helper (no DOM: fetch/save/storage are injected). */
import { describe, expect, it, vi } from "vitest";
import {
  buildEvidenceRequestInit,
  downloadEvidenceAttachment,
  readMirroredSessionToken,
  type EvidenceDownloadResult,
} from "./evidenceDownload";

function storageWith(value: string | null): Pick<Storage, "getItem"> {
  return { getItem: (key: string) => (key === "manus-cookie" ? value : null) };
}

function jsonResponse(status: number) {
  return new Response(new Blob(["evidence-bytes"], { type: "text/plain" }), { status });
}

describe("readMirroredSessionToken", () => {
  it("extracts the session token from the mirrored cookie string", () => {
    expect(readMirroredSessionToken(storageWith("other=1; app_session_id=abc.def.ghi"))).toBe("abc.def.ghi");
  });

  it("handles spacing and token-first ordering", () => {
    expect(readMirroredSessionToken(storageWith("app_session_id=token-value; theme=dark"))).toBe("token-value");
  });

  it("returns null for missing, empty, or unrelated storage values", () => {
    expect(readMirroredSessionToken(storageWith(null))).toBeNull();
    expect(readMirroredSessionToken(storageWith(""))).toBeNull();
    expect(readMirroredSessionToken(storageWith("app_session_id="))).toBeNull();
    expect(readMirroredSessionToken(storageWith("theme=dark"))).toBeNull();
    expect(readMirroredSessionToken(null)).toBeNull();
  });

  it("returns null when storage access throws (private mode / sandboxed frame)", () => {
    const throwing = {
      getItem: () => {
        throw new Error("SecurityError");
      },
    } as unknown as Pick<Storage, "getItem">;
    expect(readMirroredSessionToken(throwing)).toBeNull();
  });
});

describe("buildEvidenceRequestInit", () => {
  it("sends the session cookie and the bearer token when the token is known", () => {
    const init = buildEvidenceRequestInit("session-token");
    expect(init.credentials).toBe("include");
    expect(init.headers).toEqual({ Authorization: "Bearer session-token" });
  });

  it("falls back to the cookie alone when no token is mirrored", () => {
    const init = buildEvidenceRequestInit(null);
    expect(init.credentials).toBe("include");
    expect(init.headers).toBeUndefined();
  });
});

describe("downloadEvidenceAttachment", () => {
  it("saves the blob with the evidence file name on success", async () => {
    const save = vi.fn();
    const fetchImpl = vi.fn(async () => jsonResponse(200));
    const result = await downloadEvidenceAttachment({
      url: "/manus-storage/missions/100/evidence/scan-output.txt_deadbeef",
      fileName: "scan-output.txt",
      token: "session-token",
      fetchImpl: fetchImpl as unknown as typeof fetch,
      save,
    });

    expect(result).toEqual<EvidenceDownloadResult>({ ok: true, status: 200 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/manus-storage/missions/100/evidence/scan-output.txt_deadbeef");
    expect(init.credentials).toBe("include");
    expect(init.headers).toEqual({ Authorization: "Bearer session-token" });
    expect(save).toHaveBeenCalledTimes(1);
    const [blob, fileName] = save.mock.calls[0] as unknown as [Blob, string];
    expect(fileName).toBe("scan-output.txt");
    expect(blob).toBeInstanceOf(Blob);
    expect(await blob.text()).toBe("evidence-bytes");
  });

  it("does not save anything when the caller is not authenticated", async () => {
    const save = vi.fn();
    const result = await downloadEvidenceAttachment({
      url: "/manus-storage/missions/100/evidence/scan-output.txt_deadbeef",
      fileName: "scan-output.txt",
      fetchImpl: (async () => jsonResponse(401)) as unknown as typeof fetch,
      save,
    });
    expect(result).toMatchObject({ ok: false, status: 401, network: false });
    expect((result as { message: string }).message).toMatch(/sign in again/i);
    expect(save).not.toHaveBeenCalled();
  });

  it("reports a missing or out-of-scope object distinctly from an auth failure", async () => {
    const result = await downloadEvidenceAttachment({
      url: "/manus-storage/missions/100/evidence/other.txt_00000000",
      fileName: "other.txt",
      fetchImpl: (async () => jsonResponse(404)) as unknown as typeof fetch,
      save: vi.fn(),
    });
    expect(result).toMatchObject({ ok: false, status: 404 });
    expect((result as { message: string }).message).toMatch(/outside your mission/i);
  });

  it("surfaces other server errors with their status", async () => {
    const result = await downloadEvidenceAttachment({
      url: "/manus-storage/missions/100/evidence/scan-output.txt_deadbeef",
      fileName: "scan-output.txt",
      fetchImpl: (async () => jsonResponse(503)) as unknown as typeof fetch,
      save: vi.fn(),
    });
    expect(result).toMatchObject({ ok: false, status: 503 });
    expect((result as { message: string }).message).toContain("503");
  });

  it("flags transport failures so the caller can fall back to a direct navigation", async () => {
    const save = vi.fn();
    const result = await downloadEvidenceAttachment({
      url: "/manus-storage/missions/100/evidence/scan-output.txt_deadbeef",
      fileName: "scan-output.txt",
      fetchImpl: (async () => {
        throw new TypeError("Failed to fetch");
      }) as unknown as typeof fetch,
      save,
    });
    expect(result).toMatchObject({ ok: false, status: null, network: true });
    expect(save).not.toHaveBeenCalled();
  });
});
