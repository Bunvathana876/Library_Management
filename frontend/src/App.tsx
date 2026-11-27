import { useCallback, useEffect, useRef, useState } from 'react';
import { booksApi } from '@/api/booksApi';
import { healthApi } from '@/api/healthApi';
import { holdsApi } from '@/api/holdsApi';
import { loansApi } from '@/api/loansApi';
import { memberPortalApi } from '@/api/memberPortalApi';
import { membersApi } from '@/api/membersApi';
import { notificationsApi } from '@/api/notificationsApi';
import { BookDetailModal } from '@/components/forms/BookDetailModal';
import { BookFormModal } from '@/components/forms/BookFormModal';
import { BorrowBookModal } from '@/components/forms/BorrowBookModal';
import { ChangePasswordModal } from '@/components/forms/ChangePasswordModal';
import {
  CirculationScannerModal,
  type ScannerMode,
} from '@/components/forms/CirculationScannerModal';
import { MemberFormModal } from '@/components/forms/MemberFormModal';
import { MemberBorrowModal } from '@/components/forms/MemberBorrowModal';
import { MemberHistoryDrawer } from '@/components/forms/MemberHistoryDrawer';
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
  AuthUser,
  Book,
  HealthResponse,
  HoldResponse,
  LoanResponse,
  Member,
  MemberBookshelfResponse,
  NotificationItem,
} from '@/types/api';
import { formatCalendarDate } from '@/utils/dates';
import { formatApiErrorMessage } from '@/utils/errors';
import { formatCurrency } from '@/utils/formatting';
import { isStaff as hasStaffRole } from '@/utils/roles';

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
  const { user, isAuthenticated, isStaff, signInModalOpen, signInMode, openSignInModal, closeSignInModal } = useAuth();
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

  // Complete library data; BooksPage derives its own filtered catalog view.
  const [books, setBooks] = useState<Book[]>([]);
  const [bookSearch, setBookSearch] = useState('');
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [booksError, setBooksError] = useState<string | null>(null);

  // Staff-protected state
  const [members, setMembers] = useState<Member[]>([]);
  const [activeLoans, setActiveLoans] = useState<LoanResponse[]>([]);
  const [overdueLoans, setOverdueLoans] = useState<LoanResponse[]>([]);
  const [fineLoans, setFineLoans] = useState<LoanResponse[]>([]);
  const [activeHolds, setActiveHolds] = useState<HoldResponse[]>([]);
  const [loadingStaffData, setLoadingStaffData] = useState(false);

  // Member self-service bookshelf & notifications state
  const [bookshelf, setBookshelf] = useState<MemberBookshelfResponse | null>(null);
  const [loadingBookshelf, setLoadingBookshelf] = useState(false);
  const [bookshelfError, setBookshelfError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  // Modals & drawers
  const [bookFormOpen, setBookFormOpen] = useState(false);
  const [editingBook, setEditingBook] = useState<Book | null>(null);
  const [inspectBookId, setInspectBookId] = useState<number | null>(null);
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [pendingBorrowBook, setPendingBorrowBook] = useState<Book | null>(null);
  const [memberBorrowBook, setMemberBorrowBook] = useState<Book | null>(null);
  const [borrowPreselectBookId, setBorrowPreselectBookId] = useState<number | null>(null);
  const [borrowPreselectMemberId, setBorrowPreselectMemberId] = useState<number | null>(null);
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [inspectMemberId, setInspectMemberId] = useState<number | null>(null);
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerMode, setScannerMode] = useState<ScannerMode>('checkout');

  const [deletingBook, setDeletingBook] = useState<Book | null>(null);
  const [returningLoan, setReturningLoan] = useState<LoanResponse | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) setMemberBorrowBook(null);
  }, [isAuthenticated]);

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

  const fetchBooks = useCallback(
    async (signal?: AbortSignal) => {
      setLoadingBooks(true);
      setBooksError(null);
      try {
        const list = await booksApi.listBooks('', signal);
        if (!signal?.aborted) setBooks(list);
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
    [],
  );

  const fetchStaffData = useCallback(
    async (signal?: AbortSignal) => {
      if (!isStaff) {
        setMembers([]);
        setActiveLoans([]);
        setOverdueLoans([]);
        setFineLoans([]);
        setActiveHolds([]);
        return;
      }

      setLoadingStaffData(true);
      try {
        const [memberList, activeList, overdueList, fineList, holdList] = await Promise.all([
          membersApi.listMembers(signal),
          loansApi.getActiveLoans(signal),
          loansApi.getOverdueLoans(signal),
          loansApi.getFineLoans(signal),
          holdsApi.getActiveHolds(signal),
        ]);
        setMembers(memberList);
        setActiveLoans(activeList);
        setOverdueLoans(overdueList);
        setFineLoans(fineList);
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

  const fetchNotifications = useCallback(
    async (signal?: AbortSignal) => {
      if (!isAuthenticated) {
        setNotifications([]);
        setUnreadNotifications(0);
        return;
      }
      setLoadingNotifications(true);
      try {
        const data = await notificationsApi.listNotifications(signal);
        if (!signal?.aborted) {
          setNotifications(data.items);
          setUnreadNotifications(data.unreadCount);
        }
      } catch {
        // Ignore silent background notification poll failure
      } finally {
        if (!signal?.aborted) {
          setLoadingNotifications(false);
        }
      }
    },
    [isAuthenticated],
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
    await Promise.all([
      fetchBooks(),
      fetchStaffData(),
      fetchBookshelf(),
      fetchNotifications(),
    ]);
  }, [fetchBooks, fetchStaffData, fetchBookshelf, fetchNotifications]);

  // Initial & polled health + notifications check
  useEffect(() => {
    const controller = new AbortController();
    void fetchHealth(controller.signal);
    const interval = window.setInterval(() => {
      void fetchHealth();
      if (isAuthenticated) {
        void fetchNotifications();
      }
    }, 30000);
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [fetchHealth, fetchNotifications, isAuthenticated]);

  // Fetch the complete public library once; search stays local to the catalog.
  useEffect(() => {
    const controller = new AbortController();
    void fetchBooks(controller.signal);
    return () => controller.abort();
  }, [fetchBooks]);

  // Fetch staff data whenever staff status changes
  useEffect(() => {
    const controller = new AbortController();
    void fetchStaffData(controller.signal);
    return () => controller.abort();
  }, [fetchStaffData]);

  // Fetch patron bookshelf and notifications whenever auth status changes
  useEffect(() => {
    const controller = new AbortController();
    void fetchBookshelf(controller.signal);
    void fetchNotifications(controller.signal);
    return () => controller.abort();
  }, [fetchBookshelf, fetchNotifications]);

  const handleOpenAddBook = () => {
    setEditingBook(null);
    setBookFormOpen(true);
  };

  const handleOpenEditBook = (book: Book) => {
    setEditingBook(book);
    setBookFormOpen(true);
  };

  const handleOpenBorrow = (opts?: { bookId?: number; memberId?: number }) => {
    if (!isStaff) {
      const book = books.find((candidate) => candidate.id === opts?.bookId);
      if (!book) {
        setActiveTab('books');
      } else if (!isAuthenticated) {
        setPendingBorrowBook(book);
        openSignInModal();
      } else {
        setMemberBorrowBook(book);
      }
      return;
    }
    setBorrowPreselectBookId(opts?.bookId ?? null);
    setBorrowPreselectMemberId(opts?.memberId ?? null);
    setBorrowModalOpen(true);
  };

  const handleAuthenticated = (authenticatedUser: AuthUser) => {
    if (!pendingBorrowBook) return;
    if (hasStaffRole(authenticatedUser.roles)) {
      setBorrowPreselectBookId(pendingBorrowBook.id);
      setBorrowPreselectMemberId(null);
      setBorrowModalOpen(true);
    } else {
      setMemberBorrowBook(pendingBorrowBook);
    }
    setPendingBorrowBook(null);
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
      await fetchBooks();
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
      const fineNote =
        updated.fineAmount && updated.fineAmount > 0
          ? ` Overdue fine assessed: ${formatCurrency(updated.fineAmount)}.`
          : '';
      if (updated.heldForMemberName) {
        notify({
          variant: 'info',
          title: 'Book returned & reserved at desk',
          message: `"${updated.bookTitle}" is held at the circulation desk for ${updated.heldForMemberName} (3-day pickup window).${fineNote}`,
        });
      } else {
        notify({
          variant: 'success',
          title: 'Book returned',
          message: `Loan #${updated.id} ("${updated.bookTitle}") marked returned.${fineNote}`,
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

  const handlePayFine = async (loan: LoanResponse, note?: string) => {
    try {
      const updated = await loansApi.payFine(loan.id, note);
      await refreshAllCirculation();
      notify({
        variant: 'success',
        title: 'Fine paid',
        message: `Recorded ${formatCurrency(updated.fineAmount)} payment for Loan #${updated.id}.`,
      });
    } catch (err) {
      notify({
        variant: 'error',
        title: 'Payment failed',
        message: formatApiErrorMessage(err),
      });
    }
  };

  const handleWaiveFine = async (loan: LoanResponse, note?: string) => {
    try {
      const updated = await loansApi.waiveFine(loan.id, note);
      await refreshAllCirculation();
      notify({
        variant: 'info',
        title: 'Fine waived',
        message: `Waived ${formatCurrency(updated.fineAmount)} fine for Loan #${updated.id}.`,
      });
    } catch (err) {
      notify({
        variant: 'error',
        title: 'Waive failed',
        message: formatApiErrorMessage(err),
      });
    }
  };

  const handleMarkNotificationRead = async (id: number) => {
    try {
      await notificationsApi.markRead(id);
      await fetchNotifications();
    } catch {
      // Ignore silent read update failures
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      await notificationsApi.markAllRead();
      await fetchNotifications();
    } catch {
      // Ignore silent read update failures
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
        onOpenChangePassword={() => setChangePasswordOpen(true)}
      />

      <div className="main-column">
        <TopBar
          activeTab={activeTab}
          mobileMenuOpen={mobileMenuOpen}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
          onQuickSearch={focusCatalogSearch}
          onOpenAddBook={handleOpenAddBook}
          onOpenBorrowBook={() => handleOpenBorrow()}
          onOpenRegisterMember={() => {
            setEditingMember(null);
            setMemberModalOpen(true);
          }}
          onOpenScanner={() => handleOpenScanner('checkout')}
          notifications={notifications}
          unreadNotificationCount={unreadNotifications}
          loadingNotifications={loadingNotifications}
          onRefreshNotifications={() => void fetchNotifications()}
          onMarkNotificationRead={handleMarkNotificationRead}
          onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
          onNavigateBookshelf={() => setActiveTab('bookshelf')}
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
              onRetryBooks={() => void fetchBooks()}
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
              onRetry={() => void fetchBooks()}
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
              fineLoans={fineLoans}
              activeHolds={activeHolds}
              loading={loadingStaffData}
              onBorrowBook={() => handleOpenBorrow()}
              onOpenScanner={handleOpenScanner}
              onRequestReturnLoan={setReturningLoan}
              onRenewLoan={(loan) => handleRenewLoan(loan, false)}
              onPayFine={handlePayFine}
              onWaiveFine={handleWaiveFine}
              onFulfillHold={handleFulfillHold}
              onCancelHold={handleCancelHold}
            />
          ) : null}

          {activeTab === 'members' ? (
            <MembersPage
              members={members}
              activeLoans={activeLoans}
              loading={loadingStaffData}
              onRegisterMember={() => {
                setEditingMember(null);
                setMemberModalOpen(true);
              }}
              onEditMember={(member) => {
                setEditingMember(member);
                setMemberModalOpen(true);
              }}
              onInspectMember={(member) => setInspectMemberId(member.id)}
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
      <SignInModal
        open={signInModalOpen}
        initialMode={signInMode}
        borrowTitle={pendingBorrowBook?.title}
        onAuthenticated={handleAuthenticated}
        onClose={() => {
          closeSignInModal();
          setPendingBorrowBook(null);
        }}
      />

      {memberBorrowBook && user && !isStaff ? (
        <MemberBorrowModal
          key={memberBorrowBook.id}
          book={memberBorrowBook}
          email={user.email}
          onClose={() => setMemberBorrowBook(null)}
          onBorrowed={(loan) => {
            setMemberBorrowBook(null);
            setActiveTab('bookshelf');
            void refreshAllCirculation();
            notify({
              variant: 'success',
              title: 'Book borrowed',
              message: `“${loan.bookTitle}” is due ${formatCalendarDate(loan.dueOn)}.`,
            });
          }}
        />
      ) : null}

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
        onCopiesChanged={() => void refreshAllCirculation()}
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
        editingMember={editingMember}
        onClose={() => {
          setMemberModalOpen(false);
          setEditingMember(null);
        }}
        onSaved={() => void refreshAllCirculation()}
      />

      <MemberHistoryDrawer
        memberId={inspectMemberId}
        onClose={() => setInspectMemberId(null)}
        onEditMember={(member) => {
          setEditingMember(member);
          setMemberModalOpen(true);
        }}
        onBorrowForMember={(member) => handleOpenBorrow({ memberId: member.id })}
        onRequestReturnLoan={setReturningLoan}
        onRenewLoan={(loan) => handleRenewLoan(loan, false)}
        onPayFine={handlePayFine}
        onWaiveFine={handleWaiveFine}
        onCancelHold={handleCancelHold}
        onMembersChanged={() => void refreshAllCirculation()}
      />

      <ChangePasswordModal
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
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
