# DB Helpers

Typed query helpers and Supabase data-access utilities live in this folder.

- `database.types.ts` — **generated**, do not edit by hand. TypeScript types for every table, produced from the live schema with `npm run db:types` (requires `supabase link`). Regenerate and commit it after every migration.

The shared client in `src/lib/supabaseClient.ts` is created with `createClient<Database>`, so inserts, updates, and filters are checked against the schema. Feature `api.ts` files derive their row types from it, e.g.:

```ts
import type { Tables } from "../../lib/db/database.types";

type RecipeSummaryRow = Pick<Tables<"recipes">, "id" | "title" | "rating">;
```
