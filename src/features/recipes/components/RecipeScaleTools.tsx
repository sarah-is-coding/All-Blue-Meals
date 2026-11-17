type RecipeScaleToolsProps = {
  /** Servings the current quantities are written for. */
  baseServings: number | null;
  /** Servings entered in the form, the target of scaling. */
  targetServings: number | null;
  canScale: boolean;
  disabled: boolean;
  onScale: () => void;
};

/** Edit-mode box that rescales every quantity to the servings entered. */
export default function RecipeScaleTools({
  baseServings,
  targetServings,
  canScale,
  disabled,
  onScale,
}: RecipeScaleToolsProps) {
  return (
    <section className="recipe-scale-tools">
      <h2>Ingredient scaling</h2>
      <p>Current ingredient quantities are based on {baseServings ?? "unknown"} servings.</p>
      <button type="button" className="btn btn--ghost" onClick={onScale} disabled={disabled || !canScale}>
        {canScale ? `Scale ingredients to ${targetServings} servings` : "Adjust servings to enable scaling"}
      </button>
    </section>
  );
}
