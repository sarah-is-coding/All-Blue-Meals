# agents.md — PlanMyMeals

This repo is a lightweight, text-first personal meal planner built for Supabase free tier. These agents exist to keep changes small, safe, and consistent, with a strong focus on **mobile UX**, **RLS correctness**, and **minimal storage**.

This file covers product goals and domain rules. The tech stack, testing rules, code style, CSS conventions, and database workflow are in [CLAUDE.md](CLAUDE.md) — read both.

---

## Core product goals

- **Mobile-first** experience (fast, thumb-friendly, offline-tolerant where reasonable).
- **Text-first recipes** (avoid images/files; keep rows small).
- **Supabase free-tier friendly** (efficient queries, good indexes, minimal migrations, no bloat).
- **User data is always scoped** by `auth.uid()` via **RLS**.
- **Simple import** (URL + manual paste) and clean CRUD flows.
- **Grocery lists** generated from meal plans with simple dedup/merge behavior.

---

## Repo conventions

### Code style
- Prefer **small, focused modules** over giant files.
- Keep components **presentational** where possible; put data fetching in hooks/services.
- Use explicit types for DB rows and DTOs (avoid `any`).
- Avoid side effects at import time.

### Folder layout (recommended)
- `src/`
  - `app/` (routing, app shell, providers)
  - `components/` (shared UI)
  - `features/`
    - `recipes/`
    - `ingredients/`
    - `meal-plans/`
    - `grocery/`
    - `auth/`
  - `lib/`
    - `supabaseClient.ts`
    - `db/` (typed helpers, query builders)
    - `utils/`
  - `styles/`
- `supabase/`
  - `config.toml` (Supabase CLI config)
  - `migrations/` (timestamped migrations; the source of truth for the schema)
  - `rls/` (policy notes + snippets)
- `docs/` (architecture notes, user flows)

---

## Modularization & Separation of Concerns (Required)

This codebase follows **modular programming** and **separation of concerns**. Avoid large, multi-purpose files.

### Rules
- Each file/module should have **one primary responsibility**:
  - UI components → `components/` or feature-level UI  
  - Data fetching → hooks or `lib/db/*`  
  - Business logic → feature services or utils  
- Avoid “god files” (e.g., `utils.ts` with unrelated helpers).
- Feature logic should live in `features/<domain>/`:
  - UI: `features/recipes/components/*`
  - Data: `features/recipes/api.ts`
  - Logic: `features/recipes/utils/*` (pure, unit-tested helpers)
- Shared logic goes in `lib/` only if used by 2+ features. Which features may import which is enforced by ESLint (see "Feature boundaries" in [CLAUDE.md](CLAUDE.md)).
- Prefer composition over inheritance.
- Favor explicit imports over deep shared “magic” utils.

### Review guidelines for agents
- Flag files > ~300 lines unless strongly justified.
- Suggest splitting mixed UI + data + logic into:
  - Component  
  - Hook/service  
  - DB/query helper  
- Avoid tight coupling between features.

### Why this matters here
- Keeps Supabase queries isolated and testable  
- Makes mobile UI easier to iterate on  
- Reduces merge conflicts  
- Keeps features independently evolvable  

---

## Data + RLS rules (non-negotiable)

**Rule:** No table containing user data should be readable/writable without RLS policies enforcing ownership.

### Table ownership patterns
- Tables with `user_id`: `profiles`, `recipes`, `planned_meals`, `saved_plans`, `grocery_lists`  
  - Policies must enforce: `user_id = auth.uid()`
- Child tables without `user_id`: `recipe_ingredients`, `saved_plan_meals`, `grocery_items`  
  - Policies must enforce ownership via parent:
    - `recipe_ingredients.recipe_id → recipes.user_id`
    - `saved_plan_meals.saved_plan_id → saved_plans.user_id`
    - `grocery_items.list_id → grocery_lists.user_id`
- Shared catalog: `ingredients` and `ingredient_aliases` (no `user_id`)
  - Any authenticated user can read and insert; no update/delete policies
  - These are the only intentional shared tables — keep rows small (name, key, category, default unit; alias key and name)
  - `ingredient_aliases` maps synonyms to a catalog ingredient ("scallions" → green onion); see `docs/ingredient-normalization.md`
- Lookup table: `ingredient_categories` (grocery store departments: code, label, description, order)
  - Read-only for authenticated users; changed only by migrations
  - An "other" ingredient gets a real category only through `upgrade_ingredient_category` (it never moves one real category to another)

### Agent checklist for DB changes
- [ ] RLS enabled on any new user-scoped table  
- [ ] SELECT/INSERT/UPDATE/DELETE policies defined and reviewed  
- [ ] Indexes added for foreign keys + common filters (`user_id`, `created_at`, `planned_for`)  
- [ ] Avoid heavy text search / full-text unless explicitly planned  
- [ ] No new shared/global tables or bloat tables beyond the `ingredients` / `ingredient_aliases` catalog and the `ingredient_categories` lookup  

---

## Performance + storage constraints

- Prefer **one query per screen** (or stable batching) over chatty requests.
- Avoid loading full instructions/ingredients for list views.
- Fetch minimal fields for lists; full records only on detail pages.
- Grocery generation should be efficient and predictable.
- Avoid storing duplicated content or large JSON blobs.

---

## UX principles (mobile-first)

- One-hand friendly layouts; bottom actions preferred.
- Large tap targets; avoid dense tables.
- Allow partial drafts (only require minimal fields).
- Grocery list: fast check/uncheck, inline edit, unchecked first.
- Meal plans: quick add now; drag/drop later if needed.

---

## Ads & Loading UI defaults (required when ads are present)

- Use a shared ad component at `src/components/ads/AdSlot.tsx` for all ad placements.
- `AdSlot` must support multiple sizes (preset and custom dimensions) to fit different surfaces.
- Keep ad placement minimal and non-intrusive:
  - Prefer side whitespace rails on wide screens.
  - Prefer footer/bottom sections over inline placement in primary workflows.
  - Avoid inserting ads between form fields or critical action buttons.
- On mobile, reduce ad density and keep core task flow uninterrupted.
- Loading states should use a modal component at `src/components/feedback/LoadingModal.tsx` when appropriate.
- `LoadingModal` owns its timing: it only appears if work takes longer than ~280 ms and, once shown, stays up at least ~480 ms. Pass `open={loading}` and keep it mounted (toggle `open` instead of rendering it only while loading). Do not add per-caller timing.
- If a loading modal includes an ad slot, prevent accidental clicks:
  - Render the ad slot in non-interactive mode.
  - Keep full-screen overlay blocking background interaction.
  - Never place clickable ads directly under likely tap targets during loading transitions.
- Always label ad areas clearly (for example, "Sponsored").

---

## Testing expectations

Automated testing rules (required tests per change type, mocking conventions, `npm test` must pass) are in [CLAUDE.md](CLAUDE.md). In addition:

- [ ] Manual happy-path test steps for UI changes  
- [ ] RLS verified for any DB change:
  - user can access own rows  
  - user cannot access other users’ rows  

---

## Error handling & logging

- No sensitive data in logs.
- User-facing errors must be actionable and friendly.
- Explicit empty states (no recipes, no plans, no grocery items).

---

## Security & privacy

- Never expose Supabase service role key client-side.
- Supabase anon key allowed via `.env`.
- RLS is the primary security boundary.
- Keep third-party integrations minimal; privacy-first by default.

---

## Agents

### 1) Product Engineer Agent
**Scope:** end-to-end feature delivery  
- Mobile UX first  
- Efficient, scoped queries  
- Clear PR test steps  

**Definition of done**
- Loading/empty/error/success states  
- RLS-safe queries  
- Minimal data fetching  
- Accessible forms  

---

### 2) Database & RLS Agent
**Scope:** schema, policies, performance  
- Enforces ownership constraints  
- Reviews indexes and joins  
- Keeps schema minimal  

**Avoid**
- Heavy denormalization  
- Extensions/triggers unless justified  

---

### 3) Import/Parsing Agent
**Scope:** recipe import (URL/manual)  
- Robust parsing with graceful fallback  
- Text-only storage  
- Sanitizes remote HTML  

**Guardrails**
- Never trust remote HTML  
- Isolate parsing logic  
- “Best effort” import with user review  

---

### 4) Grocery Aggregation Agent
**Scope:** grocery list generation  
- Simple, explainable merge rules  
- Editable, mobile-fast lists  
- Optimistic UI allowed  

**Merge rules**
- Same catalog ingredient (`ingredient_id`) + normalized unit (`normalizeUnit`: "cups" = "cup") → merge quantities  
- Otherwise keep separate rows  
- Water is left off; substitutes ("or avocado oil") are shown as options on their item, never as items to buy  

---

## PR checklist (required)

- [ ] Feature description + mobile screenshots (if UI changes)  
- [ ] RLS behavior confirmed  
- [ ] No service role usage client-side  
- [ ] Minimal fields fetched for list views  
- [ ] Manual test plan included  
- [ ] CI passes (lint, type-check/build, tests)  
- [ ] Ad placement reviewed for non-intrusiveness and accidental-click safety (if ads are touched)

---

## Commit & branch guidance

- Small commits with clear messages  
- Do work on a feature branch named after the change, then merge to `main`; CI must stay green  
- Avoid drive-by refactors  

---

## Future-friendly notes (non-binding)

- PWA service worker optional later  
- Ads later must not disrupt core flows  
- Prefer indexed filters before full-text search  

---

**If you’re an agent in this repo:** optimize for **clarity, safety, modularity, and small diffs**.
