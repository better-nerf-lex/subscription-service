import { ConflictException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { BillingPlan, TokenPack } from '../common/enums/billing-plan.enum';
import { EntityType } from '../common/enums/entity-type.enum';
import { StripeService } from '../webhooks/stripe.service';
import { BillingCatalogService, PlanConfig, TokenPackConfig } from './billing-catalog.service';
import { CheckoutSessionResponseDto } from './dto/checkout-session.dto';
import { SubscriptionsService } from './subscriptions.service';
import { Subscription } from '../entities/subscription.entity';

@Injectable()
export class BillingCheckoutService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly billingCatalog: BillingCatalogService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async createSubscriptionCheckout(
    entityId: string,
    entityType: EntityType,
    plan: BillingPlan,
  ): Promise<CheckoutSessionResponseDto> {
    const activeSubscription = await this.findCurrentSubscription(entityId, entityType);
    if (activeSubscription) {
      const existingPlan = activeSubscription.plan;
      if (existingPlan === plan && !activeSubscription.pendingPlan) {
        return {
          sessionId: '',
          checkoutUrl: '',
          action: 'unchanged',
          message: `${this.planLabel(plan)} is already active.`,
          effectiveAt: null,
        };
      }

      if (existingPlan === BillingPlan.TEAM && plan === BillingPlan.SOLO) {
        return this.scheduleDowngrade(activeSubscription, plan);
      }

      if (existingPlan === BillingPlan.TEAM && plan === BillingPlan.TEAM && activeSubscription.pendingPlan) {
        return this.clearScheduledChange(activeSubscription);
      }
    }

    const planConfig = this.billingCatalog.getPlan(plan);
    const priceId = await this.ensurePlanPrice(planConfig);
    const session = await this.stripeService.client.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: this.successUrl(),
      cancel_url: this.cancelUrl(),
      metadata: {
        entityId,
        entityType,
        plan,
      },
      subscription_data: {
        metadata: {
          entityId,
          entityType,
          plan,
        },
      },
    });

    return {
      ...this.toCheckoutSessionResponse(session),
      action: 'checkout_required',
      message: plan === BillingPlan.TEAM && activeSubscription?.plan === BillingPlan.SOLO
        ? 'Upgrade requires payment now. Unused Solo tokens will carry over until the Solo period would have ended.'
        : undefined,
      effectiveAt: null,
    };
  }

  async createTopUpCheckout(
    entityId: string,
    entityType: EntityType,
    pack: TokenPack,
  ): Promise<CheckoutSessionResponseDto> {
    const packConfig = this.billingCatalog.getPack(pack);
    const session = await this.stripeService.client.checkout.sessions.create({
      mode: 'payment',
      line_items: [this.packLineItem(packConfig)],
      success_url: this.successUrl(),
      cancel_url: this.cancelUrl(),
      metadata: {
        entityId,
        entityType,
        pack,
      },
    });

    return this.toCheckoutSessionResponse(session);
  }

  private toCheckoutSessionResponse(session: Stripe.Checkout.Session): CheckoutSessionResponseDto {
    return {
      sessionId: session.id,
      checkoutUrl: session.url ?? '',
      action: 'checkout_required',
    };
  }

  private async findCurrentSubscription(
    entityId: string,
    entityType: EntityType,
  ): Promise<Subscription | null> {
    const subscriptions = await this.subscriptionsService.findActiveByEntity(entityId, entityType);
    return subscriptions[0] ?? null;
  }

  private async scheduleDowngrade(
    subscription: Subscription,
    targetPlan: BillingPlan,
  ): Promise<CheckoutSessionResponseDto> {
    if (!subscription.stripeDetails?.stripeSubId) {
      throw new ConflictException('Cannot schedule plan change for subscription without Stripe details');
    }

    const effectiveAt = subscription.currentPeriodEnd ?? subscription.validUntil;
    const scheduleId = await this.scheduleNextStripePhase(subscription, targetPlan, effectiveAt);
    await this.subscriptionsService.schedulePlanChange({
      subscriptionId: subscription.id,
      pendingPlan: targetPlan,
      effectiveAt,
      stripeScheduleId: scheduleId,
    });

    return {
      sessionId: '',
      checkoutUrl: '',
      action: 'scheduled',
      message: `Solo will start on ${effectiveAt.toISOString()}. Team remains active until then.`,
      effectiveAt: effectiveAt.toISOString(),
    };
  }

  private async clearScheduledChange(subscription: Subscription): Promise<CheckoutSessionResponseDto> {
    if (!subscription.stripeDetails?.stripeSubId) {
      throw new ConflictException('Cannot clear plan change for subscription without Stripe details');
    }

    const scheduleId = await this.findAttachedScheduleId(subscription.stripeDetails.stripeSubId);
    if (scheduleId) {
      await this.stripeService.client.subscriptionSchedules.release(scheduleId);
    }
    await this.subscriptionsService.clearScheduledPlanChange(subscription.id);

    return {
      sessionId: '',
      checkoutUrl: '',
      action: 'scheduled',
      message: 'Team renewal restored for the next billing period.',
      effectiveAt: subscription.currentPeriodEnd?.toISOString() ?? subscription.validUntil.toISOString(),
    };
  }

  private async scheduleNextStripePhase(
    subscription: Subscription,
    targetPlan: BillingPlan,
    effectiveAt: Date,
  ): Promise<string> {
    if (!subscription.plan) {
      throw new ConflictException('Cannot schedule plan change without an active plan');
    }

    const stripeSubscription = await this.stripeService.client.subscriptions.retrieve(
      subscription.stripeDetails.stripeSubId,
    );
    const currentItem = stripeSubscription.items.data[0];
    if (!currentItem?.price?.id) {
      throw new ConflictException('Cannot schedule plan change without a Stripe subscription item');
    }

    const targetPriceId = await this.ensurePlanPrice(this.billingCatalog.getPlan(targetPlan));
    const attachedScheduleId = this.extractSubscriptionScheduleId(stripeSubscription);
    const scheduleId = attachedScheduleId ?? (await this.stripeService.client.subscriptionSchedules.create({
      from_subscription: stripeSubscription.id,
    })).id;
    const currentSchedule = await this.stripeService.client.subscriptionSchedules.retrieve(scheduleId);
    const periodStart = currentSchedule.current_phase?.start_date
      ?? this.toUnixSeconds(subscription.currentPeriodStart ?? new Date());
    const periodEnd = this.toUnixSeconds(effectiveAt);

    await this.stripeService.client.subscriptionSchedules.update(scheduleId, {
      phases: [
        {
          start_date: periodStart,
          end_date: periodEnd,
          items: [{ price: currentItem.price.id, quantity: currentItem.quantity ?? 1 }],
          metadata: {
            entityId: subscription.entityId,
            entityType: subscription.entityType,
            plan: subscription.plan,
          },
        },
        {
          start_date: periodEnd,
          items: [{ price: targetPriceId, quantity: currentItem.quantity ?? 1 }],
          metadata: {
            entityId: subscription.entityId,
            entityType: subscription.entityType,
            plan: targetPlan,
          },
        },
      ],
    });

    return scheduleId;
  }

  private async findAttachedScheduleId(stripeSubscriptionId: string): Promise<string | null> {
    const stripeSubscription = await this.stripeService.client.subscriptions.retrieve(stripeSubscriptionId);
    return this.extractSubscriptionScheduleId(stripeSubscription);
  }

  private extractSubscriptionScheduleId(stripeSubscription: Stripe.Subscription): string | null {
    const schedule = (stripeSubscription as unknown as { schedule?: string | { id?: string } | null }).schedule;
    if (typeof schedule === 'string') {
      return schedule;
    }
    return schedule?.id ?? null;
  }

  private async ensurePlanPrice(plan: PlanConfig): Promise<string> {
    if (plan.priceId) {
      return plan.priceId;
    }

    const lookupKey = plan.plan === BillingPlan.SOLO ? 'lexai_solo_monthly_pln' : 'lexai_team_monthly_pln';
    const existing = await this.stripeService.client.prices.list({ lookup_keys: [lookupKey], limit: 1 });
    if (existing.data[0]) {
      return existing.data[0].id;
    }

    const product = await this.stripeService.client.products.create({
      name: `Lexai ${plan.name}`,
      metadata: { plan: plan.plan, lookup_key: lookupKey.replace('_monthly_pln', '') },
    });
    const price = await this.stripeService.client.prices.create({
      product: product.id,
      lookup_key: lookupKey,
      currency: plan.currency,
      unit_amount: plan.unitAmount,
      recurring: { interval: 'month' },
    });

    return price.id;
  }

  private planLabel(plan: BillingPlan): string {
    return plan === BillingPlan.SOLO ? 'Solo' : 'Team';
  }

  private toUnixSeconds(date: Date): number {
    return Math.floor(date.getTime() / 1000);
  }

  private packLineItem(pack: TokenPackConfig): Stripe.Checkout.SessionCreateParams.LineItem {
    if (pack.priceId) {
      return { price: pack.priceId, quantity: 1 };
    }

    return {
      quantity: 1,
      price_data: {
        currency: pack.currency,
        unit_amount: pack.unitAmount,
        product_data: {
          name: `Lexai ${pack.name}`,
          metadata: {
            pack: pack.pack,
          },
        },
      },
    };
  }

  private successUrl(): string {
    return this.configService.get<string>('stripe.successUrl') ?? 'http://localhost:8080/billing?checkout=success';
  }

  private cancelUrl(): string {
    return this.configService.get<string>('stripe.cancelUrl') ?? 'http://localhost:8080/billing?checkout=cancelled';
  }
}
