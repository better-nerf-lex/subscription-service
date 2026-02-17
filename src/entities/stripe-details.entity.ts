import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  Index,
  OneToMany,
} from 'typeorm';
import { Subscription } from './subscription.entity';

/**
 * StripeDetails entity stores Stripe subscription and pricing information
 */
@Entity('stripe_details')
export class StripeDetails {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'stripe_sub_id', type: 'varchar', length: 255, unique: true })
  @Index()
  stripeSubId: string;

  @Column({ name: 'stripe_price_id', type: 'varchar', length: 255 })
  stripePriceId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt?: Date;

  // Relations
  @OneToMany(() => Subscription, (subscription) => subscription.stripeDetails)
  subscriptions: Subscription[];
}
