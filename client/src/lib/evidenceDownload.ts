/**
 * Evidence download helper.
 *
 * Evidence objects live behind `/manus-storage/**`, which authorizes the caller
 * with the session cookie *or* an `Authorization: Bearer <token>` header. The
 * cookie is unavailable to a plain link in browsers that block third-party
 * cookies (Safari ITP, private windows, some WebViews), so the download is
 * performed with `fetch` and the session is attached explicitly, the response is
 * converted to a blob, and the save is triggered from that blob.
 */
import { COOKIE_NAME } from "@shared/const";

/** Storage key the runtime uses to mirror the session when iframe cookies are blocked. */
export const MIRRORED_SESSION_KEY = "manus-cookie";

/**
 * Reads the session token the runtime mirrored into `sessionStorage`.
 * Returns `null` when there is no token or storage is unavailable (private mode,
 * sandboxed frames), because the caller then falls back to the cookie.
 */
export function readMirroredSessionToken(
  storage?: Pick<Storage, "getItem"> | null,
): string | null {
  try {
    const source = storage ?? (typeof sessionStorage === "undefined" ? null : sessionStorage);
    const raw = source?.getItem(MIRRORED_SESSION_KEY);
    if (!raw) return null;
    const prefix = `${COOKIE_NAME}=`;
    const pair = raw
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(prefix));
    const token = pair?.slice(prefix.length);
    return token ? token : null;
  } catch {
    return null;
  }
}

/** Request options for an evidence fetch: cookie always, bearer token when available. */
export function buildEvidenceRequestInit(token: string | null): RequestInit {
  return {
    credentials: "include",
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
  };
}

export type EvidenceDownloadResult =
  | { ok: true; status: number }
  | { ok: false; status: number | null; message: string; network: boolean };

function messageForStatus(status: number): string {
  if (status === 401) return "Sign in again to download this evidence file.";
  if (status === 404) return "This evidence file was not found or is outside your mission.";
  return `Evidence download failed (HTTP ${status}).`;
}

/** Saves a blob under the evidence file name (browser only). */
export function saveBlobAsFile(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Give the browser a tick to start the download before releasing the blob URL.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}

export async function downloadEvidenceAttachment(input: {
  url: string;
  fileName: string;
  token?: string | null;
  fetchImpl?: typeof fetch;
  save?: (blob: Blob, fileName: string) => void;
}): Promise<EvidenceDownloadResult> {
  const { url, fileName, token = null, fetchImpl = fetch, save = saveBlobAsFile } = input;

  let response: Response;
  try {
    response = await fetchImpl(url, buildEvidenceRequestInit(token));
  } catch {
    // Network failure or a CORS rejection: the object store may not send the
    // CORS headers a cross-origin redirect needs. Callers may retry through a
    // direct navigation, which works wherever cookies are available.
    return {
      ok: false,
      status: null,
      message: "Evidence download could not reach the server.",
      network: true,
    };
  }

  if (!response.ok) {
    return { ok: false, status: response.status, message: messageForStatus(response.status), network: false };
  }

  const blob = await response.blob();
  save(blob, fileName);
  return { ok: true, status: response.status };
}
