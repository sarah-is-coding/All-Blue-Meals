import { supabase } from "../../lib/supabaseClient";

export const authService = {
  signInWithEmail(email: string, password: string) {
    return supabase.auth.signInWithPassword({ email, password });
  },

  /** The confirmation email links back to `emailRedirectTo` (see authLinkRedirectUrl). */
  signUpWithEmail(email: string, password: string, emailRedirectTo: string) {
    return supabase.auth.signUp({ email, password, options: { emailRedirectTo } });
  },

  requestPasswordReset(email: string, redirectTo: string) {
    return supabase.auth.resetPasswordForEmail(email, { redirectTo });
  },

  updatePassword(password: string) {
    return supabase.auth.updateUser({ password });
  },

  signOut() {
    return supabase.auth.signOut();
  },
};
