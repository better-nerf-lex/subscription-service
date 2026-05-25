import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeWebhookController } from './controller';
import { StripeWebhookService } from './services/stripe-webhook';
import { StripeService } from './services/stripe';
import { SubscriptionsModule } from '../subscriptions/module';
import { Subscription } from '../entities/subscriptions/subscription';
import { StripeDetails } from '../entities/subscriptions/stripe-details';
import { StripeEvent } from '../entities/webhooks/stripe-event';
import { TokenGrant } from '../entities/subscriptions/token-grant';
import { TokenReservation } from '../entities/subscriptions/token-reservation';
import { TokenReservationDebit } from '../entities/subscriptions/token-reservation-debit';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Subscription,
      StripeDetails,
      StripeEvent,
      TokenGrant,
      TokenReservation,
      TokenReservationDebit,
    ]),
    SubscriptionsModule,
  ],
  controllers: [StripeWebhookController],
  providers: [StripeWebhookService, StripeService],
})
export class StripeWebhookModule {}
