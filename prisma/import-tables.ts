import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { guardDestructiveWrite } from "./guard-production";
import { importTableConfig, type TableConfig } from "../src/lib/table-import";

/**
 * CLI for the idempotent table/combination importer.
 *
 *   npm run import:tables -- config/villa-gjecaj-tables.json
 *   npm run import:tables -- config/villa-gjecaj-tables.json --confirm   # remote DB
 *   npm run import:tables -- config/villa-gjecaj-tables.json --dry-run   # validate only
 *
 * Reads a JSON config, validates it, and (unless --dry-run) applies it. Writes to
 * a non-local database require --confirm. No credentials are read or printed here.
 */

function loadConfig(path: string): TableConfig {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  const outdoor = raw.expectedCounts?.outdoor;
  return {
    tables: Array.isArray(raw.tables) ? raw.tables : [],
    combinations: Array.isArray(raw.combinations) ? raw.combinations : [],
    expectedCounts: {
      indoor: raw.expectedCounts?.indoor ?? undefined,
      outdoor: outdoor === null ? undefined : outdoor,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const path = args.find((a) => !a.startsWith("--"));
  if (!path) {
    console.error("Usage: npm run import:tables -- <config.json> [--confirm] [--dry-run]");
    process.exit(1);
  }

  if (!dryRun) guardDestructiveWrite("import:tables");

  const config = loadConfig(path);
  if (config.tables.length === 0) {
    console.error(`No tables in ${path}. Fill in the real table data first (see the template).`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    const r = await importTableConfig(prisma, config, { apply: !dryRun });
    const line = (label: string, s: { created: string[]; updated: string[]; unchanged: string[] }) =>
      console.log(`${label}: ${s.created.length} created, ${s.updated.length} updated, ${s.unchanged.length} unchanged`);
    console.log(dryRun ? "\n— DRY RUN (no changes written) —" : "");
    line("Tables", r.tables);
    line("Combinations", r.combinations);
    if (r.conflicts.length) {
      console.log(`\n⚠ ${r.conflicts.length} conflict(s):`);
      for (const c of r.conflicts) console.log(`  - ${c}`);
    }
    console.log(`\nVerification: Indoor=${r.verification.indoorCount} Outdoor=${r.verification.outdoorCount}` +
      (r.verification.expected ? ` (expected Indoor=${r.verification.expected.indoor ?? "any"} Outdoor=${r.verification.expected.outdoor ?? "any"})` : ""));
    if (r.verification.duplicateNames.length) console.log(`  Duplicate names: ${r.verification.duplicateNames.join(", ")}`);
    console.log(r.verification.ok ? "✓ Verification passed." : "✗ Verification FAILED — resolve the items above.");
    process.exit(r.verification.ok ? 0 : 2);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
