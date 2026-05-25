import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityType } from '../../common/enums/entity-type';
import { BillingPlan, TokenGrantSource, TokenPack } from '../../common/enums/billing-plan';

@Entity('token_grants')
@Index(['entityId', 'entityType', 'expiresAt'])
@Index(['stripeSubscriptionId', 'periodStart', 'periodEnd'], {
  unique: true,
  where: 'stripe_subscription_id IS NOT NULL',
})
@Index(['stripeCheckoutSessionId', 'source'], {
  unique: true,
  where: 'stripe_checkout_session_id IS NOT NULL',
})
export class TokenGrant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 255 })
  entityId: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 20 })
  entityType: EntityType;

  @Column({ type: 'varchar', length: 20 })
  source: TokenGrantSource;

  @Column({ type: 'varchar', length: 20, nullable: true })
  plan?: BillingPlan | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  pack?: TokenPack | null;

  @Column({ name: 'stripe_subscription_id', type: 'varchar', length: 255, nullable: true })
  stripeSubscriptionId?: string | null;

  @Column({ name: 'stripe_checkout_session_id', type: 'varchar', length: 255, nullable: true })
  stripeCheckoutSessionId?: string | null;

  @Column({ name: 'stripe_invoice_id', type: 'varchar', length: 255, nullable: true })
  stripeInvoiceId?: string | null;

  @Column({ name: 'stripe_price_id', type: 'varchar', length: 255, nullable: true })
  stripePriceId?: string | null;

  @Column({ name: 'period_start', type: 'timestamp', nullable: true })
  periodStart?: Date | null;

  @Column({ name: 'period_end', type: 'timestamp', nullable: true })
  periodEnd?: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp' })
  @Index()
  expiresAt: Date;

  @Column({ name: 'granted_tokens', type: 'integer' })
  grantedTokens: number;

  @Column({ name: 'remaining_tokens', type: 'integer' })
  remainingTokens: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;
}
