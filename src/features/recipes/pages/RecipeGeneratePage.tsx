import { Link, useNavigate } from "react-router-dom";
import { useGenerateRecipes, useRecipeActions } from "../queries";
import RecipeAiImportPanel from "../components/RecipeAiImportPanel";
import type { ImportedRecipe } from "../types";
import { mapImportedRecipeToInput } from "../utils/recipeImport";

export default function RecipeGeneratePage() {
  const navigate = useNavigate();
  const { create: createRecipe } = useRecipeActions();
  const generateRecipes = useGenerateRecipes();

  const handleUseGeneratedDraft = (recipe: ImportedRecipe) => {
    navigate("/recipes/new", { state: { importedRecipe: recipe } });
  };

  const handleCreateGeneratedRecipes = async (recipes: ImportedRecipe[]) => {
    const recipeIds = [];
    for (const recipe of recipes) {
      const recipeId = await createRecipe(mapImportedRecipeToInput(recipe));
      recipeIds.push(recipeId);
    }

    navigate(
      recipeIds.length === 1 ? `/recipes/${recipeIds[0]}` : "/recipes"
    );
  };

  return (
    <section className="workspace-route recipe-route">
      <article className="workspace-card">
        <div className="recipe-page-header">
          <h1>Generate Recipe</h1>
          <Link className="btn btn--ghost" to="/recipes">
            Back to Recipes
          </Link>
        </div>
        <p>Describe what you want and generate one or more recipe drafts.</p>
      </article>

      <RecipeAiImportPanel
        actionLabel="generated"
        emptyResultMessage="No recipes were generated. Add more details about what you want."
        errorMessage="Failed to generate recipes."
        helperText="Describe the recipe ideas, ingredients, servings, time, style, or constraints you want."
        inputLabel="Recipe request"
        panelTitle="AI Generate"
        placeholder="Generate 3 quick high-protein dinners using chicken, rice, and vegetables. Keep each under 35 minutes."
        runLabel="Generate recipes"
        runLoadingLabel="Generating..."
        runRequest={generateRecipes.mutateAsync}
        onUseDraft={handleUseGeneratedDraft}
        onCreateRecipes={handleCreateGeneratedRecipes}
      />
    </section>
  );
}
