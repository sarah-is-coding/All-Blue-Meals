import type { CopyMode } from "../types";

type Props = {
  startLabel: string;
  hasMeals: boolean;
  onChoose: (mode: CopyMode) => void;
  onCancel: () => void;
};

/** Confirm the destination before applying a date range or saved plan. */
export default function CopyModeConfirm({ startLabel, hasMeals, onChoose, onCancel }: Props) {
  return (
    <div className="plan-browser__confirm">
      <p className="plan-browser__confirm-label" role="status">
        {hasMeals
          ? `The week starting ${startLabel} already has meals.`
          : `Apply meals starting ${startLabel}?`}
      </p>
      <div className="plan-browser__actions">
        <button
          type="button"
          className={`btn btn--small ${hasMeals ? "btn--ghost" : "btn--primary"}`}
          onClick={() => onChoose("add")}
        >
          {hasMeals ? "Add on top" : "Confirm apply"}
        </button>
        {hasMeals && (
          <button type="button" className="btn btn--primary btn--small" onClick={() => onChoose("replace")}>
            Replace existing
          </button>
        )}
        <button type="button" className="btn btn--ghost btn--small" onClick={onCancel} autoFocus>
          Cancel
        </button>
      </div>
    </div>
  );
}
