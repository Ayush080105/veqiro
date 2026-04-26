// Lightweight web crawler used by /brand-kit/scrape and the background crawl
// kicked off on finalize. Primary path is Jina Reader (https://r.jina.ai/),
// which renders pages headlessly and returns clean Markdown — no API key
// required for the free tier. Falls back to a plain fetch + naive HTML strip
// if Jina is unreachable or rate-limits us.

const JINA_BASE = "https://r.jina.ai/";
const MAX_CONTENT = 12_000;
const MAX_SUMMARY = 1_500;
const FETCH_TIMEOUT_MS = 15_000;

export interface CrawlResult {
  content: string;
  summary: string;
  source: "jina" | "fetch_fallback";
}

const fetchWithTimeout = async (url: string, init: RequestInit) => {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: ac.signal });
  } finally {
    clearTimeout(timer);
  }
};

const truncate = (s: string, n: number) =>
  s.length > n ? s.slice(0, n).replace(/\s+\S*$/u, "") + "…" : s;

// Jina Reader returns Markdown that often starts with a "Title: ..." metadata
// header followed by URL/Markdown. We strip that header and pull the first
// substantive paragraphs as the summary.
const buildSummary = (markdown: string): string => {
  // Drop Jina's metadata header block (Title:/URL Source:/Markdown Content:)
  const stripped = markdown
    .replace(/^Title:[^\n]*\n/u, "")
    .replace(/^URL Source:[^\n]*\n/u, "")
    .replace(/^Published Time:[^\n]*\n/u, "")
    .replace(/^Markdown Content:\s*\n/u, "");

  // Drop common nav-like lines (very short bullets, image-only lines, etc.)
  const meaningful = stripped
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (!t) return false;
      if (t.startsWith("![")) return false; // image-only line
      if (/^\[[^\]]+\]\([^)]+\)\s*$/u.test(t)) return false; // link-only line
      if (t.length < 40 && !t.startsWith("#")) return false; // short bullets/labels
      return true;
    })
    .join("\n");

  return truncate(meaningful.trim(), MAX_SUMMARY);
};

const stripHtml = (html: string): string =>
  html
    .replace(/<script[\s\S]*?<\/script>/giu, " ")
    .replace(/<style[\s\S]*?<\/style>/giu, " ")
    .replace(/<[^>]+>/gu, " ")
    .replace(/&nbsp;/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();

export const crawlWebsite = async (url: string): Promise<CrawlResult> => {
  // 1) Try Jina Reader. No API key needed for the free tier; if JINA_API_KEY
  //    is set we use it for higher rate limits.
  try {
    const headers: Record<string, string> = {
      Accept: "text/markdown",
      "X-With-Generated-Alt": "true",
    };
    if (process.env.JINA_API_KEY) {
      headers["Authorization"] = `Bearer ${process.env.JINA_API_KEY}`;
    }
    const res = await fetchWithTimeout(`${JINA_BASE}${url}`, { headers });
    if (res.ok) {
      const text = await res.text();
      const content = truncate(text, MAX_CONTENT);
      return {
        content,
        summary: buildSummary(text),
        source: "jina",
      };
    }
    // Fall through to fetch fallback on non-2xx (rate-limit, etc.)
  } catch {
    // Network/abort — try fallback.
  }

  // 2) Fallback: raw fetch + HTML strip. Won't render JS-only pages but is
  //    better than nothing for static landing pages.
  const res = await fetchWithTimeout(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; VeqiroBot/1.0; +https://veqiro.com)",
      Accept: "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) {
    throw new Error(`Could not fetch ${url} (status ${res.status})`);
  }
  const html = await res.text();
  const text = stripHtml(html);
  const content = truncate(text, MAX_CONTENT);
  // Summary is the first MAX_SUMMARY chars of cleaned text — coarse but useful.
  return {
    content,
    summary: truncate(text, MAX_SUMMARY),
    source: "fetch_fallback",
  };
};
