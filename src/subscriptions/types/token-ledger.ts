import { BillingPlan, TokenPack } from '../../common/enums/billing-plan';
import { EntityType } from '../../common/enums/entity-type';

export interface SubscriptionGrantInput {
  entityId: string;
  entityType: EntityType;
  plan: BillingPlan;
  stripeSubscriptionId: string;
  stripeInvoiceId?: string | null;
  stripePriceId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface TopUpGrantInput {
  entityId: string;
  entityType: EntityType;
  pack: TokenPack;
  stripeCheckoutSessionId: string;
  stripePriceId: string;
  paidAt: Date;
}
