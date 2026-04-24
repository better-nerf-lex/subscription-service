import { MigrationInterface, QueryRunner } from 'typeorm';

const STRIPE_DETAILS_ID = '00000000-0000-0000-0000-000000000001';
const SUBSCRIPTION_ID = '00000000-0000-0000-0000-000000000002';
const TEAM_ID = '550e8400-e29b-41d4-a716-446655440100';
const VALID_UNTIL = '2028-12-31T23:59:59Z';
const STRIPE_SUB_ID = 'mock_sub_dev_seed';
const STRIPE_PRICE_ID = 'mock_price_dev_seed';

export class SeedMockSubscription1745452800000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `INSERT INTO stripe_details (id, stripe_sub_id, stripe_price_id)
       VALUES ($1::uuid, $2, $3)
       ON CONFLICT (stripe_sub_id) DO NOTHING`,
      [STRIPE_DETAILS_ID, STRIPE_SUB_ID, STRIPE_PRICE_ID],
    );

    await queryRunner.query(
      `INSERT INTO subscriptions (id, stripe_details_id, entity_id, entity_type, valid_until)
       SELECT $1::uuid, $2::uuid, $3, $4::subscriptions_entity_type_enum, $5::timestamp
       WHERE NOT EXISTS (
         SELECT 1 FROM subscriptions
         WHERE entity_id = $3
           AND entity_type = $4::subscriptions_entity_type_enum
           AND deleted_at IS NULL
           AND valid_until > CURRENT_TIMESTAMP
       )`,
      [SUBSCRIPTION_ID, STRIPE_DETAILS_ID, TEAM_ID, 'team', VALID_UNTIL],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM subscriptions WHERE id = $1::uuid`, [SUBSCRIPTION_ID]);
    await queryRunner.query(`DELETE FROM stripe_details WHERE id = $1::uuid`, [STRIPE_DETAILS_ID]);
  }
}
