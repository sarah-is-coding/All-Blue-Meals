// Step 7 of docs/ingredient-normalization.md: build the cleanup plan from a
// snapshot of the catalog and write it for review. Run `npm run cleanup:review`.
// Writes review.md (for a person) and plan.json (for the migration generator).
// Reads nothing from the database: the snapshot is in data/.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildCleanupPlan, type Overrides } from "./plan";
import { renderReview } from "./report";

const SNAPSHOT_DATE = "2026-11-17";
const here = dirname(fileURLToPath(import.meta.url));
// The bundled script runs from node_modules/.tmp; the files live next to the source.
const root = existsSync(join(here, "data")) ? here : join(process.cwd(), "scripts", "ingredient-cleanup");

const read = (file: string) => readFileSync(join(root, file), "utf8");
const catalogNames = read("data/catalog-names.txt").split("\n").map((line) => line.trim()).filter(Boolean);
const units = JSON.parse(read("data/units.json")) as string[];
const unused = JSON.parse(read("data/unused.json")) as string[];
const overrides: Overrides = existsSync(join(root, "overrides.json")) ? JSON.parse(read("overrides.json")) : {};

const plan = buildCleanupPlan(catalogNames, units, overrides);
writeFileSync(join(root, "plan.json"), `${JSON.stringify({ snapshotDate: SNAPSHOT_DATE, unused, noAlias: overrides.noAlias ?? [], ...plan }, null, 2)}\n`);
writeFileSync(join(root, "review.md"), renderReview(plan, unused, SNAPSHOT_DATE));

const changed = plan.sources.filter((source) => source.action.kind !== "unchanged").length;
console.log(`${catalogNames.length} ingredients, ${changed} change. Wrote review.md and plan.json in ${root}`);
