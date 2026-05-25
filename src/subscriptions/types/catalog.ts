import { BillingPlan, TokenPack } from '../../common/enums/billing-plan';

export interface PlanConfig {
  plan: BillingPlan;
  priceId: string;
  name: string;
  monthlyTokens: number;
  unitAmount: number;
  currency: string;
}

export interface TokenPackConfig {
  pack: TokenPack;
  priceId: string;
  name: string;
  tokens: number;
  unitAmount: number;
  currency: string;
}
