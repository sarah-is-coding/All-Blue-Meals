import { describe, it, expect } from "vitest";
import { pickRangeDay } from "../../../lib/utils/pickRangeDay";

describe("pickRangeDay", () => {
  it("a first tap starts a single-day range and waits for the last day", () => {
    expect(pickRangeDay(null, "2026-05-18")).toEqual({
      anchor: "2026-05-18",
      startIso: "2026-05-18",
      endIso: "2026-05-18",
    });
  });

  it("a later tap completes the range", () => {
    expect(pickRangeDay("2026-05-18", "2026-05-24")).toEqual({
      anchor: null,
      startIso: "2026-05-18",
      endIso: "2026-05-24",
    });
  });

  it("tapping the anchor day again completes a single-day range", () => {
    expect(pickRangeDay("2026-05-18", "2026-05-18")).toEqual({
      anchor: null,
      startIso: "2026-05-18",
      endIso: "2026-05-18",
    });
  });

  it("an earlier tap starts the range over", () => {
    expect(pickRangeDay("2026-05-20", "2026-05-18")).toEqual({
      anchor: "2026-05-18",
      startIso: "2026-05-18",
      endIso: "2026-05-18",
    });
  });
});
