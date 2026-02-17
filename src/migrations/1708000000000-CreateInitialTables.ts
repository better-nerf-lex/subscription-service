import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class CreateInitialTables1708000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create stripe_details table
    await queryRunner.createTable(
      new Table({
        name: 'stripe_details',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'stripe_sub_id',
            type: 'varchar',
            length: '255',
            isUnique: true,
            isNullable: false,
          },
          {
            name: 'stripe_price_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create index on stripe_sub_id
    await queryRunner.createIndex(
      'stripe_details',
      new TableIndex({
        name: 'IDX_STRIPE_DETAILS_STRIPE_SUB_ID',
        columnNames: ['stripe_sub_id'],
        where: 'deleted_at IS NULL',
      }),
    );

    // Create subscriptions table
    await queryRunner.createTable(
      new Table({
        name: 'subscriptions',
        columns: [
          {
            name: 'id',
            type: 'uuid',
            isPrimary: true,
            generationStrategy: 'uuid',
            default: 'uuid_generate_v4()',
          },
          {
            name: 'stripe_details_id',
            type: 'uuid',
            isNullable: false,
          },
          {
            name: 'entity_id',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'entity_type',
            type: 'enum',
            enum: ['user', 'team', 'custom'],
            isNullable: false,
          },
          {
            name: 'valid_until',
            type: 'timestamp',
            isNullable: false,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'deleted_at',
            type: 'timestamp',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Create foreign key
    await queryRunner.createForeignKey(
      'subscriptions',
      new TableForeignKey({
        columnNames: ['stripe_details_id'],
        referencedTableName: 'stripe_details',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    // Create indexes
    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_SUBSCRIPTIONS_ENTITY',
        columnNames: ['entity_id', 'entity_type'],
      }),
    );

    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_SUBSCRIPTIONS_VALID_UNTIL',
        columnNames: ['valid_until'],
      }),
    );

    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_SUBSCRIPTIONS_ENTITY_ACTIVE',
        columnNames: ['entity_id', 'entity_type', 'valid_until'],
        where: 'deleted_at IS NULL',
      }),
    );

    // Create unique constraint for active subscriptions per entity
    await queryRunner.createIndex(
      'subscriptions',
      new TableIndex({
        name: 'IDX_SUBSCRIPTIONS_UNIQUE_ENTITY_ACTIVE',
        columnNames: ['entity_id', 'entity_type'],
        isUnique: true,
        where: 'deleted_at IS NULL AND valid_until > CURRENT_TIMESTAMP',
      }),
    );

    // Add comments
    await queryRunner.query(`
      COMMENT ON TABLE stripe_details IS 'Stores Stripe subscription and pricing details';
      COMMENT ON TABLE subscriptions IS 'Stores subscription information linked to entities (users, teams, or custom)';
      COMMENT ON COLUMN subscriptions.entity_id IS 'References the entity ID from gateway service (User.id, Team.id, or custom ID)';
      COMMENT ON COLUMN subscriptions.entity_type IS 'Type of entity: user, team, or custom';
      COMMENT ON COLUMN subscriptions.valid_until IS 'Subscription expiration date';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropTable('subscriptions', true);
    await queryRunner.dropTable('stripe_details', true);
  }
}
