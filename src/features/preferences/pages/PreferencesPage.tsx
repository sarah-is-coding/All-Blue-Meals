import { useEffect, useState } from "react";
import { SAVE_PREFERENCES_ERROR } from "../constants";
import PlanningCadenceField from "../components/PlanningCadenceField";
import WeekStartField from "../components/WeekStartField";
import { usePreferencesActions, useUserPreferencesQuery } from "../queries";
import {
  parsePreferencesForm,
  samePreferences,
  toPreferencesFormValues,
  type PreferencesFormValues,
} from "../utils/preferencesForm";

// "Saved" fades out by itself after this long.
const SAVED_MS = 4000;

/**
 * The user's preferences, in sections (just "Meal planning" for now; new
 * kinds of preference get their own section). One Save button for the page.
 */
export default function PreferencesPage() {
  const { preferences, error: loadError } = useUserPreferencesQuery();
  const { save } = usePreferencesActions();
  const [values, setValues] = useState<PreferencesFormValues>(() => toPreferencesFormValues(preferences));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!saved) return;
    const timer = window.setTimeout(() => setSaved(false), SAVED_MS);
    return () => window.clearTimeout(timer);
  }, [saved]);

  const parsed = parsePreferencesForm(values);
  const changed = parsed.preferences !== null && !samePreferences(parsed.preferences, preferences);

  const update = (changes: Partial<PreferencesFormValues>) => {
    setValues((current) => ({ ...current, ...changes }));
    setSaved(false);
    setSaveError(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!parsed.preferences || !changed || saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      const result = await save(parsed.preferences);
      setValues(toPreferencesFormValues(result));
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error && error.message ? error.message : SAVE_PREFERENCES_ERROR);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="workspace-route preferences">
      <form className="workspace-card preferences-card" onSubmit={handleSubmit}>
        <h1>Preferences</h1>
        {loadError ? (
          <p className="error" role="alert">
            Couldn't load your saved preferences, so the defaults are shown below. Reload the page to try again.
          </p>
        ) : null}

        <section className="preferences-section" aria-labelledby="preferences-meal-planning">
          <h2 id="preferences-meal-planning">Meal planning</h2>
          <PlanningCadenceField values={values} onChange={update} error={parsed.error} />
          <WeekStartField value={values.weekStartsOn} onChange={(weekStartsOn) => update({ weekStartsOn })} />
        </section>

        <div className="preferences-card__actions">
          <button type="submit" className="btn btn--primary" disabled={!changed || saving}>
            {saving ? "Saving…" : "Save preferences"}
          </button>
          {saved ? (
            <p className="message preferences-card__saved" role="status">
              Preferences saved.
            </p>
          ) : null}
        </div>
        {saveError ? (
          <p className="error" role="alert">
            {saveError}
          </p>
        ) : null}
      </form>
    </section>
  );
}
