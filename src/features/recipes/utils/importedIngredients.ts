// Turn an imported recipe's ingredients into recipe rows, applying the
// ingredient naming rules (ingredients/utils/ingredientLine.ts) as a safety
// net behind the AI prompt: prep and size words move to notes, "or" options
// and the AI's substitutes become substitute rows, "salt and pepper" and comma
// lists become separate rows, and "null" text is cleared.

import { normalizeIngredientLine, type NormalizedIngredient } from "../../ingredients/utils/ingredientLine";
import { ingredientKey } from "../../ingredients/utils/ingredientKey";
import type { ReviewFlag } from "../../ingredients/utils/ingredientText";
import { toCategoryCode } from "../../ingredients/categories/codes";
import type { IngredientCategory } from "../../ingredients/types";
import type { ImportedIngredientOption, ImportedRecipeIngredient } from "../types";

export type ImportedIngredientRow = {
  id: string;
  ingredientName: string;
  quantity: string;
  unit: string;
  notes: string;
  category: IngredientCategory | null;
  substituteFor: string | null;
  canonicalName: string | null;
};

/** The AI's canonical name, when it names something other than the written name. */
const canonicalFor = (option: ImportedIngredientOption, cleanedName: string): string | null => {
  const canonical = option.canonicalName?.trim() ?? "";
  if (!canonical) return null;
  const canonicalKey = ingredientKey(canonical);
  return canonicalKey && canonicalKey !== ingredientKey(cleanedName) ? canonical.toLowerCase() : null;
};

const normalizeOption = (option: ImportedIngredientOption) =>
  normalizeIngredientLine({
    ingredientName: option.ingredientName,
    quantity: option.quantity,
    unit: option.unit,
    notes: option.notes,
  });

/**
 * Rows for every imported ingredient, in order: each main row followed by
 * its substitutes. `makeId` gives each row its id (form row id or client id).
 */
export const importedIngredientRows = (
  ingredients: ReadonlyArray<ImportedRecipeIngredient>,
  makeId: () => string
): ImportedIngredientRow[] => {
  const rows: ImportedIngredientRow[] = [];

  const push = (
    line: NormalizedIngredient,
    option: ImportedIngredientOption,
    substituteFor: string | null,
    singleLine: boolean
  ) => {
    const row: ImportedIngredientRow = {
      id: makeId(),
      ingredientName: line.ingredientName,
      quantity: line.quantity,
      unit: line.unit,
      notes: line.notes,
      category: toCategoryCode(option.category),
      substituteFor,
      // A canonical name only applies when the line wasn't split into several.
      canonicalName: singleLine ? canonicalFor(option, line.ingredientName) : null,
    };
    rows.push(row);
    return row;
  };

  for (const ingredient of ingredients) {
    const { lines } = normalizeOption(ingredient);
    lines.forEach((line, index) => {
      const main = push(line, ingredient, null, lines.length === 1);
      for (const substitute of line.substitutes) {
        push(substitute, ingredient, main.id, false);
      }
      // The AI's own substitutes belong to the first row of this ingredient.
      if (index === 0) {
        for (const option of ingredient.substitutes ?? []) {
          const optionLines = normalizeOption(option).lines;
          for (const optionLine of optionLines) {
            push(optionLine, option, main.id, optionLines.length === 1);
          }
        }
      }
    });
  }
  return rows;
};

const FLAG_MESSAGES: Record<ReviewFlag, (name: string) => string> = {
  list: (name) => `"${name}" looked like a list, so it was split into separate ingredients. Check the amounts.`,
  "unclear-comma": (name) => `Check "${name}": part of it may belong in the notes.`,
  placeholder: (name) => `"${name}" isn't something you can buy. Replace it with the actual ingredients.`,
  brand: (name) => `"${name}" includes a brand name. Consider moving the brand to the notes.`,
};

/** Warnings for imported ingredient names a person should look at. */
export const importedIngredientWarnings = (
  ingredients: ReadonlyArray<ImportedRecipeIngredient>
): string[] =>
  ingredients.flatMap((ingredient) =>
    normalizeOption(ingredient).flags.map((flag) => FLAG_MESSAGES[flag](ingredient.ingredientName.trim()))
  );
