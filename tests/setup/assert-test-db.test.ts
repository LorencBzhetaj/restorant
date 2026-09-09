import { describe, it, expect } from "vitest";
import { assertLocalTestDatabase } from "./assert-test-db";

// Proves the guard rejects unsafe targets by pure string validation — no Prisma
// client, no connection. If these throw, no database was ever contacted.

describe("test database guard (assertLocalTestDatabase)", () => {
  it("rejects a Neon / remote URL", () => {
    expect(() =>
      assertLocalTestDatabase("postgresql://u:p@ep-billowing-pine-a5z732za.us-east-2.aws.neon.tech/neondb", "test"),
    ).toThrow(/remote|neon|blocked|localhost/i);
  });

  it("rejects a Vercel Postgres URL", () => {
    expect(() => assertLocalTestDatabase("postgres://u:p@db.vercel-storage.com/verceldb", "test")).toThrow(/blocked|remote/i);
  });

  it("rejects an empty TEST_DATABASE_URL (no fallback)", () => {
    expect(() => assertLocalTestDatabase("", "test")).toThrow(/empty/i);
    expect(() => assertLocalTestDatabase(undefined, "test")).toThrow(/empty/i);
  });

  it("rejects a local host with the wrong database name", () => {
    expect(() => assertLocalTestDatabase("postgresql://test:test@localhost:5433/neondb", "test")).toThrow(/resto_test/);
  });

  it("rejects a remote host even if the db is named resto_test", () => {
    expect(() => assertLocalTestDatabase("postgresql://u:p@db.example.com:5432/resto_test", "test")).toThrow(/host|blocked/i);
  });

  it("requires NODE_ENV=test", () => {
    expect(() => assertLocalTestDatabase("postgresql://test:test@localhost:5433/resto_test", "development")).toThrow(/NODE_ENV/);
    expect(() => assertLocalTestDatabase("postgresql://test:test@localhost:5433/resto_test", "production")).toThrow(/NODE_ENV/);
  });

  it("accepts the local resto_test database with NODE_ENV=test", () => {
    expect(() => assertLocalTestDatabase("postgresql://test:test@localhost:5433/resto_test", "test")).not.toThrow();
    expect(() => assertLocalTestDatabase("postgresql://test:test@127.0.0.1:5433/resto_test", "test")).not.toThrow();
  });
});
