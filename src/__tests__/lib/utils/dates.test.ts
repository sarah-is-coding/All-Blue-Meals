import {
  addDays,
  createDateFromIso,
  formatDateRange,
  formatMonthDay,
  formatWeekRangeLabel,
  getWeekEndIso,
  getWeekStartIso,
  shiftWeekStartIso,
  toIsoDate,
  isValidIsoDate,
} from "../../../lib/utils/dates";

// ─────────────────────────────────────────────────────────────
// createDateFromIso / toIsoDate
// ─────────────────────────────────────────────────────────────
describe("createDateFromIso", () => {
  it("parses as a local-time date (no UTC day shift)", () => {
    const date = createDateFromIso("2026-05-25");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(4);
    expect(date.getDate()).toBe(25);
    expect(date.getHours()).toBe(0);
  });
});

describe("toIsoDate", () => {
  it("zero-pads month and day", () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("round-trips with createDateFromIso", () => {
    expect(toIsoDate(createDateFromIso("2026-12-31"))).toBe("2026-12-31");
  });
});

// ─────────────────────────────────────────────────────────────
// addDays
// ─────────────────────────────────────────────────────────────
describe("addDays", () => {
  it("rolls over month and year boundaries", () => {
    expect(toIsoDate(addDays(new Date(2026, 0, 31), 1))).toBe("2026-02-01");
    expect(toIsoDate(addDays(new Date(2026, 11, 31), 1))).toBe("2027-01-01");
  });

  it("supports negative offsets", () => {
    expect(toIsoDate(addDays(new Date(2026, 2, 1), -1))).toBe("2026-02-28");
  });

  it("does not mutate the input date", () => {
    const date = new Date(2026, 4, 25);
    addDays(date, 3);
    expect(toIsoDate(date)).toBe("2026-05-25");
  });
});

// ─────────────────────────────────────────────────────────────
// Week helpers (weeks start on Monday)
// ─────────────────────────────────────────────────────────────
// Weeks start on Sunday since redesign decision 8 (they used to start on
// Monday, which these cases previously asserted).
describe("getWeekStartIso", () => {
  it("returns the same day for a Sunday", () => {
    expect(getWeekStartIso(new Date(2026, 4, 24))).toBe("2026-05-24");
  });

  it("returns the previous Sunday for a midweek day", () => {
    expect(getWeekStartIso(new Date(2026, 4, 28))).toBe("2026-05-24");
  });

  it("treats Monday as part of the week its Sunday started", () => {
    expect(getWeekStartIso(new Date(2026, 4, 25))).toBe("2026-05-24");
  });

  it("treats Saturday as the end of the week, not the start", () => {
    expect(getWeekStartIso(new Date(2026, 4, 30))).toBe("2026-05-24");
  });

  it("crosses a year boundary", () => {
    // Fri Jan 1 2027 belongs to the week starting Sun Dec 27 2026
    expect(getWeekStartIso(new Date(2027, 0, 1))).toBe("2026-12-27");
  });
});

describe("getWeekEndIso", () => {
  it("returns the Sunday six days after the week start", () => {
    expect(getWeekEndIso("2026-05-25")).toBe("2026-05-31");
  });
});

describe("shiftWeekStartIso", () => {
  it("moves forward and backward by whole weeks", () => {
    expect(shiftWeekStartIso("2026-05-25", 1)).toBe("2026-06-01");
    expect(shiftWeekStartIso("2026-05-25", -2)).toBe("2026-05-11");
  });

  it("returns the same week for an offset of 0", () => {
    expect(shiftWeekStartIso("2026-05-25", 0)).toBe("2026-05-25");
  });
});

// ─────────────────────────────────────────────────────────────
// Formatting
// ─────────────────────────────────────────────────────────────
describe("formatWeekRangeLabel", () => {
  it("formats the Monday–Sunday range", () => {
    expect(formatWeekRangeLabel("2026-05-25")).toBe("May 25, 2026 - May 31, 2026");
  });
});

describe("formatDateRange", () => {
  it("formats an arbitrary start/end range with an en dash", () => {
    expect(formatDateRange("2026-12-28", "2027-01-03")).toBe("Dec 28, 2026 – Jan 3, 2027");
  });
});

describe("formatMonthDay", () => {
  it("formats a day as short month and day, without the year", () => {
    expect(formatMonthDay("2026-05-25")).toBe("May 25");
  });

  it("does not shift the day across a year boundary (local time, not UTC)", () => {
    expect(formatMonthDay("2027-01-01")).toBe("Jan 1");
    expect(formatMonthDay("2026-12-31")).toBe("Dec 31");
  });
});

describe("isValidIsoDate", () => {
  it("accepts a complete, real date", () => {
    expect(isValidIsoDate("2026-05-18")).toBe(true);
    expect(isValidIsoDate("2024-02-29")).toBe(true); // leap day
  });

  it("rejects empty and half-typed values", () => {
    expect(isValidIsoDate("")).toBe(false);
    expect(isValidIsoDate("2026-0")).toBe(false);
    expect(isValidIsoDate("2026-05-1")).toBe(false);
    expect(isValidIsoDate("05/18/2026")).toBe(false);
  });

  it("rejects impossible dates", () => {
    expect(isValidIsoDate("2026-02-31")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026-00-10")).toBe(false);
  });
});
