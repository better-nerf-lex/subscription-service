# Subscription Service Agent Guide

## Scope

`subscription-service` is the internal billing and entitlement service. It is NestJS 11 and TypeScript with TypeORM/PostgreSQL and Stripe SDK integration. It exposes checkout, subscription, and token ledger operations to `gateway`, and receives signed Stripe webhooks.

Billing code can grant paid access or consume customer funds. When this repository is opened inside the Lexai parent workspace, also follow `../devtools/docs/agents/WORKSPACE.md`, `../devtools/docs/agents/ARCHITECTURE.md`, and `../devtools/docs/agents/DELIVERY.md`.

## Current Layout

| Path | Responsibility |
| --- | --- |
| `src/subscriptions` | Checkout, catalog, billing cycles, subscription state, token ledger |
| `src/webhooks` | Stripe client, signature validation, event handling |
| `src/entities` | TypeORM persistence contracts |
| `src/migrations` | Versioned database changes |
| `src/config` | Database and Stripe environment configuration |
| `src/health` | Health/readiness endpoints |

## Billing Rules

- Stripe is the external source for payment/subscription events; the local database is the durable entitlement projection used by product workflows.
- Use Stripe Checkout/Billing patterns already established in this service for purchases and recurring plans. Do not add a parallel payment flow without a documented reason.
- Always verify webhook signatures from the raw request body before processing an event.
- Webhook processing, token grants, token reservations/commits/refunds, renewals, and cancellation changes must be idempotent and safe under retries or out-of-order delivery.
- Keep monetary amounts, plan/price mapping, billing period boundaries, and token mutations explicit and typed. Never trust plan, pack, price, or entitlement values supplied by a browser.
- Treat Stripe customer IDs, subscription IDs, checkout IDs, price IDs, and event IDs as integration identifiers; do not log secret material or full customer billing payloads.

## NestJS And Persistence Rules

- Controllers validate and route; services own billing behavior; entities represent storage, not API responses; DTOs define HTTP contracts.
- Use class validation patterns for input contracts and explicit TypeScript types for changed methods. Do not introduce `any`.
- Use TypeORM migrations for schema changes. Production behavior must keep `synchronize` disabled; do not make schema creation depend on runtime synchronization.
- Use transactions and uniqueness/idempotency constraints where multiple ledger or event records must change consistently.
- New queries that grow with customers, events, or ledger entries need pagination and appropriate indexes.

## Integration Checks

- When API responses or internal routes change, inspect `gateway` subscription client usage and frontend billing flows.
- When configuration, webhook routing, service discovery, secrets, or public ALB exposure changes, inspect `infra`.
- For Stripe SDK or API-version upgrades, consult current Stripe migration documentation, update version-dependent types/event handling intentionally, and test fixture/event compatibility.
- Do not use a live Stripe catalog or mutate deployed billing resources during routine tests.

## Configuration Contracts

Important configuration includes database settings, `STRIPE_API_KEY`, `STRIPE_WEBHOOK_SECRET`, checkout success/cancel URLs, and configured price IDs for subscription plans and token top-ups. Secrets must remain environment-injected.

## Commands

Run from `subscription-service`:

```bash
npm test -- --runInBand
npm run build
npm run lint
```

For schema changes, generate or write a reviewed migration and verify migration behavior against a disposable/local database setup. The lint script writes fixes; review resulting diffs.
