import {
  addDays,
  createDateFromIso,
  formatDateRange,
  formatWeekRangeLabel,
  getWeekEndIso,
  getWeekStartIso,
  shiftWeekStartIso,
  toIsoDate,
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
describe("getWeekStartIso", () => {
  it("returns the same day for a Monday", () => {
    expect(getWeekStartIso(new Date(2026, 4, 25))).toBe("2026-05-25");
  });

  it("returns the previous Monday for a midweek day", () => {
    expect(getWeekStartIso(new Date(2026, 4, 28))).toBe("2026-05-25");
  });

  it("treats Sunday as the end of the week, not the start", () => {
    expect(getWeekStartIso(new Date(2026, 4, 31))).toBe("2026-05-25");
  });

  it("crosses a year boundary", () => {
    // Fri Jan 1 2027 belongs to the week starting Mon Dec 28 2026
    expect(getWeekStartIso(new Date(2027, 0, 1))).toBe("2026-12-28");
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
