import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsController } from './controller';
import { SubscriptionsService } from './services/subscription';
import { MockSubscriptionSeeder } from './seeders/mock-subscription';
import { Subscription } from '../entities/subscriptions/subscription';
import { StripeDetails } from '../entities/subscriptions/stripe-details';
import { TokenGrant } from '../entities/subscriptions/token-grant';
import { TokenReservation } from '../entities/subscriptions/token-reservation';
import { TokenReservationDebit } from '../entities/subscriptions/token-reservation-debit';
import { BillingCatalogService } from './services/billing-catalog';
import { BillingCycleService } from './services/billing-cycle';
import { BillingCheckoutService } from './services/billing-checkout';
import { TokenLedgerService } from './services/token-ledger';
import { StripeService } from '../webhooks/services/stripe';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      StripeDetails,
      TokenGrant,
      TokenReservation,
      TokenReservationDebit,
    ]),
  ],
  controllers: [SubscriptionsController],
  providers: [
    SubscriptionsService,
    MockSubscriptionSeeder,
    BillingCatalogService,
    BillingCycleService,
    BillingCheckoutService,
    TokenLedgerService,
    StripeService,
  ],
  exports: [SubscriptionsService, BillingCatalogService, BillingCycleService, TokenLedgerService],
})
export class SubscriptionsModule {}
