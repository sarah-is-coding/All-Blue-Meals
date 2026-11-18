import { beforeEach, describe, expect, it, vi } from "vitest";

const { auth } = vi.hoisted(() => ({
  auth: {
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    updateUser: vi.fn(),
    signOut: vi.fn(),
  },
}));

vi.mock("../../../lib/supabaseClient", () => ({ supabase: { auth } }));

import { authService } from "../../../features/auth/api";

beforeEach(() => {
  vi.clearAllMocks();
  for (const fn of Object.values(auth)) fn.mockResolvedValue({ data: {}, error: null });
});

describe("authService", () => {
  it("signs in with email and password", async () => {
    await authService.signInWithEmail("me@example.com", "secret");
    expect(auth.signInWithPassword).toHaveBeenCalledWith({ email: "me@example.com", password: "secret" });
  });

  // The confirmation email must link back to this site; without
  // emailRedirectTo Supabase used the project's Site URL, which didn't open.
  it("signs up with email and password, confirming back to the given page", async () => {
    await authService.signUpWithEmail("me@example.com", "secret", "https://app.example/auth");
    expect(auth.signUp).toHaveBeenCalledWith({
      email: "me@example.com",
      password: "secret",
      options: { emailRedirectTo: "https://app.example/auth" },
    });
  });

  it("requests a password reset that returns to the given page", async () => {
    await authService.requestPasswordReset("me@example.com", "https://app.example/reset");
    expect(auth.resetPasswordForEmail).toHaveBeenCalledWith("me@example.com", {
      redirectTo: "https://app.example/reset",
    });
  });

  it("updates the signed-in user's password", async () => {
    await authService.updatePassword("new-secret");
    expect(auth.updateUser).toHaveBeenCalledWith({ password: "new-secret" });
  });

  it("signs out", async () => {
    await authService.signOut();
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("passes Supabase's result through, errors included", async () => {
    const failure = { data: { user: null, session: null }, error: { message: "Invalid login credentials" } };
    auth.signInWithPassword.mockResolvedValue(failure);
    await expect(authService.signInWithEmail("me@example.com", "wrong")).resolves.toBe(failure);
  });
});
