import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../../../lib/supabaseClient";
import { parseAuthRedirect } from "../utils/authRedirect";

export function useAuthSession() {
  // Read the email-link result on first render, before the Supabase client
  // clears the URL hash (it does so only after verifying the link).
  const [initialRedirect] = useState(() => parseAuthRedirect(window.location.hash));

  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // True after following a valid password-reset link, until the user signs
  // out (which happens right after they set a new password).
  const [passwordRecovery, setPasswordRecovery] = useState(initialRedirect?.kind === "recovery");
  // Shown once: AuthPage calls dismissLinkError after displaying it, so coming
  // back to the sign-in page later doesn't show a stale message again.
  const [linkError, setLinkError] = useState(
    initialRedirect?.kind === "error" ? initialRedirect.message : null
  );
  const dismissLinkError = useCallback(() => setLinkError(null), []);

  useEffect(() => {
    // A failed link leaves its error in the URL; drop it so a refresh doesn't
    // show the message again.
    if (initialRedirect?.kind === "error") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    }

    const syncSession = async () => {
      const { data } = await supabase.auth.getSession();
      setSession(data.session ?? null);
      setAuthReady(true);
    };

    syncSession();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, newSession) => {
        setSession(newSession);
        if (event === "PASSWORD_RECOVERY") setPasswordRecovery(true);
        if (event === "SIGNED_OUT") setPasswordRecovery(false);
      }
    );

    return () => listener?.subscription.unsubscribe();
  }, [initialRedirect]);

  return { session, authReady, passwordRecovery, linkError, dismissLinkError };
}
