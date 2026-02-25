import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeService {
    readonly client: Stripe;
    readonly webhookSecret: string;

    constructor(private readonly configService: ConfigService) {
        this.client = new Stripe(this.configService.getOrThrow<string>('STRIPE_API_KEY'), {
            apiVersion: '2025-02-24.acacia',
        });
        this.webhookSecret = this.configService.getOrThrow<string>('STRIPE_WEBHOOK_SECRET');
    }

    constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
        return this.client.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    }
}
