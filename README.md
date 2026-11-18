# PlanMyMeals
Simple personal meal planner with a mobile-friendly web experience that lets you import or manually add recipes, build and save meal plans, and generate grocery lists. Optimized for Supabase's free tier with minimal storage usage, allowing the app to scale to tens of thousands of lightweight, text-based recipes before any upgrades are needed. Keeping the backend lightweight also makes it feasible to cover hosting costs with non-intrusive ads rather than subscriptions.

## Core Features
- Recipe entry by hand, AI import from pasted notes or URLs, and AI generation from a plain-language request
- Star ratings and filtering on recipes
- Weekly meal planning, with copying from past weeks and saved, named plan templates
- Grocery list generation from planned meals, grouped by aisle category

### Planned
- Automated meal plan suggestions based on preferences, calorie goals, or dietary targets
- PWA support (web app manifest, optional service worker)

## Running Locally (Contributors)
1. Create a Supabase project (free tier).
2. Copy your project's URL + anon/public key into `.env` (reference `.env.example`).
3. Link the project and apply the migrations: `supabase link --project-ref <your-ref>` then `supabase db push`.
4. Add `GEMINI_API_KEY` to Supabase function secrets before using AI recipe import (see below).
5. `npm install`, then `npm run dev`.

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm test` | Run the test suite once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint with ESLint |
| `npm run build` | Type-check (app and tests) and build for production |
| `npm run db:types` | Regenerate `src/lib/db/database.types.ts` from the linked Supabase project (after a migration) |

CI runs lint, build, and tests on every push to `main` and on pull requests (`.github/workflows/ci.yml`).

## AI Recipe Import
- The Add Recipe screen can extract one or many recipe drafts from pasted notes, recipe URLs, or both.
- The Recipes menu can also generate one or many recipe drafts from a plain-language request.
- Extraction runs through the Supabase Edge Function at `supabase/functions/import-recipes`, keeping `GEMINI_API_KEY` server-side.
- Deploy the function with Supabase and set the secret with `supabase secrets set GEMINI_API_KEY=...`.

## Project Structure
- `src/app`: app shell, routes, and top-level pages
- `src/components`: shared UI components
- `src/features`: feature modules (`auth`, `recipes`, `ingredients`, `meal-plans`, `grocery`)
- `src/lib`: shared clients/helpers (`supabaseClient`, `db`, `utils`)
- `src/styles`: global and app styles
- `src/__tests__`: tests, mirroring the `src/features` layout
- `supabase`: CLI config, migrations, edge functions, and RLS notes
- `docs`: architecture notes and user flows

## Tech Stack
- Frontend: React 19 + TypeScript + Vite, React Router
- Styling: plain CSS with CSS variables
- Auth/DB: Supabase (PostgreSQL + RLS)
- Client: Supabase JS (browser-side)
- AI: Gemini, called from a Supabase Edge Function
- Dev: ESLint, Vitest + React Testing Library
- Hosting: Vercel for the web app; Supabase for backend

## Database Structure (Supabase)
The schema is defined by the migrations in `supabase/migrations/`, applied in filename order. Every table has RLS enabled.

- `profiles`: user_id (pk, references auth.users), display_name.
- `recipes`: id, user_id, title, description, source_url, prep_minutes, cook_minutes, servings, tags (text[]), instructions (text), rating (1–5, nullable); text-first to minimize storage.
- `ingredients`: id, name (unique), name_key (unique matching key: case, accents, punctuation and plurals ignored), category, default_unit; a small shared catalog that any signed-in user can read and add to.
- `ingredient_aliases`: alias_key (unique), alias_name, ingredient_id, source (seed/merge/ai/user), status (approved/pending); other names for a catalog ingredient ("scallions" → green onion). Shared like `ingredients`. See `docs/ingredient-normalization.md`.
- `recipe_ingredients`: id, recipe_id, ingredient_id (references ingredients; the name shown is the catalog's), quantity, quantity_numeric, unit, notes, position, substitute_for (another row of the same recipe this is an alternative to). Saved all at once by the `save_recipe_ingredients` function.
- `meal_plans`: id, user_id, title, start_date, end_date, saved_name (set when saved as a named template), notes.
- `meal_plan_items`: id, meal_plan_id, recipe_id, planned_for (date), meal_type (breakfast/lunch/dinner/other), servings_override (nullable), notes.
- `grocery_lists`: id, user_id, meal_plan_id (nullable), title, created_at; can be generated from a plan or ad hoc.
- `grocery_items`: id, list_id, ingredient_name, quantity, unit, category, substitutes (text[] of options), is_checked; plain text so saved lists stay editable on mobile.
