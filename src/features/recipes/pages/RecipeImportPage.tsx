import { Link, useNavigate } from "react-router-dom";
import { useRecipeActions } from "../queries";
import RecipeAiImportPanel from "../components/RecipeAiImportPanel";
import { extractRecipesFromText } from "../api";
import type { ImportedRecipe } from "../types";
import { mapImportedRecipeToInput } from "../utils/recipeImport";

export default function RecipeImportPage() {
  const navigate = useNavigate();
  const { create: createRecipe } = useRecipeActions();

  const handleUseImportedDraft = (recipe: ImportedRecipe) => {
    navigate("/recipes/new", { state: { importedRecipe: recipe } });
  };

  const handleCreateImportedRecipes = async (recipes: ImportedRecipe[]) => {
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
          <h1>Import Recipe</h1>
          <Link className="btn btn--ghost" to="/recipes">
            Back to Recipes
          </Link>
        </div>
        <p>Extract recipe drafts from notes, links, or both.</p>
      </article>

      <RecipeAiImportPanel
        runRequest={extractRecipesFromText}
        onUseDraft={handleUseImportedDraft}
        onCreateRecipes={handleCreateImportedRecipes}
      />
    </section>
  );
}
