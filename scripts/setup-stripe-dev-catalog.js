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
    unitAmount: 150,
    currency: 'pln',
    recurring: { interval: 'month' },
  },
  {
    productName: 'Lexai Team',
    productLookupKey: 'lexai_team',
    priceLookupKey: 'lexai_team_monthly_pln',
    unitAmount: 1300,
    currency: 'pln',
    recurring: { interval: 'month' },
  },
  {
    productName: 'Lexai 10 Token Top-up',
    productLookupKey: 'lexai_topup_10',
    priceLookupKey: 'lexai_topup_10_pln',
    unitAmount: 100,
    currency: 'pln',
  },
  {
    productName: 'Lexai 100 Token Top-up',
    productLookupKey: 'lexai_topup_100',
    priceLookupKey: 'lexai_topup_100_pln',
    unitAmount: 750,
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

async function main() {
  const results = [];
  for (const item of catalog) {
    results.push(await ensureCatalogItem(item));
  }

  const env = {
    STRIPE_PRICE_SOLO_MONTHLY: results.find((result) => result.lookupKey === 'lexai_solo_monthly_pln').priceId,
    STRIPE_PRICE_TEAM_MONTHLY: results.find((result) => result.lookupKey === 'lexai_team_monthly_pln').priceId,
    STRIPE_PRICE_TOPUP_10: results.find((result) => result.lookupKey === 'lexai_topup_10_pln').priceId,
    STRIPE_PRICE_TOPUP_100: results.find((result) => result.lookupKey === 'lexai_topup_100_pln').priceId,
  };

  console.log(JSON.stringify(env, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
