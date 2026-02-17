# Deployment Guide

This document describes how to deploy the subscription-service to different environments.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Local Development](#local-development)
- [Docker Deployment](#docker-deployment)
- [AWS ECS Deployment](#aws-ecs-deployment)
- [Database Setup](#database-setup)
- [Environment Variables](#environment-variables)

## Prerequisites

- Node.js 20+
- PostgreSQL 12+ (uses gateway's PostgreSQL instance)
- Docker (for containerized deployment)
- AWS CLI (for ECS deployment)
- npm or yarn

## Local Development

### 1. Setup Environment

```bash
# Copy environment template
cp .env.example .env

# Edit .env with your local configuration
# DB_HOST=localhost
# DB_PORT=5432
# DB_USERNAME=gateway_user
# DB_PASSWORD=gateway_password
# DB_NAME=subscription_service
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Initialize Database

The subscription service uses the same PostgreSQL instance as the gateway service but with a separate database.

```bash
# Create the database
./scripts/init-db.sh

# Or manually:
createdb -h localhost -U gateway_user subscription_service
```

### 4. Run Migrations

```bash
npm run migration:run
```

### 5. Start Development Server

```bash
npm run start:dev
```

The service will be available at `http://localhost:3002`

## Docker Deployment

### Local Standalone Docker Deployment

Use this for local development with a standalone database:

```bash
# Start services
docker-compose -f docker-compose.local.yml up -d

# View logs
docker-compose -f docker-compose.local.yml logs -f

# Stop services
docker-compose -f docker-compose.local.yml down
```

### Integration with Gateway Services

Use this when running alongside the gateway service:

```bash
# First, ensure gateway services are running
cd ../gateway
docker-compose up -d

# Then start subscription service (uses gateway's postgres)
cd ../subscription-service
docker-compose up -d

# View logs
docker-compose logs -f subscription-service

# Stop service
docker-compose down
```

The service will:
1. Connect to the gateway's PostgreSQL instance (`gateway-postgres`)
2. Use the `subscription_service` database
3. Join the `gateway-network` Docker network

## AWS ECS Deployment

### Automatic Deployment (CI/CD)

Deployments to AWS ECS are automated via GitHub Actions:

1. **Dev Environment**: Push to `dev` branch
   ```bash
   git push origin dev
   ```

2. **Manual Trigger**: Use GitHub Actions workflow dispatch

### Manual Deployment

If you need to deploy manually:

```bash
# 1. Login to ECR
aws ecr get-login-password --region eu-north-1 | \
  docker login --username AWS --password-stdin <ACCOUNT_ID>.dkr.ecr.eu-north-1.amazonaws.com

# 2. Build and tag image
docker build -t paragrafic/subscription-service:latest .

# 3. Tag for ECR
docker tag paragrafic/subscription-service:latest \
  <ACCOUNT_ID>.dkr.ecr.eu-north-1.amazonaws.com/paragrafic/subscription-service:latest

# 4. Push to ECR
docker push <ACCOUNT_ID>.dkr.ecr.eu-north-1.amazonaws.com/paragrafic/subscription-service:latest

# 5. Update ECS service
aws ecs update-service \
  --cluster dev-cluster \
  --service dev-subscription-service \
  --force-new-deployment \
  --region eu-north-1
```

## Database Setup

### Shared PostgreSQL Instance

The subscription service uses the **same PostgreSQL instance** as the gateway service but with a **separate database**:

- **Gateway**: Uses `gateway` database
- **Subscription Service**: Uses `subscription_service` database

This approach:
- ✅ Reduces infrastructure costs
- ✅ Simplifies connection management
- ✅ Maintains data isolation
- ✅ Enables potential cross-database queries (if needed)

### Creating the Database

**Option 1: Using the init script**
```bash
./scripts/init-db.sh
```

**Option 2: Manual creation**
```bash
# Connect to gateway database
psql -h localhost -U gateway_user -d gateway

# Create subscription database
CREATE DATABASE subscription_service;

# Verify
\l
```

**Option 3: Docker init (automatic)**
The `docker-compose.yml` includes a `postgres-init` service that automatically creates the database.

### Running Migrations

```bash
# Development
npm run migration:run

# Production (via Docker)
docker exec subscription-service npm run migration:run

# Revert last migration
npm run migration:revert
```

### Creating New Migrations

```bash
# Using the helper script
./scripts/create-migration.sh AddNewFeature

# Or directly
npm run typeorm -- migration:create src/migrations/$(date +%s%3N)-AddNewFeature
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` or `gateway-postgres` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_USERNAME` | Database user | `gateway_user` |
| `DB_PASSWORD` | Database password | `gateway_password` |
| `DB_NAME` | Database name | `subscription_service` |
| `PORT` | Service port | `3002` |
| `GATEWAY_SERVICE_URL` | Gateway URL | `http://localhost:8081` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_SYNCHRONIZE` | Auto-sync schema (dev only!) | `false` |
| `NODE_ENV` | Environment | `development` |
| `LOG_LEVEL` | Logging level | `info` |
| `STRIPE_API_KEY` | Stripe API key | - |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | - |

### Environment-Specific Configurations

**Development (.env)**
```env
DB_HOST=localhost
DB_PORT=5432
NODE_ENV=development
DB_SYNCHRONIZE=false
```

**Docker (.env.docker)**
```env
DB_HOST=gateway-postgres
DB_PORT=5432
NODE_ENV=development
```

**Production (AWS ECS)**
Environment variables are managed via:
- AWS Systems Manager Parameter Store
- ECS Task Definition
- Terraform configuration in `/infra`

## Health Checks

The service provides health check endpoints:

- **Health**: `GET /health`
  ```bash
  curl http://localhost:3002/health
  ```

- **Readiness**: `GET /ready`
  ```bash
  curl http://localhost:3002/ready
  ```

## Troubleshooting

### Database Connection Issues

```bash
# Test PostgreSQL connection
psql -h localhost -U gateway_user -d subscription_service

# Check if database exists
psql -h localhost -U gateway_user -d gateway -c "\l"
```

### Docker Network Issues

```bash
# List networks
docker network ls

# Inspect gateway network
docker network inspect gateway-network

# Recreate network if needed
docker network create gateway-network
```

### Migration Issues

```bash
# Check migration status
npm run typeorm -- migration:show

# Revert last migration
npm run migration:revert

# Run specific migration
npm run typeorm -- migration:run
```

## Monitoring

### Logs

**Local Development:**
```bash
npm run start:dev  # Watch mode with live logs
```

**Docker:**
```bash
docker-compose logs -f subscription-service
```

**AWS ECS:**
```bash
# View logs via CloudWatch
aws logs tail /ecs/dev-subscription-service --follow
```

### Metrics

The service integrates with AWS CloudWatch for:
- Container metrics (CPU, Memory)
- Custom application metrics
- ECS service health

## Rollback

### Docker

```bash
# Stop current version
docker-compose down

# Start previous version
docker-compose up -d
```

### AWS ECS

```bash
# Rollback to previous task definition
aws ecs update-service \
  --cluster dev-cluster \
  --service dev-subscription-service \
  --task-definition dev-subscription-service:PREVIOUS_REVISION \
  --region eu-north-1
```

## Security

### Database Credentials

- **Local**: Stored in `.env` (not committed)
- **Docker**: Passed via environment variables
- **Production**: Stored in AWS Secrets Manager/Parameter Store

### API Keys

- Stripe API keys should be stored securely
- Use different keys for dev/prod environments
- Rotate keys regularly

## Support

For issues or questions:
1. Check the [README.md](README.md)
2. Review service logs
3. Contact the development team
