# Supabase Edge Functions principles

Applies to: Deno 2 functions in `supabase/functions/` (today:
`import-recipes`, which calls Gemini to turn pasted text and links into
recipe drafts). These run on Supabase's servers, not in the browser.

## 1. Authenticate every request

- Keep `verify_jwt` on (the default) for functions called by signed-in
  users. Turn it off only for webhooks or cron callers, and then verify
  their signature or shared secret yourself before doing anything.
- When the function reads or writes user data, create the Supabase client
  with the caller's `Authorization` header so queries run under the user's
  RLS. Use the service role key only when a task truly needs to bypass RLS,
  and never return data the caller couldn't read themselves.

## 2. Keep secrets on the server

- Third-party API keys (Gemini) live in function secrets
  (`supabase secrets set`), read with `Deno.env.get`. They never go in
  `VITE_*` variables or in the repo.
- For local runs, use `supabase functions serve --env-file` with a
  git-ignored file.
- Never log secrets, full request bodies, or user content (AGENTS.md →
  Error handling & logging).

## 3. Never trust input or remote content

- Validate the request body's shape and size before using it (mode, text
  length, number of URLs), and return `400` with a clear message when it's
  wrong.
- Fetched recipe pages are untrusted: set timeouts and size limits, allow
  only `http`/`https` URLs, strip HTML to text, and never return raw remote
  HTML to the client (AGENTS.md → Import/Parsing Agent).
- Validate model output against the expected schema before returning it.
  Treat it like any other untrusted input, and fall back gracefully ("best
  effort import with user review").

## 4. Respond predictably

- Handle the CORS preflight (`OPTIONS`) first, and include CORS headers on
  every response, including errors.
- Return JSON with an appropriate status (`400` bad input, `401`/`403`
  auth, `502` upstream failure, `500` unexpected). Send a friendly `error`
  message the app can show; keep details in server logs only.
- Retry upstream calls with backoff only for transient failures (429,
  5xx), and cap the total time so the function stays within its limits.

## 5. Structure and dependencies

- Keep `index.ts` as a thin handler (`Deno.serve`) that parses the request
  and delegates to focused modules, as `import-recipes` already does.
- Put code shared by several functions in `supabase/functions/_shared/`,
  which isn't deployed as a function.
- Import packages with `npm:` or `jsr:` specifiers pinned to a version.
- Keep the function code separate from `src/`. The browser bundle must not
  import it.

## Sources

- [Supabase: Securing Edge Functions](https://supabase.com/docs/guides/functions/auth)
- [Supabase AI prompt: writing Edge Functions](https://supabase.com/docs/guides/ai-tools/ai-prompts/edge-functions)
- [Supabase troubleshooting: Unable to call Edge Function (CORS)](https://supabase.com/docs/guides/troubleshooting/unable-to-call-edge-function)
- [gosign: Securing Supabase Edge Functions](https://www.gosign.de/en/magazine/supabase-edge-functions-secure/)
