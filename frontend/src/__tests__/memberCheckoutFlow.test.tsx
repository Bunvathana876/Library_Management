import 'temporal-polyfill/global';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import App from '@/App';
import { authApi } from '@/api/authApi';
import { booksApi } from '@/api/booksApi';
import { memberPortalApi } from '@/api/memberPortalApi';
import { notificationsApi } from '@/api/notificationsApi';
import { healthApi } from '@/api/healthApi';
import { ApiError } from '@/utils/errors';
import type { LoanResponse, MemberBookshelfResponse } from '@/types/api';

vi.mock('@/context/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
  useTheme: () => ({ renderedScheme: 'light', toggleTheme: vi.fn() }),
}));
vi.mock('@/components/forms/BookDetailModal', () => ({ BookDetailModal: () => null }));
vi.mock('@/components/forms/BookFormModal', () => ({ BookFormModal: () => null }));
vi.mock('@/components/forms/BorrowBookModal', () => ({ BorrowBookModal: () => null }));
vi.mock('@/components/forms/ChangePasswordModal', () => ({ ChangePasswordModal: () => null }));
vi.mock('@/components/forms/CirculationScannerModal', () => ({ CirculationScannerModal: () => null }));
vi.mock('@/components/forms/MemberFormModal', () => ({ MemberFormModal: () => null }));
vi.mock('@/components/forms/MemberHistoryDrawer', () => ({ MemberHistoryDrawer: () => null }));
vi.mock('@/components/layout/Sidebar', () => ({ Sidebar: () => null }));
vi.mock('@/components/layout/BottomNav', () => ({ BottomNav: () => null }));
vi.mock('@/pages/MyBookshelfPage', () => ({
  MyBookshelfPage: ({ bookshelf }: { bookshelf: MemberBookshelfResponse | null }) =>
    <div data-testid="bookshelf">{bookshelf?.activeLoans.map(loan => loan.bookTitle).join(',')}</div>,
}));

let root: Root;
let container: HTMLDivElement;
const reader = { email: 'reader@example.test', roles: ['MEMBER'] as const };
const token = { accessToken: 'test-token', tokenType: 'Bearer', expiresInSeconds: 1800 };
const book = { id: 42, title: 'A Reader’s Journey', author: 'QA', publicationYear: 2026, available: true };
const loan = { id: 51, bookId: 42, bookTitle: book.title, memberId: 7, dueOn: '2026-12-11' } as LoanResponse;
const shelf: MemberBookshelfResponse = { memberId: 7, fullName: 'Reader', email: reader.email, activeLoans: [], returnHistory: [], activeHolds: [], pastHolds: [] };

beforeAll(() => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')); };
});
beforeEach(() => {
  localStorage.clear(); window.location.hash = '#books';
  container = document.createElement('div'); document.body.append(container); root = createRoot(container);
  vi.spyOn(authApi, 'getMe').mockResolvedValue({ ...reader, roles: ['MEMBER'] });
  vi.spyOn(authApi, 'login').mockResolvedValue(token);
  vi.spyOn(authApi, 'register').mockResolvedValue(token);
  vi.spyOn(booksApi, 'listBooks').mockResolvedValue([book]);
  vi.spyOn(healthApi, 'getHealth').mockResolvedValue({ status: 'UP' });
  vi.spyOn(notificationsApi, 'listNotifications').mockResolvedValue({ items: [], unreadCount: 0 });
  vi.spyOn(memberPortalApi, 'getBookshelf').mockResolvedValue(shelf);
  vi.spyOn(memberPortalApi, 'borrowBook').mockImplementation(async () => {
    vi.mocked(memberPortalApi.getBookshelf).mockResolvedValue({ ...shelf, activeLoans: [loan] });
    return loan;
  });
});
afterEach(() => { act(() => root.unmount()); container.remove(); localStorage.clear(); window.location.hash = ''; vi.restoreAllMocks(); });

const dialog = () => container.querySelector('dialog[open]')!;
function button(text: string, scope: ParentNode = container): HTMLButtonElement {
  const found = [...scope.querySelectorAll('button')].find(el => el.textContent?.trim() === text);
  if (!found) throw new Error('Missing button: ' + text);
  return found;
}
async function click(text: string, scope: ParentNode = container) { await act(async () => button(text, scope).click()); }
async function fill(id: string, value: string) {
  await act(async () => {
    const input = container.querySelector(id)!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function authenticate(register = false) {
  if (register) { await click('Create Account', dialog()); await fill('#signup-fullname', 'Reader'); }
  await fill('#signin-email', reader.email); await fill('#signin-password', 'Reader-password-123!');
  await act(async () => dialog().querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}

it('remembers a guest book through sign-in and requires confirmation before borrowing', async () => {
  await act(async () => root.render(<App />));
  await click('Sign In to Borrow');
  expect(dialog().textContent).toContain(book.title);
  await authenticate();
  expect(dialog().textContent).toContain('Borrow this book?');
  expect(dialog().textContent).toContain(book.title);
  expect(memberPortalApi.borrowBook).not.toHaveBeenCalled();
  await click('Confirm Borrow', dialog());
  expect(memberPortalApi.borrowBook).toHaveBeenCalledExactlyOnceWith(42);
  expect(window.location.hash).toBe('#bookshelf');
  expect(container.querySelector('[data-testid="bookshelf"]')?.textContent).toContain(book.title);
});

it('creates an account from the selected book and continues to its confirmation', async () => {
  await act(async () => root.render(<App />));
  await click('Sign In to Borrow'); await authenticate(true);
  expect(authApi.register).toHaveBeenCalledWith({ fullName: 'Reader', email: reader.email, password: 'Reader-password-123!' });
  expect(dialog().textContent).toContain('Borrow this book?');
  await click('Confirm Borrow', dialog());
  expect(memberPortalApi.borrowBook).toHaveBeenCalledExactlyOnceWith(42);
});

it('opens registration directly and discards a cancelled borrowing intent', async () => {
  await act(async () => root.render(<App />));
  await click('Create Account');
  expect(dialog().textContent).toContain('Create a library account');
  await click('Cancel', dialog());
  await click('Sign In to Borrow'); await click('Cancel', dialog());
  await click('Sign In'); await authenticate();
  expect(container.querySelector('dialog[open]')).toBeNull();
  expect(memberPortalApi.borrowBook).not.toHaveBeenCalled();
});

it('retains the confirmation and meaningful borrowing-limit error after rejection', async () => {
  vi.mocked(memberPortalApi.borrowBook).mockRejectedValue(new ApiError(409, 'Borrowing limit reached (5/5 active loans)'));
  await act(async () => root.render(<App />));
  await click('Sign In to Borrow'); await authenticate(); await click('Confirm Borrow', dialog());
  expect(dialog().querySelector('[role="alert"]')?.textContent).toContain('Borrowing limit reached');
  expect(window.location.hash).toBe('#books');
});

it('sends one checkout while repeated confirmation clicks are pending', async () => {
  let resolve!: (loan: LoanResponse) => void;
  vi.mocked(memberPortalApi.borrowBook).mockImplementation(() => new Promise(done => { resolve = done; }));
  await act(async () => root.render(<App />));
  await click('Sign In to Borrow'); await authenticate();
  await act(async () => { const confirm = button('Confirm Borrow', dialog()); confirm.click(); confirm.click(); });
  expect(memberPortalApi.borrowBook).toHaveBeenCalledOnce();
  expect(button('Borrowing…', dialog()).disabled).toBe(true);
  await act(async () => resolve(loan));
});
