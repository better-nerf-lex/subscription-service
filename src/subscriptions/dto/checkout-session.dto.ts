import { IsEnum, IsString } from 'class-validator';
import { BillingPlan, TokenPack } from '../../common/enums/billing-plan.enum';
import { EntityType } from '../../common/enums/entity-type.enum';

export class CreateSubscriptionCheckoutDto {
  @IsString()
  entityId: string;

  @IsEnum(EntityType)
  entityType: EntityType;

  @IsEnum(BillingPlan)
  plan: BillingPlan;
}

export class CreateTopUpCheckoutDto {
  @IsString()
  entityId: string;

  @IsEnum(EntityType)
  entityType: EntityType;

  @IsEnum(TokenPack)
  pack: TokenPack;
}

export class CheckoutSessionResponseDto {
  sessionId: string;
  checkoutUrl: string;
  action?: 'checkout_required' | 'scheduled' | 'unchanged';
  message?: string;
  effectiveAt?: string | null;
}
