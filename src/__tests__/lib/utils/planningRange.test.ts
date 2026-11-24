import { describeCadence, planningRange, shiftByCadence } from "../../../lib/utils/planningRange";

// Wed Nov 18 2026. Its week: Sun Nov 15 – Sat Nov 21, or Mon Nov 16 – Sun Nov 22.
const WEDNESDAY = "2026-11-18";

describe("planningRange", () => {
  it("is the week the day is in, for a weekly cadence", () => {
    expect(planningRange({ unit: "week", count: 1 }, WEDNESDAY, 0)).toEqual({
      startIso: "2026-11-15",
      endIso: "2026-11-21",
    });
    expect(planningRange({ unit: "week", count: 1 }, WEDNESDAY, 1)).toEqual({
      startIso: "2026-11-16",
      endIso: "2026-11-22",
    });
  });

  it("starts on that week and runs several weeks, for every 2 weeks", () => {
    expect(planningRange({ unit: "week", count: 2 }, WEDNESDAY, 0)).toEqual({
      startIso: "2026-11-15",
      endIso: "2026-11-28",
    });
  });

  it("is the calendar month, for a monthly cadence (whatever day weeks start on)", () => {
    expect(planningRange({ unit: "month", count: 1 }, WEDNESDAY, 1)).toEqual({
      startIso: "2026-11-01",
      endIso: "2026-11-30",
    });
  });

  it("runs into following months for a multi-month cadence, across a year", () => {
    expect(planningRange({ unit: "month", count: 3 }, "2026-12-05", 0)).toEqual({
      startIso: "2026-12-01",
      endIso: "2027-02-28",
    });
  });

  it("starts on the day itself, for a cadence in days", () => {
    expect(planningRange({ unit: "day", count: 10 }, WEDNESDAY, 0)).toEqual({
      startIso: "2026-11-18",
      endIso: "2026-11-27",
    });
    expect(planningRange({ unit: "day", count: 1 }, WEDNESDAY, 0)).toEqual({
      startIso: WEDNESDAY,
      endIso: WEDNESDAY,
    });
  });

  it("treats a count below 1 as 1", () => {
    expect(planningRange({ unit: "week", count: 0 }, WEDNESDAY, 0).endIso).toBe("2026-11-21");
  });
});

describe("shiftByCadence", () => {
  it("moves by a whole number of weeks", () => {
    const range = { startIso: "2026-11-15", endIso: "2026-11-28" };
    expect(shiftByCadence(range, { unit: "week", count: 2 }, 1)).toEqual({
      startIso: "2026-11-29",
      endIso: "2026-12-12",
    });
    expect(shiftByCadence(range, { unit: "week", count: 2 }, -1)).toEqual({
      startIso: "2026-11-01",
      endIso: "2026-11-14",
    });
  });

  it("moves by days", () => {
    expect(shiftByCadence({ startIso: "2026-11-18", endIso: "2026-11-27" }, { unit: "day", count: 10 }, 1)).toEqual({
      startIso: "2026-11-28",
      endIso: "2026-12-07",
    });
  });

  it("keeps a whole month a whole month, even when the months differ in length", () => {
    const november = { startIso: "2026-11-01", endIso: "2026-11-30" };
    expect(shiftByCadence(november, { unit: "month", count: 1 }, 1)).toEqual({
      startIso: "2026-12-01",
      endIso: "2026-12-31",
    });
    expect(shiftByCadence({ startIso: "2027-01-01", endIso: "2027-01-31" }, { unit: "month", count: 1 }, 1)).toEqual({
      startIso: "2027-02-01",
      endIso: "2027-02-28",
    });
    expect(shiftByCadence(november, { unit: "month", count: 1 }, -1)).toEqual({
      startIso: "2026-10-01",
      endIso: "2026-10-31",
    });
  });

  it("moves a mid-month range by calendar months, clamping to shorter months", () => {
    expect(shiftByCadence({ startIso: "2027-01-31", endIso: "2027-02-10" }, { unit: "month", count: 1 }, 1)).toEqual({
      startIso: "2027-02-28",
      endIso: "2027-03-10",
    });
  });
});

describe("describeCadence", () => {
  it("names one period with 'a' and several with the count", () => {
    expect(describeCadence({ unit: "week", count: 1 })).toBe("a week");
    expect(describeCadence({ unit: "week", count: 2 })).toBe("2 weeks");
    expect(describeCadence({ unit: "month", count: 1 })).toBe("a month");
    expect(describeCadence({ unit: "day", count: 10 })).toBe("10 days");
  });
});
