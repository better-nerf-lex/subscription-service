import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { MockSubscriptionSeeder } from './mock-subscription.seeder';
import { Subscription } from '../entities/subscription.entity';
import { StripeDetails } from '../entities/stripe-details.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription, StripeDetails])],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, MockSubscriptionSeeder],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
