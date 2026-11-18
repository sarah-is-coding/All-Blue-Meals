// Adding up amounts written in different units of the same kind of measure
// ("2 tbsp" + "1/4 cup" = "6 tbsp"), for grocery lists. Volume and weight
// convert within themselves; they can't convert into each other without
// knowing the ingredient's density, and counts (cloves, cans) don't convert.

export type MeasureKind = "volume" | "weight";

type Measure = { kind: MeasureKind; base: number; metric: boolean };

// Base units: millilitres and grams. US units are exact multiples of one
// teaspoon or ounce, so "2 tbsp" is exactly 6 tsp (rounded factors made it
// a hair more, which rounding up turned into "2 1/2 tbsp").
const TSP_ML = 4.92892159375;
const OZ_G = 28.349523125;
const MEASURES: Record<string, Measure> = {
  tsp: { kind: "volume", base: TSP_ML, metric: false },
  tbsp: { kind: "volume", base: 3 * TSP_ML, metric: false },
  "fl oz": { kind: "volume", base: 6 * TSP_ML, metric: false },
  cup: { kind: "volume", base: 48 * TSP_ML, metric: false },
  pint: { kind: "volume", base: 96 * TSP_ML, metric: false },
  quart: { kind: "volume", base: 192 * TSP_ML, metric: false },
  gallon: { kind: "volume", base: 768 * TSP_ML, metric: false },
  ml: { kind: "volume", base: 1, metric: true },
  l: { kind: "volume", base: 1000, metric: true },
  oz: { kind: "weight", base: OZ_G, metric: false },
  lb: { kind: "weight", base: 16 * OZ_G, metric: false },
  g: { kind: "weight", base: 1, metric: true },
  kg: { kind: "weight", base: 1000, metric: true },
};

/** The kind of measure and its size in ml or g, for a normalized unit; null for counts and anything else. */
export const measureOf = (unit: string): Measure | null => MEASURES[unit] ?? null;

/** A running total of one kind of measure. */
export type MeasureTotal = { kind: MeasureKind; base: number; metric: boolean };

/** Add an amount in `unit` to a total of the same kind (or start one). Null if the unit isn't a measure. */
export const addMeasure = (total: MeasureTotal | null, amount: number, unit: string): MeasureTotal | null => {
  const measure = measureOf(unit);
  if (!measure || (total && total.kind !== measure.kind)) return null;
  return {
    kind: measure.kind,
    base: (total?.base ?? 0) + amount * measure.base,
    // Shown in metric only when every amount was written in metric.
    metric: (total?.metric ?? true) && measure.metric,
  };
};

/** `value` rounded up to a multiple of 1/`denominator`, as "1 1/2", "3/4" or "2". */
const formatRoundedUp = (value: number, denominator: number): string => {
  // Tiny tolerance so floating-point noise (2.0000001) doesn't round up a step.
  const steps = Math.ceil(value * denominator - 1e-6);
  const whole = Math.floor(steps / denominator);
  let numerator = steps % denominator;
  let divisor = denominator;
  for (const factor of [2, 2, 2]) {
    if (numerator > 0 && numerator % factor === 0 && divisor % factor === 0) {
      numerator /= factor;
      divisor /= factor;
    }
  }
  if (numerator === 0) return String(whole);
  return whole === 0 ? `${numerator}/${divisor}` : `${whole} ${numerator}/${divisor}`;
};

/** A formatted total: { quantity: "1 1/2", unit: "tbsp" }. */
export type MeasureAmount = { quantity: string; unit: string };

/** 350 → "350 g"; 1250 → "1.3 kg" (whole small units, tenths of large ones, rounded up). */
const metricAmount = (base: number, small: string, large: string): MeasureAmount =>
  base < 1000
    ? { quantity: String(Math.ceil(base - 1e-6)), unit: small }
    : { quantity: String(Math.ceil(base / 100 - 1e-6) / 10), unit: large };

/**
 * A total as a shopping amount, in the most readable unit, rounded up so the
 * list never under-buys: tsp below 1 tbsp, tbsp up to 1/2 cup, then cups;
 * oz below 1 lb, then lb; ml below 1 l, then l; g below 1 kg, then kg.
 */
export const formatMeasure = (total: MeasureTotal): MeasureAmount => {
  if (total.kind === "volume") {
    if (total.metric) return metricAmount(total.base, "ml", "l");
    const tsp = total.base / TSP_ML;
    if (tsp < 3 - 1e-6) return { quantity: formatRoundedUp(tsp, 8), unit: "tsp" };
    const tbsp = tsp / 3;
    if (tbsp <= 8 + 1e-6) return { quantity: formatRoundedUp(tbsp, 2), unit: "tbsp" };
    return { quantity: formatRoundedUp(tbsp / 16, 4), unit: "cup" };
  }
  if (total.metric) return metricAmount(total.base, "g", "kg");
  const oz = total.base / OZ_G;
  if (oz < 16 - 1e-6) return { quantity: formatRoundedUp(oz, 2), unit: "oz" };
  return { quantity: formatRoundedUp(oz / 16, 4), unit: "lb" };
};
