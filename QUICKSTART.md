# Quick Start Guide

Get the subscription service up and running in minutes!

## 🚀 Quick Start (3 methods)

### Method 1: Local Development (Recommended for development)

```bash
# 1. Install dependencies
npm install

# 2. Setup environment
cp .env.example .env
# Edit .env with your configuration

# 3. Initialize database
./scripts/init-db.sh

# 4. Start the service
npm run start:dev
```

Service available at: `http://localhost:3002`

### Method 2: Docker Standalone (Isolated testing)

```bash
# Start with its own database
docker-compose -f docker-compose.local.yml up -d

# View logs
docker-compose -f docker-compose.local.yml logs -f

# Stop
docker-compose -f docker-compose.local.yml down
```

Service available at: `http://localhost:3002`

### Method 3: Docker with Gateway (Integration testing)

```bash
# 1. Start gateway services first
cd ../gateway
docker-compose up -d

# 2. Start subscription service
cd ../subscription-service
docker-compose up -d

# View logs
docker-compose logs -f subscription-service
```

Service available at: `http://localhost:3002`

## 🧪 Test the Service

### Health Check

```bash
curl http://localhost:3002/health
```

Expected response:
```json
{
  "status": "healthy",
  "service": "subscription-service",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Create a Subscription

```bash
curl -X POST http://localhost:3002/api/v1/subscriptions \
  -H "Content-Type: application/json" \
  -d '{
    "stripeSubId": "sub_test123",
    "stripePriceId": "price_test456",
    "entityId": "1",
    "entityType": "user",
    "validUntil": "2025-12-31T23:59:59Z"
  }'
```

### Check Subscription Status

```bash
curl http://localhost:3002/api/v1/subscriptions/entity/user/1/status
```

### Get Active Subscription

```bash
curl http://localhost:3002/api/v1/subscriptions/entity/user/1/active
```

## 📚 Next Steps

- Read the [README.md](README.md) for complete API documentation
- Check [DEPLOYMENT.md](DEPLOYMENT.md) for deployment options
- Review the API endpoints at `http://localhost:3002/api/v1/subscriptions`

## 🐛 Troubleshooting

### Database connection fails

```bash
# Check if PostgreSQL is running
psql -h localhost -U gateway_user -l

# Check database exists
psql -h localhost -U gateway_user -d subscription_service
```

### Port already in use

```bash
# Find and kill process on port 3002
lsof -ti:3002 | xargs kill -9

# Or change the port in .env
PORT=3003
```

### Docker issues

```bash
# Recreate containers
docker-compose down -v
docker-compose up -d

# Check logs
docker-compose logs subscription-service
```

## 📞 Need Help?

- Check the logs: `npm run start:dev` or `docker-compose logs -f`
- Review environment variables in `.env`
- Ensure gateway service is running (if using Method 3)
- Verify database is accessible
