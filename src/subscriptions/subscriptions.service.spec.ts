import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from '../entities/subscription.entity';
import { StripeDetails } from '../entities/stripe-details.entity';
import { TokenGrant } from '../entities/token-grant.entity';
import { EntityType } from '../common/enums/entity-type.enum';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { BillingCycleService } from './billing-cycle.service';
import { TokenLedgerService } from './token-ledger.service';

describe('SubscriptionsService', () => {
  let service: SubscriptionsService;

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
          useValue: { grantSubscriptionTokens: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<SubscriptionsService>(SubscriptionsService);
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
});
