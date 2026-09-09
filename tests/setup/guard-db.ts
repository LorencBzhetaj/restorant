// HARD SAFETY GUARD — runs before every test file (vitest setupFiles).
//
// The test suite wipes tables (deleteMany) in its setup. It must therefore only
// ever touch the disposable local Docker test database, never a real one. This
// guard refuses to let any test run unless DATABASE_URL points at the local
// resto_test database, so a bare `vitest run` (which would fall back to the
// .env / Neon URL) fails immediately, before any beforeAll can delete data.

const url = process.env.DATABASE_URL ?? "";
let host = "";
let dbName = "";
try {
  const u = new URL(url);
  host = u.host;
  dbName = u.pathname.replace(/^\//, "");
} catch {
  /* url unparseable → treated as unsafe below */
}

const isLocalHost = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host);
const isTestDb = dbName === "resto_test";

if (!isLocalHost || !isTestDb) {
  throw new Error(
    `\n\n🛑 Test run BLOCKED for safety.\n` +
      `   Tests wipe data and must only touch the local test database.\n` +
      `   Expected DATABASE_URL host=localhost:5433 db=resto_test — got host="${host}" db="${dbName}".\n` +
      `   Run the suite with "npm test" (which sets the test DB via cross-env),\n` +
      `   never a bare "vitest run" (that falls back to the .env / production URL).\n`,
  );
}
