import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeService } from './stripe.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { Subscription } from '../entities/subscription.entity';
import { StripeDetails } from '../entities/stripe-details.entity';
import { StripeEvent } from '../entities/stripe-event.entity';
import { TokenGrant } from '../entities/token-grant.entity';
import { TokenReservation } from '../entities/token-reservation.entity';
import { TokenReservationDebit } from '../entities/token-reservation-debit.entity';

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
export class StripeWebhookModule { }
