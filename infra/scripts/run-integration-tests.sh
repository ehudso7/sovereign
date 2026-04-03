#!/usr/bin/env bash
set -euo pipefail

# Run integration tests against a real PostgreSQL instance.
#
# Usage:
#   TEST_DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign ./infra/scripts/run-integration-tests.sh
#
# With Docker Compose:
#   docker compose -f infra/docker/docker-compose.yml up -d postgres
#   TEST_DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign ./infra/scripts/run-integration-tests.sh
#
# Without Docker (local PostgreSQL):
#   Ensure PostgreSQL is running and the sovereign user exists:
#     createuser -P sovereign  (password: sovereign_dev)
#     createdb -O sovereign sovereign
#   Then run this script.

TEST_DATABASE_URL="${TEST_DATABASE_URL:-${DATABASE_URL:-}}"

if [[ -z "$TEST_DATABASE_URL" ]]; then
  echo "Integration tests require TEST_DATABASE_URL (preferred) or DATABASE_URL."
  echo "Example: TEST_DATABASE_URL=postgresql://sovereign:sovereign_dev@localhost:5432/sovereign pnpm test:integration"
  exit 1
fi

DATABASE_URL="${DATABASE_URL:-$TEST_DATABASE_URL}"

echo "Running integration tests against: ${TEST_DATABASE_URL%%@*}@****"

# Run migrations first
echo "Running migrations..."
DATABASE_URL="$DATABASE_URL" pnpm db:migrate

# Run integration tests
echo "Running integration tests..."
TEST_DATABASE_URL="$TEST_DATABASE_URL" DATABASE_URL="$DATABASE_URL" pnpm --filter @sovereign/db test:integration

echo ""
echo "Integration tests complete."
