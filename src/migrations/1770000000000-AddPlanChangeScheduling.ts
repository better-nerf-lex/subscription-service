import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlanChangeScheduling1770000000000 implements MigrationInterface {
  name = 'AddPlanChangeScheduling1770000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pending_plan" varchar(20)`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "pending_plan_effective_at" timestamp`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "stripe_schedule_id" varchar(255)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "stripe_schedule_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "pending_plan_effective_at"`,
    );
    await queryRunner.query(`ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "pending_plan"`);
  }
}
