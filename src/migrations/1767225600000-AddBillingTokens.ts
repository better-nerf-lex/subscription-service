import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddBillingTokens1767225600000 implements MigrationInterface {
  name = 'AddBillingTokens1767225600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "plan" varchar(20)`);
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "anchor_day" integer NOT NULL DEFAULT 1`);
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "current_period_start" timestamp`);
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "current_period_end" timestamp`);
    await queryRunner.query(`ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "status" varchar(50) NOT NULL DEFAULT 'active'`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "stripe_events" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "event_id" varchar(255) NOT NULL UNIQUE,
        "type" varchar(255) NOT NULL,
        "processed_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_stripe_events_event_id" ON "stripe_events" ("event_id")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "token_grants" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "entity_id" varchar(255) NOT NULL,
        "entity_type" varchar(20) NOT NULL,
        "source" varchar(20) NOT NULL,
        "plan" varchar(20),
        "pack" varchar(20),
        "stripe_subscription_id" varchar(255),
        "stripe_checkout_session_id" varchar(255),
        "stripe_invoice_id" varchar(255),
        "stripe_price_id" varchar(255),
        "period_start" timestamp,
        "period_end" timestamp,
        "expires_at" timestamp NOT NULL,
        "granted_tokens" integer NOT NULL,
        "remaining_tokens" integer NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        "deleted_at" timestamp
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_token_grants_entity_expiry" ON "token_grants" ("entity_id", "entity_type", "expires_at")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_token_grants_expires_at" ON "token_grants" ("expires_at")`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_token_grants_subscription_period" ON "token_grants" ("stripe_subscription_id", "period_start", "period_end") WHERE stripe_subscription_id IS NOT NULL`);
    await queryRunner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_token_grants_checkout_source" ON "token_grants" ("stripe_checkout_session_id", "source") WHERE stripe_checkout_session_id IS NOT NULL`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "token_reservations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "reservation_key" varchar(255) NOT NULL UNIQUE,
        "entity_id" varchar(255) NOT NULL,
        "entity_type" varchar(20) NOT NULL,
        "document_id" varchar(255),
        "amount" integer NOT NULL,
        "status" varchar(20) NOT NULL,
        "committed_at" timestamp,
        "refunded_at" timestamp,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_token_reservations_key" ON "token_reservations" ("reservation_key")`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS "IDX_token_reservations_entity" ON "token_reservations" ("entity_id", "entity_type")`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "token_reservation_debits" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "reservation_id" uuid NOT NULL REFERENCES "token_reservations"("id") ON DELETE CASCADE,
        "token_grant_id" uuid NOT NULL REFERENCES "token_grants"("id"),
        "amount" integer NOT NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "token_reservation_debits"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "token_reservations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "token_grants"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "stripe_events"`);
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "status"`);
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "current_period_end"`);
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "current_period_start"`);
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "anchor_day"`);
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "plan"`);
  }
}
