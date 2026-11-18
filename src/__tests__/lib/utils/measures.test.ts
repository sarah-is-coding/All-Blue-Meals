import { addMeasure, formatMeasure, measureOf, type MeasureTotal } from "../../../lib/utils/measures";

// Adding up amounts within volume and within weight for grocery lists, shown
// in a readable unit and rounded up so the list never under-buys.

const total = (...amounts: Array<[number, string]>): MeasureTotal => {
  let sum: MeasureTotal | null = null;
  for (const [amount, unit] of amounts) sum = addMeasure(sum, amount, unit);
  return sum!;
};

describe("measureOf", () => {
  it("knows volume and weight units", () => {
    expect(measureOf("tbsp")?.kind).toBe("volume");
    expect(measureOf("ml")?.kind).toBe("volume");
    expect(measureOf("lb")?.kind).toBe("weight");
    expect(measureOf("g")?.kind).toBe("weight");
  });

  it("returns null for counts and unknown units", () => {
    expect(measureOf("clove")).toBeNull();
    expect(measureOf("can")).toBeNull();
    expect(measureOf("")).toBeNull();
  });
});

describe("addMeasure", () => {
  it("adds amounts of the same kind", () => {
    expect(formatMeasure(total([2, "tbsp"], [0.25, "cup"]))).toEqual({ quantity: "6", unit: "tbsp" });
  });

  it("refuses to add a volume to a weight, and non-measures", () => {
    expect(addMeasure(total([1, "cup"]), 100, "g")).toBeNull();
    expect(addMeasure(null, 2, "clove")).toBeNull();
  });

  it("stays metric only while every amount is metric", () => {
    expect(total([200, "ml"], [0.5, "l"]).metric).toBe(true);
    expect(total([200, "ml"], [1, "cup"]).metric).toBe(false);
  });
});

describe("formatMeasure", () => {
  it.each([
    [[[0.5, "tsp"]], "1/2", "tsp"],
    [[[1, "tsp"], [1, "tsp"], [1, "tsp"]], "1", "tbsp"],
    [[[2, "tbsp"]], "2", "tbsp"],
    [[[0.5, "cup"]], "8", "tbsp"],
    [[[1, "cup"], [2, "tbsp"]], "1 1/4", "cup"],
    [[[3, "cup"]], "3", "cup"],
  ] as Array<[Array<[number, string]>, string, string]>)("US volume %j → %s %s", (amounts, quantity, unit) => {
    expect(formatMeasure(total(...amounts))).toEqual({ quantity, unit });
  });

  it.each([
    [[[8, "oz"]], "8", "oz"],
    [[[1, "lb"], [8, "oz"]], "1 1/2", "lb"],
    [[[17, "oz"]], "1 1/4", "lb"],
  ] as Array<[Array<[number, string]>, string, string]>)("US weight %j → %s %s", (amounts, quantity, unit) => {
    expect(formatMeasure(total(...amounts))).toEqual({ quantity, unit });
  });

  it("shows metric in whole small units, then tenths of large ones, rounded up", () => {
    expect(formatMeasure(total([350, "g"]))).toEqual({ quantity: "350", unit: "g" });
    expect(formatMeasure(total([500, "g"], [0.75, "kg"]))).toEqual({ quantity: "1.3", unit: "kg" });
    expect(formatMeasure(total([250, "ml"], [0.25, "l"]))).toEqual({ quantity: "500", unit: "ml" });
    expect(formatMeasure(total([1, "l"]))).toEqual({ quantity: "1", unit: "l" });
  });

  it("rounds up, never down", () => {
    // 1/3 tsp is shown as 3/8 tsp, the next 1/8 step.
    expect(formatMeasure(total([1 / 3, "tsp"]))).toEqual({ quantity: "3/8", unit: "tsp" });
    // 5 tbsp + 1 tsp = 5 1/3 tbsp, shown as 5 1/2.
    expect(formatMeasure(total([5, "tbsp"], [1, "tsp"]))).toEqual({ quantity: "5 1/2", unit: "tbsp" });
  });
});
