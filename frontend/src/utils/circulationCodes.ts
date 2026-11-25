import type { Book, LoanResponse, Member } from '@/types/api';
import { extractIsbnFromBarcode, normalizeIsbn } from '@/utils/isbn';

export type ParsedCirculationCode =
  | { kind: 'isbn'; isbn: string; raw: string }
  | { kind: 'book'; bookId: number; raw: string }
  | { kind: 'member'; memberId: number; raw: string }
  | { kind: 'loan'; loanId: number; raw: string }
  | { kind: 'email'; email: string; raw: string }
  | { kind: 'text'; text: string; raw: string };

export function parseCirculationCode(rawValue: string): ParsedCirculationCode | null {
  const trimmed = rawValue.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const obj = JSON.parse(trimmed) as Record<string, unknown>;
      if (typeof obj.loanId === 'number' || typeof obj.loanId === 'string') {
        const id = Number.parseInt(String(obj.loanId), 10);
        if (Number.isFinite(id) && id > 0) return { kind: 'loan', loanId: id, raw: trimmed };
      }
      if (typeof obj.bookId === 'number' || typeof obj.bookId === 'string') {
        const id = Number.parseInt(String(obj.bookId), 10);
        if (Number.isFinite(id) && id > 0) return { kind: 'book', bookId: id, raw: trimmed };
      }
      if (typeof obj.memberId === 'number' || typeof obj.memberId === 'string') {
        const id = Number.parseInt(String(obj.memberId), 10);
        if (Number.isFinite(id) && id > 0) return { kind: 'member', memberId: id, raw: trimmed };
      }
      if (typeof obj.isbn === 'string') {
        const isbn = extractIsbnFromBarcode(obj.isbn);
        if (isbn) return { kind: 'isbn', isbn, raw: trimmed };
      }
      if (typeof obj.email === 'string') {
        return { kind: 'email', email: obj.email.trim().toLowerCase(), raw: trimmed };
      }
    } catch {
      // Fall through to text token parsing
    }
  }

  const loanMatch = trimmed.match(/^(?:LOAN[-:\s#]*)(\d+)$/i);
  if (loanMatch) {
    const loanId = Number.parseInt(loanMatch[1], 10);
    if (loanId > 0) return { kind: 'loan', loanId, raw: trimmed };
  }

  const catMatch = trimmed.match(/^(?:CAT|BOOK)[-:\s#]*(\d+)$/i);
  if (catMatch) {
    const bookId = Number.parseInt(catMatch[1], 10);
    if (bookId > 0) return { kind: 'book', bookId, raw: trimmed };
  }

  const memMatch = trimmed.match(/^(?:MEM|MEMBER)[-:\s#]*(\d+)$/i);
  if (memMatch) {
    const memberId = Number.parseInt(memMatch[1], 10);
    if (memberId > 0) return { kind: 'member', memberId, raw: trimmed };
  }

  const isbn = extractIsbnFromBarcode(trimmed);
  if (isbn) {
    return { kind: 'isbn', isbn, raw: trimmed };
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
    return { kind: 'email', email: trimmed.toLowerCase(), raw: trimmed };
  }

  return { kind: 'text', text: trimmed, raw: trimmed };
}

export function matchBookFromCode(rawValue: string, books: Book[]): Book | null {
  const parsed = parseCirculationCode(rawValue);
  if (!parsed) return null;

  if (parsed.kind === 'book') {
    return books.find((b) => b.id === parsed.bookId) ?? null;
  }

  if (parsed.kind === 'isbn') {
    const normalizedTarget = normalizeIsbn(parsed.isbn);
    return (
      books.find((b) => b.isbn && normalizeIsbn(b.isbn) === normalizedTarget) ?? null
    );
  }

  if (parsed.kind === 'text') {
    if (/^\d+$/.test(parsed.text)) {
      const id = Number.parseInt(parsed.text, 10);
      const byId = books.find((b) => b.id === id);
      if (byId) return byId;
    }
    const lower = parsed.text.toLowerCase();
    return books.find((b) => b.title.toLowerCase() === lower) ?? null;
  }

  return null;
}

export function matchMemberFromCode(rawValue: string, members: Member[]): Member | null {
  const parsed = parseCirculationCode(rawValue);
  if (!parsed) return null;

  if (parsed.kind === 'member') {
    return members.find((m) => m.id === parsed.memberId) ?? null;
  }

  if (parsed.kind === 'email') {
    return members.find((m) => m.email.toLowerCase() === parsed.email) ?? null;
  }

  if (parsed.kind === 'text' && /^\d+$/.test(parsed.text)) {
    const id = Number.parseInt(parsed.text, 10);
    return members.find((m) => m.id === id) ?? null;
  }

  return null;
}

export function matchActiveLoanFromCode(
  rawValue: string,
  activeLoans: LoanResponse[],
  books: Book[],
): LoanResponse | null {
  const parsed = parseCirculationCode(rawValue);
  if (!parsed) return null;

  if (parsed.kind === 'loan') {
    return activeLoans.find((l) => l.id === parsed.loanId) ?? null;
  }

  if (parsed.kind === 'book') {
    return activeLoans.find((l) => l.bookId === parsed.bookId) ?? null;
  }

  if (parsed.kind === 'isbn') {
    const normalizedTarget = normalizeIsbn(parsed.isbn);
    const byLoanIsbn = activeLoans.find(
      (l) => l.bookIsbn && normalizeIsbn(l.bookIsbn) === normalizedTarget,
    );
    if (byLoanIsbn) return byLoanIsbn;

    const matchedBook = matchBookFromCode(rawValue, books);
    if (matchedBook) {
      return activeLoans.find((l) => l.bookId === matchedBook.id) ?? null;
    }
    return null;
  }

  if (parsed.kind === 'text' && /^\d+$/.test(parsed.text)) {
    const num = Number.parseInt(parsed.text, 10);
    return (
      activeLoans.find((l) => l.id === num) ??
      activeLoans.find((l) => l.bookId === num) ??
      null
    );
  }

  return null;
}
