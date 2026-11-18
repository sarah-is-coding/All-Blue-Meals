import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { authService } from "../api";
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
};

export default function AuthPage({
  recovery = false,
  linkError = null,
  onLinkErrorShown,
}: AuthPageProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>(recovery ? "resetUpdate" : "signIn");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(recovery ? null : linkError);
  const [message, setMessage] = useState<string | null>(recovery ? RECOVERY_MESSAGE : null);

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
      setError(null);
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
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!email || !password) {
      setError("Email and password are required.");
      setLoading(false);
      return;
    }

    const action =
      mode === "signUp"
        ? authService.signUpWithEmail(email, password)
        : authService.signInWithEmail(email, password);

    const { data, error: authError } = await action;
    if (authError) {
      setError(authError.message);
    } else if (mode === "signUp" && !data.session) {
      setMessage("Check your inbox for a link to confirm your email.");
    }

    setLoading(false);
  };

  const handleRequestPasswordReset = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!email) {
      setError("Email is required.");
      setLoading(false);
      return;
    }

    const { error: resetError } = await authService.requestPasswordReset(
      email,
      `${window.location.origin}/auth`
    );

    if (resetError) {
      setError(resetError.message);
    } else {
      setMessage("If there’s an account with that email, you’ll get a link to reset your password.");
    }

    setLoading(false);
  };

  const handleUpdatePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError(null);
    setMessage(null);

    if (!password) {
      setError("New password is required.");
      setLoading(false);
      return;
    }

    const { error: updateError } = await authService.updatePassword(password);

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    await authService.signOut();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`
    );
    setPassword("");
    setMode("signIn");
    setMessage("Password updated. Sign in with your new password.");
    setLoading(false);
  };

  return (
    <main className="auth-page">
      <LoadingModal
        open={loading}
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
                <button type="submit" className="btn btn--primary" disabled={loading}>
                  {loading ? "Updating..." : "Update password"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setMode("signIn");
                    setPassword("");
                    setError(null);
                    setMessage(null);
                  }}
                  disabled={loading}
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
                <button type="submit" className="btn btn--primary" disabled={loading}>
                  {loading ? "Sending..." : "Send reset link"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost"
                  onClick={() => {
                    setMode("signIn");
                    setError(null);
                    setMessage(null);
                  }}
                  disabled={loading}
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
                <button type="submit" className="btn btn--primary btn--small" disabled={loading}>
                  {mode === "signUp" ? "Sign up" : "Sign in"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => {
                    setMode(mode === "signUp" ? "signIn" : "signUp");
                    setError(null);
                    setMessage(null);
                  }}
                  disabled={loading}
                >
                  {mode === "signUp" ? "Sign in" : "Sign up"}
                </button>
                <button
                  type="button"
                  className="btn btn--ghost btn--small"
                  onClick={() => {
                    setMode("resetRequest");
                    setPassword("");
                    setError(null);
                    setMessage(null);
                  }}
                  disabled={loading}
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
