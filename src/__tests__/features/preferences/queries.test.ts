import { waitFor } from "@testing-library/react";
import {
  fetchUserPreferences,
  preferencesKeys,
  usePreferencesActions,
  useUserPreferencesQuery,
} from "../../../features/preferences/queries";
import { DEFAULT_PREFERENCES, type UserPreferences } from "../../../lib/preferences/types";
import { createTestQueryClient, renderHookWithProviders, TEST_USER_ID } from "../../utils/renderWithProviders";

vi.mock("../../../features/preferences/api", () => ({
  getUserPreferences: vi.fn(),
  saveUserPreferences: vi.fn(),
}));

import { getUserPreferences, saveUserPreferences } from "../../../features/preferences/api";

const MONDAY_MONTHLY: UserPreferences = { weekStartsOn: 1, planningCadence: { unit: "month", count: 1 } };

beforeEach(() => vi.clearAllMocks());

describe("useUserPreferencesQuery", () => {
  it("is not ready while loading, then has the user's preferences", async () => {
    vi.mocked(getUserPreferences).mockResolvedValue(MONDAY_MONTHLY);
    const { result } = renderHookWithProviders(() => useUserPreferencesQuery());

    expect(result.current.ready).toBe(false);
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.preferences).toEqual(MONDAY_MONTHLY);
    expect(getUserPreferences).toHaveBeenCalledWith(TEST_USER_ID);
  });

  it("is ready with the defaults when loading fails, so the app isn't blocked", async () => {
    vi.mocked(getUserPreferences).mockRejectedValue(new Error("offline"));
    const { result } = renderHookWithProviders(() => useUserPreferencesQuery());

    await waitFor(() => expect(result.current.ready).toBe(true));
    expect(result.current.preferences).toEqual(DEFAULT_PREFERENCES);
    expect(result.current.error).toBe("offline");
  });

  it("is ready without loading anything when nobody is signed in", () => {
    const { result } = renderHookWithProviders(() => useUserPreferencesQuery(), { userId: null });
    expect(result.current.ready).toBe(true);
    expect(getUserPreferences).not.toHaveBeenCalled();
  });
});

describe("fetchUserPreferences", () => {
  it("loads and caches the preferences", async () => {
    vi.mocked(getUserPreferences).mockResolvedValue(MONDAY_MONTHLY);
    const client = createTestQueryClient();
    await expect(fetchUserPreferences(client, "user-1")).resolves.toEqual(MONDAY_MONTHLY);
    expect(client.getQueryData(preferencesKeys.user("user-1"))).toEqual(MONDAY_MONTHLY);
  });

  it("gives the defaults when they can't be loaded", async () => {
    vi.mocked(getUserPreferences).mockRejectedValue(new Error("offline"));
    await expect(fetchUserPreferences(createTestQueryClient(), "user-1")).resolves.toEqual(DEFAULT_PREFERENCES);
  });
});

describe("usePreferencesActions", () => {
  it("saves, then puts what was saved in the cache", async () => {
    vi.mocked(saveUserPreferences).mockResolvedValue(MONDAY_MONTHLY);
    const client = createTestQueryClient();
    const { result } = renderHookWithProviders(() => usePreferencesActions(), { client });

    await expect(result.current.save(MONDAY_MONTHLY)).resolves.toEqual(MONDAY_MONTHLY);
    expect(saveUserPreferences).toHaveBeenCalledWith(TEST_USER_ID, MONDAY_MONTHLY);
    expect(client.getQueryData(preferencesKeys.user(TEST_USER_ID))).toEqual(MONDAY_MONTHLY);
  });

  it("leaves the cache alone when saving fails", async () => {
    vi.mocked(saveUserPreferences).mockRejectedValue(new Error("Couldn't save your preferences. Try again."));
    const client = createTestQueryClient();
    client.setQueryData(preferencesKeys.user(TEST_USER_ID), DEFAULT_PREFERENCES);
    const { result } = renderHookWithProviders(() => usePreferencesActions(), { client });

    await expect(result.current.save(MONDAY_MONTHLY)).rejects.toThrow("Couldn't save");
    expect(client.getQueryData(preferencesKeys.user(TEST_USER_ID))).toEqual(DEFAULT_PREFERENCES);
  });
});
