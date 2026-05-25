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
    successUrl:
      process.env.STRIPE_CHECKOUT_SUCCESS_URL || 'http://localhost:8080/billing?checkout=success',
    cancelUrl:
      process.env.STRIPE_CHECKOUT_CANCEL_URL || 'http://localhost:8080/billing?checkout=cancelled',
    prices: {
      solo: process.env.STRIPE_PRICE_SOLO_MONTHLY,
      team: process.env.STRIPE_PRICE_TEAM_MONTHLY,
      tokens10: process.env.STRIPE_PRICE_TOPUP_10,
      tokens100: process.env.STRIPE_PRICE_TOPUP_100,
    },
  };
});
