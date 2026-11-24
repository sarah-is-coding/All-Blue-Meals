import { useMutation } from "@tanstack/react-query";
import type { AuthError } from "@supabase/supabase-js";
import { authService } from "./api";

// The only module in auth that talks to TanStack Query (see "Data loading" in
// CLAUDE.md). Sign-in and the rest are server side effects, so each is a
// mutation: components get pending and error state from it instead of
// tracking their own. The session itself comes from useAuthSession, and
// signing out clears the query cache there (src/app/useSessionCache.ts).

/** Supabase auth calls return their error instead of throwing; throw it so
 *  it becomes the mutation's error. */
function throwIfAuthError(error: AuthError | null): void {
  if (error) throw new Error(error.message);
}

export function useSignIn() {
  return useMutation({
    mutationFn: async ({ email, password }: { email: string; password: string }) => {
      const { data, error } = await authService.signInWithEmail(email, password);
      throwIfAuthError(error);
      return data;
    },
  });
}

export function useSignUp() {
  return useMutation({
    mutationFn: async ({
      email,
      password,
      emailRedirectTo,
    }: {
      email: string;
      password: string;
      /** Where the confirmation email links back to (authLinkRedirectUrl). */
      emailRedirectTo: string;
    }) => {
      const { data, error } = await authService.signUpWithEmail(email, password, emailRedirectTo);
      throwIfAuthError(error);
      return data;
    },
  });
}

export function useRequestPasswordReset() {
  return useMutation({
    mutationFn: async ({ email, redirectTo }: { email: string; redirectTo: string }) => {
      const { error } = await authService.requestPasswordReset(email, redirectTo);
      throwIfAuthError(error);
    },
  });
}

/** Sets the new password from a reset link, then signs out, so the user
 *  signs in again with it. */
export function useUpdatePassword() {
  return useMutation({
    mutationFn: async (password: string) => {
      const { error } = await authService.updatePassword(password);
      throwIfAuthError(error);
      await authService.signOut();
    },
  });
}

export function useSignOut() {
  return useMutation({
    mutationFn: async () => {
      const { error } = await authService.signOut();
      throwIfAuthError(error);
    },
  });
}
