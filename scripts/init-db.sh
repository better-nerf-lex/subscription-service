#!/bin/bash

# Script to initialize the subscription_service database
# This script should be run once to create the database on the gateway PostgreSQL instance

set -e

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '^#' | xargs)
fi

# Default values
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USERNAME=${DB_USERNAME:-gateway_user}
DB_NAME=${DB_NAME:-subscription_service}

echo "=========================================="
echo "Subscription Service Database Setup"
echo "=========================================="
echo "Host: $DB_HOST"
echo "Port: $DB_PORT"
echo "User: $DB_USERNAME"
echo "Database: $DB_NAME"
echo "=========================================="
echo ""

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "Error: psql command not found. Please install PostgreSQL client."
    exit 1
fi

# Check if database already exists
echo "Checking if database exists..."
DB_EXISTS=$(PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d gateway -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")

if [ "$DB_EXISTS" = "1" ]; then
    echo "Database '$DB_NAME' already exists."
    read -p "Do you want to drop and recreate it? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "Dropping existing database..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d gateway -c "DROP DATABASE $DB_NAME"
        echo "Creating database..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d gateway -c "CREATE DATABASE $DB_NAME"
        echo "Database recreated successfully!"
    else
        echo "Keeping existing database."
    fi
else
    echo "Creating database..."
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USERNAME -d gateway -c "CREATE DATABASE $DB_NAME"
    echo "Database created successfully!"
fi

echo ""
echo "Running migrations..."
npm run migration:run

echo ""
echo "=========================================="
echo "Database setup completed successfully!"
echo "=========================================="
