import { describe, expect, it } from 'vitest';
import { getInventorySummary } from '@/utils/inventory';
import type { Book } from '@/types/api';

const title: Book = { id: 1, title: 'Reading', author: 'A. Reader', publicationYear: 2020, available: true };

describe('physical inventory reporting', () => {
  it('counts copies across titles, including unavailable and reserved copies', () => {
    expect(getInventorySummary([
      { ...title, totalCopies: 7, availableCopies: 4, loanedCopies: 2, onHoldCopies: 1 },
      { ...title, id: 2, available: false, totalCopies: 3, availableCopies: 0, loanedCopies: 2, onHoldCopies: 0 },
    ])).toEqual({ total: 10, available: 4, loaned: 4, onHold: 1 });
  });
  it('does not infer physical inventory from title availability or partial records', () => {
    expect(getInventorySummary([{ ...title, totalCopies: 3 }, { ...title, id: 2 }]))
      .toEqual({ total: null, available: null, loaned: null, onHold: null });
    expect(getInventorySummary([{ ...title, totalCopies: NaN }]).total).toBeNull();
  });
  it('reports a genuinely empty collection as zero', () => {
    expect(getInventorySummary([])).toEqual({ total: 0, available: 0, loaned: 0, onHold: 0 });
  });
});
