#!/bin/bash

# Script to create a new migration
# Usage: ./scripts/create-migration.sh MigrationName

set -e

if [ -z "$1" ]; then
    echo "Error: Migration name is required"
    echo "Usage: ./scripts/create-migration.sh MigrationName"
    exit 1
fi

MIGRATION_NAME=$1
TIMESTAMP=$(date +%s%3N)

echo "Creating migration: $MIGRATION_NAME"
echo "Timestamp: $TIMESTAMP"

npm run typeorm -- migration:create "src/migrations/${TIMESTAMP}-${MIGRATION_NAME}"

echo "Migration created successfully!"
echo "File: src/migrations/${TIMESTAMP}-${MIGRATION_NAME}.ts"
