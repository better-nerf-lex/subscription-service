import { ConflictException, HttpException, HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, MoreThan, Repository } from 'typeorm';
import { EntityType } from '../common/enums/entity-type.enum';
import {
  BillingPlan,
  TokenGrantSource,
  TokenPack,
  TokenReservationStatus,
} from '../common/enums/billing-plan.enum';
import { Subscription } from '../entities/subscription.entity';
import { TokenGrant } from '../entities/token-grant.entity';
import { TokenReservation } from '../entities/token-reservation.entity';
import { TokenReservationDebit } from '../entities/token-reservation-debit.entity';
import { BillingCatalogService } from './billing-catalog.service';
import { TokenStatusDto } from './dto/token.dto';

interface SubscriptionGrantInput {
  entityId: string;
  entityType: EntityType;
  plan: BillingPlan;
  stripeSubscriptionId: string;
  stripeInvoiceId?: string | null;
  stripePriceId: string;
  periodStart: Date;
  periodEnd: Date;
}

interface TopUpGrantInput {
  entityId: string;
  entityType: EntityType;
  pack: TokenPack;
  stripeCheckoutSessionId: string;
  stripePriceId: string;
  paidAt: Date;
}

@Injectable()
export class TokenLedgerService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(TokenGrant)
    private readonly tokenGrantRepository: Repository<TokenGrant>,
    @InjectRepository(TokenReservation)
    private readonly reservationRepository: Repository<TokenReservation>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    private readonly billingCatalog: BillingCatalogService,
  ) {}

  async getStatus(entityId: string, entityType: EntityType): Promise<TokenStatusDto> {
    const now = new Date();
    const [subscription, grants] = await Promise.all([
      this.subscriptionRepository.findOne({
        where: {
          entityId,
          entityType,
          deletedAt: IsNull(),
          validUntil: MoreThan(now),
        },
        order: { validUntil: 'DESC' },
      }),
      this.tokenGrantRepository.find({
        where: {
          entityId,
          entityType,
          deletedAt: IsNull(),
          expiresAt: MoreThan(now),
        },
      }),
    ]);

    const monthlyTokensRemaining = grants
      .filter((grant) => grant.source === TokenGrantSource.SUBSCRIPTION)
      .reduce((sum, grant) => sum + grant.remainingTokens, 0);
    const carryoverTokensRemaining = grants
      .filter((grant) => grant.source === TokenGrantSource.CARRYOVER)
      .reduce((sum, grant) => sum + grant.remainingTokens, 0);
    const topUpTokensRemaining = grants
      .filter((grant) => grant.source === TokenGrantSource.TOP_UP)
      .reduce((sum, grant) => sum + grant.remainingTokens, 0);

    return {
      entityId,
      entityType,
      activePlan: subscription?.plan ?? null,
      subscriptionStatus: subscription ? subscription.status : 'inactive',
      subscriptionValidUntil: subscription?.validUntil?.toISOString() ?? null,
      pendingPlan: subscription?.pendingPlan ?? null,
      pendingPlanEffectiveAt: subscription?.pendingPlanEffectiveAt?.toISOString() ?? null,
      nextResetAt: subscription?.currentPeriodEnd?.toISOString() ?? subscription?.validUntil?.toISOString() ?? null,
      monthlyTokensRemaining,
      carryoverTokensRemaining,
      topUpTokensRemaining,
      tokensRemaining: monthlyTokensRemaining + carryoverTokensRemaining + topUpTokensRemaining,
    };
  }

  async grantSubscriptionTokens(input: SubscriptionGrantInput): Promise<TokenGrant> {
    const plan = this.billingCatalog.getPlan(input.plan);
    const existing = await this.tokenGrantRepository.findOne({
      where: {
        stripeSubscriptionId: input.stripeSubscriptionId,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
      },
    });

    if (existing) {
      return existing;
    }

    const grant = this.tokenGrantRepository.create({
      entityId: input.entityId,
      entityType: input.entityType,
      source: TokenGrantSource.SUBSCRIPTION,
      plan: input.plan,
      stripeSubscriptionId: input.stripeSubscriptionId,
      stripeInvoiceId: input.stripeInvoiceId ?? null,
      stripePriceId: input.stripePriceId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      expiresAt: input.periodEnd,
      grantedTokens: plan.monthlyTokens,
      remainingTokens: plan.monthlyTokens,
    });

    return this.tokenGrantRepository.save(grant);
  }

  async grantTopUpTokens(input: TopUpGrantInput): Promise<TokenGrant> {
    const pack = this.billingCatalog.getPack(input.pack);
    const existing = await this.tokenGrantRepository.findOne({
      where: {
        stripeCheckoutSessionId: input.stripeCheckoutSessionId,
        source: TokenGrantSource.TOP_UP,
      },
    });

    if (existing) {
      return existing;
    }

    const expiresAt = new Date(input.paidAt);
    expiresAt.setUTCFullYear(expiresAt.getUTCFullYear() + 1);

    const grant = this.tokenGrantRepository.create({
      entityId: input.entityId,
      entityType: input.entityType,
      source: TokenGrantSource.TOP_UP,
      pack: input.pack,
      stripeCheckoutSessionId: input.stripeCheckoutSessionId,
      stripePriceId: input.stripePriceId,
      expiresAt,
      grantedTokens: pack.tokens,
      remainingTokens: pack.tokens,
    });

    return this.tokenGrantRepository.save(grant);
  }

  async reserveTokens(
    entityId: string,
    entityType: EntityType,
    reservationKey: string,
    amount: number,
    documentId?: string,
  ): Promise<TokenReservation> {
    if (amount < 1) {
      throw new ConflictException('Reservation amount must be greater than zero');
    }

    return this.dataSource.transaction(async (manager) => {
      const existing = await manager.getRepository(TokenReservation).findOne({
        where: { reservationKey },
        relations: ['debits'],
      });

      if (existing) {
        if (existing.status === TokenReservationStatus.REFUNDED) {
          throw new ConflictException('Reservation has already been refunded');
        }
        return existing;
      }

      const grants = await manager.getRepository(TokenGrant)
        .createQueryBuilder('grant')
        .where('grant.entity_id = :entityId', { entityId })
        .andWhere('grant.entity_type = :entityType', { entityType })
        .andWhere('grant.deleted_at IS NULL')
        .andWhere('grant.expires_at > :now', { now: new Date() })
        .andWhere('grant.remaining_tokens > 0')
        .orderBy("CASE WHEN grant.source = 'subscription' THEN 0 WHEN grant.source = 'carryover' THEN 1 ELSE 2 END", 'ASC')
        .addOrderBy('grant.expires_at', 'ASC')
        .setLock('pessimistic_write')
        .getMany();

      const availableTokens = grants.reduce((sum, grant) => sum + grant.remainingTokens, 0);
      if (availableTokens < amount) {
        throw new HttpException('Not enough document tokens for this team', HttpStatus.PAYMENT_REQUIRED);
      }

      const reservation = await manager.getRepository(TokenReservation).save(manager.getRepository(TokenReservation).create({
        reservationKey,
        entityId,
        entityType,
        documentId: documentId ?? null,
        amount,
        status: TokenReservationStatus.RESERVED,
        expiresAt: this.reservationExpiry(),
      }));

      await this.debitGrants(manager, grants, reservation.id, amount);

      return manager.getRepository(TokenReservation).findOneOrFail({
        where: { id: reservation.id },
        relations: ['debits'],
      });
    });
  }

  async commitReservation(reservationKey: string): Promise<TokenReservation> {
    return this.dataSource.transaction(async (manager) => {
      const reservation = await this.findReservationForUpdate(manager, reservationKey);

      if (reservation.status === TokenReservationStatus.COMMITTED) {
        return reservation;
      }
      if (reservation.status === TokenReservationStatus.REFUNDED) {
        throw new ConflictException('Reservation has already been refunded');
      }

      reservation.status = TokenReservationStatus.COMMITTED;
      reservation.committedAt = new Date();
      return manager.getRepository(TokenReservation).save(reservation);
    });
  }

  async refundReservation(reservationKey: string): Promise<TokenReservation> {
    return this.dataSource.transaction(async (manager) => {
      const reservation = await this.findReservationForUpdate(manager, reservationKey);

      if (reservation.status === TokenReservationStatus.REFUNDED) {
        return reservation;
      }
      if (reservation.status === TokenReservationStatus.COMMITTED) {
        throw new ConflictException('Committed token reservations cannot be refunded');
      }

      const debits = await manager.getRepository(TokenReservationDebit).find({
        where: { reservationId: reservation.id },
      });

      for (const debit of debits) {
        const grant = await manager.getRepository(TokenGrant)
          .createQueryBuilder('grant')
          .where('grant.id = :id', { id: debit.tokenGrantId })
          .setLock('pessimistic_write')
          .getOneOrFail();
        grant.remainingTokens += debit.amount;
        await manager.getRepository(TokenGrant).save(grant);
      }

      reservation.status = TokenReservationStatus.REFUNDED;
      reservation.refundedAt = new Date();
      return manager.getRepository(TokenReservation).save(reservation);
    });
  }

  private async debitGrants(
    manager: EntityManager,
    grants: TokenGrant[],
    reservationId: string,
    amount: number,
  ): Promise<void> {
    let remaining = amount;

    for (const grant of grants) {
      if (remaining === 0) {
        return;
      }

      const debitAmount = Math.min(grant.remainingTokens, remaining);
      grant.remainingTokens -= debitAmount;
      remaining -= debitAmount;

      await manager.getRepository(TokenGrant).save(grant);
      await manager.getRepository(TokenReservationDebit).save(manager.getRepository(TokenReservationDebit).create({
        reservationId,
        tokenGrantId: grant.id,
        amount: debitAmount,
      }));
    }
  }

  private async findReservationForUpdate(
    manager: EntityManager,
    reservationKey: string,
  ): Promise<TokenReservation> {
    const reservation = await manager.getRepository(TokenReservation)
      .createQueryBuilder('reservation')
      .where('reservation.reservation_key = :reservationKey', { reservationKey })
      .setLock('pessimistic_write')
      .getOne();

    if (!reservation) {
      throw new NotFoundException('Token reservation not found');
    }

    return reservation;
  }

  private reservationExpiry(): Date {
    const expiresAt = new Date();
    expiresAt.setUTCHours(expiresAt.getUTCHours() + 6);
    return expiresAt;
  }
}
