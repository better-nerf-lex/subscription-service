import { IsEnum, IsNotEmpty, IsString, IsDateString } from 'class-validator';
import { EntityType } from '../../common/enums/entity-type.enum';

export class CreateSubscriptionDto {
  @IsNotEmpty()
  @IsString()
  stripeSubId: string;

  @IsNotEmpty()
  @IsString()
  stripePriceId: string;

  @IsNotEmpty()
  @IsString()
  entityId: string;

  @IsNotEmpty()
  @IsEnum(EntityType)
  entityType: EntityType;

  @IsNotEmpty()
  @IsDateString()
  validUntil: string;
}
