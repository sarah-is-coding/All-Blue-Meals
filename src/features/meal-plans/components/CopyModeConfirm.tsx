import type { CopyMode } from "../types";

/** Asked before copying or applying meals onto a week that already has some. */
export default function CopyModeConfirm({ onChoose }: { onChoose: (mode: CopyMode) => void }) {
  return (
    <div className="plan-browser__confirm">
      <p className="plan-browser__confirm-label">
        The week you're viewing already has meals. What would you like to do?
      </p>
      <div className="plan-browser__actions">
        <button type="button" className="btn btn--ghost" onClick={() => onChoose("add")}>
          Add on top
        </button>
        <button type="button" className="btn btn--primary" onClick={() => onChoose("replace")}>
          Replace existing
        </button>
      </div>
    </div>
  );
}
