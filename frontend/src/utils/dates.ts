/**
 * Location-agnostic calendar date utilities powered by Temporal.PlainDate
 * (matches Java LocalDate YYYY-MM-DD payloads without UTC/timezone drift).
 */

function getTemporal(): typeof Temporal {
  if (typeof Temporal === 'undefined') {
    throw new Error('Temporal API is not initialized.');
  }
  return Temporal;
}

export function parsePlainDate(isoDate: string): Temporal.PlainDate {
  return getTemporal().PlainDate.from(isoDate);
}

export function todayPlainDate(): Temporal.PlainDate {
  return getTemporal().Now.plainDateISO();
}

export function formatCalendarDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '—';
  const plain = parsePlainDate(isoDate);
  return plain.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function previewDueDate(days = 14): string {
  const due = todayPlainDate().add({ days });
  return formatCalendarDate(due.toString());
}

/**
 * Signed day difference from referenceDate to dueOnIso:
 * negative means overdue by |diff| days, 0 means due today, positive means days remaining.
 */
export function daysUntilDue(dueOnIso: string, referenceDate?: Temporal.PlainDate): number {
  const T = getTemporal();
  const ref = referenceDate ?? T.Now.plainDateISO();
  const due = T.PlainDate.from(dueOnIso);
  return ref.until(due, { largestUnit: 'day' }).days;
}

export function describeLoanSchedule(
  dueOnIso: string,
  returnedOnIso: string | null,
  overdue: boolean,
  referenceDate?: Temporal.PlainDate,
): string {
  if (returnedOnIso) {
    return `Returned ${formatCalendarDate(returnedOnIso)}`;
  }
  const diff = daysUntilDue(dueOnIso, referenceDate);
  if (overdue || diff < 0) {
    const overdueDays = Math.abs(diff);
    return overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`;
  }
  if (diff === 0) {
    return 'Due today';
  }
  return diff === 1 ? 'Due in 1 day' : `Due in ${diff} days`;
}

export function formatDurationSeconds(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  if (mins >= 60) {
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m`;
  }
  return `${mins}m ${String(secs).padStart(2, '0')}s`;
}

/**
 * Computes elapsed percentage across a loan term (default 14 days) for progress meters.
 */
export function loanProgressPercent(
  borrowedOnIso: string,
  dueOnIso: string,
  returnedOnIso: string | null,
  referenceDate?: Temporal.PlainDate,
): number {
  if (returnedOnIso) return 100;
  const T = getTemporal();
  const ref = referenceDate ?? T.Now.plainDateISO();
  const borrowed = T.PlainDate.from(borrowedOnIso);
  const due = T.PlainDate.from(dueOnIso);
  const totalDays = Math.max(1, borrowed.until(due, { largestUnit: 'day' }).days);
  const elapsedDays = Math.max(0, borrowed.until(ref, { largestUnit: 'day' }).days);
  return Math.min(100, Math.round((elapsedDays / totalDays) * 100));
}
