import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException } from '@nestjs/common';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Subscription } from '../entities/subscription.entity';
import { StripeDetails } from '../entities/stripe-details.entity';
import { EntityType } from '../common/enums/entity-type.enum';
import Stripe from 'stripe';

describe('StripeWebhookService', () => {
    let service: StripeWebhookService;

    const mockStripeService = {
        constructEvent: jest.fn(),
    };

    const mockSubscriptionsService = {
        createSubscription: jest.fn(),
        renewSubscription: jest.fn(),
        cancelSubscription: jest.fn(),
    };

    const mockSubscriptionRepository = {
        findOne: jest.fn(),
    };

    const mockStripeDetailsRepository = {
        findOne: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                StripeWebhookService,
                { provide: StripeService, useValue: mockStripeService },
                { provide: SubscriptionsService, useValue: mockSubscriptionsService },
                { provide: getRepositoryToken(Subscription), useValue: mockSubscriptionRepository },
                { provide: getRepositoryToken(StripeDetails), useValue: mockStripeDetailsRepository },
            ],
        }).compile();

        service = module.get<StripeWebhookService>(StripeWebhookService);
    });

    afterEach(() => jest.clearAllMocks());

    describe('constructEvent', () => {
        it('should return a Stripe Event on valid signature', () => {
            const event = { id: 'evt_1', type: 'customer.subscription.created' } as unknown as Stripe.Event;
            mockStripeService.constructEvent.mockReturnValue(event);

            const result = service.constructEvent(Buffer.from('body'), 'sig');

            expect(result).toBe(event);
        });

        it('should throw BadRequestException on invalid signature', () => {
            mockStripeService.constructEvent.mockImplementation(() => {
                throw new Error('No signatures found matching the expected signature');
            });

            expect(() => service.constructEvent(Buffer.from('body'), 'bad-sig')).toThrow(BadRequestException);
        });
    });

    describe('handleEvent', () => {
        it('should handle customer.subscription.created with entity metadata', async () => {
            const stripeSub = {
                id: 'sub_123',
                current_period_end: Math.floor(Date.now() / 1000) + 86400,
                metadata: { entityId: 'team-uuid', entityType: 'team' },
                items: { data: [{ price: { id: 'price_123' } }] },
            };
            const event = { type: 'customer.subscription.created', data: { object: stripeSub } } as unknown as Stripe.Event;

            mockSubscriptionsService.createSubscription.mockResolvedValue({ id: 'local-sub-id' });

            await service.handleEvent(event);

            expect(mockSubscriptionsService.createSubscription).toHaveBeenCalledWith(
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
            const event = { type: 'customer.subscription.created', data: { object: stripeSub } } as unknown as Stripe.Event;

            await service.handleEvent(event);

            expect(mockSubscriptionsService.createSubscription).not.toHaveBeenCalled();
        });

        it('should renew subscription on invoice.payment_succeeded', async () => {
            const stripeDetails = { id: 'sd-uuid', stripeSubId: 'sub_123' };
            const subscription = { id: 'local-sub-id' };
            mockStripeDetailsRepository.findOne.mockResolvedValue(stripeDetails);
            mockSubscriptionRepository.findOne.mockResolvedValue(subscription);
            mockSubscriptionsService.renewSubscription.mockResolvedValue(subscription);

            const periodEnd = Math.floor(Date.now() / 1000) + 86400 * 30;
            const invoice = {
                subscription: 'sub_123',
                lines: { data: [{ period: { end: periodEnd } }] },
            };
            const event = { type: 'invoice.payment_succeeded', data: { object: invoice } } as unknown as Stripe.Event;

            await service.handleEvent(event);

            expect(mockSubscriptionsService.renewSubscription).toHaveBeenCalledWith(
                'local-sub-id',
                new Date(periodEnd * 1000),
            );
        });

        it('should cancel subscription on customer.subscription.deleted', async () => {
            const stripeDetails = { id: 'sd-uuid', stripeSubId: 'sub_123' };
            const subscription = { id: 'local-sub-id' };
            mockStripeDetailsRepository.findOne.mockResolvedValue(stripeDetails);
            mockSubscriptionRepository.findOne.mockResolvedValue(subscription);
            mockSubscriptionsService.cancelSubscription.mockResolvedValue(undefined);

            const stripeSub = { id: 'sub_123', metadata: {} };
            const event = { type: 'customer.subscription.deleted', data: { object: stripeSub } } as unknown as Stripe.Event;

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
            const event = { type: 'invoice.payment_failed', data: { object: invoice } } as unknown as Stripe.Event;

            await service.handleEvent(event);

            expect(mockSubscriptionsService.cancelSubscription).toHaveBeenCalledWith('local-sub-id-2');
        });
    });
});
