import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Outlet } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import AppRouter from "../../app/AppRouter";

// The sign-in loading modal stays up from "Sign in" until the home page says
// it has loaded, across the switch from the sign-in page to the app.

vi.mock("../../lib/supabaseClient", () => ({ supabase: {} }));
vi.mock("../../app/components/AppWorkspaceLayout", () => ({ default: () => <Outlet /> }));
// Stands in for the home page: reports ready when the test says so.
vi.mock("../../app/pages/AppHomePage", () => ({
  default: ({ onReady }: { onReady?: () => void }) => (
    <button type="button" onClick={onReady}>
      Finish loading home
    </button>
  ),
}));
vi.mock("../../features/auth/api", () => ({
  authService: {
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
    signOut: vi.fn(),
  },
}));

import { authService } from "../../features/auth/api";

const T = { timeout: 1500 };
const session = { user: { id: "user-1" } } as Session;

type SignInResult = Awaited<ReturnType<typeof authService.signInWithEmail>>;

// Signs in on /auth. Like App, the test then passes the new session to the
// router (rerender keeps the router's state), which swaps in the app.
const signIn = () => {
  window.history.replaceState(null, "", "/auth");
  const { rerender } = render(<AppRouter session={null} authReady />);
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "me@example.com" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  return { setSession: (next: Session) => rerender(<AppRouter session={next} authReady />) };
};

describe("sign-in loading modal", () => {
  beforeEach(() => vi.clearAllMocks());

  it("stays up after signing in until the home page has loaded", async () => {
    let finishSignIn: (result: SignInResult) => void = () => {};
    vi.mocked(authService.signInWithEmail).mockImplementation(
      () => new Promise<SignInResult>((resolve) => (finishSignIn = resolve))
    );
    const { setSession } = signIn();

    // One modal, from the sign-in page's own copy.
    expect(await screen.findByText("Signing you in…", undefined, T)).toBeInTheDocument();
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);

    // Signed in: the app replaces the sign-in page, but the modal stays.
    setSession(session);
    finishSignIn({ data: { session, user: session.user }, error: null } as SignInResult);
    const finishHome = await screen.findByRole("button", { name: "Finish loading home" });
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Loading your meals…")).toBeInTheDocument();

    // Home has loaded: the modal goes.
    fireEvent.click(finishHome);
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(), T);
  });

  it("goes away and shows the error when sign-in fails", async () => {
    vi.mocked(authService.signInWithEmail).mockImplementation(
      () =>
        new Promise<SignInResult>((resolve) =>
          setTimeout(
            () => resolve({ data: { session: null, user: null }, error: { message: "Invalid login credentials" } } as SignInResult),
            400
          )
        )
    );
    signIn();

    expect(await screen.findByRole("alertdialog", undefined, T)).toBeInTheDocument();
    expect(await screen.findByText("Invalid login credentials", undefined, T)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(), T);
  });
});
