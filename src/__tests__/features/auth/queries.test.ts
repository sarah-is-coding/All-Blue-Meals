import { act, waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "../../utils/renderWithProviders";
import {
  useRequestPasswordReset,
  useSignIn,
  useSignOut,
  useSignUp,
  useUpdatePassword,
} from "../../../features/auth/queries";

vi.mock("../../../features/auth/api", () => ({
  authService: {
    signInWithEmail: vi.fn(),
    signUpWithEmail: vi.fn(),
    requestPasswordReset: vi.fn(),
    updatePassword: vi.fn(),
    signOut: vi.fn(),
  },
}));

import { authService } from "../../../features/auth/api";

const auth = vi.mocked(authService);
const authError = (message: string) => ({ message }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  auth.signOut.mockResolvedValue({ error: null });
});

describe("auth mutations", () => {
  it("useSignIn returns the session data on success", async () => {
    const data = { session: { access_token: "t" }, user: { id: "u1" } };
    auth.signInWithEmail.mockResolvedValue({ data, error: null } as never);
    const { result } = renderHookWithProviders(() => useSignIn());

    let returned: unknown;
    await act(async () => {
      returned = await result.current.mutateAsync({ email: "a@b.c", password: "pw" });
    });

    expect(auth.signInWithEmail).toHaveBeenCalledWith("a@b.c", "pw");
    expect(returned).toEqual(data);
  });

  // Supabase returns auth errors instead of throwing; the mutation turns
  // them into its own error so the form can show them.
  it("useSignIn exposes Supabase's error as the mutation error", async () => {
    auth.signInWithEmail.mockResolvedValue({ data: {}, error: authError("Invalid login credentials") } as never);
    const { result } = renderHookWithProviders(() => useSignIn());

    await act(async () => {
      await expect(result.current.mutateAsync({ email: "a@b.c", password: "x" })).rejects.toThrow(
        "Invalid login credentials"
      );
    });
    await waitFor(() => expect(result.current.error?.message).toBe("Invalid login credentials"));
  });

  it("useSignUp passes the confirmation link through", async () => {
    auth.signUpWithEmail.mockResolvedValue({ data: { session: null }, error: null } as never);
    const { result } = renderHookWithProviders(() => useSignUp());

    await act(async () => {
      await result.current.mutateAsync({ email: "a@b.c", password: "pw", emailRedirectTo: "https://x/auth" });
    });

    expect(auth.signUpWithEmail).toHaveBeenCalledWith("a@b.c", "pw", "https://x/auth");
  });

  it("useRequestPasswordReset sends the reset link", async () => {
    auth.requestPasswordReset.mockResolvedValue({ data: {}, error: null } as never);
    const { result } = renderHookWithProviders(() => useRequestPasswordReset());

    await act(async () => {
      await result.current.mutateAsync({ email: "a@b.c", redirectTo: "https://x/auth" });
    });

    expect(auth.requestPasswordReset).toHaveBeenCalledWith("a@b.c", "https://x/auth");
  });

  it("useUpdatePassword sets the password, then signs out", async () => {
    auth.updatePassword.mockResolvedValue({ data: {}, error: null } as never);
    const { result } = renderHookWithProviders(() => useUpdatePassword());

    await act(async () => {
      await result.current.mutateAsync("new-pw");
    });

    expect(auth.updatePassword).toHaveBeenCalledWith("new-pw");
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("useUpdatePassword doesn't sign out when the update fails", async () => {
    auth.updatePassword.mockResolvedValue({ data: {}, error: authError("Password too short") } as never);
    const { result } = renderHookWithProviders(() => useUpdatePassword());

    await act(async () => {
      await expect(result.current.mutateAsync("x")).rejects.toThrow("Password too short");
    });
    expect(auth.signOut).not.toHaveBeenCalled();
  });

  it("useSignOut reports a failed sign-out", async () => {
    auth.signOut.mockResolvedValue({ error: authError("Network error") } as never);
    const { result } = renderHookWithProviders(() => useSignOut());

    act(() => result.current.mutate());

    await waitFor(() => expect(result.current.error?.message).toBe("Network error"));
  });
});
