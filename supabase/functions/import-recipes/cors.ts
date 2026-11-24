// CORS for the import function (decision D3 in
// principles/evaluations/2026-11-24-plan.md): allow the app's own origins
// only, echoing the request's Origin on an exact match (scheme, host, and
// port) and always sending `Vary: Origin` (OWASP CORS guidance).
//
// This is defense in depth: the app authenticates with a bearer token from
// browser storage, which other sites can't send for a user anyway.
//
// No Deno globals here, so the app's tests (Vitest) can import this module.

/** The production site and local dev. `allbluemeals.com` redirects to www,
 *  so www is the only production origin a browser sends. */
export const DEFAULT_ALLOWED_ORIGINS: readonly string[] = [
  "https://www.allbluemeals.com",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];

/** The `ALLOWED_ORIGINS` secret (comma-separated) replaces the defaults when set. */
export function parseAllowedOrigins(value: string | undefined): readonly string[] {
  const origins = (value ?? "")
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);
  return origins.length > 0 ? origins : DEFAULT_ALLOWED_ORIGINS;
}

export function corsHeaders(origin: string | null, allowed: readonly string[]): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
  if (origin && allowed.includes(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}
