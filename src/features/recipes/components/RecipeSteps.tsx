import { useState } from "react";
import { parseSteps, splitCookingCues } from "../utils/recipeSteps";

type Props = {
  instructions: string;
};

/**
 * A recipe's instructions as numbered steps, with times, temperatures and heat
 * levels in bold. Tapping a step marks it done (to keep your place while
 * cooking); that's only for this visit, never saved.
 */
export default function RecipeSteps({ instructions }: Props) {
  const steps = parseSteps(instructions);
  const [done, setDone] = useState<ReadonlySet<number>>(() => new Set());
  // New instructions (e.g. after an edit) start with nothing ticked.
  const [stepsFor, setStepsFor] = useState(instructions);
  if (stepsFor !== instructions) {
    setStepsFor(instructions);
    setDone(new Set());
  }

  if (steps.length === 0) return <p>No instructions added yet.</p>;

  const toggle = (index: number) =>
    setDone((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  return (
    <div className="recipe-steps">
      <p className="recipe-steps__hint">Tap a step to mark it done.</p>
      <ol className="recipe-steps__list">
        {steps.map((step, index) => {
          const isDone = done.has(index);
          return (
            <li key={index} className="recipe-steps__item">
              <button
                type="button"
                className={`recipe-steps__step${isDone ? " recipe-steps__step--done" : ""}`}
                aria-pressed={isDone}
                onClick={() => toggle(index)}
              >
                <span className="recipe-steps__number" aria-hidden="true">
                  {isDone ? "✓" : index + 1}
                </span>
                <span className="recipe-steps__text">
                  {splitCookingCues(step).map((part, partIndex) =>
                    part.cue ? (
                      <strong key={partIndex} className="recipe-steps__cue">
                        {part.text}
                      </strong>
                    ) : (
                      <span key={partIndex}>{part.text}</span>
                    )
                  )}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      {done.size > 0 ? (
        <div className="recipe-steps__footer">
          <span className="recipe-steps__progress" aria-live="polite">
            {done.size} of {steps.length} done
          </span>
          <button type="button" className="btn btn--ghost btn--small" onClick={() => setDone(new Set())}>
            Reset steps
          </button>
        </div>
      ) : null}
    </div>
  );
}
