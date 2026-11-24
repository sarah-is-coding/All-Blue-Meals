import { describeCadence, planningRange, planningRangeFrom, shiftByCadence } from "../../../lib/utils/planningRange";

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

describe("planningRangeFrom", () => {
  it("starts on the given day for every unit", () => {
    expect(planningRangeFrom({ unit: "week", count: 1 }, "2026-11-22")).toEqual({
      startIso: "2026-11-22",
      endIso: "2026-11-28",
    });
    expect(planningRangeFrom({ unit: "week", count: 2 }, "2026-11-22").endIso).toBe("2026-12-05");
    expect(planningRangeFrom({ unit: "day", count: 10 }, "2026-11-22").endIso).toBe("2026-12-01");
  });

  it("runs to the day before the same date a month later", () => {
    expect(planningRangeFrom({ unit: "month", count: 1 }, "2026-11-22")).toEqual({
      startIso: "2026-11-22",
      endIso: "2026-12-21",
    });
    expect(planningRangeFrom({ unit: "month", count: 3 }, "2026-11-22").endIso).toBe("2027-02-21");
  });

  it("is a whole month when it starts on the 1st", () => {
    expect(planningRangeFrom({ unit: "month", count: 1 }, "2027-02-01").endIso).toBe("2027-02-28");
    expect(planningRangeFrom({ unit: "month", count: 1 }, "2026-12-01").endIso).toBe("2026-12-31");
  });

  it("ends on the last day of a month too short for the start date", () => {
    // There's no June 31, Feb 31 or Feb 29 in 2027: the period runs to the month's end.
    expect(planningRangeFrom({ unit: "month", count: 1 }, "2026-05-31").endIso).toBe("2026-06-30");
    expect(planningRangeFrom({ unit: "month", count: 1 }, "2027-01-31").endIso).toBe("2027-02-28");
    expect(planningRangeFrom({ unit: "month", count: 1 }, "2027-01-29").endIso).toBe("2027-02-28");
    // Feb 28 exists, so the period ends the day before.
    expect(planningRangeFrom({ unit: "month", count: 1 }, "2027-01-28").endIso).toBe("2027-02-27");
  });

  it("treats a count below 1 as 1", () => {
    expect(planningRangeFrom({ unit: "day", count: 0 }, "2026-11-22").endIso).toBe("2026-11-22");
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

  it("steps a month period to the next one with no overlap, even from the 31st", () => {
    const month = { unit: "month", count: 1 } as const;
    // Used to give Feb 28 – Mar 31: Feb 28 in both, and 32 days long.
    expect(shiftByCadence({ startIso: "2027-01-31", endIso: "2027-02-28" }, month, 1)).toEqual({
      startIso: "2027-03-01",
      endIso: "2027-03-31",
    });
    expect(shiftByCadence({ startIso: "2026-05-31", endIso: "2026-06-30" }, month, 1)).toEqual({
      startIso: "2026-07-01",
      endIso: "2026-07-31",
    });
    // A month from the viewed week (the planner's default).
    expect(shiftByCadence({ startIso: "2026-11-22", endIso: "2026-12-21" }, month, 1)).toEqual({
      startIso: "2026-12-22",
      endIso: "2027-01-21",
    });
    expect(shiftByCadence({ startIso: "2026-11-22", endIso: "2026-12-21" }, month, -1)).toEqual({
      startIso: "2026-10-22",
      endIso: "2026-11-21",
    });
  });

  it("steps back to end the day before, for multi-month periods too", () => {
    expect(
      shiftByCadence({ startIso: "2026-07-01", endIso: "2026-09-30" }, { unit: "month", count: 3 }, -1)
    ).toEqual({ startIso: "2026-04-01", endIso: "2026-06-30" });
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
