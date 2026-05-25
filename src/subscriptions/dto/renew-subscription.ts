import { IsNotEmpty, IsDateString } from 'class-validator';

export class RenewSubscriptionDto {
  @IsNotEmpty()
  @IsDateString()
  validUntil: string;
}
