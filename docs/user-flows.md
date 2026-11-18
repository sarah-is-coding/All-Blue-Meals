# User Flows

## Public Visitor
1. User lands on `/`.
2. User selects CTA and navigates to `/auth`.

## Authentication
1. User signs in or signs up on `/auth`.
2. On success, user is routed to `/app`.
3. Password reset is initiated from `/auth` and completed via recovery link.

## Authenticated Workspace
1. User accesses `/app`.
2. User can sign out and return to public/auth routes.

Workspace routes (all under `/app`):

| Route | Purpose |
|---|---|
| `recipes` | Browse, search, and filter recipes (including by rating) |
| `recipes/new` | Add a recipe by hand |
| `recipes/import` | AI import from pasted notes and/or URLs |
| `recipes/generate` | AI-generate recipe drafts from a request |
| `recipes/:recipeId` | View, edit, rate, delete, or add a recipe to a plan |
| `meal-plans` | Weekly meal planner; copy past weeks or apply saved plans |
| `saved-meal-plans` | Rename or delete saved plan templates |
| `grocery` | Generate and check off a grocery list from a date range or saved plan |

Unknown routes redirect to `/`.
