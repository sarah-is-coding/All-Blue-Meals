import { describe, it, expect } from "vitest";
import {
  manageSavedPlansState,
  opensSavedPlansTab,
  savedPlansBackLink,
} from "../../../../features/meal-plans/utils/savedPlansNavigation";

describe("manageSavedPlansState", () => {
  it("records the planner or grocery page as the way back", () => {
    expect(manageSavedPlansState("/meal-plans")).toEqual({ returnTo: "/meal-plans" });
    expect(manageSavedPlansState("/grocery")).toEqual({ returnTo: "/grocery" });
  });

  it("records nothing for other pages", () => {
    expect(manageSavedPlansState("/recipes")).toBeUndefined();
    expect(manageSavedPlansState("")).toBeUndefined();
  });
});

describe("savedPlansBackLink", () => {
  it("goes back to the page the user came from, asking for its Saved plans tab", () => {
    expect(savedPlansBackLink({ returnTo: "/grocery" })).toEqual({
      to: "/grocery",
      label: "Grocery Lists",
      state: { planBrowserTab: "saved" },
    });
    expect(savedPlansBackLink({ returnTo: "/meal-plans" })).toMatchObject({
      to: "/meal-plans",
      label: "Meal Plans",
    });
  });

  it("falls back to the planner with no state (a reload or direct visit)", () => {
    expect(savedPlansBackLink(null)).toMatchObject({ to: "/meal-plans", label: "Meal Plans" });
    expect(savedPlansBackLink(undefined)).toMatchObject({ to: "/meal-plans" });
  });

  it("ignores a return path that isn't one of the known pages", () => {
    expect(savedPlansBackLink({ returnTo: "https://example.com" })).toMatchObject({ to: "/meal-plans" });
    expect(savedPlansBackLink({ returnTo: "toString" })).toMatchObject({ to: "/meal-plans" });
    expect(savedPlansBackLink({ returnTo: 42 })).toMatchObject({ to: "/meal-plans" });
  });
});

describe("opensSavedPlansTab", () => {
  it("is true only when asked for the Saved plans tab", () => {
    expect(opensSavedPlansTab({ planBrowserTab: "saved" })).toBe(true);
    expect(opensSavedPlansTab({ planBrowserTab: "calendar" })).toBe(false);
    expect(opensSavedPlansTab({ jumpToDate: "2026-05-18" })).toBe(false);
    expect(opensSavedPlansTab(null)).toBe(false);
    expect(opensSavedPlansTab(undefined)).toBe(false);
  });
});
