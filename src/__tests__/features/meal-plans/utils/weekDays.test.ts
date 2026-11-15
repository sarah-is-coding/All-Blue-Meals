import { getWeekDays } from "../../../../features/meal-plans/utils/weekDays";

describe("getWeekDays", () => {
  it("returns seven consecutive days starting from the week start", () => {
    const days = getWeekDays("2026-05-25");
    expect(days.map((day) => day.dateIso)).toEqual([
      "2026-05-25",
      "2026-05-26",
      "2026-05-27",
      "2026-05-28",
      "2026-05-29",
      "2026-05-30",
      "2026-05-31",
    ]);
  });

  it("labels each day for display", () => {
    const [monday] = getWeekDays("2026-05-25");
    expect(monday).toEqual({
      dateIso: "2026-05-25",
      weekdayShort: "Mon",
      monthDayLabel: "May 25",
      fullLabel: "Monday, May 25",
    });
  });

  it("crosses a month boundary", () => {
    const days = getWeekDays("2026-06-29");
    expect(days[2].dateIso).toBe("2026-07-01");
    expect(days[6].monthDayLabel).toBe("Jul 5");
  });
});
