// Writes the step 7 data migration from the approved plan.json. Run
// `npm run cleanup:migration` after `npm run cleanup:review` once review.md is
// approved. Refuses to overwrite the migration once it exists (it may already
// be applied); pass --force to regenerate one that hasn't been.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderCleanupMigration, type ApprovedPlan } from "./migration";
import { SEED_ALIASES } from "./seedAliases";

const MIGRATION = "supabase/migrations/20261117200000_ingredient_catalog_cleanup.sql";

const root = process.cwd();
const target = join(root, MIGRATION);
if (existsSync(target) && !process.argv.includes("--force")) {
  console.error(`${MIGRATION} already exists. Pass --force only if it hasn't been applied.`);
  process.exit(1);
}
const plan = JSON.parse(readFileSync(join(root, "scripts/ingredient-cleanup/plan.json"), "utf8")) as ApprovedPlan;
writeFileSync(target, renderCleanupMigration(plan, SEED_ALIASES));
console.log(`Wrote ${MIGRATION}`);
