import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import AdSlot from "../../components/ads/AdSlot";
import LoadingModal from "../../components/feedback/LoadingModal";
import { authService } from "../../features/auth/api";
import { clearRecipeListViewState } from "../../features/recipes/utils/recipeListViewState";

// The same short names in the desktop header and the mobile bottom bar.
const appNavItems = [
  { label: "Home", to: "/", end: true },
  { label: "Recipes", to: "/recipes" },
  { label: "Plans", to: "/meal-plans" },
  { label: "Grocery", to: "/grocery" },
];

export default function AppWorkspaceLayout() {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!location.pathname.startsWith("/recipes")) {
      clearRecipeListViewState();
    }
  }, [location.pathname]);

  const handleSignOut = async () => {
    setLoading(true);
    setError(null);
    const { error: signOutError } = await authService.signOut();
    if (signOutError) {
      setError(signOutError.message);
    }
    setLoading(false);
  };

  return (
    <main className="workspace">
      <LoadingModal
        open={loading}
        title="Signing you out..."
        message="Wrapping up your session. You will be redirected shortly."
      />

      <div className="workspace-layout">
        <aside className="workspace-side workspace-side--left" aria-label="Sponsored">
          <AdSlot size="skyscraper" label="Sponsored" />
        </aside>

        <div className="workspace-main">
          <header className="workspace-topbar">
            <Link className="workspace-brand" to="/">
              <img className="brand__logo" src="/favicon.svg" alt="" width={26} height={26} />
              All Blue Meals
            </Link>

            <nav className="workspace-nav workspace-nav--desktop" aria-label="Primary">
              {appNavItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) =>
                    `workspace-nav__link${isActive ? " workspace-nav__link--active" : ""}`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="workspace__actions">
              <NavLink
                to="/preferences"
                className={({ isActive }) =>
                  `workspace__preferences-link${isActive ? " workspace__preferences-link--active" : ""}`
                }
                aria-label="Preferences"
                title="Preferences"
              >
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false">
                  <circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" strokeWidth="2" />
                  <path
                    d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </NavLink>
              <button className="btn btn--primary" onClick={handleSignOut} disabled={loading}>
                {loading ? "Signing out..." : "Sign out"}
              </button>
            </div>
          </header>

          <section className="workspace__header-sponsor" aria-label="Sponsored">
            <AdSlot size="banner" label="Sponsored" />
          </section>

          {error ? <p className="error workspace__error">{error}</p> : null}

          <Outlet />

          <nav className="workspace-bottom-nav" aria-label="Primary">
            {appNavItems.map((item) => (
              <NavLink
                key={`mobile-${item.to}`}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `workspace-nav__link${isActive ? " workspace-nav__link--active" : ""}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <footer className="workspace__sponsor">
            <AdSlot size="leaderboard" label="Sponsored" className="ad-slot--desktop-only" />
            <AdSlot size="banner" label="Sponsored" className="ad-slot--mobile-only" />
          </footer>
        </div>

        <aside className="workspace-side workspace-side--right" aria-label="Sponsored">
          <AdSlot size="skyscraper" label="Sponsored" />
        </aside>
      </div>
    </main>
  );
}
