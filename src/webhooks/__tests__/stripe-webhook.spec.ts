import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { StripeWebhookService } from '../services/stripe-webhook';
import { StripeService } from '../services/stripe';
import { SubscriptionsService } from '../../subscriptions/services/subscription';
import { Subscription } from '../../entities/subscriptions/subscription';
import { StripeDetails } from '../../entities/subscriptions/stripe-details';
import { StripeEvent } from '../../entities/webhooks/stripe-event';
import { EntityType } from '../../common/enums/entity-type';
import Stripe from 'stripe';
import { BillingCatalogService } from '../../subscriptions/services/billing-catalog';
import { BillingCycleService } from '../../subscriptions/services/billing-cycle';
import { TokenLedgerService } from '../../subscriptions/services/token-ledger';
import { BillingPlan } from '../../common/enums/billing-plan';

describe('StripeWebhookService', () => {
  let service: StripeWebhookService;

  const mockStripeService = {
    constructEvent: jest.fn(),
    client: {
      subscriptions: {
        retrieve: jest.fn(),
      },
      checkout: {
        sessions: {
          retrieve: jest.fn(),
        },
      },
    },
  };

  const mockSubscriptionsService = {
    createSubscription: jest.fn(),
    syncStripeSubscription: jest.fn(),
    renewSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
  };

  const mockSubscriptionRepository = {
    findOne: jest.fn(),
  };

  const mockStripeDetailsRepository = {
    findOne: jest.fn(),
  };

  const mockStripeEventRepository = {
    findOne: jest.fn(),
    create: jest.fn((value) => value),
    save: jest.fn(),
  };

  const mockBillingCatalogService = {
    getPlan: jest.fn(),
    getPlanByPriceId: jest.fn(),
    getPackByPriceId: jest.fn(),
  };

  const mockTokenLedgerService = {
    grantTopUpTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeWebhookService,
        { provide: StripeService, useValue: mockStripeService },
        { provide: SubscriptionsService, useValue: mockSubscriptionsService },
        { provide: getRepositoryToken(Subscription), useValue: mockSubscriptionRepository },
        { provide: getRepositoryToken(StripeDetails), useValue: mockStripeDetailsRepository },
        { provide: getRepositoryToken(StripeEvent), useValue: mockStripeEventRepository },
        { provide: BillingCatalogService, useValue: mockBillingCatalogService },
        BillingCycleService,
        { provide: TokenLedgerService, useValue: mockTokenLedgerService },
      ],
    }).compile();

    service = module.get<StripeWebhookService>(StripeWebhookService);
  });

  afterEach(() => jest.clearAllMocks());
  beforeEach(() => {
    mockStripeEventRepository.findOne.mockResolvedValue(null);
    mockStripeEventRepository.save.mockResolvedValue({});
    mockBillingCatalogService.getPlan.mockReturnValue({
      plan: BillingPlan.TEAM,
      priceId: 'price_123',
      monthlyTokens: 100,
    });
    mockBillingCatalogService.getPlanByPriceId.mockReturnValue({
      plan: BillingPlan.TEAM,
      priceId: 'price_123',
      monthlyTokens: 100,
    });
  });

  describe('constructEvent', () => {
    it('should return a Stripe Event on valid signature', () => {
      const event = {
        id: 'evt_1',
        type: 'customer.subscription.created',
      } as unknown as Stripe.Event;
      mockStripeService.constructEvent.mockReturnValue(event);

      const result = service.constructEvent(Buffer.from('body'), 'sig');

      expect(result).toBe(event);
    });

    it('should throw BadRequestException on invalid signature', () => {
      mockStripeService.constructEvent.mockImplementation(() => {
        throw new Error('No signatures found matching the expected signature');
      });

      expect(() => service.constructEvent(Buffer.from('body'), 'bad-sig')).toThrow(
        BadRequestException,
      );
    });
  });

  describe('handleEvent', () => {
    it('should handle customer.subscription.created with entity metadata', async () => {
      const stripeSub = {
        id: 'sub_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: Math.floor(Date.now() / 1000) + 86400,
        metadata: { entityId: 'team-uuid', entityType: 'team', plan: 'team' },
        items: { data: [{ price: { id: 'price_123' } }] },
      };
      const event = {
        id: 'evt_1',
        type: 'customer.subscription.created',
        data: { object: stripeSub },
      } as unknown as Stripe.Event;

      mockSubscriptionsService.syncStripeSubscription.mockResolvedValue({ id: 'local-sub-id' });

      await service.handleEvent(event);

      expect(mockSubscriptionsService.syncStripeSubscription).toHaveBeenCalledWith(
        expect.objectContaining({
          stripeSubId: 'sub_123',
          entityId: 'team-uuid',
          entityType: EntityType.TEAM,
        }),
      );
    });

    it('should skip customer.subscription.created when no entity metadata', async () => {
      const stripeSub = {
        id: 'sub_no_meta',
        current_period_end: Date.now(),
        metadata: {},
        items: { data: [] },
      };
      const event = {
        id: 'evt_2',
        type: 'customer.subscription.created',
        data: { object: stripeSub },
      } as unknown as Stripe.Event;

      await service.handleEvent(event);

      expect(mockSubscriptionsService.syncStripeSubscription).not.toHaveBeenCalled();
    });

    it('should renew subscription on invoice.payment_succeeded', async () => {
      const periodEnd = Math.floor(Date.now() / 1000) + 86400 * 30;
      mockStripeService.client.subscriptions.retrieve.mockResolvedValue({
        id: 'sub_123',
        status: 'active',
        current_period_start: Math.floor(Date.now() / 1000),
        current_period_end: periodEnd,
        metadata: { entityId: 'team-uuid', entityType: 'team', plan: 'team' },
        items: { data: [{ price: { id: 'price_123' } }] },
      });
      const invoice = {
        id: 'in_123',
        subscription: 'sub_123',
        lines: { data: [{ period: { end: periodEnd } }] },
      };
      const event = {
        id: 'evt_3',
        type: 'invoice.payment_succeeded',
        data: { object: invoice },
      } as unknown as Stripe.Event;

      await service.handleEvent(event);

      expect(mockSubscriptionsService.syncStripeSubscription).toHaveBeenCalledWith(
        expect.objectContaining({ stripeSubId: 'sub_123', stripeInvoiceId: 'in_123' }),
      );
    });

    it('should cancel subscription on customer.subscription.deleted', async () => {
      const stripeDetails = { id: 'sd-uuid', stripeSubId: 'sub_123' };
      const subscription = { id: 'local-sub-id' };
      mockStripeDetailsRepository.findOne.mockResolvedValue(stripeDetails);
      mockSubscriptionRepository.findOne.mockResolvedValue(subscription);
      mockSubscriptionsService.cancelSubscription.mockResolvedValue(undefined);

      const stripeSub = { id: 'sub_123', metadata: {} };
      const event = {
        id: 'evt_4',
        type: 'customer.subscription.deleted',
        data: { object: stripeSub },
      } as unknown as Stripe.Event;

      await service.handleEvent(event);

      expect(mockSubscriptionsService.cancelSubscription).toHaveBeenCalledWith('local-sub-id');
    });

    it('should cancel subscription on invoice.payment_failed', async () => {
      const stripeDetails = { id: 'sd-uuid', stripeSubId: 'sub_456' };
      const subscription = { id: 'local-sub-id-2' };
      mockStripeDetailsRepository.findOne.mockResolvedValue(stripeDetails);
      mockSubscriptionRepository.findOne.mockResolvedValue(subscription);
      mockSubscriptionsService.cancelSubscription.mockResolvedValue(undefined);

      const invoice = { subscription: 'sub_456' };
      const event = {
        id: 'evt_5',
        type: 'invoice.payment_failed',
        data: { object: invoice },
      } as unknown as Stripe.Event;

      await service.handleEvent(event);

      expect(mockSubscriptionsService.cancelSubscription).toHaveBeenCalledWith('local-sub-id-2');
    });
  });
});
