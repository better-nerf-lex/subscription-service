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

  @Column({ name: 'valid_until', type: 'timestamp' })
  @Index()
  validUntil: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

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
