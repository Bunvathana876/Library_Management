import { beforeAll, describe, expect, it } from 'vitest';
import {
  daysUntilDue,
  describeLoanSchedule,
  formatCalendarDate,
  formatDurationSeconds,
  loanProgressPercent,
  parsePlainDate,
} from '@/utils/dates';

beforeAll(async () => {
  if (typeof Temporal === 'undefined') {
    await import('temporal-polyfill/global');
  }
});

describe('dates utilities (Temporal.PlainDate)', () => {
  it('parses YYYY-MM-DD calendar dates without timezone drift', () => {
    const d = parsePlainDate('2026-01-01');
    expect(d.year).toBe(2026);
    expect(d.month).toBe(1);
    expect(d.day).toBe(1);
    expect(formatCalendarDate('2026-01-01')).toBe('Jan 1, 2026');
    expect(formatCalendarDate(null)).toBe('—');
  });

  it('computes exact days until due and overdue descriptions', () => {
    const ref = parsePlainDate('2026-11-23');
    expect(daysUntilDue('2026-11-28', ref)).toBe(5);
    expect(daysUntilDue('2026-11-23', ref)).toBe(0);
    expect(daysUntilDue('2026-11-20', ref)).toBe(-3);

    expect(describeLoanSchedule('2026-11-28', null, false, ref)).toBe('Due in 5 days');
    expect(describeLoanSchedule('2026-11-23', null, false, ref)).toBe('Due today');
    expect(describeLoanSchedule('2026-11-20', null, true, ref)).toBe('3 days overdue');
    expect(describeLoanSchedule('2026-11-20', '2026-11-21', false, ref)).toBe(
      'Returned Nov 21, 2026',
    );
  });

  it('formats JWT session duration cleanly', () => {
    expect(formatDurationSeconds(1800)).toBe('30m 00s');
    expect(formatDurationSeconds(65)).toBe('1m 05s');
    expect(formatDurationSeconds(3660)).toBe('1h 1m');
  });

  it('computes 14-day loan progress percentage cleanly', () => {
    const mid = parsePlainDate('2026-11-17');
    expect(loanProgressPercent('2026-11-10', '2026-11-24', null, mid)).toBe(50);
    expect(loanProgressPercent('2026-11-10', '2026-11-24', '2026-11-12', mid)).toBe(100);
    expect(
      loanProgressPercent('2026-11-10', '2026-11-24', null, parsePlainDate('2026-12-01')),
    ).toBe(100);
  });
});
