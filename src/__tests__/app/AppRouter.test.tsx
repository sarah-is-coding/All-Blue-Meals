import { useState } from "react";
import { fireEvent, screen } from "@testing-library/react";
// Components here use mutations, so they render inside a query provider.
import { renderWithProviders as render } from "../utils/renderWithProviders";
import type { Session } from "@supabase/supabase-js";
import AppRouter from "../../app/AppRouter";
import { PreferencesContext } from "../../lib/preferences/preferencesContext";
import { DEFAULT_PREFERENCES } from "../../lib/preferences/types";

// AppRouter imports every page; keep them off the network and env-free.
vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }));
vi.mock("../../app/components/AppWorkspaceLayout", () => ({
  default: () => <p>Workspace</p>,
}));

const session = { user: { id: "user-1" } } as Session;

const renderAt = (path: string, props: Partial<Parameters<typeof AppRouter>[0]> = {}) => {
  window.history.replaceState(null, "", path);
  return render(<AppRouter session={null} authReady {...props} />);
};

describe("AppRouter — preferences", () => {
  it("waits for the user's preferences before showing the app", () => {
    window.history.replaceState(null, "", "/");
    render(
      <PreferencesContext.Provider value={{ preferences: DEFAULT_PREFERENCES, ready: false }}>
        <AppRouter session={session} authReady />
      </PreferencesContext.Provider>
    );
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(screen.getByText("Loading your session...")).toBeInTheDocument();
  });

  it("has a Preferences page", () => {
    renderAt("/preferences", { session });
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/preferences");
  });
});

// App pages live at the site root (they used to be under /app).
describe("AppRouter — app pages at the root", () => {
  it("shows the landing page at / when signed out", () => {
    renderAt("/");
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Sign In" }).length).toBeGreaterThan(0);
    expect(window.location.pathname).toBe("/");
  });

  it("shows the app at / when signed in", () => {
    renderAt("/", { session });
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("sends a signed-out visitor from an app page to sign in", () => {
    renderAt("/recipes/r-1");
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth");
  });

  it("redirects old /app links to the same page without /app", () => {
    renderAt("/app/recipes/r-1#notes", { session });
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/recipes/r-1");
    expect(window.location.hash).toBe("#notes");
  });

  it("redirects /app itself to the home page", () => {
    renderAt("/app", { session });
    expect(window.location.pathname).toBe("/");
  });
});

describe("AppRouter — password recovery", () => {
  it("sends a signed-in user from /auth to the app", () => {
    renderAt("/auth", { session });
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/");
  });

  it("keeps a user who followed a reset link on the new-password form", () => {
    renderAt("/auth", { session, passwordRecovery: true });
    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth");
  });

  it("does not let a recovering user into the app before setting a password", () => {
    renderAt("/", { session, passwordRecovery: true });
    expect(screen.queryByText("Workspace")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument();
  });

  it("shows a failed link's message on the sign-in page", () => {
    renderAt("/auth", { linkError: "This email link has expired or was already used." });
    expect(screen.getByText("This email link has expired or was already used.")).toBeInTheDocument();
  });
});

describe("AppRouter — failed email link message", () => {
  const MESSAGE = "This email link has expired or was already used.";

  // Mirrors App: the session hook forgets the message once AuthPage shows it.
  function AppWithLinkError() {
    const [linkError, setLinkError] = useState<string | null>(MESSAGE);
    return (
      <AppRouter
        session={null}
        authReady
        linkError={linkError}
        onLinkErrorShown={() => setLinkError(null)}
      />
    );
  }

  it("shows the message once, not every time the sign-in page opens", () => {
    window.history.replaceState(null, "", "/auth");
    render(<AppWithLinkError />);
    expect(screen.getByText(MESSAGE)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("link", { name: "Back to home" }));
    fireEvent.click(screen.getAllByRole("link", { name: "Sign In" })[0]);

    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText(MESSAGE)).not.toBeInTheDocument();
  });
});
