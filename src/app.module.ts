import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from './config/database.config';
import { stripeConfig } from './config/stripe.config';
import { SubscriptionsModule } from './subscriptions/subscriptions.module';
import { HealthModule } from './health/health.module';
import { StripeWebhookModule } from './webhooks/stripe-webhook.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, stripeConfig],
      envFilePath: ['.env.local', '.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => configService.getOrThrow('database'),
    }),
    SubscriptionsModule,
    HealthModule,
    StripeWebhookModule,
  ],
})
export class AppModule { }
