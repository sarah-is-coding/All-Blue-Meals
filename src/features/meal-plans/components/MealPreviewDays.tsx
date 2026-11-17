import { createDateFromIso } from "../../../lib/utils/dates";
import type { MealPlanDayPreview } from "../types";

const dayLabelFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

type Props = {
  preview: MealPlanDayPreview[];
  /** Tighter spacing, for previews inside a list row. */
  compact?: boolean;
};

/** Recipe names by day ("Mon, May 25 — Tacos · Soup"): a plan's preview. */
export default function MealPreviewDays({ preview, compact }: Props) {
  return (
    <div className={`plan-browser__preview${compact ? " plan-browser__preview--compact" : ""}`}>
      {preview.map(({ dateIso, recipes }) => (
        <div key={dateIso} className="plan-browser__day">
          <span className="plan-browser__day-label">
            {dayLabelFmt.format(createDateFromIso(dateIso))}
          </span>
          {recipes.length === 0 ? (
            <span className="plan-browser__day-empty">—</span>
          ) : (
            <span className="plan-browser__day-recipes">{recipes.join(" · ")}</span>
          )}
        </div>
      ))}
    </div>
  );
}
