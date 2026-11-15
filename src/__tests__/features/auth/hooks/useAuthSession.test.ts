import { act, renderHook, waitFor } from "@testing-library/react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { useAuthSession } from "../../../../features/auth/hooks/useAuthSession";

type AuthListener = (event: AuthChangeEvent, session: Session | null) => void;
let listener: AuthListener | null = null;

vi.mock("../../../../lib/supabaseClient", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn((callback: AuthListener) => {
        listener = callback;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
  },
}));

const fakeSession = { user: { id: "user-1" } } as Session;

const setHash = (hash: string) => window.history.replaceState(null, "", `/auth${hash}`);

describe("useAuthSession", () => {
  beforeEach(() => {
    listener = null;
    setHash("");
  });

  it("starts with no session and becomes ready", async () => {
    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(result.current.authReady).toBe(true));
    expect(result.current).toMatchObject({ session: null, passwordRecovery: false, linkError: null });
  });

  it("enters password recovery from a reset link in the URL", () => {
    setHash("#access_token=abc&type=recovery");
    const { result } = renderHook(() => useAuthSession());
    expect(result.current.passwordRecovery).toBe(true);
  });

  it("enters password recovery when Supabase reports PASSWORD_RECOVERY", async () => {
    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(listener).not.toBeNull());

    act(() => listener?.("PASSWORD_RECOVERY", fakeSession));

    expect(result.current.passwordRecovery).toBe(true);
    expect(result.current.session).toBe(fakeSession);
  });

  it("leaves password recovery on sign-out", async () => {
    setHash("#access_token=abc&type=recovery");
    const { result } = renderHook(() => useAuthSession());
    await waitFor(() => expect(listener).not.toBeNull());

    act(() => listener?.("SIGNED_OUT", null));

    expect(result.current.passwordRecovery).toBe(false);
  });

  it("exposes a failed link's message and removes the error from the URL", () => {
    setHash("#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid");
    const { result } = renderHook(() => useAuthSession());

    expect(result.current.linkError).toMatch(/expired or was already used/);
    expect(result.current.passwordRecovery).toBe(false);
    expect(window.location.hash).toBe("");
    expect(window.location.pathname).toBe("/auth");
  });

  it("forgets the link message once dismissed", () => {
    setHash("#error=access_denied&error_code=otp_expired");
    const { result } = renderHook(() => useAuthSession());
    expect(result.current.linkError).not.toBeNull();

    act(() => result.current.dismissLinkError());
    expect(result.current.linkError).toBeNull();
  });
});
