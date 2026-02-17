#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Load local overrides first, then base env.
set -a
[ -f ".env.local" ] && source ".env.local"
[ -f ".env" ] && source ".env"
set +a

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USERNAME="gateway_user"
DB_PASSWORD="gateway_password"
DB_NAME="${DB_NAME:-subscription_service}"
DB_SYNCHRONIZE="${DB_SYNCHRONIZE:-true}"
PORT="${PORT:-3002}"
NODE_ENV="${NODE_ENV:-development}"

DB_SSL_DEFAULT="true"
if [[ "$DB_HOST" == "localhost" || "$DB_HOST" == "127.0.0.1" || "$DB_HOST" == "postgres" || "$DB_HOST" == "gateway-postgres" ]]; then
  DB_SSL_DEFAULT="false"
fi
DB_SSL="${DB_SSL:-$DB_SSL_DEFAULT}"
DB_SSL_REJECT_UNAUTHORIZED="${DB_SSL_REJECT_UNAUTHORIZED:-false}"

export DB_HOST DB_PORT DB_USERNAME DB_PASSWORD DB_NAME DB_SYNCHRONIZE
export DB_SSL DB_SSL_REJECT_UNAUTHORIZED PORT NODE_ENV

echo "Starting subscription-service with local profile"
echo "DB: ${DB_HOST}:${DB_PORT}/${DB_NAME} (user=${DB_USERNAME}, ssl=${DB_SSL})"
echo "Nest synchronize: ${DB_SYNCHRONIZE} (migrations are not executed by this script)"

if ! command -v psql >/dev/null 2>&1; then
  echo "Error: psql is required to verify/create database."
  exit 1
fi

if [ ! -d node_modules ]; then
  npm install
fi

DB_EXISTS="$(
  PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USERNAME" \
    -d postgres \
    -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'"
)"

if [[ "$DB_EXISTS" != "1" ]]; then
  echo "Creating database '${DB_NAME}'..."
  PGPASSWORD="$DB_PASSWORD" psql \
    -h "$DB_HOST" \
    -p "$DB_PORT" \
    -U "$DB_USERNAME" \
    -d postgres \
    -c "CREATE DATABASE ${DB_NAME};"
fi

PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" \
  -p "$DB_PORT" \
  -U "$DB_USERNAME" \
  -d "$DB_NAME" \
  -tAc "SELECT current_database(), current_user;" >/dev/null

npm run start:dev
