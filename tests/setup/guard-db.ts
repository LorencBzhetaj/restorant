// HARD SAFETY GUARD — a vitest setupFile, so it executes in the worker BEFORE
// any test module (and therefore before `@/lib/prisma` and the Prisma client)
// is imported.
//
// Defense in depth against the incident where a bare `vitest run` fell back to
// the .env / Neon URL and deleted data:
//
//  1. Tests are driven by TEST_DATABASE_URL, never the app's DATABASE_URL.
//  2. NODE_ENV must be "test".
//  3. The target must be localhost/127.0.0.1 and the database named resto_test;
//     Neon / Vercel Postgres / every non-local host is rejected.
//  4. An empty TEST_DATABASE_URL is rejected (no silent fallback to .env).
//  5. Only after validation is TEST_DATABASE_URL mapped onto DATABASE_URL /
//     DIRECT_URL, so the Prisma client the tests import can only ever reach the
//     disposable local database.
//
// Because validation happens here — before the mapping and before Prisma is
// imported — an unsafe target throws before any connection is opened. This makes
// `npx vitest run` safe too (empty TEST_DATABASE_URL → thrown), not only
// `npm test`.

import { assertLocalTestDatabase } from "./assert-test-db";

const testUrl = process.env.TEST_DATABASE_URL;
assertLocalTestDatabase(testUrl, process.env.NODE_ENV);

// Validated as the local resto_test DB — safe to point Prisma at it.
process.env.DATABASE_URL = testUrl;
process.env.DIRECT_URL = testUrl;
