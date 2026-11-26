import { act, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import App from '@/App';
import { booksApi } from '@/api/booksApi';
import type { Book } from '@/types/api';

vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => children,
  useAuth: () => ({ isAuthenticated: false, isStaff: false, signInModalOpen: false }),
}));
vi.mock('@/context/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));
vi.mock('@/context/ToastContext', () => ({
  ToastProvider: ({ children }: { children: ReactNode }) => children,
  useToast: () => ({ notify }),
}));
const { notify } = vi.hoisted(() => ({ notify: vi.fn() }));
vi.mock('@/api/booksApi', () => ({ booksApi: { listBooks: vi.fn() } }));
vi.mock('@/api/healthApi', () => ({ healthApi: { getHealth: vi.fn().mockResolvedValue({ status: 'UP' }) } }));
vi.mock('@/components/layout/Sidebar', () => ({
  Sidebar: ({ counts, onSelectTab }: { counts: { books: number }; onSelectTab: (tab: string) => void }) =>
    <button data-testid="sidebar" onClick={() => onSelectTab('overview')}>{counts.books}</button>,
}));
vi.mock('@/pages/OverviewPage', () => ({
  OverviewPage: ({ books }: { books: Book[] }) => <div data-testid="overview">{books.length}</div>,
}));
vi.mock('@/components/forms/BorrowBookModal', () => ({
  BorrowBookModal: ({ books }: { books: Book[] }) => <div data-testid="borrow">{books.map(b => b.title).join(',')}</div>,
}));
vi.mock('@/components/forms/CirculationScannerModal', () => ({
  CirculationScannerModal: ({ books }: { books: Book[] }) => <div data-testid="scanner">{books.map(b => b.title).join(',')}</div>,
}));
vi.mock('@/components/forms/BookDetailModal', () => ({ BookDetailModal: () => null }));
vi.mock('@/components/forms/BookFormModal', () => ({ BookFormModal: () => null }));
vi.mock('@/components/forms/ChangePasswordModal', () => ({ ChangePasswordModal: () => null }));
vi.mock('@/components/forms/MemberFormModal', () => ({ MemberFormModal: () => null }));
vi.mock('@/components/forms/MemberHistoryDrawer', () => ({ MemberHistoryDrawer: () => null }));
vi.mock('@/components/forms/SignInModal', () => ({ SignInModal: () => null }));
vi.mock('@/components/layout/BottomNav', () => ({ BottomNav: () => null }));
vi.mock('@/components/layout/TopBar', () => ({ TopBar: () => null }));
vi.mock('@/components/ui/ConfirmDialog', () => ({ ConfirmDialog: () => null }));
vi.mock('@/components/ui/ToastRegion', () => ({ ToastRegion: () => null }));
vi.mock('@/pages/AdminUsersPage', () => ({ AdminUsersPage: () => null }));
vi.mock('@/pages/LoansPage', () => ({ LoansPage: () => null }));
vi.mock('@/pages/MembersPage', () => ({ MembersPage: () => null }));
vi.mock('@/pages/MyBookshelfPage', () => ({ MyBookshelfPage: () => null }));

it('keeps library counts and circulation choices complete while filtering the catalog', async () => {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const books: Book[] = [
    { id: 1, title: 'Alpha', author: 'One', publicationYear: 2020, available: true, category: 'Fiction' },
    { id: 2, title: 'Beta', author: 'Two', publicationYear: 2021, available: true, category: 'Science' },
  ];
  vi.mocked(booksApi.listBooks).mockResolvedValue(books);
  window.location.hash = '#books';
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(async () => { root.render(<App />); });
    expect(container.querySelectorAll('select[name="catalog-category"]')).toHaveLength(1);
    const ids = Array.from(container.querySelectorAll('[id]'), el => el.id);
    expect(new Set(ids).size).toBe(ids.length);
    const search = container.querySelector('input[type="search"]') as HTMLInputElement;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(search, 'Alpha');
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(container.querySelector('.catalog-page')?.textContent).toContain('Filtered to 1 book');
    expect(container.querySelector('.catalog-page')?.textContent).not.toContain('Beta');
    expect(container.querySelector('[data-testid="sidebar"]')?.textContent).toBe('2');
    expect(container.querySelector('[data-testid="borrow"]')?.textContent).toBe('Alpha,Beta');
    expect(container.querySelector('[data-testid="scanner"]')?.textContent).toBe('Alpha,Beta');
    // Let the former search debounce elapse to detect accidental server filtering.
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 300)); });
    expect(booksApi.listBooks).toHaveBeenCalledTimes(1);
    expect(booksApi.listBooks).toHaveBeenCalledWith('', expect.any(AbortSignal));
    await act(async () => { (container.querySelector('[data-testid="sidebar"]') as HTMLButtonElement).click(); });
    expect(container.querySelector('[data-testid="overview"]')?.textContent).toBe('2');
  } finally {
    act(() => root.unmount());
    container.remove();
    window.location.hash = '';
  }
});
