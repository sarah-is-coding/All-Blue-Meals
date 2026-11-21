import type { RecipeListView } from "./types";

/** Longest recipe note, in characters; matches the recipe_notes check constraint. */
export const MAX_NOTE_LENGTH = 2000;

/** Id of a recipe page's notes section: link to `/recipes/<id>#notes` to jump there. */
export const RECIPE_NOTES_ANCHOR = "notes";

/** The ways the recipes page can show recipes, in the View menu. New views go here. */
export const RECIPE_VIEWS: Array<{ value: RecipeListView; label: string }> = [
  { value: "list", label: "List" },
  { value: "tags", label: "Tag folders" },
];
