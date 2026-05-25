import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscription } from '../../entities/subscriptions/subscription';
import { StripeDetails } from '../../entities/subscriptions/stripe-details';
import { EntityType } from '../../common/enums/entity-type';

const STRIPE_DETAILS_ID = '00000000-0000-0000-0000-000000000001';
const SUBSCRIPTION_ID = '00000000-0000-0000-0000-000000000002';
const TEAM_ID = '550e8400-e29b-41d4-a716-446655440100';
const VALID_UNTIL = new Date('2028-12-31T23:59:59Z');
const STRIPE_SUB_ID = 'mock_sub_dev_seed';
const STRIPE_PRICE_ID = 'mock_price_dev_seed';

@Injectable()
export class MockSubscriptionSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(MockSubscriptionSeeder.name);

  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(StripeDetails)
    private readonly stripeDetailsRepository: Repository<StripeDetails>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (process.env.ENABLE_MOCK_SEED !== 'true') {
      this.logger.log('Skipping mock subscription seed (ENABLE_MOCK_SEED is not "true")');
      return;
    }

    try {
      const stripeDetailsExists = await this.stripeDetailsRepository.findOne({
        where: { id: STRIPE_DETAILS_ID },
        withDeleted: true,
      });

      if (!stripeDetailsExists) {
        await this.stripeDetailsRepository.save({
          id: STRIPE_DETAILS_ID,
          stripeSubId: STRIPE_SUB_ID,
          stripePriceId: STRIPE_PRICE_ID,
        });
        this.logger.log(`Mock stripe_details seeded (id=${STRIPE_DETAILS_ID})`);
      }

      const activeSub = await this.subscriptionRepository
        .createQueryBuilder('s')
        .where('s.entityId = :id', { id: TEAM_ID })
        .andWhere('s.entityType = :type', { type: EntityType.TEAM })
        .andWhere('s.deletedAt IS NULL')
        .andWhere('s.validUntil > NOW()')
        .getOne();

      if (activeSub) {
        this.logger.log(`Active subscription already exists for team ${TEAM_ID}`);
        return;
      }

      await this.subscriptionRepository.save({
        id: SUBSCRIPTION_ID,
        stripeDetailsId: STRIPE_DETAILS_ID,
        entityId: TEAM_ID,
        entityType: EntityType.TEAM,
        validUntil: VALID_UNTIL,
      });
      this.logger.log(
        `Mock subscription seeded for team ${TEAM_ID} valid until ${VALID_UNTIL.toISOString()}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;
      this.logger.error(`Failed to seed mock subscription: ${message}`, stack);
    }
  }
}
