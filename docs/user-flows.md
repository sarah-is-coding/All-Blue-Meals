# User Flows

## Public Visitor
1. User lands on `/` (the landing page while signed out).
2. User selects CTA and navigates to `/auth`.

## Authentication
1. User signs in or signs up on `/auth`.
2. On success, user is routed to `/` (their home page).
3. Password reset is initiated from `/auth` and completed via recovery link.

## Authenticated Workspace
1. Signed in, `/` is the home page (today's and tomorrow's meals, last meal to rate).
2. User can sign out and return to public/auth routes.

Workspace routes (at the site root; signed-out visitors are sent to `/auth`):

| Route | Purpose |
|---|---|
| `/` | Home: today's and tomorrow's meals, and the last meal to rate |
| `recipes` | Browse, search, and filter recipes (including by rating) |
| `recipes/new` | Add a recipe by hand |
| `recipes/import` | AI import from pasted notes and/or URLs |
| `recipes/generate` | AI-generate recipe drafts from a request |
| `recipes/:recipeId` | View, edit, rate, delete, or add a recipe to a plan |
| `meal-plans` | Weekly meal planner; copy past weeks or apply saved plans |
| `saved-meal-plans` | Rename or delete saved plan templates |
| `grocery` | Generate and check off a grocery list from a date range or saved plan |

Unknown routes redirect to `/`. Old `/app/...` links (the app used to live under `/app`) redirect to the same page without the prefix.
