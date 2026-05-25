import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import Stripe from 'stripe';
import { StripeService } from './stripe';
import { SubscriptionsService } from '../../subscriptions/services/subscription';
import { Subscription } from '../../entities/subscriptions/subscription';
import { StripeDetails } from '../../entities/subscriptions/stripe-details';
import { StripeEvent } from '../../entities/webhooks/stripe-event';
import { EntityType } from '../../common/enums/entity-type';
import { BillingPlan, TokenPack } from '../../common/enums/billing-plan';
import { BillingCatalogService } from '../../subscriptions/services/billing-catalog';
import { BillingCycleService } from '../../subscriptions/services/billing-cycle';
import { TokenLedgerService } from '../../subscriptions/services/token-ledger';

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
    @InjectRepository(StripeEvent)
    private readonly stripeEventRepository: Repository<StripeEvent>,
    private readonly billingCatalog: BillingCatalogService,
    private readonly billingCycle: BillingCycleService,
    private readonly tokenLedgerService: TokenLedgerService,
  ) {}

  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    try {
      return this.stripeService.constructEvent(rawBody, signature);
    } catch {
      throw new BadRequestException('Invalid Stripe webhook signature');
    }
  }

  async handleEvent(event: Stripe.Event): Promise<void> {
    const existingEvent = await this.stripeEventRepository.findOne({
      where: { eventId: event.id },
    });
    if (existingEvent) {
      this.logger.debug(`Skipping already processed Stripe event: ${event.id}`);
      return;
    }

    this.logger.log(`Processing Stripe event: ${event.type} [${event.id}]`);

    switch (event.type) {
      case 'checkout.session.completed':
        await this.handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
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

    await this.stripeEventRepository.save(
      this.stripeEventRepository.create({
        eventId: event.id,
        type: event.type,
      }),
    );
  }

  private async handleSubscriptionCreated(stripeSub: Stripe.Subscription): Promise<void> {
    await this.syncStripeSubscription(stripeSub);
  }

  private async handleSubscriptionUpdated(stripeSub: Stripe.Subscription): Promise<void> {
    await this.syncStripeSubscription(stripeSub);
  }

  private async syncStripeSubscription(
    stripeSub: Stripe.Subscription,
    stripeInvoiceId?: string | null,
  ): Promise<void> {
    const { entityId, entityType, plan } = this.extractEntityMetadata(stripeSub);
    const stripePriceId = this.extractSubscriptionPriceId(stripeSub);
    const planConfig = plan
      ? this.billingCatalog.getPlan(plan as BillingPlan)
      : this.billingCatalog.getPlanByPriceId(stripePriceId);

    if (!entityId || !entityType || !planConfig) {
      this.logger.warn(`Missing billing metadata on Stripe subscription ${stripeSub.id}`);
      return;
    }

    const currentPeriodStart =
      this.extractUnixDate(stripeSub, 'current_period_start') ?? new Date();
    const stripePeriodEnd = this.extractUnixDate(stripeSub, 'current_period_end');
    const anchorDay = this.billingCycle.normalizeAnchorDay(currentPeriodStart);
    const periodEnd =
      stripePeriodEnd ?? this.billingCycle.nextPeriodEnd(currentPeriodStart, anchorDay);

    await this.subscriptionsService.syncStripeSubscription({
      stripeSubId: stripeSub.id,
      stripePriceId,
      entityId,
      entityType: entityType as EntityType,
      plan: planConfig.plan,
      status: (stripeSub as unknown as { status: string }).status ?? 'active',
      periodStart: currentPeriodStart,
      periodEnd,
      stripeInvoiceId: stripeInvoiceId ?? null,
    });

    this.logger.log(`Subscription synced for entity ${entityType}:${entityId}`);
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
    const stripeSubId = this.extractInvoiceSubscriptionId(invoice);
    if (!stripeSubId) return;

    const stripeSub = await this.stripeService.client.subscriptions.retrieve(stripeSubId);
    await this.syncStripeSubscription(stripeSub, invoice.id);
    this.logger.log(`Subscription ${stripeSubId} renewed via invoice.payment_succeeded`);
  }

  private async handleInvoicePaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const stripeSubId = this.extractInvoiceSubscriptionId(invoice);
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

  private async handleCheckoutSessionCompleted(session: Stripe.Checkout.Session): Promise<void> {
    if (session.mode === 'subscription') {
      const stripeSubId = this.extractSessionSubscriptionId(session);
      if (!stripeSubId) return;
      const stripeSub = await this.stripeService.client.subscriptions.retrieve(stripeSubId);
      await this.syncStripeSubscription(stripeSub);
      return;
    }

    if (session.mode !== 'payment') {
      return;
    }

    const metadata = session.metadata ?? {};
    const entityId = metadata['entityId'];
    const entityType = metadata['entityType'] as EntityType | undefined;
    const pack = metadata['pack'] as TokenPack | undefined;

    if (!entityId || !entityType || !pack) {
      this.logger.warn(`Missing top-up metadata on checkout session ${session.id}`);
      return;
    }

    const hydratedSession = await this.stripeService.client.checkout.sessions.retrieve(session.id, {
      expand: ['line_items.data.price'],
    });
    const priceId = this.extractSessionPriceId(hydratedSession);
    const packConfig = priceId ? this.billingCatalog.getPackByPriceId(priceId) : null;

    await this.tokenLedgerService.grantTopUpTokens({
      entityId,
      entityType,
      pack: packConfig?.pack ?? pack,
      stripeCheckoutSessionId: session.id,
      stripePriceId: priceId ?? '',
      paidAt: new Date((session.created ?? Math.floor(Date.now() / 1000)) * 1000),
    });
    this.logger.log(`Granted top-up ${pack} to ${entityType}:${entityId}`);
  }

  private extractEntityMetadata(stripeSub: Stripe.Subscription): {
    entityId: string | undefined;
    entityType: string | undefined;
    plan: string | undefined;
  } {
    const metadata = (stripeSub as unknown as { metadata: Record<string, string> }).metadata ?? {};
    return {
      entityId: metadata['entityId'],
      entityType: metadata['entityType'],
      plan: metadata['plan'],
    };
  }

  private extractSubscriptionPriceId(stripeSub: Stripe.Subscription): string {
    return (
      (stripeSub as unknown as { items: { data: { price: { id: string } }[] } }).items?.data?.[0]
        ?.price?.id ?? ''
    );
  }

  private extractUnixDate(source: object, key: string): Date | null {
    const value = (source as Record<string, unknown>)[key];
    return typeof value === 'number' ? new Date(value * 1000) : null;
  }

  private extractInvoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
    const invoiceData = invoice as unknown as {
      subscription?: string | { id: string } | null;
      parent?: { subscription_details?: { subscription?: string | null } };
    };
    const subscription = invoiceData.subscription;
    if (typeof subscription === 'string') return subscription;
    if (subscription && typeof subscription === 'object') return subscription.id;
    return invoiceData.parent?.subscription_details?.subscription ?? null;
  }

  private extractSessionSubscriptionId(session: Stripe.Checkout.Session): string | null {
    const subscription = (session as unknown as { subscription?: string | { id: string } | null })
      .subscription;
    if (typeof subscription === 'string') return subscription;
    if (subscription && typeof subscription === 'object') return subscription.id;
    return null;
  }

  private extractSessionPriceId(session: Stripe.Checkout.Session): string | null {
    const lineItems = (
      session as unknown as {
        line_items?: { data?: { price?: { id?: string } }[] };
      }
    ).line_items;
    return lineItems?.data?.[0]?.price?.id ?? null;
  }
}
