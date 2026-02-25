import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import Stripe from 'stripe';
import { StripeService } from './stripe.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { Subscription } from '../entities/subscription.entity';
import { StripeDetails } from '../entities/stripe-details.entity';
import { EntityType } from '../common/enums/entity-type.enum';

@Injectable()
export class StripeWebhookService {
    private readonly logger = new Logger(StripeWebhookService.name);

    constructor(
        private readonly stripeService: StripeService,
        private readonly subscriptionsService: SubscriptionsService,
        @InjectRepository(Subscription)
        private readonly subscriptionRepository: Repository<Subscription>,
        @InjectRepository(StripeDetails)
        private readonly stripeDetailsRepository: Repository<StripeDetails>,
    ) { }

    constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
        try {
            return this.stripeService.constructEvent(rawBody, signature);
        } catch {
            throw new BadRequestException('Invalid Stripe webhook signature');
        }
    }

    async handleEvent(event: Stripe.Event): Promise<void> {
        this.logger.log(`Processing Stripe event: ${event.type} [${event.id}]`);

        switch (event.type) {
            case 'customer.subscription.created':
                await this.handleSubscriptionCreated(event.data.object as Stripe.Subscription);
                break;
            case 'customer.subscription.updated':
                await this.handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
                break;
            case 'customer.subscription.deleted':
                await this.handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
                break;
            case 'invoice.payment_succeeded':
                await this.handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
                break;
            case 'invoice.payment_failed':
                await this.handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
                break;
            default:
                this.logger.debug(`Unhandled event type: ${event.type}`);
        }
    }

    private async handleSubscriptionCreated(stripeSub: Stripe.Subscription): Promise<void> {
        const { entityId, entityType } = this.extractEntityMetadata(stripeSub);

        if (!entityId || !entityType) {
            this.logger.warn(`No entityId/entityType metadata on Stripe sub ${stripeSub.id} — skipping`);
            return;
        }

        const validUntil = new Date((stripeSub as unknown as { current_period_end: number }).current_period_end * 1000).toISOString();

        await this.subscriptionsService.createSubscription({
            stripeSubId: stripeSub.id,
            stripePriceId: (stripeSub as unknown as { items: { data: { price: { id: string } }[] } }).items.data[0]?.price?.id ?? '',
            entityId,
            entityType: entityType as EntityType,
            validUntil,
        });

        this.logger.log(`Subscription created for entity ${entityType}:${entityId}`);
    }

    private async handleSubscriptionUpdated(stripeSub: Stripe.Subscription): Promise<void> {
        const stripeDetails = await this.stripeDetailsRepository.findOne({
            where: { stripeSubId: stripeSub.id },
        });

        if (!stripeDetails) {
            this.logger.warn(`No local StripeDetails for sub ${stripeSub.id} on update — attempting create`);
            await this.handleSubscriptionCreated(stripeSub);
            return;
        }

        const subscription = await this.subscriptionRepository.findOne({
            where: { stripeDetailsId: stripeDetails.id, deletedAt: IsNull() },
        });

        if (!subscription) {
            this.logger.warn(`No active local subscription for StripeDetails ${stripeDetails.id}`);
            return;
        }

        const newValidUntil = new Date((stripeSub as unknown as { current_period_end: number }).current_period_end * 1000);
        await this.subscriptionsService.renewSubscription(subscription.id, newValidUntil);
        this.logger.log(`Subscription ${subscription.id} updated until ${newValidUntil.toISOString()}`);
    }

    private async handleSubscriptionDeleted(stripeSub: Stripe.Subscription): Promise<void> {
        const stripeDetails = await this.stripeDetailsRepository.findOne({
            where: { stripeSubId: stripeSub.id },
        });

        if (!stripeDetails) {
            this.logger.warn(`No local StripeDetails for sub ${stripeSub.id} on deletion`);
            return;
        }

        const subscription = await this.subscriptionRepository.findOne({
            where: { stripeDetailsId: stripeDetails.id, deletedAt: IsNull() },
        });

        if (!subscription) {
            this.logger.warn(`No active local subscription for StripeDetails ${stripeDetails.id}`);
            return;
        }

        await this.subscriptionsService.cancelSubscription(subscription.id);
        this.logger.log(`Subscription ${subscription.id} cancelled via Stripe webhook`);
    }

    private async handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
        const stripeSubId = (invoice as unknown as { subscription: string | null }).subscription;
        if (!stripeSubId) return;

        const stripeDetails = await this.stripeDetailsRepository.findOne({
            where: { stripeSubId },
        });

        if (!stripeDetails) {
            this.logger.warn(`No local StripeDetails for sub ${stripeSubId} on invoice.payment_succeeded`);
            return;
        }

        const subscription = await this.subscriptionRepository.findOne({
            where: { stripeDetailsId: stripeDetails.id, deletedAt: IsNull() },
        });

        if (!subscription) return;

        const periodEnd = (invoice as unknown as { lines: { data: { period: { end: number } }[] } }).lines?.data?.[0]?.period?.end;
        if (!periodEnd) return;

        const newValidUntil = new Date(periodEnd * 1000);
        await this.subscriptionsService.renewSubscription(subscription.id, newValidUntil);
        this.logger.log(`Subscription ${subscription.id} renewed until ${newValidUntil.toISOString()} via invoice.payment_succeeded`);
    }

    private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
        const stripeSubId = (invoice as unknown as { subscription: string | null }).subscription;
        if (!stripeSubId) return;

        const stripeDetails = await this.stripeDetailsRepository.findOne({
            where: { stripeSubId },
        });

        if (!stripeDetails) return;

        const subscription = await this.subscriptionRepository.findOne({
            where: { stripeDetailsId: stripeDetails.id, deletedAt: IsNull() },
        });

        if (!subscription) return;

        await this.subscriptionsService.cancelSubscription(subscription.id);
        this.logger.warn(`Subscription ${subscription.id} cancelled due to invoice.payment_failed`);
    }

    private extractEntityMetadata(stripeSub: Stripe.Subscription): {
        entityId: string | undefined;
        entityType: string | undefined;
    } {
        const metadata = (stripeSub as unknown as { metadata: Record<string, string> }).metadata ?? {};
        return {
            entityId: metadata['entityId'],
            entityType: metadata['entityType'],
        };
    }
}
