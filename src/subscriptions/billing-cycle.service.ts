import { Injectable } from '@nestjs/common';

@Injectable()
export class BillingCycleService {
  normalizeAnchorDay(date: Date): number {
    const day = date.getUTCDate();
    return day === 31 ? 30 : day;
  }

  nextPeriodEnd(periodStart: Date, anchorDay: number): Date {
    const year = periodStart.getUTCFullYear();
    const month = periodStart.getUTCMonth() + 1;
    const targetYear = month > 11 ? year + 1 : year;
    const targetMonth = month > 11 ? 0 : month;
    const day = Math.min(anchorDay, this.daysInMonthUtc(targetYear, targetMonth));

    return new Date(Date.UTC(
      targetYear,
      targetMonth,
      day,
      periodStart.getUTCHours(),
      periodStart.getUTCMinutes(),
      periodStart.getUTCSeconds(),
      periodStart.getUTCMilliseconds(),
    ));
  }

  private daysInMonthUtc(year: number, month: number): number {
    return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  }
}
