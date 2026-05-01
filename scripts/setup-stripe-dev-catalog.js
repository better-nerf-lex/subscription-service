const Stripe = require('stripe');

const apiKey = process.env.STRIPE_API_KEY;

if (!apiKey) {
  throw new Error('STRIPE_API_KEY is required');
}

const stripe = new Stripe(apiKey, {
  apiVersion: '2025-02-24.acacia',
});

const catalog = [
  {
    productName: 'Lexai Solo',
    productLookupKey: 'lexai_solo',
    priceLookupKey: 'lexai_solo_monthly_pln',
    unitAmount: 15000,
    currency: 'pln',
    recurring: { interval: 'month' },
  },
  {
    productName: 'Lexai Team',
    productLookupKey: 'lexai_team',
    priceLookupKey: 'lexai_team_monthly_pln',
    unitAmount: 130000,
    currency: 'pln',
    recurring: { interval: 'month' },
  },
  {
    productName: 'Lexai 10 Token Top-up',
    productLookupKey: 'lexai_topup_10',
    priceLookupKey: 'lexai_topup_10_pln',
    unitAmount: 10000,
    currency: 'pln',
  },
  {
    productName: 'Lexai 100 Token Top-up',
    productLookupKey: 'lexai_topup_100',
    priceLookupKey: 'lexai_topup_100_pln',
    unitAmount: 75000,
    currency: 'pln',
  },
];

async function findProduct(productLookupKey) {
  const products = await stripe.products.search({
    query: `metadata['lookup_key']:'${productLookupKey}'`,
    limit: 1,
  });
  return products.data[0] ?? null;
}

async function findPrice(priceLookupKey) {
  const prices = await stripe.prices.list({
    lookup_keys: [priceLookupKey],
    limit: 1,
  });
  return prices.data[0] ?? null;
}

async function ensureCatalogItem(item) {
  let product = await findProduct(item.productLookupKey);
  if (!product) {
    product = await stripe.products.create({
      name: item.productName,
      metadata: {
        lookup_key: item.productLookupKey,
      },
    });
  }

  let price = await findPrice(item.priceLookupKey);
  if (!price) {
    price = await stripe.prices.create({
      product: product.id,
      lookup_key: item.priceLookupKey,
      currency: item.currency,
      unit_amount: item.unitAmount,
      recurring: item.recurring,
    });
  }

  return {
    lookupKey: item.priceLookupKey,
    productId: product.id,
    priceId: price.id,
  };
}

async function ensureWebhookEndpoint() {
  const webhookUrl = process.env.STRIPE_WEBHOOK_URL;
  if (!webhookUrl) {
    return null;
  }

  const enabledEvents = [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.payment_succeeded',
    'invoice.payment_failed',
  ];

  const endpoints = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = endpoints.data.find((endpoint) => endpoint.url === webhookUrl);
  if (existing) {
    await stripe.webhookEndpoints.update(existing.id, {
      disabled: false,
      enabled_events: enabledEvents,
    });
    return {
      id: existing.id,
      url: existing.url,
      secret: null,
      reused: true,
    };
  }

  const endpoint = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: enabledEvents,
  });

  return {
    id: endpoint.id,
    url: endpoint.url,
    secret: endpoint.secret,
    reused: false,
  };
}

async function main() {
  const results = [];
  for (const item of catalog) {
    results.push(await ensureCatalogItem(item));
  }
  const webhookEndpoint = await ensureWebhookEndpoint();

  const env = {
    STRIPE_PRICE_SOLO_MONTHLY: results.find((result) => result.lookupKey === 'lexai_solo_monthly_pln').priceId,
    STRIPE_PRICE_TEAM_MONTHLY: results.find((result) => result.lookupKey === 'lexai_team_monthly_pln').priceId,
    STRIPE_PRICE_TOPUP_10: results.find((result) => result.lookupKey === 'lexai_topup_10_pln').priceId,
    STRIPE_PRICE_TOPUP_100: results.find((result) => result.lookupKey === 'lexai_topup_100_pln').priceId,
  };
  if (webhookEndpoint?.secret) {
    env.STRIPE_WEBHOOK_SECRET = webhookEndpoint.secret;
  }

  console.log(JSON.stringify({ ...env, webhookEndpoint }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
