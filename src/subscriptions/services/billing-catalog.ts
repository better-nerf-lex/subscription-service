import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingPlan, TokenPack } from '../../common/enums/billing-plan';
import { PlanConfig, TokenPackConfig } from '../types/catalog';

@Injectable()
export class BillingCatalogService {
  constructor(private readonly configService: ConfigService) {}

  getPlan(plan: BillingPlan): PlanConfig {
    const prices = this.configService.getOrThrow<{
      solo?: string;
      team?: string;
    }>('stripe.prices');
    const priceId = plan === BillingPlan.SOLO ? prices.solo : prices.team;

    return {
      plan,
      priceId: priceId ?? '',
      name: plan === BillingPlan.SOLO ? 'Solo' : 'Team',
      monthlyTokens: plan === BillingPlan.SOLO ? 10 : 100,
      unitAmount: plan === BillingPlan.SOLO ? 15000 : 130000,
      currency: 'pln',
    };
  }

  getPack(pack: TokenPack): TokenPackConfig {
    const prices = this.configService.getOrThrow<{
      tokens10?: string;
      tokens100?: string;
    }>('stripe.prices');
    const priceId = pack === TokenPack.TOKENS_10 ? prices.tokens10 : prices.tokens100;

    return {
      pack,
      priceId: priceId ?? '',
      name: pack === TokenPack.TOKENS_10 ? '10 document tokens' : '100 document tokens',
      tokens: pack === TokenPack.TOKENS_10 ? 10 : 100,
      unitAmount: pack === TokenPack.TOKENS_10 ? 10000 : 75000,
      currency: 'pln',
    };
  }

  getPlanByPriceId(priceId: string): PlanConfig | null {
    return (
      [BillingPlan.SOLO, BillingPlan.TEAM]
        .map((plan) => this.getPlan(plan))
        .find((plan) => plan.priceId !== '' && plan.priceId === priceId) ?? null
    );
  }

  getPackByPriceId(priceId: string): TokenPackConfig | null {
    return (
      [TokenPack.TOKENS_10, TokenPack.TOKENS_100]
        .map((pack) => this.getPack(pack))
        .find((pack) => pack.priceId !== '' && pack.priceId === priceId) ?? null
    );
  }
}
