# Subscription Service

A microservice for managing subscriptions integrated with Stripe, built with NestJS and TypeORM following clean architecture principles.

[![Deploy to Dev](https://github.com/bntech/lexai/actions/workflows/deploy-dev.yml/badge.svg)](https://github.com/bntech/lexai/actions/workflows/deploy-dev.yml)
[![Test](https://github.com/bntech/lexai/actions/workflows/test.yml/badge.svg)](https://github.com/bntech/lexai/actions/workflows/test.yml)

## 📋 Table of Contents

- [Features](#features)
- [Quick Start](#quick-start)
- [Architecture](#architecture)
- [API Documentation](#api-documentation)
- [Database Schema](#database-schema)
- [Development](#development)
- [Deployment](#deployment)
- [Testing](#testing)

## ✨ Features

- **Clean Architecture**: Separation of concerns with controllers, services, entities, and DTOs
- **Entity Support**: Subscriptions can be linked to Users, Teams, or Custom entities from the gateway service
- **Stripe Integration**: Manages Stripe subscription and pricing details
- **RESTful API**: Well-structured HTTP endpoints with validation
- **TypeORM**: PostgreSQL integration with migrations support
- **Shared Database**: Uses the same PostgreSQL instance as gateway service
- **Validation**: Request validation using class-validator
- **Type Safety**: Full TypeScript support
- **Health Checks**: Built-in health and readiness endpoints
- **CORS Support**: Cross-origin resource sharing enabled
- **Docker Support**: Production-ready containerization
- **CI/CD**: Automated deployment via GitHub Actions

## 🚀 Quick Start

See [QUICKSTART.md](QUICKSTART.md) for detailed instructions.

```bash
# Install and run locally
npm install
cp .env.example .env
./scripts/init-db.sh
npm run start:dev
```

Or use Docker:

```bash
# With gateway services
docker-compose up -d

# Standalone
docker-compose -f docker-compose.local.yml up -d
```

**Service URL**: `http://localhost:3002`

## 🏗️ Architecture

### Clean Architecture Layers

```
┌─────────────────────────────────────────┐
│         Controllers (HTTP)              │  ← REST API endpoints
├─────────────────────────────────────────┤
│      Services (Business Logic)          │  ← Use cases & orchestration
├─────────────────────────────────────────┤
│     Repositories (Data Access)           │  ← TypeORM repositories
├─────────────────────────────────────────┤
│       Entities (Domain Models)           │  ← Database entities
└─────────────────────────────────────────┘
```

### Project Structure

```
subscription-service/
├── src/
│   ├── common/
│   │   └── enums/              # Shared enums (EntityType)
│   ├── config/                 # Configuration (database, etc.)
│   ├── entities/               # TypeORM entities
│   │   ├── subscription.entity.ts
│   │   └── stripe-details.entity.ts
│   ├── health/                 # Health check module
│   ├── migrations/             # Database migrations
│   ├── subscriptions/          # Subscription module
│   │   ├── dto/                # Data Transfer Objects
│   │   ├── subscriptions.controller.ts
│   │   ├── subscriptions.service.ts
│   │   └── subscriptions.module.ts
│   ├── app.module.ts
│   └── main.ts
├── scripts/                    # Utility scripts
├── test/                       # E2E tests
├── .github/workflows/          # CI/CD workflows
├── DEPLOYMENT.md               # Deployment guide
└── QUICKSTART.md               # Quick start guide
```

## 📡 API Documentation

### Base URL

- **Local**: `http://localhost:3002/api/v1`
- **Dev**: `https://api-dev.paragrafic.pl/api/v1`
- **Prod**: `https://api.paragrafic.pl/api/v1`

### Endpoints

#### Health Checks

```
GET /health               # Service health status
GET /ready                # Service readiness status
```

#### Subscriptions

```
POST   /subscriptions                                    # Create subscription
GET    /subscriptions                                    # List subscriptions (with filters)
GET    /subscriptions/:id                                # Get subscription by ID
DELETE /subscriptions/:id                                # Cancel subscription
PUT    /subscriptions/:id/renew                          # Renew subscription
```

#### Entity-Specific

```
GET /subscriptions/entity/:entityType/:entityId          # Get all subscriptions for entity
GET /subscriptions/entity/:entityType/:entityId/active   # Get active subscription
GET /subscriptions/entity/:entityType/:entityId/status   # Check subscription status
```

### Request Examples

#### Create Subscription

```bash
POST /api/v1/subscriptions
Content-Type: application/json

{
  "stripeSubId": "sub_1234567890",
  "stripePriceId": "price_1234567890",
  "entityId": "123",
  "entityType": "user",
  "validUntil": "2025-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "id": "uuid",
  "stripeDetailsId": "uuid",
  "entityId": "123",
  "entityType": "user",
  "validUntil": "2025-12-31T23:59:59.000Z",
  "isActive": true,
  "isExpired": false,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z",
  "stripeDetails": {
    "id": "uuid",
    "stripeSubId": "sub_1234567890",
    "stripePriceId": "price_1234567890",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Check Status

```bash
GET /api/v1/subscriptions/entity/user/123/status
```

**Response:**
```json
{
  "entityId": "123",
  "entityType": "user",
  "isActive": true
}
```

#### List Subscriptions with Filters

```bash
GET /api/v1/subscriptions?entityType=user&limit=10&offset=0&includeExpired=false
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `entityId` | string | Filter by entity ID |
| `entityType` | enum | Filter by entity type (user, team, custom) |
| `includeDeleted` | boolean | Include soft-deleted subscriptions |
| `includeExpired` | boolean | Include expired subscriptions |
| `limit` | number | Max results to return (default: 50) |
| `offset` | number | Offset for pagination (default: 0) |

## 💾 Database Schema

### Shared PostgreSQL Instance

The subscription service uses the **same PostgreSQL instance** as the gateway service:

- **Instance**: Same as gateway (`gateway-postgres`)
- **Gateway Database**: `gateway`
- **Subscription Database**: `subscription_service`

### Schema

#### stripe_details
```sql
CREATE TABLE stripe_details (
  id UUID PRIMARY KEY,
  stripe_sub_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_price_id VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP
);
```

#### subscriptions
```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY,
  stripe_details_id UUID REFERENCES stripe_details(id),
  entity_id VARCHAR(255) NOT NULL,
  entity_type ENUM('user', 'team', 'custom') NOT NULL,
  valid_until TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  deleted_at TIMESTAMP,

  -- Indexes
  INDEX idx_entity (entity_id, entity_type),
  INDEX idx_valid_until (valid_until),
  UNIQUE INDEX idx_unique_active (entity_id, entity_type)
    WHERE deleted_at IS NULL AND valid_until > NOW()
);
```

### Entity Integration

| Entity Type | Gateway Entity | ID Type | Example |
|-------------|---------------|---------|---------|
| `user` | User | Long (int64) | "123" |
| `team` | Team | UUID | "550e8400-e29b-41d4-a716-446655440000" |
| `custom` | Any | String | "custom-entity-001" |

## 🛠️ Development

### Prerequisites

- Node.js 20+
- PostgreSQL 12+ (gateway's instance)
- Docker (optional)

### Setup

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Initialize database
./scripts/init-db.sh

# Run migrations
npm run migration:run

# Start development server
npm run start:dev
```

### Available Scripts

```bash
npm run start           # Start the application
npm run start:dev       # Start in watch mode
npm run start:debug     # Start in debug mode
npm run start:prod      # Start production build

npm run build           # Build the application
npm run format          # Format code
npm run lint            # Lint code

npm run test            # Run tests
npm run test:watch      # Run tests in watch mode
npm run test:cov        # Run tests with coverage

npm run migration:generate  # Generate migration
npm run migration:run       # Run migrations
npm run migration:revert    # Revert migration
```

### Creating Migrations

```bash
# Using helper script
./scripts/create-migration.sh AddNewFeature

# Or directly
npm run typeorm -- migration:create src/migrations/$(date +%s)-AddNewFeature
```

## 🚢 Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for complete deployment guide.

### Quick Deploy

**Dev Environment** (automatic):
```bash
git push origin dev
```

**Manual Docker Deploy**:
```bash
docker-compose up -d
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `DB_HOST` | PostgreSQL host | Yes |
| `DB_PORT` | PostgreSQL port | Yes |
| `DB_USERNAME` | Database user | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `DB_NAME` | Database name | Yes |
| `PORT` | Service port | No (default: 3002) |
| `GATEWAY_SERVICE_URL` | Gateway service URL | Yes |
| `STRIPE_API_KEY` | Stripe API key | No |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook secret | No |

## 🧪 Testing

### Unit Tests

```bash
npm run test
```

### Test Coverage

```bash
npm run test:cov
```

### E2E Tests

```bash
npm run test:e2e
```

### Manual Testing

```bash
# Health check
curl http://localhost:3002/health

# Create test subscription
curl -X POST http://localhost:3002/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "stripeSubId": "sub_test",
    "stripePriceId": "price_test",
    "entityId": "1",
    "entityType": "user",
    "validUntil": "2025-12-31T23:59:59Z"
  }'
```

## 📊 Monitoring

### Health Endpoints

- **Health**: `GET /health` - Basic health check
- **Ready**: `GET /ready` - Readiness probe

### Logs

```bash
# Development
npm run start:dev

# Docker
docker-compose logs -f subscription-service

# AWS ECS
aws logs tail /ecs/dev-subscription-service --follow
```

## 🔒 Security

- **Non-root user** in Docker container
- **Environment variables** for sensitive data
- **Validation** on all inputs
- **Soft deletes** for audit trail
- **CORS** configuration
- **Database isolation** from gateway

## 🤝 Integration

### Gateway Service Integration

```typescript
// In gateway service, call subscription service
const response = await fetch('http://subscription-service:3002/api/v1/subscriptions/entity/user/123/status');
const { isActive } = await response.json();
```

### Entity References

```typescript
// User subscription
{
  entityType: 'user',
  entityId: '123' // User.id (Long)
}

// Team subscription
{
  entityType: 'team',
  entityId: '550e8400-e29b-41d4-a716-446655440000' // Team.id (UUID)
}

// Custom entity subscription
{
  entityType: 'custom',
  entityId: 'custom-001' // Any string identifier
}
```

## 📝 Design Principles

- ✅ **Reusability**: Injectable services, modular structure
- ✅ **Clean Code**: TypeScript, ESLint, Prettier
- ✅ **Type Safety**: Full TypeScript with decorators
- ✅ **Validation**: class-validator for DTOs
- ✅ **Separation of Concerns**: Clear layer boundaries
- ✅ **Soft Deletes**: Audit trail preservation
- ✅ **Database Isolation**: Separate database, shared instance
- ✅ **Testing**: Unit and E2E tests
- ✅ **Documentation**: Comprehensive guides

## 📚 Additional Resources

- [Quick Start Guide](QUICKSTART.md)
- [Deployment Guide](DEPLOYMENT.md)
- [API Documentation](#api-documentation)
- [NestJS Documentation](https://docs.nestjs.com/)
- [TypeORM Documentation](https://typeorm.io/)

## 📄 License

Copyright © 2024 BNTech

---

**Need help?** Check the [troubleshooting section](DEPLOYMENT.md#troubleshooting) or review the logs.
