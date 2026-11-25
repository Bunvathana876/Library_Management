import { useCallback, useEffect, useRef, useState } from 'react';
import { booksApi } from '@/api/booksApi';
import { healthApi } from '@/api/healthApi';
import { holdsApi } from '@/api/holdsApi';
import { loansApi } from '@/api/loansApi';
import { memberPortalApi } from '@/api/memberPortalApi';
import { membersApi } from '@/api/membersApi';
import { BookDetailModal } from '@/components/forms/BookDetailModal';
import { BookFormModal } from '@/components/forms/BookFormModal';
import { BorrowBookModal } from '@/components/forms/BorrowBookModal';
import {
  CirculationScannerModal,
  type ScannerMode,
} from '@/components/forms/CirculationScannerModal';
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
import { MyBookshelfPage } from '@/pages/MyBookshelfPage';
import { OverviewPage } from '@/pages/OverviewPage';
import type {
  Book,
  HealthResponse,
  HoldResponse,
  LoanResponse,
  Member,
  MemberBookshelfResponse,
} from '@/types/api';
import { formatCalendarDate } from '@/utils/dates';
import { formatApiErrorMessage } from '@/utils/errors';

const VALID_TABS: ReadonlyArray<NavTab> = [
  'overview',
  'books',
  'bookshelf',
  'loans',
  'members',
  'admin',
];

const TAB_PAGE_TITLES: Record<NavTab, string> = {
  overview: 'Library Overview | Athenaeum',
  books: 'Books Catalog | Athenaeum',
  bookshelf: 'My Bookshelf | Athenaeum',
  loans: 'Loans & Returns | Athenaeum',
  members: 'Members | Athenaeum',
  admin: 'Staff & Accounts | Athenaeum',
};

function LibraryWorkspace() {
  const { isAuthenticated, isStaff, signInModalOpen, closeSignInModal } = useAuth();
  const { notify } = useToast();

  const getTabFromHash = useCallback((): NavTab => {
    if (typeof window === 'undefined') return 'overview';
    const raw = window.location.hash.replace(/^#/, '') as NavTab;
    if (raw && VALID_TABS.includes(raw)) {
      return raw;
    }
    return 'overview';
  }, []);

  const [activeTab, setActiveTabState] = useState<NavTab>(() => {
    if (typeof window !== 'undefined') {
      const raw = window.location.hash.replace(/^#/, '') as NavTab;
      if (raw && VALID_TABS.includes(raw)) {
        return raw;
      }
    }
    return 'overview';
  });

  const setActiveTab = useCallback((tab: NavTab) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined' && window.location.hash !== `#${tab}`) {
      window.location.hash = tab;
    }
  }, []);

  useEffect(() => {
    const handleHashChange = () => {
      setActiveTabState(getTabFromHash());
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [getTabFromHash]);

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
  const [activeHolds, setActiveHolds] = useState<HoldResponse[]>([]);
  const [loadingStaffData, setLoadingStaffData] = useState(false);

  // Member self-service bookshelf state
  const [bookshelf, setBookshelf] = useState<MemberBookshelfResponse | null>(null);
  const [loadingBookshelf, setLoadingBookshelf] = useState(false);
  const [bookshelfError, setBookshelfError] = useState<string | null>(null);

  // Modals & confirmations
  const [bookFormOpen, setBookFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [inspectBookId, setInspectBookId] = useState<number | null>(null);
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [borrowPreselectBookId, setBorrowPreselectBookId] = useState<number | null>(null);
  const [borrowPreselectMemberId, setBorrowPreselectMemberId] = useState<number | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<ScannerMode>('checkout');

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
  }, [setActiveTab]);

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
        setActiveHolds([]);
        return;
      }

      setLoadingStaffData(true);
      try {
        const [memberList, activeList, overdueList, holdList] = await Promise.all([
          membersApi.listMembers(signal),
          loansApi.getActiveLoans(signal),
          loansApi.getOverdueLoans(signal),
          holdsApi.getActiveHolds(signal),
        ]);
        setMembers(memberList);
        setActiveLoans(activeList);
        setOverdueLoans(overdueList);
        setActiveHolds(holdList);
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

  const fetchBookshelf = useCallback(
    async (signal?: AbortSignal) => {
      if (!isAuthenticated) {
        setBookshelf(null);
        setBookshelfError(null);
        return;
      }
      setLoadingBookshelf(true);
      setBookshelfError(null);
      try {
        const data = await memberPortalApi.getBookshelf(signal);
        setBookshelf(data);
      } catch (err) {
        if (!signal?.aborted) {
          setBookshelfError(formatApiErrorMessage(err));
        }
      } finally {
        if (!signal?.aborted) {
          setLoadingBookshelf(false);
        }
      }
    },
    [isAuthenticated],
  );

  const refreshAllCirculation = useCallback(async () => {
    await Promise.all([fetchBooks(debouncedSearch), fetchStaffData(), fetchBookshelf()]);
  }, [fetchBooks, debouncedSearch, fetchStaffData, fetchBookshelf]);

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

  // Fetch patron bookshelf whenever auth status changes
  useEffect(() => {
    const controller = new AbortController();
    void fetchBookshelf(controller.signal);
    return () => controller.abort();
  }, [fetchBookshelf]);

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

  const handleOpenScanner = (mode: ScannerMode = 'checkout') => {
    setScannerMode(mode);
    setScannerOpen(true);
  };

  const handleRenewLoan = async (loan: LoanResponse, selfService: boolean) => {
    try {
      const updated = selfService
        ? await memberPortalApi.renewOwnLoan(loan.id)
        : await loansApi.renewLoan(loan.id);
      await refreshAllCirculation();
      notify({
        variant: 'success',
        title: 'Loan renewed (+14 days)',
        message: `"${updated.bookTitle}" is now due ${formatCalendarDate(updated.dueOn)} (${updated.renewalCount}/${updated.maxRenewals} renewals used).`,
      });
    } catch (err) {
      await refreshAllCirculation();
      notify({
        variant: 'error',
        title: 'Renewal unavailable',
        message: formatApiErrorMessage(err),
      });
    }
  };

  const handlePlaceHold = async (book: Book) => {
    try {
      const hold = await holdsApi.placeHold({ bookId: book.id });
      await refreshAllCirculation();
      notify({
        variant: 'success',
        title: 'Hold placed',
        message: `You are #${hold.queuePosition} in queue for "${hold.bookTitle}".`,
      });
    } catch (err) {
      await refreshAllCirculation();
      notify({
        variant: 'error',
        title: 'Could not place hold',
        message: formatApiErrorMessage(err),
      });
    }
  };

  const handleCancelHold = async (hold: HoldResponse) => {
    try {
      await holdsApi.cancelHold(hold.id);
      await refreshAllCirculation();
      notify({
        variant: 'info',
        title: 'Hold cancelled',
        message: `Cancelled reservation for "${hold.bookTitle}".`,
      });
    } catch (err) {
      notify({
        variant: 'error',
        title: 'Cancel failed',
        message: formatApiErrorMessage(err),
      });
    }
  };

  const handleFulfillHold = async (hold: HoldResponse) => {
    try {
      const loan = await holdsApi.fulfillHold(hold.id);
      await refreshAllCirculation();
      notify({
        variant: 'success',
        title: 'Hold checked out',
        message: `"${loan.bookTitle}" issued to ${loan.memberName} (due ${formatCalendarDate(loan.dueOn)}).`,
      });
    } catch (err) {
      await refreshAllCirculation();
      notify({
        variant: 'error',
        title: 'Fulfillment failed',
        message: formatApiErrorMessage(err),
      });
    }
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
      await refreshAllCirculation();
      if (updated.heldForMemberName) {
        notify({
          variant: 'info',
          title: 'Book returned & reserved at desk',
          message: `"${updated.bookTitle}" is held at the circulation desk for ${updated.heldForMemberName} (3-day pickup window).`,
        });
      } else {
        notify({
          variant: 'success',
          title: 'Book returned',
          message: `Loan #${updated.id} ("${updated.bookTitle}") marked returned.`,
        });
      }
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

  const myLoansCount = isAuthenticated ? (bookshelf?.activeLoans.length ?? 0) : null;

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
          myLoans: myLoansCount,
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
          onOpenScanner={() => handleOpenScanner('checkout')}
        />

        <main id="main-content" tabIndex={-1} className="page-content">
          {activeTab === 'overview' ? (
            <OverviewPage
              books={books}
              activeLoans={activeLoans}
              overdueLoans={overdueLoans}
              members={members}
              bookshelf={bookshelf}
              loadingBooks={loadingBooks}
              booksError={booksError}
              onRetryBooks={() => void fetchBooks(debouncedSearch)}
              onNavigate={setActiveTab}
              onInspectBook={setInspectBookId}
              onOpenAddBook={handleOpenAddBook}
              onOpenBorrowBook={() => handleOpenBorrow()}
              onOpenScanner={() => handleOpenScanner('checkout')}
              onOpenRegisterMember={() => setMemberModalOpen(true)}
              onRequestReturnLoan={setReturningLoan}
            />
          ) : null}

          {activeTab === 'books' ? (
            <BooksPage
              books={books}
              myActiveHolds={bookshelf?.activeHolds ?? []}
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
              onPlaceHold={handlePlaceHold}
            />
          ) : null}

          {activeTab === 'bookshelf' ? (
            <MyBookshelfPage
              bookshelf={bookshelf}
              loading={loadingBookshelf}
              errorMsg={bookshelfError}
              onRetry={() => void fetchBookshelf()}
              onRenewLoan={(loan) => handleRenewLoan(loan, true)}
              onCancelHold={handleCancelHold}
              onInspectBook={setInspectBookId}
              onBrowseCatalog={() => setActiveTab('books')}
            />
          ) : null}

          {activeTab === 'loans' ? (
            <LoansPage
              activeLoans={activeLoans}
              overdueLoans={overdueLoans}
              activeHolds={activeHolds}
              loading={loadingStaffData}
              onBorrowBook={() => handleOpenBorrow()}
              onOpenScanner={handleOpenScanner}
              onRequestReturnLoan={setReturningLoan}
              onRenewLoan={(loan) => handleRenewLoan(loan, false)}
              onFulfillHold={handleFulfillHold}
              onCancelHold={handleCancelHold}
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
          myLoans: myLoansCount,
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
        onSaved={() => void refreshAllCirculation()}
      />

      <BookDetailModal
        bookId={inspectBookId}
        myActiveHolds={bookshelf?.activeHolds ?? []}
        onClose={() => setInspectBookId(null)}
        onEdit={handleOpenEditBook}
        onBorrow={(book) => handleOpenBorrow({ bookId: book.id })}
        onDelete={setDeletingBook}
        onPlaceHold={handlePlaceHold}
      />

      <BorrowBookModal
        open={borrowModalOpen}
        books={books}
        members={members}
        activeHolds={activeHolds}
        initialBookId={borrowPreselectBookId}
        initialMemberId={borrowPreselectMemberId}
        onClose={() => setBorrowModalOpen(false)}
        onBorrowed={() => void refreshAllCirculation()}
        onOpenScanner={() => handleOpenScanner('checkout')}
      />

      <CirculationScannerModal
        open={scannerOpen}
        initialMode={scannerMode}
        books={books}
        members={members}
        activeLoans={activeLoans}
        activeHolds={activeHolds}
        onClose={() => setScannerOpen(false)}
        onCompleted={() => void refreshAllCirculation()}
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
