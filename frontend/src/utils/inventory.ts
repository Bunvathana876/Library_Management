import type { Book } from '@/types/api';

/** Missing API fields remain unknown; title availability is not a copy count. */
export function getInventorySummary(books: Book[]) {
  const sum = (field: 'totalCopies' | 'availableCopies' | 'loanedCopies' | 'onHoldCopies') =>
    books.every(book => typeof book[field] === 'number' && Number.isFinite(book[field]))
      ? books.reduce((total, book) => total + book[field]!, 0) : null;
  return { total: sum('totalCopies'), available: sum('availableCopies'), loaned: sum('loanedCopies'), onHold: sum('onHoldCopies') };
}
