import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from '../config/database';
import { stripeConfig } from '../config/stripe';
import { SubscriptionsModule } from '../subscriptions/module';
import { HealthModule } from '../health/module';
import { StripeWebhookModule } from '../webhooks/module';

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
export class AppModule {}
