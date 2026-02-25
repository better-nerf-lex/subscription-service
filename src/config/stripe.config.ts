import { registerAs } from '@nestjs/config';

export const stripeConfig = registerAs('stripe', () => {
    const apiKey = process.env.STRIPE_API_KEY;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    if (!apiKey) {
        // We don't throw here to allow ConfigModule to finish loading
        // but we'll check it in the service
        console.warn('STRIPE_API_KEY is not defined in environment');
    }

    return {
        apiKey,
        webhookSecret,
    };
});
