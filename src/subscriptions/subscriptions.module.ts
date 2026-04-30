import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { MockSubscriptionSeeder } from './mock-subscription.seeder';
import { Subscription } from '../entities/subscription.entity';
import { StripeDetails } from '../entities/stripe-details.entity';
import { TokenGrant } from '../entities/token-grant.entity';
import { TokenReservation } from '../entities/token-reservation.entity';
import { TokenReservationDebit } from '../entities/token-reservation-debit.entity';
import { BillingCatalogService } from './billing-catalog.service';
import { BillingCycleService } from './billing-cycle.service';
import { BillingCheckoutService } from './billing-checkout.service';
import { TokenLedgerService } from './token-ledger.service';
import { StripeService } from '../webhooks/stripe.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, StripeDetails, TokenGrant, TokenReservation, TokenReservationDebit])],
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
