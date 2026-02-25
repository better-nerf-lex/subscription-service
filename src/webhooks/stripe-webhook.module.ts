import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StripeWebhookController } from './stripe-webhook.controller';
import { StripeWebhookService } from './stripe-webhook.service';
import { StripeService } from './stripe.service';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { Subscription } from '../entities/subscription.entity';
import { StripeDetails } from '../entities/stripe-details.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Subscription, StripeDetails]),
        SubscriptionsModule,
    ],
    controllers: [StripeWebhookController],
    providers: [StripeWebhookService, StripeService],
})
export class StripeWebhookModule { }
