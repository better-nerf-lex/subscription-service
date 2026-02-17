import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, MoreThan } from 'typeorm';
import { Subscription } from '../entities/subscription.entity';
import { StripeDetails } from '../entities/stripe-details.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { QuerySubscriptionsDto } from './dto/query-subscriptions.dto';
import { EntityType } from '../common/enums/entity-type.enum';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(StripeDetails)
    private readonly stripeDetailsRepository: Repository<StripeDetails>,
  ) {}

  /**
   * Create a new subscription
   */
  async createSubscription(createDto: CreateSubscriptionDto): Promise<Subscription> {
    // Check if active subscription already exists for this entity
    const existingActive = await this.findActiveByEntity(createDto.entityId, createDto.entityType);

    if (existingActive.length > 0) {
      throw new ConflictException('Active subscription already exists for this entity');
    }

    // Find or create stripe details
    let stripeDetails = await this.stripeDetailsRepository.findOne({
      where: { stripeSubId: createDto.stripeSubId },
    });

    if (!stripeDetails) {
      stripeDetails = this.stripeDetailsRepository.create({
        stripeSubId: createDto.stripeSubId,
        stripePriceId: createDto.stripePriceId,
      });
      await this.stripeDetailsRepository.save(stripeDetails);
    }

    // Create subscription
    const subscription = this.subscriptionRepository.create({
      stripeDetailsId: stripeDetails.id,
      entityId: createDto.entityId,
      entityType: createDto.entityType,
      validUntil: new Date(createDto.validUntil),
    });

    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Find subscription by ID
   */
  async findById(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id, deletedAt: IsNull() },
      relations: ['stripeDetails'],
    });

    if (!subscription) {
      throw new NotFoundException('Subscription not found');
    }

    return subscription;
  }

  /**
   * Find subscriptions by entity
   */
  async findByEntity(entityId: string, entityType: EntityType): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: {
        entityId,
        entityType,
        deletedAt: IsNull(),
      },
      relations: ['stripeDetails'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Find active subscriptions by entity
   */
  async findActiveByEntity(entityId: string, entityType: EntityType): Promise<Subscription[]> {
    return this.subscriptionRepository.find({
      where: {
        entityId,
        entityType,
        deletedAt: IsNull(),
        validUntil: MoreThan(new Date()),
      },
      relations: ['stripeDetails'],
      order: { validUntil: 'DESC' },
    });
  }

  /**
   * Get active subscription for entity (most recent)
   */
  async getActiveEntitySubscription(
    entityId: string,
    entityType: EntityType,
  ): Promise<Subscription> {
    const subscriptions = await this.findActiveByEntity(entityId, entityType);

    if (subscriptions.length === 0) {
      throw new NotFoundException('No active subscription found for this entity');
    }

    return subscriptions[0];
  }

  /**
   * Check if entity has active subscription
   */
  async isEntitySubscriptionActive(entityId: string, entityType: EntityType): Promise<boolean> {
    const count = await this.subscriptionRepository.count({
      where: {
        entityId,
        entityType,
        deletedAt: IsNull(),
        validUntil: MoreThan(new Date()),
      },
    });

    return count > 0;
  }

  /**
   * Renew subscription
   */
  async renewSubscription(id: string, newValidUntil: Date): Promise<Subscription> {
    const subscription = await this.findById(id);

    subscription.validUntil = newValidUntil;

    return this.subscriptionRepository.save(subscription);
  }

  /**
   * Cancel subscription (soft delete)
   */
  async cancelSubscription(id: string): Promise<void> {
    const subscription = await this.findById(id);
    await this.subscriptionRepository.softDelete(subscription.id);
  }

  /**
   * List subscriptions with filters
   */
  async listSubscriptions(query: QuerySubscriptionsDto): Promise<Subscription[]> {
    const queryBuilder = this.subscriptionRepository
      .createQueryBuilder('subscription')
      .leftJoinAndSelect('subscription.stripeDetails', 'stripeDetails');

    // Apply filters
    if (query.entityId) {
      queryBuilder.andWhere('subscription.entityId = :entityId', { entityId: query.entityId });
    }

    if (query.entityType) {
      queryBuilder.andWhere('subscription.entityType = :entityType', {
        entityType: query.entityType,
      });
    }

    if (!query.includeDeleted) {
      queryBuilder.andWhere('subscription.deletedAt IS NULL');
    }

    if (!query.includeExpired) {
      queryBuilder.andWhere('subscription.validUntil > :now', { now: new Date() });
    }

    // Apply pagination
    queryBuilder.orderBy('subscription.createdAt', 'DESC');

    if (query.limit) {
      queryBuilder.take(query.limit);
    }

    if (query.offset) {
      queryBuilder.skip(query.offset);
    }

    return queryBuilder.getMany();
  }
}
