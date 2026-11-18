// Works out what the cleanup does to each catalog ingredient, using the app's
// own naming rules (src/features/ingredients/utils), so the result matches
// what imports produce from now on. Pure: input names in, plan out.

import { chooseDisplayName, ingredientKey } from "../../src/features/ingredients/utils/ingredientKey";
import { parseIngredientText, type ReviewFlag } from "../../src/features/ingredients/utils/ingredientText";
import { normalizeUnit } from "../../src/lib/utils/units";
import { SEED_ALIASES } from "./seedAliases";

export type Overrides = {
  /** Catalog names to leave exactly as they are. */
  keep?: string[];
  /** Group key → the name to use instead of the chosen one. */
  names?: Record<string, string>;
  /** Catalog name → corrected text, cleaned by the same rules instead of the name. */
  rewrite?: Record<string, string>;
  /** Names not to record as aliases when merged away: too ambiguous to resolve later. */
  noAlias?: string[];
};

export type TargetRef = { key: string; notes: string[]; unitHint: string | null };

export type SourceAction =
  | { kind: "unchanged" }
  | { kind: "rename" | "merge"; target: TargetRef }
  | { kind: "substitutes"; target: TargetRef; substitutes: TargetRef[] }
  | { kind: "split"; how: "list" | "staples"; items: TargetRef[] };

export type SourcePlan = { name: string; action: SourceAction; flags: ReviewFlag[] };

export type GroupPlan = {
  key: string;
  name: string;
  /** Catalog names merged into this ingredient (one keeps its row and id). */
  owners: string[];
  /** Catalog names whose split or substitutes point here. */
  referencedBy: string[];
  /** No current ingredient becomes this one: it's created by the cleanup. */
  created: boolean;
  /** Seed synonyms recorded as aliases of this ingredient. */
  seedAliases: string[];
};

export type UnitPlan = { raw: string; unit: string; notes: string[]; sizeUnit?: string };

export type CleanupPlan = {
  sources: SourcePlan[];
  groups: GroupPlan[];
  units: UnitPlan[];
};

const seedTargets = () => {
  const toCanonical = new Map<string, string>();
  const canonicalName = new Map<string, string>();
  for (const [canonical, variants] of Object.entries(SEED_ALIASES)) {
    const canonicalKey = ingredientKey(canonical);
    canonicalName.set(canonicalKey, canonical);
    for (const variant of variants) toCanonical.set(ingredientKey(variant), canonicalKey);
  }
  return { toCanonical, canonicalName };
};

export function buildCleanupPlan(
  catalogNames: string[],
  unitValues: string[],
  overrides: Overrides = {}
): CleanupPlan {
  const { toCanonical, canonicalName } = seedTargets();
  const resolve = (name: string) => {
    const key = ingredientKey(name);
    return toCanonical.get(key) ?? key;
  };
  const catalogKeys = new Set(catalogNames.map(resolve));
  const keep = new Set(overrides.keep ?? []);

  type GroupDraft = { owners: string[]; referencedBy: string[]; candidates: string[]; seedAliases: Set<string> };
  const groups = new Map<string, GroupDraft>();
  const group = (key: string) => {
    let draft = groups.get(key);
    if (!draft) {
      draft = { owners: [], referencedBy: [], candidates: [], seedAliases: new Set() };
      groups.set(key, draft);
    }
    return draft;
  };
  const ref = (name: string, notes: string[], unitHint: string | null): TargetRef => ({
    key: resolve(name),
    notes,
    unitHint,
  });

  const sources: SourcePlan[] = catalogNames.map((name) => {
    if (keep.has(name)) {
      const target = group(ingredientKey(name));
      target.owners.push(name);
      target.candidates.push(name);
      return { name, action: { kind: "unchanged" }, flags: [] };
    }
    const text = overrides.rewrite?.[name] ?? name;
    const parsed = parseIngredientText(text, { isKnownIngredient: (n) => catalogKeys.has(resolve(n)) });
    const noteSeed = (key: string, written: string) => {
      if (toCanonical.has(ingredientKey(written))) group(key).seedAliases.add(written);
    };

    if (parsed.split) {
      const items = parsed.items.map((item) => ref(item.name, item.notes, item.unitHint));
      parsed.items.forEach((item, index) => {
        const target = group(items[index]!.key);
        target.referencedBy.push(name);
        target.candidates.push(item.name);
        noteSeed(items[index]!.key, item.name);
      });
      return { name, action: { kind: "split", how: parsed.split, items }, flags: parsed.flags };
    }

    const [item] = parsed.items;
    if (!item) return { name, action: { kind: "unchanged" }, flags: parsed.flags };
    const main = ref(item.name, item.notes, item.unitHint);
    const mainGroup = group(main.key);
    mainGroup.owners.push(name);
    mainGroup.candidates.push(item.name);
    noteSeed(main.key, item.name);
    noteSeed(main.key, name);

    if (item.substitutes.length > 0) {
      const substitutes = item.substitutes.map((sub) => ref(sub.name, sub.notes, sub.unitHint));
      item.substitutes.forEach((sub, index) => {
        const target = group(substitutes[index]!.key);
        target.referencedBy.push(name);
        target.candidates.push(sub.name);
      });
      return { name, action: { kind: "substitutes", target: main, substitutes }, flags: parsed.flags };
    }
    return { name, action: { kind: "rename", target: main }, flags: parsed.flags };
  });

  const groupPlans: GroupPlan[] = [...groups.entries()]
    .map(([key, draft]) => {
      const uses = new Map<string, number>();
      for (const candidate of draft.candidates) uses.set(candidate, (uses.get(candidate) ?? 0) + 1);
      const chosen =
        overrides.names?.[key] ??
        canonicalName.get(key) ??
        chooseDisplayName([...uses.entries()].map(([candidate, count]) => ({ name: candidate, uses: count })));
      return {
        key,
        name: chosen,
        owners: draft.owners,
        referencedBy: [...new Set(draft.referencedBy)],
        created: draft.owners.length === 0,
        seedAliases: [...draft.seedAliases].filter((alias) => ingredientKey(alias) !== key),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  // A source that stays one ingredient is a merge when others join its group.
  const byKey = new Map(groupPlans.map((plan) => [plan.key, plan]));
  for (const source of sources) {
    const { action } = source;
    if (action.kind !== "rename") continue;
    const target = byKey.get(action.target.key)!;
    const untouched =
      target.owners.length === 1 && target.name === source.name && action.target.notes.length === 0 && !action.target.unitHint;
    source.action = untouched ? { kind: "unchanged" } : { kind: target.owners.length > 1 ? "merge" : "rename", target: action.target };
  }

  const units = unitValues.map((raw) => ({ raw, ...normalizeUnit(raw) }));
  return { sources, groups: groupPlans, units };
}
