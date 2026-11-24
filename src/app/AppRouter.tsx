import type { Session } from "@supabase/supabase-js";
import { lazy, useCallback, useEffect, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import AuthPage from "../features/auth/pages/AuthPage";
import LoadingModal from "../components/feedback/LoadingModal";
import { usePreferencesReady } from "../lib/preferences/preferencesContext";
import AppWorkspaceLayout from "./components/AppWorkspaceLayout";
import AppHomePage from "./pages/AppHomePage";
import LandingPage from "./pages/LandingPage";

// Pages a visitor or a just-signed-in user sees first (landing, sign-in, the
// app shell, and home) are in the main bundle. The rest load when first
// opened, so phones don't download the whole app up front (principles/vite.md
// §3). Moving between pages is a transition, so the current page stays on
// screen while the next one's code loads; AppWorkspaceLayout's Suspense
// fallback only shows when a page is opened directly from a link.
const RecipesPage = lazy(() => import("../features/recipes/pages/RecipesPage"));
const RecipeCreatePage = lazy(() => import("../features/recipes/pages/RecipeCreatePage"));
const RecipeImportPage = lazy(() => import("../features/recipes/pages/RecipeImportPage"));
const RecipeGeneratePage = lazy(() => import("../features/recipes/pages/RecipeGeneratePage"));
const RecipeDetailPage = lazy(() => import("../features/recipes/pages/RecipeDetailPage"));
const MealPlansPage = lazy(() => import("../features/meal-plans/pages/MealPlansPage"));
const SavedMealPlansPage = lazy(() => import("../features/meal-plans/pages/SavedMealPlansPage"));
const GroceryPage = lazy(() => import("../features/grocery/pages/GroceryPage"));
const PreferencesPage = lazy(() => import("../features/preferences/pages/PreferencesPage"));

// If the home page never reports in (e.g. it isn't the page that opened),
// stop blocking the app with the sign-in modal after this long.
const SIGN_IN_MODAL_MAX_MS = 15_000;

type AppRouterProps = {
  session: Session | null;
  authReady: boolean;
  /** Signed in via a password-reset link: keep the user on the reset form
   *  until they set a new password, instead of sending them into the app. */
  passwordRecovery?: boolean;
  /** Message for an email link that failed (e.g. expired), shown on /auth. */
  linkError?: string | null;
  /** Called once AuthPage has shown `linkError`, so it isn't shown again. */
  onLinkErrorShown?: () => void;
};

/** Signed out: the landing page at "/", sign-in for any app page. A user
 *  who followed a reset link goes to the new-password form. */
function SignedOutRoot({ passwordRecovery }: { passwordRecovery: boolean }) {
  const { pathname } = useLocation();
  if (passwordRecovery || pathname !== "/") return <Navigate to="/auth" replace />;
  return <LandingPage />;
}

/** "/app/recipes/1#notes" → "/recipes/1#notes" (and "/app" → "/"). */
function LegacyAppRedirect() {
  const { pathname, search, hash } = useLocation();
  return <Navigate to={`${pathname.replace(/^\/app/, "") || "/"}${search}${hash}`} replace />;
}

function SessionLoading() {
  return (
    <main className="status-page">
      <p>Loading your session...</p>
    </main>
  );
}

export default function AppRouter({
  session,
  authReady,
  passwordRecovery = false,
  linkError = null,
  onLinkErrorShown,
}: AppRouterProps) {
  const signedIn = session !== null && !passwordRecovery;
  // App pages wait for the user's preferences (e.g. which day weeks start on),
  // so the planner never draws one week layout and then jumps to another.
  const preferencesReady = usePreferencesReady();

  // The sign-in loading modal lives here, outside the routes, so it stays up
  // (without flickering) from "Sign in" until the home page has loaded, even
  // though the sign-in page is replaced by the app in between. Null: hidden.
  const [signInMessage, setSignInMessage] = useState<string | null>(null);
  const finishSignIn = useCallback(() => setSignInMessage(null), []);

  const waitingForHome = signedIn && signInMessage !== null;
  useEffect(() => {
    if (!waitingForHome) return;
    const timer = window.setTimeout(finishSignIn, SIGN_IN_MODAL_MAX_MS);
    return () => window.clearTimeout(timer);
  }, [waitingForHome, finishSignIn]);

  if (!authReady) return <SessionLoading />;

  return (
    <BrowserRouter>
      <LoadingModal
        open={signInMessage !== null}
        title="Please wait..."
        message={signedIn ? "Loading your meals…" : (signInMessage ?? "")}
      />
      <Routes>
        {/* One layout route at "/" for the whole signed-in app, so moving
            between pages keeps the same layout. Signed out, "/" is the landing
            page and every other page sends you to sign in (SignedOutRoot
            renders no outlet, so no app page shows). */}
        <Route
          path="/"
          element={
            !signedIn ? (
              <SignedOutRoot passwordRecovery={passwordRecovery} />
            ) : preferencesReady ? (
              <AppWorkspaceLayout />
            ) : (
              <SessionLoading />
            )
          }
        >
          <Route index element={<AppHomePage onReady={finishSignIn} />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="recipes/new" element={<RecipeCreatePage />} />
          <Route path="recipes/import" element={<RecipeImportPage />} />
          <Route path="recipes/generate" element={<RecipeGeneratePage />} />
          <Route path="recipes/:recipeId" element={<RecipeDetailPage />} />
          <Route path="meal-plans" element={<MealPlansPage />} />
          <Route path="saved-meal-plans" element={<SavedMealPlansPage />} />
          <Route path="grocery" element={<GroceryPage />} />
          <Route path="preferences" element={<PreferencesPage />} />
        </Route>
        <Route
          path="/auth"
          element={
            signedIn ? (
              <Navigate to="/" replace />
            ) : (
              <AuthPage
                recovery={passwordRecovery}
                linkError={linkError}
                onLinkErrorShown={onLinkErrorShown}
                onSignInProgress={setSignInMessage}
              />
            )
          }
        />
        {/* The app used to live under /app; keep old bookmarks and shared links working. */}
        <Route path="/app/*" element={<LegacyAppRedirect />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
