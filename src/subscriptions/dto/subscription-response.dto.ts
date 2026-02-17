import { Subscription } from '../../entities/subscription.entity';
import { EntityType } from '../../common/enums/entity-type.enum';
import { StripeDetailsResponseDto } from './stripe-details-response.dto';

export class SubscriptionResponseDto {
  id: string;
  stripeDetailsId: string;
  entityId: string;
  entityType: EntityType;
  validUntil: Date;
  isActive: boolean;
  isExpired: boolean;
  createdAt: Date;
  updatedAt: Date;
  stripeDetails?: StripeDetailsResponseDto;

  static fromEntity(subscription: Subscription): SubscriptionResponseDto {
    const dto = new SubscriptionResponseDto();
    dto.id = subscription.id;
    dto.stripeDetailsId = subscription.stripeDetailsId;
    dto.entityId = subscription.entityId;
    dto.entityType = subscription.entityType;
    dto.validUntil = subscription.validUntil;
    dto.isActive = subscription.isActive;
    dto.isExpired = subscription.isExpired;
    dto.createdAt = subscription.createdAt;
    dto.updatedAt = subscription.updatedAt;

    if (subscription.stripeDetails) {
      dto.stripeDetails = StripeDetailsResponseDto.fromEntity(subscription.stripeDetails);
    }

    return dto;
  }

  static fromEntities(subscriptions: Subscription[]): SubscriptionResponseDto[] {
    return subscriptions.map((sub) => this.fromEntity(sub));
  }
}
