import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { EntityType } from '../../common/enums/entity-type.enum';

export class ReserveTokensDto {
  @IsString()
  entityId: string;

  @IsEnum(EntityType)
  entityType: EntityType;

  @IsString()
  reservationKey: string;

  @IsInt()
  @Min(1)
  amount: number;

  @IsOptional()
  @IsString()
  documentId?: string;
}

export class ReservationKeyDto {
  @IsString()
  reservationKey: string;
}

export class TokenStatusDto {
  entityId: string;
  entityType: EntityType;
  activePlan: string | null;
  subscriptionStatus: string;
  subscriptionValidUntil: string | null;
  nextResetAt: string | null;
  monthlyTokensRemaining: number;
  topUpTokensRemaining: number;
  tokensRemaining: number;
}
