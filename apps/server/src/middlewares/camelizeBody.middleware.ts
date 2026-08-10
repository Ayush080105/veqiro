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

// MCP routes (connect configValues, tool-call args) are opaque pass-throughs
// to third-party Composio schemas, which commonly use snake_case
// field names mirroring the underlying REST APIs (e.g. Instagram's
// ig_user_id) — camelizing them silently corrupts the payload before it
// ever reaches the provider. Skip camelization for that whole path family.
const SKIP_PATH_SEGMENT = "/mcp/";

export function camelizeBody(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === "object" && !req.path.includes(SKIP_PATH_SEGMENT)) {
    req.body = camelizeKeys(req.body);
  }
  next();
}
