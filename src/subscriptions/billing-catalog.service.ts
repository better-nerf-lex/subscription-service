import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BillingPlan, TokenPack } from '../common/enums/billing-plan.enum';

export interface PlanConfig {
  plan: BillingPlan;
  priceId: string;
  name: string;
  monthlyTokens: number;
}

export interface TokenPackConfig {
  pack: TokenPack;
  priceId: string;
  name: string;
  tokens: number;
}

@Injectable()
export class BillingCatalogService {
  constructor(private readonly configService: ConfigService) {}

  getPlan(plan: BillingPlan): PlanConfig {
    const prices = this.configService.getOrThrow<{
      solo?: string;
      team?: string;
    }>('stripe.prices');
    const priceId = plan === BillingPlan.SOLO ? prices.solo : prices.team;

    if (!priceId) {
      throw new InternalServerErrorException(`Stripe price is not configured for plan ${plan}`);
    }

    return {
      plan,
      priceId,
      name: plan === BillingPlan.SOLO ? 'Solo' : 'Team',
      monthlyTokens: plan === BillingPlan.SOLO ? 10 : 100,
    };
  }

  getPack(pack: TokenPack): TokenPackConfig {
    const prices = this.configService.getOrThrow<{
      tokens10?: string;
      tokens100?: string;
    }>('stripe.prices');
    const priceId = pack === TokenPack.TOKENS_10 ? prices.tokens10 : prices.tokens100;

    if (!priceId) {
      throw new InternalServerErrorException(`Stripe price is not configured for token pack ${pack}`);
    }

    return {
      pack,
      priceId,
      name: pack === TokenPack.TOKENS_10 ? '10 document tokens' : '100 document tokens',
      tokens: pack === TokenPack.TOKENS_10 ? 10 : 100,
    };
  }

  getPlanByPriceId(priceId: string): PlanConfig | null {
    return [BillingPlan.SOLO, BillingPlan.TEAM]
      .map((plan) => this.getOptionalPlan(plan))
      .find((plan) => plan?.priceId === priceId) ?? null;
  }

  getPackByPriceId(priceId: string): TokenPackConfig | null {
    return [TokenPack.TOKENS_10, TokenPack.TOKENS_100]
      .map((pack) => this.getOptionalPack(pack))
      .find((pack) => pack?.priceId === priceId) ?? null;
  }

  private getOptionalPlan(plan: BillingPlan): PlanConfig | null {
    try {
      return this.getPlan(plan);
    } catch {
      return null;
    }
  }

  private getOptionalPack(pack: TokenPack): TokenPackConfig | null {
    try {
      return this.getPack(pack);
    } catch {
      return null;
    }
  }
}
