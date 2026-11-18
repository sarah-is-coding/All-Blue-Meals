import type { Session } from "@supabase/supabase-js";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import AuthPage from "../features/auth/pages/AuthPage";
import GroceryPage from "../features/grocery/pages/GroceryPage";
import MealPlansPage from "../features/meal-plans/pages/MealPlansPage";
import SavedMealPlansPage from "../features/meal-plans/pages/SavedMealPlansPage";
import RecipeCreatePage from "../features/recipes/pages/RecipeCreatePage";
import RecipeDetailPage from "../features/recipes/pages/RecipeDetailPage";
import RecipeGeneratePage from "../features/recipes/pages/RecipeGeneratePage";
import RecipeImportPage from "../features/recipes/pages/RecipeImportPage";
import RecipesPage from "../features/recipes/pages/RecipesPage";
import AppWorkspaceLayout from "./components/AppWorkspaceLayout";
import AppHomePage from "./pages/AppHomePage";
import LandingPage from "./pages/LandingPage";

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

export default function AppRouter({
  session,
  authReady,
  passwordRecovery = false,
  linkError = null,
  onLinkErrorShown,
}: AppRouterProps) {
  const signedIn = session !== null && !passwordRecovery;

  if (!authReady) {
    return (
      <main className="status-page">
        <p>Loading your session...</p>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/"
          element={
            signedIn ? (
              <Navigate to="/app" replace />
            ) : passwordRecovery ? (
              <Navigate to="/auth" replace />
            ) : (
              <LandingPage />
            )
          }
        />
        <Route
          path="/auth"
          element={
            signedIn ? (
              <Navigate to="/app" replace />
            ) : (
              <AuthPage
                recovery={passwordRecovery}
                linkError={linkError}
                onLinkErrorShown={onLinkErrorShown}
              />
            )
          }
        />
        <Route
          path="/app"
          element={signedIn ? <AppWorkspaceLayout /> : <Navigate to="/auth" replace />}
        >
          <Route index element={<AppHomePage />} />
          <Route path="recipes" element={<RecipesPage />} />
          <Route path="recipes/new" element={<RecipeCreatePage />} />
          <Route path="recipes/import" element={<RecipeImportPage />} />
          <Route path="recipes/generate" element={<RecipeGeneratePage />} />
          <Route path="recipes/:recipeId" element={<RecipeDetailPage />} />
          <Route path="meal-plans" element={<MealPlansPage />} />
          <Route path="saved-meal-plans" element={<SavedMealPlansPage />} />
          <Route path="grocery" element={<GroceryPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
