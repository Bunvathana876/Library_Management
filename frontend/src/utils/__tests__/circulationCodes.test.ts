import { describe, expect, it } from 'vitest';
import type { Book, LoanResponse, Member } from '@/types/api';
import {
  matchActiveLoanFromCode,
  matchBookFromCode,
  matchMemberFromCode,
  parseCirculationCode,
} from '@/utils/circulationCodes';

const BOOKS: Book[] = [
  {
    id: 1,
    title: 'Spring in Action',
    author: 'Craig Walls',
    publicationYear: 2022,
    isbn: '9781617297571',
    available: false,
  },
  {
    id: 2,
    title: 'Clean Code',
    author: 'Robert C. Martin',
    publicationYear: 2008,
    isbn: '9780132350884',
    available: true,
  },
];

const MEMBERS: Member[] = [
  { id: 7, fullName: 'Alice Reader', email: 'alice@library.local' },
  { id: 12, fullName: 'Bob Patron', email: 'bob@library.local' },
];

const ACTIVE_LOANS: LoanResponse[] = [
  {
    id: 42,
    bookId: 1,
    bookTitle: 'Spring in Action',
    bookAuthor: 'Craig Walls',
    bookIsbn: '9781617297571',
    bookCoverUrl: null,
    memberId: 7,
    memberName: 'Alice Reader',
    borrowedOn: '2026-11-10',
    dueOn: '2026-11-24',
    returnedOn: null,
    overdue: true,
    renewalCount: 0,
    maxRenewals: 2,
    lastRenewedOn: null,
    hasActiveHold: false,
    renewable: true,
    renewDisabledReason: null,
    heldForMemberName: null,
  },
];

describe('circulationCodes utilities', () => {
  it('parses call numbers, copy barcodes, member QR passes, loan passes, ISBNs, emails, and JSON payloads', () => {
    expect(parseCirculationCode('CAT-0002')).toEqual({ kind: 'book', bookId: 2, raw: 'CAT-0002' });
    expect(parseCirculationCode('CPY-0001-02')).toEqual({
      kind: 'copy',
      barcode: 'CPY-0001-02',
      bookId: 1,
      raw: 'CPY-0001-02',
    });
    expect(parseCirculationCode('MEM-0007')).toEqual({ kind: 'member', memberId: 7, raw: 'MEM-0007' });
    expect(parseCirculationCode('LOAN-0042')).toEqual({ kind: 'loan', loanId: 42, raw: 'LOAN-0042' });
    expect(parseCirculationCode('978-0-13-235088-4')).toEqual({
      kind: 'isbn',
      isbn: '9780132350884',
      raw: '978-0-13-235088-4',
    });
    expect(parseCirculationCode('bob@library.local')).toEqual({
      kind: 'email',
      email: 'bob@library.local',
      raw: 'bob@library.local',
    });
    expect(parseCirculationCode('{"memberId":12}')).toEqual({
      kind: 'member',
      memberId: 12,
      raw: '{"memberId":12}',
    });
  });

  it('matches catalog books by ISBN, copy barcode, CAT code, or numeric ID', () => {
    expect(matchBookFromCode('9780132350884', BOOKS)?.id).toBe(2);
    expect(matchBookFromCode('CAT-0001', BOOKS)?.id).toBe(1);
    expect(matchBookFromCode('CPY-0002-03', BOOKS)?.id).toBe(2);
    expect(matchBookFromCode('2', BOOKS)?.title).toBe('Clean Code');
    expect(matchBookFromCode('CAT-9999', BOOKS)).toBeNull();
  });

  it('matches members by MEM code or email', () => {
    expect(matchMemberFromCode('MEM-0007', MEMBERS)?.fullName).toBe('Alice Reader');
    expect(matchMemberFromCode('BOB@library.local', MEMBERS)?.id).toBe(12);
    expect(matchMemberFromCode('unknown@library.local', MEMBERS)).toBeNull();
  });

  it('matches active loans by LOAN code, CAT code, or ISBN', () => {
    expect(matchActiveLoanFromCode('LOAN-0042', ACTIVE_LOANS, BOOKS)?.id).toBe(42);
    expect(matchActiveLoanFromCode('CAT-0001', ACTIVE_LOANS, BOOKS)?.id).toBe(42);
    expect(matchActiveLoanFromCode('978-1-61729-757-1', ACTIVE_LOANS, BOOKS)?.id).toBe(42);
    expect(matchActiveLoanFromCode('CAT-0002', ACTIVE_LOANS, BOOKS)).toBeNull();
  });
});
