// What people see when loading or saving preferences fails. The database's
// own message (e.g. "column profiles.week_starts_on does not exist") means
// nothing to them, so api.ts keeps it only as the error's `cause`.
export const LOAD_PREFERENCES_ERROR = "Couldn't load your preferences.";
export const SAVE_PREFERENCES_ERROR = "Couldn't save your preferences. Check your connection and try again.";
