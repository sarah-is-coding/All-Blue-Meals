# Architecture Notes

## Frontend Structure
- `src/app`: routing and application shell.
- `src/features`: feature modules (`auth`, `recipes`, `ingredients`, `meal-plans`, `grocery`).
- `src/components`: shared UI components.
- `src/lib`: shared infrastructure (`supabaseClient`, db helpers, utils).
- `src/styles`: global and app-level styles.
- `src/__tests__`: tests, mirroring the `src/features` layout.

## Backend Structure
- `supabase/config.toml`: Supabase CLI configuration.
- `supabase/migrations`: timestamped migrations, applied in filename order. Together they define the schema and policies.
- `supabase/functions/import-recipes`: Edge Function that calls Gemini for AI recipe import and generation, keeping the API key server-side.
- `supabase/rls`: RLS notes and policy snippets.
