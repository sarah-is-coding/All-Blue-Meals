// Normalize one whole ingredient line (name + quantity + unit + notes) the way
// it should be saved: clean name, canonical unit, notes holding size/prep,
// substitutes split out, and lists or "salt and pepper" split into rows.

import { cleanMissingText, joinNotes } from "../../../lib/utils/text";
import { normalizeUnit } from "../../../lib/utils/units";
import {
  parseIngredientText,
  type ParseOptions,
  type ParsedName,
  type ReviewFlag,
} from "./ingredientText";

export type IngredientLineInput = {
  ingredientName: string | null | undefined;
  quantity: string | null | undefined;
  unit: string | null | undefined;
  notes: string | null | undefined;
};

export type NormalizedIngredient = {
  ingredientName: string;
  quantity: string;
  unit: string;
  notes: string;
};

export type NormalizedLine = NormalizedIngredient & { substitutes: NormalizedIngredient[] };

export type NormalizedLineResult = {
  lines: NormalizedLine[];
  flags: ReviewFlag[];
};

/**
 * Normalize one ingredient line. Usually returns one line; returns several
 * when the name was a list or combined staples. A list's items don't get the
 * original amount (it was for all of them together), so it's kept as a note.
 */
export const normalizeIngredientLine = (
  input: IngredientLineInput,
  options: ParseOptions = {}
): NormalizedLineResult => {
  const quantity = cleanMissingText(input.quantity);
  const lineNotes = cleanMissingText(input.notes);
  const unit = normalizeUnit(input.unit);
  const parsed = parseIngredientText(cleanMissingText(input.ingredientName), options);

  const build = (name: ParsedName, extraNotes: string[], amount: string, unitText: string) => ({
    ingredientName: name.name,
    quantity: amount,
    unit: unitText || (amount ? name.unitHint ?? "" : ""),
    notes: joinNotes([...name.notes, ...extraNotes]),
  });

  if (parsed.split === "list") {
    const together = [quantity, unit.unit].filter(Boolean).join(" ");
    const shared = together ? [`part of ${together}`] : [];
    return {
      lines: parsed.items.map((item) => ({
        ...build(item, [...unit.notes, lineNotes, ...shared], "", ""),
        substitutes: [],
      })),
      flags: parsed.flags,
    };
  }

  return {
    lines: parsed.items.map((item) => ({
      ...build(item, [...unit.notes, lineNotes], quantity, unit.unit),
      substitutes: item.substitutes.map((sub) => build(sub, [], quantity, unit.unit)),
    })),
    flags: parsed.flags,
  };
};
