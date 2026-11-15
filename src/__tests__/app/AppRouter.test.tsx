import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { Session } from "@supabase/supabase-js";
import AppRouter from "../../app/AppRouter";

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

describe("AppRouter — password recovery", () => {
  it("sends a signed-in user from /auth to the app", () => {
    renderAt("/auth", { session });
    expect(screen.getByText("Workspace")).toBeInTheDocument();
    expect(window.location.pathname).toBe("/app");
  });

  it("keeps a user who followed a reset link on the new-password form", () => {
    renderAt("/auth", { session, passwordRecovery: true });
    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument();
    expect(window.location.pathname).toBe("/auth");
  });

  it("does not let a recovering user into the app before setting a password", () => {
    renderAt("/app", { session, passwordRecovery: true });
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
