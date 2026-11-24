import { renderHook } from "@testing-library/react";
import { usePlanningPeriod } from "../../../lib/preferences/usePlanningPeriod";
import { useWeek } from "../../../lib/preferences/useWeek";
import { getWeekStartIso } from "../../../lib/utils/dates";
import { renderHookWithProviders } from "../../utils/renderWithProviders";

// Wed Nov 18 2026.
const WEDNESDAY = "2026-11-18";

describe("useWeek", () => {
  it("applies the user's first day of the week", () => {
    const { result } = renderHookWithProviders(() => useWeek(), { preferences: { weekStartsOn: 1 } });
    expect(result.current.weekStartsOn).toBe(1);
    expect(result.current.startOf(WEDNESDAY)).toBe("2026-11-16");
    expect(result.current.startOf(new Date(2026, 10, 22))).toBe("2026-11-16"); // Sunday ends the Monday week
    expect(result.current.current()).toBe(getWeekStartIso(new Date(), 1));
    expect(result.current.dayIndex(new Date(2026, 10, 16))).toBe(0);
    expect(result.current.weekdayInitials[0]).toBe("Mo");
  });

  it("is Sunday weeks without a provider (the default)", () => {
    const { result } = renderHook(() => useWeek());
    expect(result.current.startOf(WEDNESDAY)).toBe("2026-11-15");
    expect(result.current.weekdayInitials[0]).toBe("Su");
  });

  it("gives the same helpers between renders until the preference changes", () => {
    const { result, rerender } = renderHookWithProviders(() => useWeek());
    const first = result.current;
    rerender(undefined);
    expect(result.current).toBe(first);
  });
});

describe("usePlanningPeriod", () => {
  it("applies the user's cadence and first day of the week", () => {
    const { result } = renderHookWithProviders(() => usePlanningPeriod(), {
      preferences: { weekStartsOn: 1, planningCadence: { unit: "week", count: 2 } },
    });
    expect(result.current.around(WEDNESDAY)).toEqual({ startIso: "2026-11-16", endIso: "2026-11-29" });
    expect(result.current.from(WEDNESDAY)).toEqual({ startIso: "2026-11-18", endIso: "2026-12-01" });
    expect(result.current.shift({ startIso: "2026-11-16", endIso: "2026-11-29" }, 1)).toEqual({
      startIso: "2026-11-30",
      endIso: "2026-12-13",
    });
    expect(result.current.label).toBe("2 weeks");
  });

  it("is a week starting Sunday without a provider (the default)", () => {
    const { result } = renderHook(() => usePlanningPeriod());
    expect(result.current.around(WEDNESDAY)).toEqual({ startIso: "2026-11-15", endIso: "2026-11-21" });
    expect(result.current.label).toBe("a week");
  });
});
