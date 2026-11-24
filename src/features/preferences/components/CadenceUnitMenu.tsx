import { useEffect, useRef, useState } from "react";
import type { CadenceUnit } from "../../../lib/preferences/types";
import { CADENCE_UNIT_OPTIONS } from "../utils/preferencesForm";

type Props = {
  value: CadenceUnit;
  onChange: (unit: CadenceUnit) => void;
};

/**
 * "weeks ▾": picks days, weeks or months for a custom cadence. Looks like the
 * Recipes page's Add Recipe / View menus (a button that opens a small panel),
 * and closes on a pick, a tap outside, or Escape.
 */
export default function CadenceUnitMenu({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const current = CADENCE_UNIT_OPTIONS.find((option) => option.value === value) ?? CADENCE_UNIT_OPTIONS[1]!;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideTap = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutsideTap);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutsideTap);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div className="preferences-unit-menu" ref={rootRef}>
      <button
        type="button"
        className="btn btn--ghost preferences-unit-menu__button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="cadence-unit-menu"
        aria-label={`Unit: ${current.label}`}
      >
        {current.label} <span aria-hidden="true">▾</span>
      </button>
      {open ? (
        <div id="cadence-unit-menu" className="preferences-unit-menu__panel" role="menu" aria-label="Days, weeks or months">
          {CADENCE_UNIT_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="menuitemradio"
              aria-checked={option.value === value}
              className={[
                "preferences-unit-menu__item",
                option.value === value ? "preferences-unit-menu__item--current" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                setOpen(false);
                if (option.value !== value) onChange(option.value);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
