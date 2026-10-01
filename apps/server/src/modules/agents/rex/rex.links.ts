/**
 * Linked spreadsheets: a customer pastes a share link (Google Sheets, OneDrive/SharePoint,
 * Dropbox, or any direct CSV/Excel URL) and Rex keeps the dataset in sync with it.
 *
 * No integration or OAuth is involved — the file must be shared "anyone with the link", and it is
 * downloaded with one plain GET, the same file the customer would get by clicking Download. That
 * keeps a sync free (no provider API calls) and lets the existing upload parser handle it.
 *
 * The URL is customer-supplied, so fetching it is an SSRF surface: https only, every hop's host
 * must resolve to a public address, a bounded number of redirects, and a size cap.
 */
import { createHash } from "crypto";
import { lookup } from "dns/promises";
import { isIP } from "net";
import { BadRequestError } from "../../../common/errors/badRequest.js";

export const MAX_LINK_BYTES = 50 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 30_000;
const MAX_REDIRECTS = 4;

export type LinkProvider = "google" | "onedrive" | "sharepoint" | "dropbox" | "direct";

export interface ResolvedLink {
  provider: LinkProvider;
  downloadUrl: string;
}

export class LinkNotShared extends BadRequestError {}

/** Turn a share link into the URL that downloads the file itself. */
export function resolveShareLink(raw: string): ResolvedLink {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BadRequestError("That doesn't look like a link. Paste the full https:// address.");
  }
  if (url.protocol !== "https:") {
    throw new BadRequestError("Only https:// links can be used.");
  }
  const host = url.hostname.toLowerCase();

  if (host === "docs.google.com" && url.pathname.startsWith("/spreadsheets/")) {
    // Published to the web: /spreadsheets/d/e/<pubId>/pubhtml or /pub?output=csv
    const published = url.pathname.match(/^\/spreadsheets\/d\/e\/([\w-]+)/);
    if (published) {
      return {
        provider: "google",
        downloadUrl: `https://docs.google.com/spreadsheets/d/e/${published[1]}/pub?output=xlsx`,
      };
    }
    const id = url.pathname.match(/^\/spreadsheets\/d\/([\w-]+)/)?.[1];
    if (!id) throw new BadRequestError("That Google Sheets link has no spreadsheet id in it.");
    // xlsx rather than csv: one download carries every tab.
    return { provider: "google", downloadUrl: `https://docs.google.com/spreadsheets/d/${id}/export?format=xlsx` };
  }

  if (host === "1drv.ms" || host === "onedrive.live.com" || host.endsWith(".onedrive.live.com")) {
    // The OneDrive shares API downloads any "anyone with the link" file from its share URL.
    const encoded = Buffer.from(url.toString()).toString("base64")
      .replace(/=+$/, "").replace(/\//g, "_").replace(/\+/g, "-");
    return { provider: "onedrive", downloadUrl: `https://api.onedrive.com/v1.0/shares/u!${encoded}/root/content` };
  }

  if (host.endsWith(".sharepoint.com")) {
    url.searchParams.set("download", "1");
    return { provider: "sharepoint", downloadUrl: url.toString() };
  }

  if (host === "www.dropbox.com" || host === "dropbox.com") {
    url.searchParams.delete("dl");
    url.searchParams.set("dl", "1");
    return { provider: "dropbox", downloadUrl: url.toString() };
  }

  return { provider: "direct", downloadUrl: url.toString() };
}

/** How to make a link downloadable, per provider — shown when a fetch returns a web page. */
export function sharingHelp(provider: LinkProvider): string {
  switch (provider) {
    case "google":
      return "In Google Sheets, click Share → General access → \"Anyone with the link\" (Viewer), then paste the link again.";
    case "onedrive":
    case "sharepoint":
      return "In Excel/OneDrive, click Share → \"Anyone with the link can view\", copy that link and paste it here.";
    case "dropbox":
      return "In Dropbox, create a share link with \"Anyone with the link\" access and paste it here.";
    default:
      return "The link must download the file itself (a .csv, .xlsx or .xls) without signing in.";
  }
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") ||
    v6.startsWith("fe80") || v6.startsWith("ff");
}

async function assertPublicHost(url: URL): Promise<void> {
  if (url.protocol !== "https:") throw new BadRequestError("The link redirected to a non-https address.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true }).catch(() => []);
  if (addresses.length === 0) throw new BadRequestError(`Couldn't reach ${host}.`);
  if (addresses.some((a) => isPrivateAddress(a.address))) {
    throw new BadRequestError("That link points to a private network address.");
  }
}

export type SheetFormat = "xlsx" | "xls" | "csv";

/** What kind of file the bytes are, or null for a web page (sign-in wall, preview page). */
export function sniffFormat(buf: Buffer): SheetFormat | null {
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return "xlsx";
  if (buf.length >= 4 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return "xls";
  const head = buf.subarray(0, 1024).toString("utf-8").trimStart().toLowerCase();
  if (head.startsWith("<!doctype html") || head.startsWith("<html") || head.includes("<head")) return null;
  if (buf.subarray(0, 1024).includes(0)) return null;   // binary we don't know
  return "csv";
}

export interface FetchedSheet {
  buffer: Buffer;
  format: SheetFormat;
  contentHash: string;
}

/** Download a resolved link. Throws LinkNotShared when what comes back is a web page. */
export async function fetchLinkedSheet(link: ResolvedLink): Promise<FetchedSheet> {
  let url = new URL(link.downloadUrl);
  let res: Response | null = null;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(url);
    res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "user-agent": "Veqiro-Rex/1.0 (+https://veqiro.com)" },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = new URL(res.headers.get("location")!, url);
      continue;
    }
    break;
  }
  if (!res) throw new BadRequestError("Couldn't download that link.");
  if (res.status >= 300 && res.status < 400) throw new BadRequestError("That link redirects too many times.");
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    throw new LinkNotShared(`The file isn't shared publicly. ${sharingHelp(link.provider)}`);
  }
  if (!res.ok) throw new BadRequestError(`The link answered with HTTP ${res.status}.`);

  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > MAX_LINK_BYTES) throw new BadRequestError("That file is over 50 MB.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  const reader = res.body?.getReader();
  if (!reader) throw new BadRequestError("The link returned no file.");
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_LINK_BYTES) {
      await reader.cancel();
      throw new BadRequestError("That file is over 50 MB.");
    }
    chunks.push(value);
  }
  const buffer = Buffer.concat(chunks);
  const format = sniffFormat(buffer);
  if (!format) throw new LinkNotShared(`That link opens a web page, not a file. ${sharingHelp(link.provider)}`);
  return { buffer, format, contentHash: createHash("sha256").update(buffer).digest("hex") };
}
