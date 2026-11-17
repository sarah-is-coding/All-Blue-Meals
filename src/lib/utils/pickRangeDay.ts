export type RangePick = {
  /** The pending first tap, waiting for the range's last day; null when complete. */
  anchor: string | null;
  startIso: string;
  endIso: string;
};

/** Two-tap date-range picking on a calendar: the first tap starts a
 *  single-day range and becomes the anchor, a second tap on the same or a
 *  later day completes the range, and an earlier tap starts over. */
export function pickRangeDay(anchor: string | null, dateIso: string): RangePick {
  if (anchor !== null && dateIso >= anchor) {
    return { anchor: null, startIso: anchor, endIso: dateIso };
  }
  return { anchor: dateIso, startIso: dateIso, endIso: dateIso };
}
