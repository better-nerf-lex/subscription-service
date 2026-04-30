import { BillingCycleService } from './billing-cycle.service';

describe('BillingCycleService', () => {
  const service = new BillingCycleService();

  it('normalizes purchases on the 31st to anchor day 30', () => {
    expect(service.normalizeAnchorDay(new Date('2026-01-31T10:00:00.000Z'))).toBe(30);
  });

  it('caps a normalized 30th anchor to the last day of February', () => {
    const periodEnd = service.nextPeriodEnd(new Date('2026-01-31T10:00:00.000Z'), 30);

    expect(periodEnd.toISOString()).toBe('2026-02-28T10:00:00.000Z');
  });

  it('resets on the same day of the next month for regular purchase days', () => {
    const periodEnd = service.nextPeriodEnd(new Date('2026-04-15T08:30:00.000Z'), 15);

    expect(periodEnd.toISOString()).toBe('2026-05-15T08:30:00.000Z');
  });
});
