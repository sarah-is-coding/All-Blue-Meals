# Auth Feature

Sign-in, sign-up, password reset, and the signed-in session.

- `api.ts`: the Supabase auth calls (`authService`).
- `queries.ts`: a `useMutation` hook for each action (`useSignIn`,
  `useSignUp`, `useRequestPasswordReset`, `useUpdatePassword`,
  `useSignOut`). Pages get pending and error state from these instead of
  tracking their own. Supabase returns auth errors rather than throwing, so
  each hook throws them to make them the mutation's error.
- `hooks/useAuthSession.ts`: the current session and password-recovery
  state. Signing out clears the query cache (`src/app/useSessionCache.ts`).
