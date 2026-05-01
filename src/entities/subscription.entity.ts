import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { EntityType } from '../common/enums/entity-type.enum';
import { BillingPlan } from '../common/enums/billing-plan.enum';
import { StripeDetails } from './stripe-details.entity';

/**
 * Subscription entity represents a subscription linked to an entity
 * (User, Team, or Custom) from the gateway service
 */
@Entity('subscriptions')
@Index(['entityId', 'entityType'])
@Index(['entityId', 'entityType', 'validUntil'])
export class Subscription {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stripe_details_id', type: 'uuid' })
  stripeDetailsId: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 255 })
  entityId: string;

  @Column({
    name: 'entity_type',
    type: 'enum',
    enum: EntityType,
  })
  entityType: EntityType;

  @Column({ type: 'varchar', length: 20, nullable: true })
  plan?: BillingPlan | null;

  @Column({ name: 'pending_plan', type: 'varchar', length: 20, nullable: true })
  pendingPlan?: BillingPlan | null;

  @Column({ name: 'pending_plan_effective_at', type: 'timestamp', nullable: true })
  pendingPlanEffectiveAt?: Date | null;

  @Column({ name: 'stripe_schedule_id', type: 'varchar', length: 255, nullable: true })
  stripeScheduleId?: string | null;

  @Column({ name: 'anchor_day', type: 'integer', default: 1 })
  anchorDay: number;

  @Column({ name: 'current_period_start', type: 'timestamp', nullable: true })
  currentPeriodStart?: Date | null;

  @Column({ name: 'current_period_end', type: 'timestamp', nullable: true })
  currentPeriodEnd?: Date | null;

  @Column({ type: 'varchar', length: 50, default: 'active' })
  status: string;

  @Column({ name: 'valid_until', type: 'timestamp' })
  @Index()
  validUntil: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date | null;

  // Relations
  @ManyToOne(() => StripeDetails, (stripeDetails) => stripeDetails.subscriptions, {
    eager: true,
  })
  @JoinColumn({ name: 'stripe_details_id' })
  stripeDetails: StripeDetails;

  // Virtual properties
  get isActive(): boolean {
    if (this.deletedAt) return false;
    return new Date() < new Date(this.validUntil);
  }

  get isExpired(): boolean {
    if (this.deletedAt) return true;
    return new Date() > new Date(this.validUntil);
  }
}
