import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from '../entities/subscription.entity';
import { StripeDetails } from '../entities/stripe-details.entity';
import { TokenGrant } from '../entities/token-grant.entity';
import { EntityType } from '../common/enums/entity-type.enum';
import { BillingPlan, TokenGrantSource } from '../common/enums/billing-plan.enum';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BillingCycleService } from './billing-cycle.service';
import { TokenLedgerService } from './token-ledger.service';
import { StripeService } from '../webhooks/stripe.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;
  let stripeService: StripeService;

  const mockSubscriptionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    softDelete: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockStripeDetailsRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockTokenGrantRepository = {
    softDelete: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockTokenLedgerService = {
    grantSubscriptionTokens: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionsService,
        {
          provide: getRepositoryToken(Subscription),
          useValue: mockSubscriptionRepository,
        },
        {
          provide: getRepositoryToken(StripeDetails),
          useValue: mockStripeDetailsRepository,
        },
        {
          provide: getRepositoryToken(TokenGrant),
          useValue: mockTokenGrantRepository,
        },
        BillingCycleService,
        {
          provide: TokenLedgerService,
          useValue: mockTokenLedgerService,
        },
        {
          provide: StripeService,
          useValue: {
            client: {
              subscriptions: {
                update: jest.fn(),
              },
            },
          },
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
    stripeService = module.get<StripeService>(StripeService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createSubscription', () => {
    it('should create a new subscription successfully', async () => {
      const createDto = {
        stripeSubId: 'sub_123',
        stripePriceId: 'price_123',
        entityId: '1',
        entityType: EntityType.USER,
        validUntil: '2026-12-31T23:59:59Z',
      };

      const stripeDetails = {
        id: 'stripe-uuid',
        stripeSubId: 'sub_123',
        stripePriceId: 'price_123',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const subscription = {
        id: 'sub-uuid',
        ...createDto,
        stripeDetailsId: stripeDetails.id,
        validUntil: new Date(createDto.validUntil),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockSubscriptionRepository.find.mockResolvedValue([]);
      mockStripeDetailsRepository.findOne.mockResolvedValue(null);
      mockStripeDetailsRepository.create.mockReturnValue(stripeDetails);
      mockStripeDetailsRepository.save.mockResolvedValue(stripeDetails);
      mockSubscriptionRepository.create.mockReturnValue(subscription);
      mockSubscriptionRepository.save.mockResolvedValue(subscription);

      const result = await service.createSubscription(createDto);

      expect(result).toEqual(subscription);
      expect(mockStripeDetailsRepository.create).toHaveBeenCalled();
      expect(mockSubscriptionRepository.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if active subscription exists', async () => {
      const createDto = {
        stripeSubId: 'sub_123',
        stripePriceId: 'price_123',
        entityId: '1',
        entityType: EntityType.USER,
        validUntil: '2026-12-31T23:59:59Z',
      };

      mockSubscriptionRepository.find.mockResolvedValue([{ id: 'existing-sub' }]);

      await expect(service.createSubscription(createDto)).rejects.toThrow(ConflictException);
    });
  });

  describe('findById', () => {
    it('should return a subscription by id', async () => {
      const subscription = {
        id: 'sub-uuid',
        entityId: '1',
        entityType: EntityType.USER,
        validUntil: new Date(),
        deletedAt: null,
      };

      mockSubscriptionRepository.findOne.mockResolvedValue(subscription);

      const result = await service.findById('sub-uuid');

      expect(result).toEqual(subscription);
      expect(mockSubscriptionRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'sub-uuid', deletedAt: expect.anything() },
        relations: ['stripeDetails'],
      });
    });

    it('should throw NotFoundException if subscription not found', async () => {
      mockSubscriptionRepository.findOne.mockResolvedValue(null);

      await expect(service.findById('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  describe('isEntitySubscriptionActive', () => {
    it('should return true if entity has active subscription', async () => {
      mockSubscriptionRepository.count.mockResolvedValue(1);

      const result = await service.isEntitySubscriptionActive('1', EntityType.USER);

      expect(result).toBe(true);
    });

    it('should return false if entity has no active subscription', async () => {
      mockSubscriptionRepository.count.mockResolvedValue(0);

      const result = await service.isEntitySubscriptionActive('1', EntityType.USER);

      expect(result).toBe(false);
    });
  });

  describe('syncStripeSubscription', () => {
    it('moves unused solo tokens to carryover and cancels the old solo renewal on team upgrade', async () => {
      const periodStart = new Date('2026-05-01T10:00:00Z');
      const periodEnd = new Date('2026-06-01T10:00:00Z');
      const teamStripeDetails = {
        id: 'team-stripe-details',
        stripeSubId: 'sub_team',
        stripePriceId: 'price_team',
      };
      const createdTeamSubscription = {
        id: 'team-subscription',
        stripeDetailsId: teamStripeDetails.id,
        entityId: 'team-1',
        entityType: EntityType.TEAM,
      };
      const soloSubscription = {
        id: 'solo-subscription',
        stripeDetailsId: 'solo-stripe-details',
        entityId: 'team-1',
        entityType: EntityType.TEAM,
        plan: BillingPlan.SOLO,
        validUntil: periodEnd,
        stripeDetails: {
          stripeSubId: 'sub_solo',
        },
      };
      const soloGrant = {
        id: 'solo-grant',
        source: TokenGrantSource.SUBSCRIPTION,
        remainingTokens: 4,
      };

      mockStripeDetailsRepository.findOne.mockResolvedValue(teamStripeDetails);
      mockSubscriptionRepository.findOne.mockResolvedValue(null);
      mockSubscriptionRepository.create.mockReturnValue(createdTeamSubscription);
      mockSubscriptionRepository.save.mockImplementation((subscription) => Promise.resolve(subscription));
      mockSubscriptionRepository.find.mockResolvedValue([soloSubscription]);
      mockTokenGrantRepository.find.mockResolvedValue([soloGrant]);
      mockTokenGrantRepository.save.mockResolvedValue({ ...soloGrant, source: TokenGrantSource.CARRYOVER });
      mockSubscriptionRepository.softDelete.mockResolvedValue({ affected: 1 });
      mockTokenGrantRepository.softDelete.mockResolvedValue({ affected: 1 });
      mockTokenLedgerService.grantSubscriptionTokens.mockResolvedValue({});

      await service.syncStripeSubscription({
        stripeSubId: 'sub_team',
        stripePriceId: 'price_team',
        entityId: 'team-1',
        entityType: EntityType.TEAM,
        plan: BillingPlan.TEAM,
        status: 'active',
        periodStart,
        periodEnd,
      });

      expect(soloGrant.source).toBe(TokenGrantSource.CARRYOVER);
      expect(mockTokenGrantRepository.save).toHaveBeenCalledWith(soloGrant);
      expect(stripeService.client.subscriptions.update).toHaveBeenCalledWith('sub_solo', {
        cancel_at_period_end: true,
      });
      expect(mockTokenLedgerService.grantSubscriptionTokens).toHaveBeenCalledWith(
        expect.objectContaining({
          plan: BillingPlan.TEAM,
          stripeSubscriptionId: 'sub_team',
        }),
      );
    });

    it('does not resurrect a replaced soft-deleted subscription when Stripe sends a later update', async () => {
      const softDeletedSubscription = {
        id: 'old-solo-subscription',
        stripeDetailsId: 'solo-stripe-details',
        entityId: 'team-1',
        entityType: EntityType.TEAM,
        plan: BillingPlan.SOLO,
        deletedAt: new Date('2026-05-01T10:00:00Z'),
      };
      const activeTeamSubscription = {
        id: 'team-subscription',
        stripeDetailsId: 'team-stripe-details',
        entityId: 'team-1',
        entityType: EntityType.TEAM,
        plan: BillingPlan.TEAM,
      };

      mockStripeDetailsRepository.findOne.mockResolvedValue({
        id: 'solo-stripe-details',
        stripeSubId: 'sub_solo',
        stripePriceId: 'price_solo',
      });
      mockSubscriptionRepository.findOne.mockResolvedValue(softDeletedSubscription);
      mockSubscriptionRepository.find.mockResolvedValue([activeTeamSubscription]);

      const result = await service.syncStripeSubscription({
        stripeSubId: 'sub_solo',
        stripePriceId: 'price_solo',
        entityId: 'team-1',
        entityType: EntityType.TEAM,
        plan: BillingPlan.SOLO,
        status: 'active',
        periodStart: new Date('2026-05-01T10:00:00Z'),
        periodEnd: new Date('2026-06-01T10:00:00Z'),
      });

      expect(result).toBe(softDeletedSubscription);
      expect(mockSubscriptionRepository.save).not.toHaveBeenCalled();
      expect(mockTokenLedgerService.grantSubscriptionTokens).not.toHaveBeenCalled();
    });
  });
});
