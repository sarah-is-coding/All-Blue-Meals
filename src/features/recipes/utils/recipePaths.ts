import { RECIPE_NOTES_ANCHOR } from "../constants";

/** A recipe's page, optionally scrolled to its notes section. */
export const recipePath = (recipeId: string, section?: "notes"): string =>
  `/app/recipes/${recipeId}${section === "notes" ? `#${RECIPE_NOTES_ANCHOR}` : ""}`;
