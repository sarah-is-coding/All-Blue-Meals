import { CADENCE_MAX } from "../../../lib/preferences/types";
import { CADENCE_PRESETS, type CadenceChoice, type PreferencesFormValues } from "../utils/preferencesForm";
import CadenceUnitMenu from "./CadenceUnitMenu";

type Props = {
  values: PreferencesFormValues;
  onChange: (changes: Partial<PreferencesFormValues>) => void;
  /** What's wrong with the custom cadence, shown under it. */
  error: string | null;
};

/** How often you usually plan: a quick choice, or any number of days, weeks or months. */
export default function PlanningCadenceField({ values, onChange, error }: Props) {
  const choices: ReadonlyArray<{ value: CadenceChoice; label: string }> = [
    ...CADENCE_PRESETS,
    { value: "custom", label: "Custom" },
  ];
  const custom = values.cadenceChoice === "custom";

  return (
    <fieldset className="preferences-field">
      <legend className="preferences-field__legend">How often do you plan meals?</legend>
      <p className="preferences-field__hint">
        The planner's Calendar tab and the grocery list start on this many days, and their arrows move by it.
      </p>

      <div className="preferences-field__options">
        {choices.map((choice) => (
          <label key={choice.value} className="preferences-option">
            <input
              type="radio"
              name="planning-cadence"
              value={choice.value}
              checked={values.cadenceChoice === choice.value}
              onChange={() => onChange({ cadenceChoice: choice.value })}
            />
            <span>{choice.label}</span>
          </label>
        ))}
      </div>

      {custom ? (
        <div className="preferences-custom-cadence">
          <span>Every</span>
          <input
            className="preferences-custom-cadence__count"
            type="number"
            inputMode="numeric"
            min={1}
            max={CADENCE_MAX[values.customUnit]}
            step={1}
            aria-label="How many"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "planning-cadence-error" : undefined}
            value={values.customCount}
            onChange={(event) => onChange({ customCount: event.target.value })}
          />
          <CadenceUnitMenu value={values.customUnit} onChange={(customUnit) => onChange({ customUnit })} />
        </div>
      ) : null}

      {custom && error ? (
        <p id="planning-cadence-error" className="error" role="alert">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
