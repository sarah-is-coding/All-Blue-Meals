import type { PreferencesFormValues } from "../utils/preferencesForm";

type Props = {
  value: PreferencesFormValues["weekStartsOn"];
  onChange: (value: PreferencesFormValues["weekStartsOn"]) => void;
};

const OPTIONS: ReadonlyArray<{ value: PreferencesFormValues["weekStartsOn"]; label: string }> = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
];

/** Which day the planner's week, the calendars, and "this week" start on. */
export default function WeekStartField({ value, onChange }: Props) {
  return (
    <fieldset className="preferences-field">
      <legend className="preferences-field__legend">Weeks start on</legend>
      <p className="preferences-field__hint">Used by the meal planner, the calendars, and grocery list dates.</p>
      <div className="preferences-field__options">
        {OPTIONS.map((option) => (
          <label key={option.value} className="preferences-option">
            <input
              type="radio"
              name="week-starts-on"
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
