import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { TokenGrant } from './token-grant.entity';
import { TokenReservation } from './token-reservation.entity';

@Entity('token_reservation_debits')
export class TokenReservationDebit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'reservation_id', type: 'uuid' })
  reservationId: string;

  @Column({ name: 'token_grant_id', type: 'uuid' })
  tokenGrantId: string;

  @Column({ type: 'integer' })
  amount: number;

  @ManyToOne(() => TokenReservation, (reservation) => reservation.debits)
  @JoinColumn({ name: 'reservation_id' })
  reservation: TokenReservation;

  @ManyToOne(() => TokenGrant)
  @JoinColumn({ name: 'token_grant_id' })
  tokenGrant: TokenGrant;
}
