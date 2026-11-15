import { describeAuthLinkError, parseAuthRedirect } from "../../../../features/auth/utils/authRedirect";

describe("parseAuthRedirect", () => {
  it("detects a password-reset link", () => {
    expect(parseAuthRedirect("#access_token=abc&refresh_token=def&type=recovery")).toEqual({
      kind: "recovery",
    });
  });

  it("detects an expired link and explains it", () => {
    const result = parseAuthRedirect(
      "#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb="
    );
    expect(result).toEqual({
      kind: "error",
      code: "otp_expired",
      message: expect.stringContaining("expired or was already used"),
    });
  });

  it("falls back to Supabase's description for other errors", () => {
    expect(parseAuthRedirect("#error=server_error&error_description=Something+broke")).toEqual({
      kind: "error",
      code: "server_error",
      message: "Something broke",
    });
  });

  it("returns null when the URL has nothing auth-related", () => {
    expect(parseAuthRedirect("")).toBeNull();
    expect(parseAuthRedirect("#section-2")).toBeNull();
    expect(parseAuthRedirect("#access_token=abc&type=signup")).toBeNull();
  });
});

describe("describeAuthLinkError", () => {
  it("has a generic message when there is no description", () => {
    expect(describeAuthLinkError("unknown", null)).toBe(
      "This email link didn't work. Please try again."
    );
  });
});
