import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import AuthPage from "../../../../features/auth/pages/AuthPage";

vi.mock("../../../../features/auth/api", () => ({
  authService: {
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
    signOut: vi.fn(),
  },
}));

import { authService } from "../../../../features/auth/api";

const T = { timeout: 1500 };

const renderPage = (props: Parameters<typeof AuthPage>[0] = {}) =>
  render(
    <MemoryRouter>
      <AuthPage {...props} />
    </MemoryRouter>
  );

describe("AuthPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the sign-in form by default", () => {
    renderPage();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("explains a failed email link on the sign-in form", () => {
    renderPage({ linkError: "This email link has expired or was already used." });
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("This email link has expired or was already used.")).toBeInTheDocument();
  });

  it("reports the link message as shown, and keeps it on screen after the parent forgets it", () => {
    const onLinkErrorShown = vi.fn();
    const { rerender } = renderPage({ linkError: "Link expired.", onLinkErrorShown });
    expect(onLinkErrorShown).toHaveBeenCalledTimes(1);

    rerender(
      <MemoryRouter>
        <AuthPage linkError={null} onLinkErrorShown={onLinkErrorShown} />
      </MemoryRouter>
    );
    expect(screen.getByText("Link expired.")).toBeInTheDocument();
  });

  it("clears the link message once the user acts", () => {
    renderPage({ linkError: "Link expired." });
    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    expect(screen.queryByText("Link expired.")).not.toBeInTheDocument();
  });

  it("shows the new-password form after a valid reset link", () => {
    renderPage({ recovery: true });
    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument();
    expect(screen.getByText(/enter a new password/i)).toBeInTheDocument();
  });

  it("switches to the new-password form when recovery is confirmed after loading", () => {
    const { rerender } = renderPage();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <AuthPage recovery />
      </MemoryRouter>
    );
    expect(screen.getByRole("heading", { name: "Set a new password" })).toBeInTheDocument();
  });

  it("updates the password, signs out, and asks the user to sign in again", async () => {
    vi.mocked(authService.updatePassword).mockResolvedValue({ error: null } as never);
    vi.mocked(authService.signOut).mockResolvedValue({ error: null });
    renderPage({ recovery: true });

    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "new-secret-123" } });
    fireEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(
      await screen.findByText("Password updated. Sign in with your new password.", undefined, T)
    ).toBeInTheDocument();
    expect(authService.updatePassword).toHaveBeenCalledWith("new-secret-123");
    expect(authService.signOut).toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
  });

  it("requests a reset link from the forgot-password form", async () => {
    vi.mocked(authService.requestPasswordReset).mockResolvedValue({ data: {}, error: null } as never);
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: "Forgot password?" }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));

    await waitFor(
      () =>
        expect(authService.requestPasswordReset).toHaveBeenCalledWith(
          "me@example.com",
          `${window.location.origin}/auth`
        ),
      T
    );
    expect(await screen.findByText(/reset link has been sent/i, undefined, T)).toBeInTheDocument();
  });
});
