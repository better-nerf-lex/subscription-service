import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
  readonly client: Stripe;
  readonly webhookSecret: string;

  constructor(private readonly configService: ConfigService) {
    const stripeConfig = this.configService.getOrThrow<{ apiKey: string; webhookSecret: string }>(
      'stripe',
    );

    if (!stripeConfig.apiKey) {
      throw new Error('STRIPE_API_KEY is not defined or empty');
    }
    if (!stripeConfig.webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET is not defined or empty');
    }

    this.client = new Stripe(stripeConfig.apiKey, {
      apiVersion: '2025-02-24.acacia',
    });
    this.webhookSecret = stripeConfig.webhookSecret;
  }

  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    return this.client.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
  }
}
