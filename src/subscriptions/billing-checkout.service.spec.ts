import { BillingPlan } from '../common/enums/billing-plan.enum';
import { EntityType } from '../common/enums/entity-type.enum';
import { Subscription } from '../entities/subscription.entity';
import { BillingCheckoutService } from './billing-checkout.service';

describe('BillingCheckoutService', () => {
  const currentPeriodStart = new Date('2026-05-01T00:00:00.000Z');
  const currentPeriodEnd = new Date('2026-06-01T00:00:00.000Z');

  const createService = (subscription: Subscription) => {
    const stripeClient = {
      checkout: {
        sessions: {
          create: jest.fn(),
        },
      },
      prices: {
        list: jest.fn(),
        create: jest.fn(),
      },
      products: {
        create: jest.fn(),
      },
      subscriptions: {
        retrieve: jest.fn().mockResolvedValue({
          id: 'sub_team',
          schedule: 'sub_sched_existing',
          items: {
            data: [
              {
                price: { id: 'price_team' },
                quantity: 1,
              },
            ],
          },
        }),
      },
      subscriptionSchedules: {
        create: jest.fn(),
        retrieve: jest.fn().mockResolvedValue({
          id: 'sub_sched_existing',
          current_phase: {
            start_date: Math.floor(currentPeriodStart.getTime() / 1000),
          },
        }),
        update: jest.fn().mockResolvedValue({ id: 'sub_sched_existing' }),
        release: jest.fn().mockResolvedValue({ id: 'sub_sched_existing' }),
      },
    };

    const subscriptionsService = {
      findActiveByEntity: jest.fn().mockResolvedValue([subscription]),
      schedulePlanChange: jest.fn().mockResolvedValue(subscription),
      clearScheduledPlanChange: jest.fn().mockResolvedValue(subscription),
    };

    const service = new BillingCheckoutService(
      { client: stripeClient } as never,
      { get: jest.fn() } as never,
      {
        getPlan: jest.fn((plan: BillingPlan) => ({
          plan,
          priceId: plan === BillingPlan.SOLO ? 'price_solo' : 'price_team',
          name: plan === BillingPlan.SOLO ? 'Solo' : 'Team',
          monthlyTokens: plan === BillingPlan.SOLO ? 10 : 100,
          unitAmount: plan === BillingPlan.SOLO ? 15000 : 130000,
          currency: 'pln',
        })),
        getPack: jest.fn(),
      } as never,
      subscriptionsService as never,
    );

    return { service, stripeClient, subscriptionsService };
  };

  const teamSubscription = (overrides: Partial<Subscription> = {}): Subscription => ({
    id: 'local-subscription-id',
    stripeDetailsId: 'stripe-details-id',
    entityId: 'team-id',
    entityType: EntityType.TEAM,
    plan: BillingPlan.TEAM,
    pendingPlan: null,
    pendingPlanEffectiveAt: null,
    stripeScheduleId: null,
    anchorDay: 1,
    currentPeriodStart,
    currentPeriodEnd,
    status: 'active',
    validUntil: currentPeriodEnd,
    createdAt: currentPeriodStart,
    updatedAt: currentPeriodStart,
    deletedAt: null,
    stripeDetails: {
      id: 'stripe-details-id',
      stripeSubId: 'sub_team',
      stripePriceId: 'price_team',
      subscriptions: [],
      createdAt: currentPeriodStart,
      updatedAt: currentPeriodStart,
    },
    isActive: true,
    isExpired: false,
    ...overrides,
  } as unknown as Subscription);

  it('updates the attached Stripe schedule when scheduling a downgrade', async () => {
    const { service, stripeClient, subscriptionsService } = createService(teamSubscription());

    const response = await service.createSubscriptionCheckout('team-id', EntityType.TEAM, BillingPlan.SOLO);

    expect(response.action).toBe('scheduled');
    expect(stripeClient.subscriptionSchedules.create).not.toHaveBeenCalled();
    expect(stripeClient.subscriptionSchedules.update).toHaveBeenCalledWith('sub_sched_existing', expect.objectContaining({
      phases: expect.arrayContaining([
        expect.objectContaining({
          items: [{ price: 'price_team', quantity: 1 }],
        }),
        expect.objectContaining({
          items: [{ price: 'price_solo', quantity: 1 }],
          metadata: expect.objectContaining({ plan: BillingPlan.SOLO }),
        }),
      ]),
    }));
    expect(subscriptionsService.schedulePlanChange).toHaveBeenCalledWith(expect.objectContaining({
      pendingPlan: BillingPlan.SOLO,
      stripeScheduleId: 'sub_sched_existing',
    }));
  });

  it('releases the attached Stripe schedule when cancelling a pending downgrade', async () => {
    const { service, stripeClient, subscriptionsService } = createService(teamSubscription({
      pendingPlan: BillingPlan.SOLO,
      pendingPlanEffectiveAt: currentPeriodEnd,
    }));

    const response = await service.createSubscriptionCheckout('team-id', EntityType.TEAM, BillingPlan.TEAM);

    expect(response.action).toBe('scheduled');
    expect(stripeClient.subscriptionSchedules.release).toHaveBeenCalledWith('sub_sched_existing');
    expect(subscriptionsService.clearScheduledPlanChange).toHaveBeenCalledWith('local-subscription-id');
  });
});
