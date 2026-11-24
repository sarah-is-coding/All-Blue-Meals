# TypeScript principles

Applies to: TypeScript ~5.9 with `strict`, `verbatimModuleSyntax`,
`erasableSyntaxOnly`, `noUnusedLocals`/`Parameters`, and
`noFallthroughCasesInSwitch` (see `tsconfig.app.json`). `npm run build`
(`tsc -b`) is the type check, and it covers tests too.

## 1. Let the compiler prove things; don't silence it

- No `any`. At boundaries where the shape isn't known yet (JSON from an edge
  function, `localStorage`, URL params, `catch (error)`), use `unknown` and
  narrow it before use.
- Avoid `as` casts. A cast tells the compiler to stop checking. If you need
  one, it usually means a type is wrong somewhere upstream. The accepted uses
  are narrowing a generated DB column (with a comment, per CLAUDE.md) and
  test fixtures.
- Never use the non-null assertion `!` to get past a possibly missing value.
  Handle the missing case, or restructure so the value can't be missing.
- No `// @ts-ignore`. If you must suppress an error, use
  `// @ts-expect-error <reason>`, so the suppression fails once it's no
  longer needed.

**Why:** every escape hatch hides a place where runtime data can disagree
with the types, which is exactly where bugs live.

## 2. Model states, not flags

- Use a discriminated union when a value has distinct states, instead of
  several optional fields or booleans that can contradict each other:

  ```ts
  type ImportState =
    | { status: "idle" }
    | { status: "loading" }
    | { status: "error"; message: string }
    | { status: "done"; drafts: RecipeDraft[] };
  ```

- Make `switch` statements over a union exhaustive with a `never` check, so
  adding a variant is a compile error everywhere it isn't handled:

  ```ts
  default: {
    const unreachable: never = state;
    return unreachable;
  }
  ```

- Prefer string literal unions over `enum` (`erasableSyntaxOnly` forbids
  enums anyway). Derive the union from a constant when you also need the list
  at runtime:
  `const MEAL_TYPES = ["breakfast", "lunch", "dinner"] as const; type MealType = (typeof MEAL_TYPES)[number];`

## 3. Derive types; don't duplicate them

- DB row types come from the generated schema:
  `Pick<Tables<"recipes">, "id" | "title">`. Never hand-write a row type
  (CLAUDE.md → Code Style).
- Use `Pick`, `Omit`, `Partial`, `ReturnType`, `Parameters`, and indexed
  access (`Recipe["id"]`) to build related types from one source.
- Use `satisfies` to check a value against a type without widening it, which
  keeps literal types (good for config objects and lookup maps):
  `const LABELS = { … } satisfies Record<MealType, string>;`

## 4. Write types that read like documentation

- Use `type` for object shapes and unions (the repo's convention). Name
  types after domain concepts (`PlannedMeal`, `GroceryLine`), not after
  where they're used.
- Annotate the return types of exported functions in `api.ts` and `utils/`.
  This keeps the public contract stable and makes errors show up where the
  function is written, not where it's called.
- Prefer `readonly` arrays (`readonly string[]`) for inputs a function must
  not mutate.
- Represent "no value" consistently: `null` for values that come from the
  database, optional properties (`?`) for props/options a caller can omit.
  Don't mix `undefined` and `null` for the same field.

## 5. Imports and modules

- Use `import type { … }` for type-only imports. `verbatimModuleSyntax`
  requires it, and it keeps types out of the bundle.
- Only use syntax TypeScript can erase (`erasableSyntaxOnly`): no `enum`,
  `namespace`, or constructor parameter properties.
- Avoid import-time side effects (AGENTS.md); `noUncheckedSideEffectImports`
  catches bare imports of files that don't exist.

## 6. Handle errors as values at the edges

- Supabase calls return `{ data, error }`. Check `error` immediately, throw
  an `Error` with a friendly message in `api.ts`, and let TanStack Query
  carry it to the UI. Never let `data` be used while `error` is set.
- In `catch`, the error is `unknown`: narrow with `error instanceof Error`
  before reading `.message`.

## Sources

- [TypeScript Handbook: Narrowing (discriminated unions, `never` exhaustiveness)](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
- [TSConfig reference: `strict`, `verbatimModuleSyntax`, `erasableSyntaxOnly`](https://www.typescriptlang.org/tsconfig/)
- [TypeScript 4.9 release notes: the `satisfies` operator](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-9.html)
- [Better Stack: TypeScript discriminated unions](https://betterstack.com/community/guides/scaling-nodejs/discriminated-unions.md)
- [DEV: `satisfies never` exhaustiveness checking](https://dev.to/cefn/typescript-satisfies-never-exhaustiveness-checking-in-typescript-49-58fh)
