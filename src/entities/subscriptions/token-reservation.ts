import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EntityType } from '../../common/enums/entity-type';
import { TokenReservationStatus } from '../../common/enums/billing-plan';
import { TokenReservationDebit } from './token-reservation-debit';

@Entity('token_reservations')
@Index(['entityId', 'entityType'])
export class TokenReservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reservation_key', type: 'varchar', length: 255, unique: true })
  @Index()
  reservationKey: string;

  @Column({ name: 'entity_id', type: 'varchar', length: 255 })
  entityId: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 20 })
  entityType: EntityType;

  @Column({ name: 'document_id', type: 'varchar', length: 255, nullable: true })
  documentId?: string | null;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ type: 'varchar', length: 20 })
  status: TokenReservationStatus;

  @Column({ name: 'committed_at', type: 'timestamp', nullable: true })
  committedAt?: Date | null;

  @Column({ name: 'refunded_at', type: 'timestamp', nullable: true })
  refundedAt?: Date | null;

  @Column({ name: 'expires_at', type: 'timestamp' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @OneToMany(() => TokenReservationDebit, (debit) => debit.reservation, { eager: true })
  debits: TokenReservationDebit[];
}
