// Shared guard for scripts that can DELETE or RESET data. Refuses to run against
// a non-local database unless an explicit confirmation flag is given, and prints
// only the host (never the connection string / credentials).

export function guardDestructiveWrite(actionName: string): void {
  const url = process.env.DATABASE_URL ?? "";
  let host = "(unknown)";
  try {
    host = new URL(url).host || "(unknown)";
  } catch {
    /* leave as unknown */
  }
  const isLocal = /^(localhost|127\.0\.0\.1|\[::1\])(:|$)/i.test(host);
  const confirmed = process.argv.includes("--confirm") || process.env.PROD_WRITE_CONFIRM === "yes";

  if (!isLocal && !confirmed) {
    console.error(`✋ ${actionName}: refusing to modify a non-local database ("${host}") without confirmation.`);
    console.error(`   This is a destructive script. Re-run with --confirm only when you are certain.`);
    process.exit(1);
  }
  console.log(`${actionName} → database host: ${host}${isLocal ? " (local)" : " (REMOTE — confirmed)"}`);
}
