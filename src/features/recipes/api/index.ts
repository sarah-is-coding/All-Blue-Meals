// The recipes feature's Supabase calls, split by area:
// - recipes.ts: list, detail, create, update, rate, delete
// - ingredientRows.ts: preparing and atomically saving a recipe's ingredients
// - importRecipes.ts: AI import and generation (edge function)
// - notes.ts: a recipe's dated notes
export { createRecipe, deleteRecipe, getRecipeById, listRecipes, listRecipeTags, rateRecipe, updateRecipe } from "./recipes";
export { extractRecipesFromText, generateRecipesFromPrompt } from "./importRecipes";
export { addRecipeNote, deleteRecipeNote, listRecipeNotes, updateRecipeNote } from "./notes";
