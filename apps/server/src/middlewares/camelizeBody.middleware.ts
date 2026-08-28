import { Request, Response, NextFunction } from "express";

function camelizeKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(camelizeKeys);
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [
        k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase()),
        camelizeKeys(v),
      ])
    );
  }
  return value;
}

// Paths whose bodies are opaque pass-throughs to (or from) third-party schemas.
//
// MCP routes (connect configValues, tool-call args) carry Composio schemas,
// which commonly use snake_case field names mirroring the underlying REST APIs
// (e.g. Instagram's ig_user_id) — camelizing them silently corrupts the payload
// before it ever reaches the provider.
//
// Internal run routes carry the same thing in both directions: the write
// endpoint forwards raw tool arguments to callTool, and step updates persist
// provider results verbatim as actionResult/toolTrace. apps/ai already sends
// this family camelCase, so there is nothing here to convert and everything to
// lose. Matched as substrings because req.path here is the full /api/v1/...
// path; both segments are fixed route families, not user-supplied values.
const SKIP_PATH_SEGMENTS = ["/mcp/", "/internal/runs/"];

const isOpaquePath = (path: string) =>
  SKIP_PATH_SEGMENTS.some((p) => path.includes(p));

export function camelizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object" && !isOpaquePath(req.path)) {
    req.body = camelizeKeys(req.body);
  }
  next();
}
