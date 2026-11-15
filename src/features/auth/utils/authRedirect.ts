// What an email link (password reset, sign-up confirmation) told us when it
// redirected back to the app. Supabase puts the result in the URL hash:
//   success: #access_token=...&type=recovery   (the client then clears the hash)
//   failure: #error=access_denied&error_code=otp_expired&error_description=...
export type AuthRedirect =
  | { kind: "recovery" }
  | { kind: "error"; code: string; message: string };

export function parseAuthRedirect(hash: string): AuthRedirect | null {
  const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);

  const code = params.get("error_code") ?? params.get("error");
  if (code) {
    return { kind: "error", code, message: describeAuthLinkError(code, params.get("error_description")) };
  }
  if (params.get("type") === "recovery") {
    return { kind: "recovery" };
  }
  return null;
}

export function describeAuthLinkError(code: string, description: string | null): string {
  if (code === "otp_expired") {
    return (
      "This email link has expired or was already used. " +
      "If you were resetting your password, choose “Forgot password?” to get a new link, " +
      "and use only the newest email."
    );
  }
  return description || "This email link didn't work. Please try again.";
}
