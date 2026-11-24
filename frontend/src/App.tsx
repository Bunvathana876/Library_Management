import { useCallback, useEffect, useRef, useState } from 'react';
import { booksApi } from '@/api/booksApi';
import { healthApi } from '@/api/healthApi';
import { loansApi } from '@/api/loansApi';
import { membersApi } from '@/api/membersApi';
import { BookDetailModal } from '@/components/forms/BookDetailModal';
import { BookFormModal } from '@/components/forms/BookFormModal';
import { BorrowBookModal } from '@/components/forms/BorrowBookModal';
import { MemberFormModal } from '@/components/forms/MemberFormModal';
import { SignInModal } from '@/components/forms/SignInModal';
import { BottomNav } from '@/components/layout/BottomNav';
import { Sidebar, type NavTab } from '@/components/layout/Sidebar';
import { TopBar } from '@/components/layout/TopBar';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { ToastRegion } from '@/components/ui/ToastRegion';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider, useToast } from '@/context/ToastContext';
import { AdminUsersPage } from '@/pages/AdminUsersPage';
import { BooksPage } from '@/pages/BooksPage';
import { LoansPage } from '@/pages/LoansPage';
import { MembersPage } from '@/pages/MembersPage';
import { OverviewPage } from '@/pages/OverviewPage';
import type { Book, HealthResponse, LoanResponse, Member } from '@/types/api';
import { formatApiErrorMessage } from '@/utils/errors';

const TAB_PAGE_TITLES: Record<NavTab, string> = {
  overview: 'Library Overview | Athenaeum',
  books: 'Books Catalog | Athenaeum',
  loans: 'Loans & Returns | Athenaeum',
  members: 'Members | Athenaeum',
  admin: 'Staff & Accounts | Athenaeum',
};

function LibraryWorkspace() {
  const { isStaff, signInModalOpen, closeSignInModal } = useAuth();
  const { notify } = useToast();

  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const booksSearchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = TAB_PAGE_TITLES[activeTab];
  }, [activeTab]);

  // Health state
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState(false);

  // Books catalog state
  const [books, setBooks] = useState<Book[]>([]);
  const [bookSearch, setBookSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [booksError, setBooksError] = useState<string | null>(null);

  // Staff-protected state
  const [members, setMembers] = useState<Member[]>([]);
  const [activeLoans, setActiveLoans] = useState<LoanResponse[]>([]);
  const [overdueLoans, setOverdueLoans] = useState<LoanResponse[]>([]);
  const [loadingStaffData, setLoadingStaffData] = useState(false);

  // Modals & confirmations
  const [bookFormOpen, setBookFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [inspectBookId, setInspectBookId] = useState<number | null>(null);
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [borrowPreselectBookId, setBorrowPreselectBookId] = useState<number | null>(null);
  const [borrowPreselectMemberId, setBorrowPreselectMemberId] = useState<number | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);

  const [deletingBook, setDeletingBook] = useState<Book | null>(null);
  const [returningLoan, setReturningLoan] = useState<LoanResponse | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const focusCatalogSearch = useCallback(() => {
    setActiveTab('books');
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        booksSearchInputRef.current?.focus();
      });
    });
  }, []);

  // Global "/" and Cmd/Ctrl+K shortcut to jump to catalog search
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        focusCatalogSearch();
      } else if (e.key === '/' && !isEditing && !e.metaKey && !e.ctrlKey && !e.altKey) {
        e.preventDefault();
        focusCatalogSearch();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [focusCatalogSearch]);

  // Debounce catalog search input
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(bookSearch);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [bookSearch]);

  const fetchHealth = useCallback(async (signal?: AbortSignal) => {
    try {
      const status = await healthApi.getHealth(signal);
      setHealth(status);
      setHealthError(false);
    } catch {
      if (!signal?.aborted) {
        setHealthError(true);
      }
    }
  }, []);

  const isCatalogIdSearch = (value: string) => /^(cat-?\d*|#\d+|\d{1,6})$/i.test(value.trim());

  const fetchBooks = useCallback(
    async (search = debouncedSearch, signal?: AbortSignal) => {
      setLoadingBooks(true);
      setBooksError(null);
      try {
        const apiSearch = isCatalogIdSearch(search) ? '' : search;
        const list = await booksApi.listBooks(apiSearch, signal);
        setBooks(list);
      } catch (err) {
        if (!signal?.aborted) {
          setBooksError(formatApiErrorMessage(err));
        }
      } finally {
        if (!signal?.aborted) {
          setLoadingBooks(false);
        }
      }
    },
    [debouncedSearch],
  );

  const fetchStaffData = useCallback(
    async (signal?: AbortSignal) => {
      if (!isStaff) {
        setMembers([]);
        setActiveLoans([]);
        setOverdueLoans([]);
        return;
      }

      setLoadingStaffData(true);
      try {
        const [memberList, activeList, overdueList] = await Promise.all([
          membersApi.listMembers(signal),
          loansApi.getActiveLoans(signal),
          loansApi.getOverdueLoans(signal),
        ]);
        setMembers(memberList);
        setActiveLoans(activeList);
        setOverdueLoans(overdueList);
      } catch (err) {
        if (!signal?.aborted) {
          notify({
            variant: 'error',
            title: 'Failed to sync circulation data',
            message: formatApiErrorMessage(err),
          });
        }
      } finally {
        if (!signal?.aborted) {
          setLoadingStaffData(false);
        }
      }
    },
    [isStaff, notify],
  );

  // Initial & polled health check
  useEffect(() => {
    const controller = new AbortController();
    void fetchHealth(controller.signal);
    const interval = window.setInterval(() => {
      void fetchHealth();
    }, 30000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [fetchHealth]);

  // Fetch public catalog on mount / debounced search change
  useEffect(() => {
    const controller = new AbortController();
    void fetchBooks(debouncedSearch, controller.signal);
    return () => controller.abort();
  }, [debouncedSearch, fetchBooks]);

  // Fetch staff data whenever staff status changes
  useEffect(() => {
    const controller = new AbortController();
    void fetchStaffData(controller.signal);
    return () => controller.abort();
  }, [fetchStaffData]);

  const handleOpenAddBook = () => {
    setEditingBook(null);
    setBookFormOpen(true);
  };

  const handleOpenEditBook = (book: Book) => {
    setEditingBook(book);
    setBookFormOpen(true);
  };

  const handleOpenBorrow = (opts?: { bookId?: number; memberId?: number }) => {
    setBorrowPreselectBookId(opts?.bookId ?? null);
    setBorrowPreselectMemberId(opts?.memberId ?? null);
    setBorrowModalOpen(true);
  };

  const handleConfirmDeleteBook = async () => {
    if (!deletingBook) return;
    setConfirmBusy(true);
    try {
      await booksApi.deleteBook(deletingBook.id);
      const removedTitle = deletingBook.title;
      setDeletingBook(null);
      await fetchBooks(debouncedSearch);
      notify({
        variant: 'success',
        title: 'Book deleted',
        message: `"${removedTitle}" was removed from the catalog.`,
      });
    } catch (err) {
      setDeletingBook(null);
      notify({
        variant: 'error',
        title: 'Cannot delete book',
        message: formatApiErrorMessage(err, 'deleteBook'),
      });
    } finally {
      setConfirmBusy(false);
    }
  };

  const handleConfirmReturnLoan = async () => {
    if (!returningLoan) return;
    setConfirmBusy(true);
    try {
      const updated = await loansApi.returnBook(returningLoan.id);
      setReturningLoan(null);
      await Promise.all([fetchBooks(debouncedSearch), fetchStaffData()]);
      notify({
        variant: 'success',
        title: 'Book returned',
        message: `Loan #${updated.id} ("${updated.bookTitle}") marked returned.`,
      });
    } catch (err) {
      setReturningLoan(null);
      notify({
        variant: 'error',
        title: 'Return failed',
        message: formatApiErrorMessage(err),
      });
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link visually-hidden">
        Skip to main content
      </a>

      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        counts={{
          books: books.length,
          activeLoans: isStaff ? activeLoans.length : null,
          overdueLoans: isStaff ? overdueLoans.length : null,
          members: isStaff ? members.length : null,
        }}
        health={health}
        healthError={healthError}
        onRefreshHealth={() => void fetchHealth()}
      />

      <div className="main-column">
        <TopBar
          activeTab={activeTab}
          mobileMenuOpen={mobileMenuOpen}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onQuickSearch={focusCatalogSearch}
          onOpenAddBook={handleOpenAddBook}
          onOpenBorrowBook={() => handleOpenBorrow()}
          onOpenRegisterMember={() => setMemberModalOpen(true)}
        />

        <main id="main-content" tabIndex={-1} className="page-content">
          {activeTab === 'overview' ? (
            <OverviewPage
              books={books}
              activeLoans={activeLoans}
              overdueLoans={overdueLoans}
              members={members}
              loadingBooks={loadingBooks}
              booksError={booksError}
              onRetryBooks={() => void fetchBooks(debouncedSearch)}
              onNavigate={setActiveTab}
              onInspectBook={setInspectBookId}
              onOpenAddBook={handleOpenAddBook}
              onOpenBorrowBook={() => handleOpenBorrow()}
              onOpenRegisterMember={() => setMemberModalOpen(true)}
              onRequestReturnLoan={setReturningLoan}
            />
          ) : null}

          {activeTab === 'books' ? (
            <BooksPage
              books={books}
              searchQuery={bookSearch}
              onSearchChange={setBookSearch}
              searchInputRef={booksSearchInputRef}
              loading={loadingBooks}
              errorMsg={booksError}
              onRetry={() => void fetchBooks(debouncedSearch)}
              onAddBook={handleOpenAddBook}
              onEditBook={handleOpenEditBook}
              onDeleteBook={setDeletingBook}
              onInspectBook={setInspectBookId}
              onBorrowBook={(book) => handleOpenBorrow({ bookId: book.id })}
            />
          ) : null}

          {activeTab === 'loans' ? (
            <LoansPage
              activeLoans={activeLoans}
              overdueLoans={overdueLoans}
              loading={loadingStaffData}
              onBorrowBook={() => handleOpenBorrow()}
              onRequestReturnLoan={setReturningLoan}
            />
          ) : null}

          {activeTab === 'members' ? (
            <MembersPage
              members={members}
              activeLoans={activeLoans}
              loading={loadingStaffData}
              onRegisterMember={() => setMemberModalOpen(true)}
              onBorrowForMember={(member) => handleOpenBorrow({ memberId: member.id })}
            />
          ) : null}

          {activeTab === 'admin' ? <AdminUsersPage /> : null}
        </main>
      </div>

      <BottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        counts={{
          books: books.length,
          activeLoans: isStaff ? activeLoans.length : null,
          overdueLoans: isStaff ? overdueLoans.length : null,
        }}
      />

      {/* Native <dialog> Modals */}
      <SignInModal open={signInModalOpen} onClose={closeSignInModal} />

      <BookFormModal
        open={bookFormOpen}
        editingBook={editingBook}
        onClose={() => setBookFormOpen(false)}
        onSaved={() => void fetchBooks(debouncedSearch)}
      />

      <BookDetailModal
        bookId={inspectBookId}
        onClose={() => setInspectBookId(null)}
        onEdit={handleOpenEditBook}
        onBorrow={(book) => handleOpenBorrow({ bookId: book.id })}
        onDelete={setDeletingBook}
      />

      <BorrowBookModal
        open={borrowModalOpen}
        books={books}
        members={members}
        initialBookId={borrowPreselectBookId}
        initialMemberId={borrowPreselectMemberId}
        onClose={() => setBorrowModalOpen(false)}
        onBorrowed={() => {
          void fetchBooks(debouncedSearch);
          void fetchStaffData();
        }}
      />

      <MemberFormModal
        open={memberModalOpen}
        onClose={() => setMemberModalOpen(false)}
        onRegistered={() => void fetchStaffData()}
      />

      <ConfirmDialog
        open={deletingBook !== null}
        onClose={() => setDeletingBook(null)}
        onConfirm={handleConfirmDeleteBook}
        busy={confirmBusy}
        title="Delete Book from Catalog?"
        message={
          deletingBook
            ? `Permanently delete "${deletingBook.title}" (#${deletingBook.id})? Books referenced by loan records cannot be deleted.`
            : ''
        }
        confirmLabel="Delete Book"
        variant="danger"
      />

      <ConfirmDialog
        open={returningLoan !== null}
        onClose={() => setReturningLoan(null)}
        onConfirm={handleConfirmReturnLoan}
        busy={confirmBusy}
        title="Confirm Book Return"
        message={
          returningLoan
            ? `Mark Loan #${returningLoan.id} ("${returningLoan.bookTitle}" borrowed by ${returningLoan.memberName}) as returned today?`
            : ''
        }
        confirmLabel="Confirm Return"
        variant="primary"
      />

      <ToastRegion />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <LibraryWorkspace />
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
