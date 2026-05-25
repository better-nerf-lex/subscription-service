import { BillingPlan } from '../../common/enums/billing-plan';
import { EntityType } from '../../common/enums/entity-type';

export interface SyncStripeSubscriptionInput {
  stripeSubId: string;
  stripePriceId: string;
  entityId: string;
  entityType: EntityType;
  plan: BillingPlan;
  status: string;
  periodStart: Date;
  periodEnd?: Date | null;
  stripeInvoiceId?: string | null;
}

export interface ScheduledPlanChangeInput {
  subscriptionId: string;
  pendingPlan: BillingPlan;
  effectiveAt: Date;
  stripeScheduleId: string;
}
