import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useRequestPasswordReset, useSignIn, useSignUp, useUpdatePassword } from "../queries";
import { authLinkRedirectUrl } from "../utils/authRedirect";
import LoadingModal from "../../../components/feedback/LoadingModal";

type AuthMode = "signIn" | "signUp" | "resetRequest" | "resetUpdate";

const RECOVERY_MESSAGE = "Enter a new password, then sign in again.";

type AuthPageProps = {
  /** The user followed a valid password-reset link: show "Set a new password". */
  recovery?: boolean;
  /** An email link failed (e.g. expired): explain why on arrival. */
  linkError?: string | null;
  /** Called once `linkError` is on screen, so the parent can forget it. */
  onLinkErrorShown?: () => void;
  /** Signing in (or up) is in progress, with what to say ("Signing you in…"),
   *  or null once it failed or needs no session (confirm-your-email sign-up).
   *  When given, the parent shows the loading modal for these, and keeps it up
   *  after a successful sign-in until the home page has loaded. */
  onSignInProgress?: (message: string | null) => void;
};

export default function AuthPage({
  recovery = false,
  linkError = null,
  onLinkErrorShown,
  onSignInProgress,
}: AuthPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>(recovery ? "resetUpdate" : "signIn");
  // What's wrong with the form itself (or the email link that brought the
  // user here). Errors from Supabase come from the mutations below.
  const [formError, setFormError] = useState<string | null>(recovery ? null : linkError);
  const [message, setMessage] = useState<string | null>(recovery ? RECOVERY_MESSAGE : null);

  const signIn = useSignIn();
  const signUp = useSignUp();
  const requestReset = useRequestPasswordReset();
  const updatePassword = useUpdatePassword();
  const pending = [signIn, signUp, requestReset, updatePassword].some((action) => action.isPending);

  // The form on screen shows its own action's error.
  const activeAction =
    mode === "signUp" ? signUp : mode === "resetRequest" ? requestReset : mode === "resetUpdate" ? updatePassword : signIn;
  const error = formError ?? activeAction.error?.message ?? null;

  /** Clears what's shown before an action, or when switching forms. */
  const clearFeedback = () => {
    setFormError(null);
    setMessage(null);
    for (const action of [signIn, signUp, requestReset, updatePassword]) action.reset();
  };

  // The message now lives in this page's own state; let the parent drop it.
  useEffect(() => {
    if (linkError) onLinkErrorShown?.();
  }, [linkError, onLinkErrorShown]);

  // Supabase can confirm a reset link a moment after this page first renders;
  // switch to the new-password form when that happens.
  const [wasRecovery, setWasRecovery] = useState(recovery);
  if (recovery !== wasRecovery) {
    setWasRecovery(recovery);
    if (recovery) {
      setMode("resetUpdate");
      setFormError(null);
      setMessage(RECOVERY_MESSAGE);
    }
  }
  const loadingMessageByMode: Record<AuthMode, string> = {
    signIn: "Signing you in…",
    signUp: "Creating your account…",
    resetRequest: "Sending your reset link…",
    resetUpdate: "Updating your password…",
  };

  const handleAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();

    if (!email || !password) {
      setFormError("Email and password are required.");
      return;
    }

    onSignInProgress?.(loadingMessageByMode[mode]);
    try {
      const data =
        mode === "signUp"
          ? await signUp.mutateAsync({ email, password, emailRedirectTo: authLinkRedirectUrl() })
          : await signIn.mutateAsync({ email, password });
      if (mode === "signUp" && !data.session) {
        setMessage("Check your inbox for a link to confirm your email.");
      }
      // Signed in: the parent keeps its modal up until the home page loads.
      if (!data.session) onSignInProgress?.(null);
    } catch {
      // The mutation holds the error, which the form shows.
      onSignInProgress?.(null);
    }
  };

  const handleRequestPasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();

    if (!email) {
      setFormError("Email is required.");
      return;
    }

    try {
      await requestReset.mutateAsync({ email, redirectTo: authLinkRedirectUrl() });
      setMessage("If there’s an account with that email, you’ll get a link to reset your password.");
    } catch {
      // Shown from the mutation's error.
    }
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    clearFeedback();

    if (!password) {
      setFormError("New password is required.");
      return;
    }

    try {
      await updatePassword.mutateAsync(password);
    } catch {
      return; // Shown from the mutation's error.
    }

    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );
    setPassword("");
    setMode("signIn");
    setMessage("Password updated. Sign in with your new password.");
  };

  return (
    <main className="auth-page">
      {/* Sign-in and sign-up use the parent's modal when it provides one. */}
      <LoadingModal
        open={pending && !(onSignInProgress && (mode === "signIn" || mode === "signUp"))}
        title="Please wait..."
        message={loadingMessageByMode[mode]}
      />
      <div className="auth-page__glow" />
      <div className="auth-shell">
        <section className="auth-intro">
          <Link to="/" className="back-link">
            Back to home
          </Link>
          <h1>What’s for dinner?</h1>
          <p>
            Save the recipes you love, plan your meals, and make a grocery list for the week.
          </p>
        </section>

        <section className="auth-panel">
          {mode === "resetUpdate" ? (
            <form className="auth-form" onSubmit={handleUpdatePassword}>
              <h2>Set a new password</h2>
              <label htmlFor="reset-password">New password</label>
              <input
                id="reset-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                required
                autoComplete="new-password"
              />

              {error ? <p className="error">{error}</p> : null}
              {message ? <p className="message">{message}</p> : null}

              <div className="actions">
                <button type="submit" className="btn btn--primary" disabled={pending}>
                  {pending ? "Updating..." : "Update password"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setMode("signIn");
                    setPassword("");
                    clearFeedback();
                  }}
                  disabled={pending}
                >
                  Back to sign in
                </button>
              </div>
            </form>
          ) : mode === "resetRequest" ? (
            <form className="auth-form" onSubmit={handleRequestPasswordReset}>
              <h2>Reset your password</h2>
              <label htmlFor="reset-email">Email</label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />

              {error ? <p className="error">{error}</p> : null}
              {message ? <p className="message">{message}</p> : null}

              <div className="actions">
                <button type="submit" className="btn btn--primary" disabled={pending}>
                  {pending ? "Sending..." : "Send reset link"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setMode("signIn");
                    clearFeedback();
                  }}
                  disabled={pending}
                >
                  Back to sign in
                </button>
              </div>
            </form>
          ) : (
            <form className="auth-form" onSubmit={handleAuth}>
              <h2>{mode === "signUp" ? "Create account" : "Sign in"}</h2>
              <label htmlFor="auth-email">Email</label>
              <input
                id="auth-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
              />

              <label htmlFor="auth-password">Password</label>
              <input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="********"
                required
                autoComplete={
                  mode === "signUp" ? "new-password" : "current-password"
                }
              />

              {error ? <p className="error">{error}</p> : null}
              {message ? <p className="message">{message}</p> : null}

              <div className="auth-form__account-actions">
                <button type="submit" className="btn btn--primary btn--small" disabled={pending}>
                  {mode === "signUp" ? "Sign up" : "Sign in"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => {
                    setMode(mode === "signUp" ? "signIn" : "signUp");
                    clearFeedback();
                  }}
                  disabled={pending}
                >
                  {mode === "signUp" ? "Sign in" : "Sign up"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => {
                    setMode("resetRequest");
                    setPassword("");
                    clearFeedback();
                  }}
                  disabled={pending}
                >
                  Forgot password?
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
