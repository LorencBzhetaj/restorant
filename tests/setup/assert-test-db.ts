// Pure, dependency-free validation of the test database target.
//
// It is a plain string check with NO database connection, so it can (and must)
// run BEFORE any Prisma client is imported/instantiated. The setup file calls it
// with the live env; a safety test calls it directly to prove a remote URL is
// rejected before Prisma could ever connect.

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);
const REQUIRED_DB_NAME = "resto_test";

// Managed / remote providers that must never be a test target, even in the
// unlikely event one resolved to a local-looking host.
const REMOTE_PROVIDER = /neon\.tech|vercel|supabase|amazonaws|azure|rds\b|render\.com|pooler|\.aws\./i;

/**
 * Throws unless `rawUrl` is unambiguously the local, disposable resto_test
 * database and NODE_ENV is "test". Never connects to anything.
 */
export function assertLocalTestDatabase(rawUrl: string | undefined, nodeEnv: string | undefined): void {
  if (nodeEnv !== "test") {
    throw new Error(`Test guard: NODE_ENV must be "test" to run tests (got "${nodeEnv ?? "undefined"}").`);
  }
  if (!rawUrl || rawUrl.trim() === "") {
    throw new Error(
      "Test guard: TEST_DATABASE_URL is empty. Tests require an explicit local test database and must never fall back to .env/DATABASE_URL.",
    );
  }
  if (REMOTE_PROVIDER.test(rawUrl)) {
    throw new Error("Test guard: TEST_DATABASE_URL points at a managed/remote provider (Neon, Vercel, etc.) — blocked.");
  }

  let host = "";
  let dbName = "";
  try {
    const u = new URL(rawUrl);
    host = u.hostname;
    dbName = u.pathname.replace(/^\//, "");
  } catch {
    throw new Error("Test guard: TEST_DATABASE_URL is not a valid URL.");
  }

  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Test guard: TEST_DATABASE_URL host must be localhost/127.0.0.1 (got "${host}"). Every non-local host is blocked.`,
    );
  }
  if (dbName !== REQUIRED_DB_NAME) {
    throw new Error(`Test guard: TEST_DATABASE_URL database name must be exactly "${REQUIRED_DB_NAME}" (got "${dbName}").`);
  }
}
