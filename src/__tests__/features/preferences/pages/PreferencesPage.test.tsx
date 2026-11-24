import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PreferencesPage from "../../../../features/preferences/pages/PreferencesPage";
import { preferencesKeys } from "../../../../features/preferences/queries";
import type { UserPreferences } from "../../../../lib/preferences/types";
import { createTestQueryClient, renderWithProviders, TEST_USER_ID } from "../../../utils/renderWithProviders";

vi.mock("../../../../features/preferences/api", () => ({
  getUserPreferences: vi.fn(),
  saveUserPreferences: vi.fn(),
}));

import { getUserPreferences, saveUserPreferences } from "../../../../features/preferences/api";

const T = { timeout: 1500 };

const renderPage = (stored: UserPreferences = { weekStartsOn: 0, planningCadence: { unit: "week", count: 1 } }) => {
  const client = createTestQueryClient();
  // As in the app: preferences are loaded before any app page opens.
  client.setQueryData(preferencesKeys.user(TEST_USER_ID), stored);
  renderWithProviders(<PreferencesPage />, { client });
  return { client };
};

const saveButton = () => screen.getByRole("button", { name: "Save preferences" });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getUserPreferences).mockResolvedValue({ weekStartsOn: 0, planningCadence: { unit: "week", count: 1 } });
  vi.mocked(saveUserPreferences).mockImplementation(async (_userId, preferences) => preferences);
});

describe("PreferencesPage", () => {
  it("shows the saved preferences in a Meal planning section, with nothing to save yet", () => {
    renderPage({ weekStartsOn: 1, planningCadence: { unit: "week", count: 2 } });

    expect(screen.getByRole("heading", { level: 1, name: "Preferences" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Meal planning" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Every 2 weeks" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Monday" })).toBeChecked();
    expect(saveButton()).toBeDisabled();
  });

  it("saves a quick choice and the week start, and updates the shared cache", async () => {
    const user = userEvent.setup();
    const { client } = renderPage();

    await user.click(screen.getByRole("radio", { name: "Every month" }));
    await user.click(screen.getByRole("radio", { name: "Monday" }));
    await user.click(saveButton());

    const expected = { weekStartsOn: 1, planningCadence: { unit: "month", count: 1 } };
    expect(saveUserPreferences).toHaveBeenCalledWith(TEST_USER_ID, expected);
    expect(await screen.findByText("Preferences saved.", undefined, T)).toBeInTheDocument();
    expect(client.getQueryData(preferencesKeys.user(TEST_USER_ID))).toEqual(expected);
    // Saved, so nothing left to save.
    expect(saveButton()).toBeDisabled();
  });

  it("walks a custom cadence: pick Custom, fix an invalid number, save it", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("radio", { name: "Custom" }));
    const count = screen.getByRole("spinbutton", { name: "How many" });
    fireEvent.change(count, { target: { value: "120" } });
    // The unit is a menu like the Recipes page's Add Recipe menu (it was a native select).
    await user.click(screen.getByRole("button", { name: "Unit: weeks" }));
    await user.click(screen.getByRole("menuitemradio", { name: "days" }));
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unit: days" })).toBeInTheDocument();

    expect(screen.getByRole("alert")).toHaveTextContent("Enter a whole number from 1 to 90 days.");
    expect(saveButton()).toBeDisabled();

    fireEvent.change(count, { target: { value: "10" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(saveButton());

    expect(saveUserPreferences).toHaveBeenCalledWith(TEST_USER_ID, {
      weekStartsOn: 0,
      planningCadence: { unit: "day", count: 10 },
    });
  });

  it("explains when the saved preferences couldn't load, without database jargon", async () => {
    vi.mocked(getUserPreferences).mockRejectedValue(new Error("Couldn't load your preferences."));
    renderWithProviders(<PreferencesPage />);

    const alert = await screen.findByRole("alert", undefined, { timeout: 3000 });
    expect(alert).toHaveTextContent("Couldn't load your saved preferences, so the defaults are shown below.");
    // The defaults are on the form, ready to save.
    expect(screen.getByRole("radio", { name: "Every week" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Sunday" })).toBeChecked();
  });

  it("shows a friendly error when saving fails, and keeps the choice", async () => {
    const user = userEvent.setup();
    vi.mocked(saveUserPreferences).mockRejectedValue(new Error("Couldn't save your preferences. Try again."));
    renderPage();

    await user.click(screen.getByRole("radio", { name: "Monday" }));
    await user.click(saveButton());

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Couldn't save your preferences."));
    expect(screen.getByRole("radio", { name: "Monday" })).toBeChecked();
    expect(saveButton()).toBeEnabled();
  });
});
