/**
 * Test environment for the NEXUS security suite.
 *
 * Registered as a Vitest `setupFiles` entry so it runs before any test module
 * imports `server/_core/env.ts` (which snapshots `process.env` at load time).
 * All values are local, synthetic test values — no real credentials or hosts.
 */
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "nexus-test-cookie-secret";
process.env.VITE_APP_ID = "nexus-test-app";
process.env.OAUTH_SERVER_URL = "https://oauth.invalid";
process.env.OWNER_OPEN_ID = "nexus-owner-open-id";
process.env.BUILT_IN_FORGE_API_URL = "https://forge.invalid";
process.env.BUILT_IN_FORGE_API_KEY = "nexus-test-forge-key";
// Intentionally left unset: DATABASE_URL. The suite injects an in-memory
// Drizzle instance through `__setTestDatabase` instead of reaching a database.
delete process.env.DATABASE_URL;
