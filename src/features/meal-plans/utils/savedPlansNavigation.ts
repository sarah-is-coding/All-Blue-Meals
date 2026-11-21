// The round trip from a Saved plans tab to the Saved Meal Plans page and
// back: the "Manage" link records which page it came from, and the page's
// back link returns there with the Saved plans tab open again.

/** Pages with a Saved plans tab, and how the back link names them. */
const RETURN_PAGES = {
  "/meal-plans": "Meal Plans",
  "/grocery": "Grocery Lists",
} as const;

type ReturnPath = keyof typeof RETURN_PAGES;

const DEFAULT_RETURN: ReturnPath = "/meal-plans";

/** Router state on the "Manage" link: where it was opened from. */
export type ManageSavedPlansState = { returnTo: ReturnPath };

/** Router state on the way back: open the Saved plans tab. */
export type OpenSavedPlansTabState = { planBrowserTab: "saved" };

function isReturnPath(value: unknown): value is ReturnPath {
  return typeof value === "string" && Object.hasOwn(RETURN_PAGES, value);
}

/** The state for the "Manage" link on the page at `pathname`. */
export function manageSavedPlansState(pathname: string): ManageSavedPlansState | undefined {
  return isReturnPath(pathname) ? { returnTo: pathname } : undefined;
}

/**
 * Where the Saved Meal Plans page's back link goes: the page the user came
 * from (the planner when unknown, e.g. after a reload or a direct visit).
 */
export function savedPlansBackLink(state: unknown): {
  to: ReturnPath;
  label: string;
  state: OpenSavedPlansTabState;
} {
  const returnTo = (state as Partial<ManageSavedPlansState> | null)?.returnTo;
  const to = isReturnPath(returnTo) ? returnTo : DEFAULT_RETURN;
  return { to, label: RETURN_PAGES[to], state: { planBrowserTab: "saved" } };
}

/** Whether the page was opened asking for its Saved plans tab. */
export function opensSavedPlansTab(state: unknown): boolean {
  return (state as Partial<OpenSavedPlansTabState> | null)?.planBrowserTab === "saved";
}
