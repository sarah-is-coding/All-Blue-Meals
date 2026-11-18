import { useMemo, useRef, useState } from "react";
import { addDays, createDateFromIso, toIsoDate } from "../../../lib/utils/dates";
import { usePlannedMealsBetween } from "../queries";
import { createWheelPager, swipeStep } from "../utils/monthSwipe";

// A month calendar for picking a date range to copy or save. Days with
// planned meals are marked, read straight from the meals' dates (no plan
// rows involved), and any day can start or end a range. Swiping sideways
// (touch or trackpad) moves a month, like the ◀ ▶ buttons.

/** Sunday-first day-of-week: 0 = Sun … 6 = Sat (what getDay already is). */
function sunFirstDow(date: Date): number {
  return date.getDay();
}

// ── Month grid builder ────────────────────────────────────────────────────

type DayCell = {
  dateIso: string;
  dayNum: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  hasMeals: boolean;
  inRange: boolean;
  /** Round the left edge of the selection band (range start, or first day of week). */
  bandLeft: boolean;
  /** Round the right edge of the selection band (range end, or last day of week). */
  bandRight: boolean;
};

/** The grid's first and last day: full weeks padded around the month. */
function monthGridBounds(year: number, month: number): { startIso: string; endIso: string } {
  const firstOfMonth = new Date(year, month, 1);
  const lastOfMonth = new Date(year, month + 1, 0);
  return {
    startIso: toIsoDate(addDays(firstOfMonth, -sunFirstDow(firstOfMonth))),
    endIso: toIsoDate(addDays(lastOfMonth, 6 - sunFirstDow(lastOfMonth))),
  };
}

function buildMonthCells(
  year: number,
  month: number, // 0-indexed
  mealDates: ReadonlySet<string>,
  rangeStartIso: string | null,
  rangeEndIso: string | null,
  todayIso: string
): DayCell[] {
  const { startIso, endIso } = monthGridBounds(year, month);
  const cells: DayCell[] = [];
  let d = createDateFromIso(startIso);
  const end = createDateFromIso(endIso);

  while (d <= end) {
    const iso = toIsoDate(d);
    const dow = sunFirstDow(d); // 0 = Sun, 6 = Sat
    const inRange =
      rangeStartIso !== null &&
      rangeEndIso !== null &&
      iso >= rangeStartIso &&
      iso <= rangeEndIso;

    cells.push({
      dateIso: iso,
      dayNum: d.getDate(),
      isCurrentMonth: d.getMonth() === month,
      isToday: iso === todayIso,
      hasMeals: mealDates.has(iso),
      inRange,
      bandLeft: inRange && (iso === rangeStartIso || dow === 0),
      bandRight: inRange && (iso === rangeEndIso || dow === 6),
    });

    d = addDays(d, 1);
  }

  return cells;
}

// ── Component ─────────────────────────────────────────────────────────────

type Props = {
  /** The chosen range, highlighted on the grid (both null while picking anew). */
  rangeStartIso: string | null;
  rangeEndIso: string | null;
  onSelectDay: (dateIso: string) => void;
};

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const monthYearFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

export default function MealDatesCalendar({ rangeStartIso, rangeEndIso, onSelectDay }: Props) {
  const todayIso = toIsoDate(new Date());
  const [viewDate, setViewDate] = useState(() =>
    rangeStartIso === null ? new Date() : createDateFromIso(rangeStartIso)
  );
  const viewYear = viewDate.getFullYear();
  const viewMonth = viewDate.getMonth();

  // Which of the visible days have meals, straight from the meals' dates.
  const grid = monthGridBounds(viewYear, viewMonth);
  const [previousRange, setPreviousRange] = useState({ startIso: rangeStartIso, endIso: rangeEndIso });
  if (previousRange.startIso !== rangeStartIso || previousRange.endIso !== rangeEndIso) {
    setPreviousRange({ startIso: rangeStartIso, endIso: rangeEndIso });
    // Reveal a new range that moved entirely off this grid without pulling
    // the calendar back when the user browses months independently.
    if (rangeStartIso !== null && rangeEndIso !== null &&
        (rangeStartIso > grid.endIso || rangeEndIso < grid.startIso)) {
      setViewDate(createDateFromIso(rangeStartIso));
    }
  }
  const monthMeals = usePlannedMealsBetween(grid.startIso, grid.endIso);
  const mealDates = useMemo(
    () => new Set(monthMeals.items.map((item) => item.plannedFor)),
    [monthMeals.items]
  );

  const monthLabel = useMemo(
    () => monthYearFmt.format(new Date(viewYear, viewMonth)),
    [viewYear, viewMonth]
  );

  const cells = useMemo(
    () => buildMonthCells(viewYear, viewMonth, mealDates, rangeStartIso, rangeEndIso, todayIso),
    [viewYear, viewMonth, mealDates, rangeStartIso, rangeEndIso, todayIso]
  );

  /** Move the view by `step` months (-1 or 1). */
  const shiftMonth = (step: number) => {
    setViewDate((date) => new Date(date.getFullYear(), date.getMonth() + step));
  };

  // ── Sideways gestures ──
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const [wheelStep] = useState(createWheelPager);

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStart.current = e.touches.length === 1 ? { x: t.clientX, y: t.clientY } : null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStart.current;
    touchStart.current = null;
    const t = e.changedTouches[0];
    if (!start || !t) return;
    const step = swipeStep(t.clientX - start.x, t.clientY - start.y);
    if (step !== 0) shiftMonth(step);
  };
  const handleWheel = (e: React.WheelEvent) => {
    const step = wheelStep(e.deltaX, e.deltaY, e.timeStamp);
    if (step !== 0) shiftMonth(step);
  };

  return (
    <div
      className="meal-dates-cal"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={() => { touchStart.current = null; }}
      onWheel={handleWheel}
    >
      <div className="meal-dates-cal__header">
        <button
          type="button"
          className="meal-dates-cal__nav"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
        >
          ◀
        </button>
        <span className="meal-dates-cal__month-label">{monthLabel}</span>
        <button
          type="button"
          className="meal-dates-cal__nav"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
        >
          ▶
        </button>
      </div>

      <div className="meal-dates-cal__weekdays" aria-hidden="true">
        {WEEKDAY_LABELS.map((lbl) => (
          <span key={lbl} className="meal-dates-cal__weekday">{lbl}</span>
        ))}
      </div>

      <div className="meal-dates-cal__grid" role="grid" aria-label={monthLabel}>
        {cells.map((cell) => {
          const cls = [
            "meal-dates-cal__day",
            !cell.isCurrentMonth && "meal-dates-cal__day--other-month",
            cell.isToday    && "meal-dates-cal__day--today",
            cell.hasMeals   && "meal-dates-cal__day--has-meals",
            cell.inRange    && "meal-dates-cal__day--in-range",
            cell.bandLeft   && "meal-dates-cal__day--band-left",
            cell.bandRight  && "meal-dates-cal__day--band-right",
          ].filter(Boolean).join(" ");

          return (
            <button
              key={cell.dateIso}
              type="button"
              role="gridcell"
              className={cls}
              onClick={() => onSelectDay(cell.dateIso)}
              aria-label={cell.dateIso}
              aria-selected={cell.inRange}
            >
              <span className="meal-dates-cal__day-band" aria-hidden="true" />
              <span className="meal-dates-cal__day-num">{cell.dayNum}</span>
              {cell.hasMeals && <span className="meal-dates-cal__day-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      {monthMeals.loading && <p className="meal-dates-cal__status">Loading…</p>}
      {monthMeals.error && <p className="error">{monthMeals.error}</p>}
    </div>
  );
}
