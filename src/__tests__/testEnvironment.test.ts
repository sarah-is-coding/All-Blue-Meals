// Guards the test setup itself: tests must never talk to the real Supabase
// project configured in a developer's .env (see test.env in vite.config.ts).
describe("test environment", () => {
  it("uses placeholder Supabase settings, not the real project from .env", () => {
    expect(import.meta.env.VITE_SUPABASE_URL).toBe("http://supabase.test.invalid");
    expect(import.meta.env.VITE_SUPABASE_ANON_KEY).toBe("test-anon-key");
  });
});
