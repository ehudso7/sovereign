/**
 * Integration test harness for real PostgreSQL tests.
 *
 * Manages database lifecycle: creates a fresh test DB, runs migrations,
 * provides a DatabaseClient, and tears down cleanly.
 */

import { Pool } from "pg";
import { DatabaseClient } from "../../client.js";
import { runMigrations } from "../../migrate.js";
import { join } from "node:path";
import {
  buildPostgresUrl,
  resolveIntegrationDatabaseConfig,
} from "./test-db-config.js";

const migrationsDir = join(import.meta.dirname ?? __dirname, "..", "..", "migrations");

let _dbClient: DatabaseClient | null = null;
let _testDbName: string | null = null;
let _adminPool: Pool | null = null;
let _appRole: string | null = null;

function qident(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function qliteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function dropTestDatabase(adminPool: Pool, testDbName: string, appRole: string | null): Promise<void> {
  try {
    await adminPool.query(`ALTER DATABASE ${qident(testDbName)} WITH ALLOW_CONNECTIONS false`);
  } catch {
    // Best effort. The database may already be gone or not yet accepting the command.
  }

  try {
    await adminPool.query(
      `SELECT pg_terminate_backend(pid)
         FROM pg_stat_activity
        WHERE datname = $1
          AND pid <> pg_backend_pid()`,
      [testDbName],
    );
  } catch {
    // Best effort. We still attempt to drop below.
  }

  try {
    await adminPool.query(`DROP DATABASE IF EXISTS ${qident(testDbName)} WITH (FORCE)`);
  } catch (forceError) {
    try {
      await adminPool.query(`DROP DATABASE IF EXISTS ${qident(testDbName)}`);
    } catch (dropError) {
      throw new Error(
        `Failed to drop integration test database "${testDbName}": ` +
          `${getErrorMessage(forceError)}; fallback drop also failed: ${getErrorMessage(dropError)}`,
      );
    }
  }

  if (appRole) {
    await adminPool.query(`DROP ROLE IF EXISTS ${qident(appRole)}`);
  }
}

/**
 * Set up a fresh test database with all migrations applied.
 * Call this in beforeAll().
 */
export async function setupTestDb(): Promise<DatabaseClient> {
  const { parsed } = resolveIntegrationDatabaseConfig();

  // Connect to a maintenance DB so we can safely create/drop the test DB.
  // Using the target DB here can make teardown flaky when Postgres is still draining connections.
  _adminPool = new Pool({
    host: parsed.host,
    port: parsed.port,
    user: parsed.user,
    password: parsed.password,
    database: "postgres",
  });

  // Create a unique database name for this test run
  const suffix = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  _testDbName = `sovereign_inttest_${suffix}`;

  try {
    await _adminPool.query(`CREATE DATABASE ${qident(_testDbName)}`);

    const testDbUrl = buildPostgresUrl(parsed, { database: _testDbName });

    // Run all migrations against the fresh DB (as superuser)
    const migrationResult = await runMigrations(testDbUrl, migrationsDir);
    if (migrationResult.failed.length > 0) {
      throw new Error(`Migrations failed: ${migrationResult.failed.join(", ")}`);
    }

    // Create a non-superuser role for the app so RLS is enforced.
    // Superusers bypass RLS even with FORCE ROW LEVEL SECURITY.
    const setupPool = new Pool({ connectionString: testDbUrl });
    const appRole = `sovereign_app_${suffix}`;
    try {
      await setupPool.query(
        `CREATE ROLE ${qident(appRole)} LOGIN PASSWORD ${qliteral(parsed.password)} NOSUPERUSER`,
      );
      await setupPool.query(`GRANT ALL ON DATABASE ${qident(_testDbName)} TO ${qident(appRole)}`);
      await setupPool.query(`GRANT ALL ON ALL TABLES IN SCHEMA public TO ${qident(appRole)}`);
      await setupPool.query(`GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO ${qident(appRole)}`);
      await setupPool.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${qident(appRole)}`,
      );
      await setupPool.query(
        `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${qident(appRole)}`,
      );
      _appRole = appRole;

      // Connect the DatabaseClient as the non-superuser app role
      const appDbUrl = buildPostgresUrl(parsed, {
        user: appRole,
        password: parsed.password,
        database: _testDbName,
      });
      _dbClient = new DatabaseClient({
        url: appDbUrl,
        maxConnections: 5,
        connectionTimeoutMs: 5_000,
      });
    } finally {
      await setupPool.end();
    }

    return _dbClient;
  } catch (error) {
    if (_adminPool && _testDbName) {
      try {
        await dropTestDatabase(_adminPool, _testDbName, _appRole);
      } catch {
        // Preserve the original setup error.
      }
    }
    throw error;
  }
}

/**
 * Tear down the test database.
 * Call this in afterAll().
 */
export async function teardownTestDb(): Promise<void> {
  if (_dbClient) {
    await _dbClient.destroy();
    _dbClient = null;
  }

  if (_adminPool && _testDbName) {
    try {
      await dropTestDatabase(_adminPool, _testDbName, _appRole);
    } finally {
      await _adminPool.end();
      _adminPool = null;
      _testDbName = null;
      _appRole = null;
    }
  }
}

/**
 * Get the current test DatabaseClient.
 */
export function getTestDb(): DatabaseClient {
  if (!_dbClient) {
    throw new Error("Test database not set up. Call setupTestDb() first.");
  }
  return _dbClient;
}

/**
 * Clean all data from tables (preserving schema).
 * Call this in beforeEach() or afterEach() for test isolation.
 */
export async function truncateAllTables(): Promise<void> {
  const db = getTestDb();
  const unscoped = db.unscoped();
  await unscoped.execute(`
    TRUNCATE TABLE spend_alerts, invoices, usage_events, billing_accounts, crm_sync_log, outreach_drafts, crm_notes, crm_tasks, crm_deals, crm_contacts, crm_accounts, policy_decisions, approvals, quarantine_records, policies, alert_events, alert_rules, memory_links, memories, browser_sessions, skill_installs, skills, connector_credentials, connector_installs, connectors, run_steps, runs, agent_versions, agents, audit_events, sessions, invitations, projects, memberships, organizations, users CASCADE
  `);
}

/**
 * Get the test database URL (for migration runner tests that need the raw URL).
 */
export function getTestDbUrl(): string {
  if (!_testDbName) {
    throw new Error("Test database not set up. Call setupTestDb() first.");
  }
  const { parsed } = resolveIntegrationDatabaseConfig();
  return buildPostgresUrl(parsed, {
    user: _appRole ?? parsed.user,
    password: parsed.password,
    database: _testDbName,
  });
}
