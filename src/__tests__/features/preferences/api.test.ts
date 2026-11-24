import {
  getUserPreferences,
  LOAD_PREFERENCES_ERROR,
  SAVE_PREFERENCES_ERROR,
  saveUserPreferences,
} from "../../../features/preferences/api";
import { DEFAULT_PREFERENCES } from "../../../lib/preferences/types";

vi.mock("../../../lib/supabaseClient", () => {
  const builder: Record<string, ReturnType<typeof vi.fn>> = {};
  const chained = ["from", "select", "upsert", "insert", "update", "delete", "eq"];
  for (const method of chained) {
    builder[method] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockResolvedValue({ data: null, error: null });
  builder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  return { supabase: builder };
});

import { supabase } from "../../../lib/supabaseClient";

const db = supabase as unknown as Record<string, ReturnType<typeof vi.fn>>;
const COLUMNS = "week_starts_on,plan_cadence_unit,plan_cadence_count";

beforeEach(() => {
  vi.clearAllMocks();
  for (const method of ["from", "select", "upsert", "insert", "update", "delete", "eq"]) {
    db[method]!.mockReturnValue(db);
  }
  db.single!.mockResolvedValue({ data: null, error: null });
  db.maybeSingle!.mockResolvedValue({ data: null, error: null });
});

describe("getUserPreferences", () => {
  it("reads the user's profile row and maps it", async () => {
    db.maybeSingle!.mockResolvedValue({
      data: { week_starts_on: 1, plan_cadence_unit: "week", plan_cadence_count: 2 },
      error: null,
    });

    await expect(getUserPreferences("user-1")).resolves.toEqual({
      weekStartsOn: 1,
      planningCadence: { unit: "week", count: 2 },
    });
    expect(db.from).toHaveBeenCalledWith("profiles");
    expect(db.select).toHaveBeenCalledWith(COLUMNS);
    expect(db.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("is the defaults (Sunday weeks, every week) when the user has no row yet", async () => {
    await expect(getUserPreferences("user-1")).resolves.toEqual(DEFAULT_PREFERENCES);
    expect(DEFAULT_PREFERENCES).toEqual({ weekStartsOn: 0, planningCadence: { unit: "week", count: 1 } });
  });

  it("falls back to the default cadence for values the app doesn't know", async () => {
    db.maybeSingle!.mockResolvedValue({
      data: { week_starts_on: 0, plan_cadence_unit: "year", plan_cadence_count: 1 },
      error: null,
    });
    await expect(getUserPreferences("user-1")).resolves.toEqual(DEFAULT_PREFERENCES);

    db.maybeSingle!.mockResolvedValue({
      data: { week_starts_on: 0, plan_cadence_unit: "month", plan_cadence_count: 12 },
      error: null,
    });
    await expect(getUserPreferences("user-1")).resolves.toEqual(DEFAULT_PREFERENCES);
  });

  // A friendly message, not the database's (e.g. a missing column before the
  // migration is applied); the database error is kept as the cause.
  it("throws a friendly error, keeping the database error as its cause", async () => {
    const dbError = { code: "42703", message: "column profiles.week_starts_on does not exist" };
    db.maybeSingle!.mockResolvedValue({ data: null, error: dbError });
    const failure = await getUserPreferences("user-1").catch((error: Error) => error);
    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(LOAD_PREFERENCES_ERROR);
    expect((failure as Error).cause).toBe(dbError);
  });
});

describe("saveUserPreferences", () => {
  it("creates or updates the user's row and returns what was saved", async () => {
    db.single!.mockResolvedValue({
      data: { week_starts_on: 1, plan_cadence_unit: "month", plan_cadence_count: 1 },
      error: null,
    });

    const saved = await saveUserPreferences("user-1", {
      weekStartsOn: 1,
      planningCadence: { unit: "month", count: 1 },
    });

    expect(db.from).toHaveBeenCalledWith("profiles");
    expect(db.upsert).toHaveBeenCalledWith(
      { user_id: "user-1", week_starts_on: 1, plan_cadence_unit: "month", plan_cadence_count: 1 },
      { onConflict: "user_id" }
    );
    expect(db.select).toHaveBeenCalledWith(COLUMNS);
    expect(saved).toEqual({ weekStartsOn: 1, planningCadence: { unit: "month", count: 1 } });
  });

  it("refuses a cadence outside the limits without calling the database", async () => {
    await expect(
      saveUserPreferences("user-1", { weekStartsOn: 0, planningCadence: { unit: "week", count: 13 } })
    ).rejects.toThrow("Choose between 1 and 12 weeks.");
    await expect(
      saveUserPreferences("user-1", { weekStartsOn: 0, planningCadence: { unit: "day", count: 1.5 } })
    ).rejects.toThrow();
    expect(db.upsert).not.toHaveBeenCalled();
  });

  it("throws a friendly error instead of the database's", async () => {
    db.single!.mockResolvedValue({ data: null, error: { message: "new row violates row-level security policy" } });
    await expect(saveUserPreferences("user-1", DEFAULT_PREFERENCES)).rejects.toThrow(SAVE_PREFERENCES_ERROR);
  });
});
