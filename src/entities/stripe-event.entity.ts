import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity('stripe_events')
export class StripeEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'varchar', length: 255, unique: true })
  @Index()
  eventId: string;

  @Column({ type: 'varchar', length: 255 })
  type: string;

  @CreateDateColumn({ name: 'processed_at' })
  processedAt: Date;
}
