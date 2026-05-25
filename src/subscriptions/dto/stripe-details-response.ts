import { StripeDetails } from '../../entities/subscriptions/stripe-details';

export class StripeDetailsResponseDto {
  id: string;
  stripeSubId: string;
  stripePriceId: string;
  createdAt: Date;
  updatedAt: Date;

  static fromEntity(stripeDetails: StripeDetails): StripeDetailsResponseDto {
    const dto = new StripeDetailsResponseDto();
    dto.id = stripeDetails.id;
    dto.stripeSubId = stripeDetails.stripeSubId;
    dto.stripePriceId = stripeDetails.stripePriceId;
    dto.createdAt = stripeDetails.createdAt;
    dto.updatedAt = stripeDetails.updatedAt;
    return dto;
  }

  static fromEntities(stripeDetailsList: StripeDetails[]): StripeDetailsResponseDto[] {
    return stripeDetailsList.map((details) => this.fromEntity(details));
  }
}
