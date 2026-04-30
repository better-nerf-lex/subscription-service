import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { BillingPlan, TokenPack } from '../common/enums/billing-plan.enum';
import { EntityType } from '../common/enums/entity-type.enum';
import { StripeService } from '../webhooks/stripe.service';
import { BillingCatalogService, PlanConfig, TokenPackConfig } from './billing-catalog.service';
import { CheckoutSessionResponseDto } from './dto/checkout-session.dto';

@Injectable()
export class BillingCheckoutService {
  constructor(
    private readonly stripeService: StripeService,
    private readonly configService: ConfigService,
    private readonly billingCatalog: BillingCatalogService,
  ) {}

  async createSubscriptionCheckout(
    entityId: string,
    entityType: EntityType,
    plan: BillingPlan,
  ): Promise<CheckoutSessionResponseDto> {
    const planConfig = this.billingCatalog.getPlan(plan);
    const session = await this.stripeService.client.checkout.sessions.create({
      mode: 'subscription',
      line_items: [this.planLineItem(planConfig)],
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

    return this.toCheckoutSessionResponse(session);
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
    };
  }

  private planLineItem(plan: PlanConfig): Stripe.Checkout.SessionCreateParams.LineItem {
    if (plan.priceId) {
      return { price: plan.priceId, quantity: 1 };
    }

    return {
      quantity: 1,
      price_data: {
        currency: plan.currency,
        unit_amount: plan.unitAmount,
        recurring: { interval: 'month' },
        product_data: {
          name: `Lexai ${plan.name}`,
          metadata: {
            plan: plan.plan,
          },
        },
      },
    };
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
