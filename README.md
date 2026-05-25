# Subscription Service

Internal NestJS service for Stripe billing state and document-token entitlements. It receives signed Stripe webhooks and exposes billing and token operations consumed by the gateway.

## Structure

```text
src/
  app/                   Application module
  common/enums/          Billing and entity enums
  config/                Environment-backed database and Stripe configuration
  entities/
    subscriptions/       Subscription and token ledger persistence
    webhooks/            Stripe event idempotency persistence
  subscriptions/
    dto/                 HTTP contracts
    services/            Billing and token workflows
    types/               Workflow input/config contracts
    __tests__/           Unit tests
  webhooks/
    services/            Stripe client and webhook handling
    __tests__/           Unit tests
  health/                Health endpoints
  migrations/            Versioned schema changes
```

Inside a feature folder, files use concise names such as `controller.ts`, `module.ts`, and `services/token-ledger.ts`.

## Configuration

Configuration is environment-driven. Important values include database settings, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, checkout return URLs, and configured Stripe price IDs. Never commit secret values or live billing fixtures.

For local development, this service uses the PostgreSQL instance started by `../gateway/compose.yml`, with a separate `subscription_service` database. Begin with `.env.example`; its `gateway_user` / `gateway_password` credentials match the gateway container. Initialize the additional database once with:

```bash
./scripts/init-db.sh
```

Infrastructure and deployment wiring are maintained in `../infra`; shared local supporting services are maintained in `../devtools`. The `Dockerfile` remains here because CI builds this service image.

## Development

```bash
npm install
npm run migration:run
npm run start:dev
```

## Validation

```bash
npm test -- --runInBand
npm run build
```

Schema changes require a reviewed migration. Billing and webhook changes require focused tests for idempotency, token mutations, and retry/order behavior.
