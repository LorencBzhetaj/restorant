import { PrismaClient } from "@prisma/client";
import { bootstrapVillaGjecaj } from "../src/lib/villa-gjecaj-bootstrap";

/**
 * CLI wrapper for the Villa Gjeçaj bootstrap.
 *
 *   npm run bootstrap:villa-gjecaj                 # local DB only
 *   npm run bootstrap:villa-gjecaj -- --confirm    # required for a REMOTE db
 *
 * Runs manually only — never wired into build, migrate or deploy. It reads the
 * connection from DATABASE_URL (via Prisma); no credentials are stored here and
 * the connection string itself is never printed (only the host).
 */

function dbHost(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host || "(unknown)";
  } catch {
    return "(unknown)";
  }
}

function isLocalHost(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(host);
}

async function main() {
  const host = dbHost();
  const local = isLocalHost(host);
  const confirmed = process.argv.includes("--confirm") || process.env.BOOTSTRAP_CONFIRM === "yes";

  if (!local && !confirmed) {
    console.error(`✋ Refusing to modify a non-local database ("${host}") without confirmation.`);
    console.error(`   This is the production safety guard.`);
    console.error(`   Re-run explicitly:  npm run bootstrap:villa-gjecaj -- --confirm`);
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    console.log(`Villa Gjeçaj bootstrap → database host: ${host}${local ? " (local)" : " (REMOTE — confirmed)"}\n`);
    const actions = await bootstrapVillaGjecaj(prisma);
    for (const a of actions) {
      const label =
        a.status === "created" ? "＋ CREATED" : a.status === "updated" ? "✎ UPDATED" : "✓ OK      ";
      console.log(`  ${label}  ${a.record} — ${a.detail}`);
    }
    const n = (s: BootstrapCount) => actions.filter((a) => a.status === s).length;
    console.log(
      `\nDone. ${n("created")} created, ${n("updated")} updated, ${n("already-correct")} already correct.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

type BootstrapCount = "created" | "updated" | "already-correct";

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
