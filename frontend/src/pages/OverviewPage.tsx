import {
  AlertTriangle,
  ArrowRight,
  BookCheck,
  BookmarkCheck,
  BookOpen,
  Camera,
  KeyRound,
  LibraryBig,
  LogIn,
  Plus,
  Repeat,
  ShieldCheck,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AvailabilityGauge } from '@/components/ui/AvailabilityGauge';
import { BookCoverImage } from '@/components/ui/BookCoverImage';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { NavTab } from '@/components/layout/Sidebar';
import type { Book, LoanResponse, Member, MemberBookshelfResponse } from '@/types/api';
import { describeLoanSchedule, formatCalendarDate } from '@/utils/dates';
import { formatCallNumber } from '@/utils/formatting';
import { formatRoleLabel, getPrimaryRole } from '@/utils/roles';

interface OverviewPageProps {
  books: Book[];
  activeLoans: LoanResponse[];
  overdueLoans: LoanResponse[];
  members: Member[];
  bookshelf?: MemberBookshelfResponse | null;
  loadingBooks: boolean;
  booksError?: string | null;
  onRetryBooks?: () => void;
  onNavigate: (tab: NavTab) => void;
  onInspectBook: (bookId: number) => void;
  onOpenAddBook: () => void;
  onOpenBorrowBook: () => void;
  onOpenScanner?: () => void;
  onOpenRegisterMember: () => void;
  onRequestReturnLoan: (loan: LoanResponse) => void;
}

export function OverviewPage({
  books,
  activeLoans,
  overdueLoans,
  members,
  bookshelf = null,
  loadingBooks,
  booksError = null,
  onRetryBooks,
  onNavigate,
  onInspectBook,
  onOpenAddBook,
  onOpenBorrowBook,
  onOpenScanner,
  onOpenRegisterMember,
  onRequestReturnLoan,
}: OverviewPageProps) {
  const { user, isAuthenticated, isStaff, isAdmin, openSignInModal } = useAuth();

  const availableCount = books.filter((b) => b.available).length;
  const checkedOutCount = books.length - availableCount;
  const availPercent = books.length > 0 ? Math.round((availableCount / books.length) * 100) : 0;
  const primaryRole = getPrimaryRole(user?.roles);

  const priorityLoans = [
    ...overdueLoans,
    ...activeLoans.filter((l) => !overdueLoans.some((o) => o.id === l.id)),
  ].slice(0, 6);

  const featuredBooks = books.slice(0, 6);

  return (
    <>
      <section className="hero-banner stagger-enter" aria-label="Workspace summary">
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span>
              {isAuthenticated && user
                ? `${formatRoleLabel(primaryRole)} desk · ${user.email}`
                : 'Public catalog access'}
            </span>
          </div>

          <h2 className="hero-heading">
            {isStaff
              ? 'Library Operations & Circulation'
              : 'Athenaeum Collection & Circulation Desk'}
          </h2>

          <p className="hero-copy">
            {isStaff
              ? 'Manage catalog titles, member profiles, 14-day loans, and overdue returns'
              : 'Find your next read. Create an account or sign in to borrow available books for 14 days and manage your loans in My Bookshelf.'}
          </p>

          <div className="hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => onNavigate('books')}>
              <BookOpen size={16} aria-hidden="true" />
              <span>Browse Catalog</span>
            </button>
            {isStaff ? (
              <button type="button" className="btn btn-hero-outline" onClick={onOpenBorrowBook}>
                <Repeat size={16} aria-hidden="true" />
                <span>Issue Loan</span>
              </button>
            ) : isAuthenticated ? (
              <button
                type="button"
                className="btn btn-hero-outline"
                onClick={() => onNavigate('bookshelf')}
              >
                <BookmarkCheck size={16} aria-hidden="true" />
                <span>My Bookshelf</span>
              </button>
            ) : (
              <button type="button" className="btn btn-hero-outline" onClick={openSignInModal}>
                <LogIn size={16} aria-hidden="true" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>

        <div className="hero-artwork" aria-hidden="true">
          <img
            src="/images/Cozy%20Purple-Teal%20Library%20Reading%20Nook.png"
            alt=""
            className="hero-artwork-img"
            width={1448}
            height={1086}
            fetchPriority="high"
            decoding="async"
          />
        </div>
      </section>

      {loadingBooks && books.length === 0 ? (
        <StatCardSkeleton count={4} />
      ) : (
        <section className="kpi-grid" aria-label="Library metrics">
          <StatCard
            staggerIndex={0}
            label="Total Catalog Books"
            value={books.length}
            foot="Titles currently cataloged"
            icon={<BookOpen size={16} />}
            tone="accent"
          />
          <StatCard
            staggerIndex={1}
            label="Available on Shelf"
            value={availableCount}
            foot={books.length > 0 ? `${availPercent}% ready to borrow` : 'No titles in catalog'}
            icon={<LibraryBig size={16} />}
            tone="success"
          />
          <StatCard
            staggerIndex={2}
            label={isStaff ? 'Active Loans' : 'Checked Out Copies'}
            value={isStaff ? activeLoans.length : checkedOutCount}
            foot={isStaff ? 'Currently out on 14-day term' : 'Currently borrowed by members'}
            icon={<Repeat size={16} />}
            tone="warning"
          />
          <StatCard
            staggerIndex={3}
            label={isStaff ? 'Overdue Alerts' : 'Registered Members'}
            value={isStaff ? overdueLoans.length : 'Staff Only'}
            foot={
              isStaff
                ? overdueLoans.length > 0
                  ? `${members.length} registered members`
                  : `All ${members.length} members in good standing`
                : 'Sign in as Librarian or Admin'
            }
            icon={
              isStaff && overdueLoans.length > 0 ? (
                <AlertTriangle size={16} />
              ) : (
                <Users size={16} />
              )
            }
            tone={isStaff && overdueLoans.length > 0 ? 'danger' : 'info'}
          />
        </section>
      )}

      {isStaff ? (
        <div className="two-col-grid">
          <section className="card" aria-labelledby="priority-loans-heading">
            <div className="card-header">
              <div>
                <h3 id="priority-loans-heading" className="card-title">
                  Circulation Queue
                </h3>
                <p className="card-subtitle">
                  Overdue returns appear first, followed by upcoming due dates
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigate('loans')}
              >
                <span>Open Loans Desk</span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>

            {priorityLoans.length === 0 ? (
              <EmptyState
                flat
                icon={<BookCheck size={22} />}
                title="No active loans right now"
                description="All catalog volumes are currently returned on the shelf."
                action={
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={onOpenBorrowBook}
                  >
                    Issue First Loan
                  </button>
                }
              />
            ) : (
              <div className="queue-list">
                {priorityLoans.map((loan) => (
                  <div key={loan.id} className="queue-row">
                    <div className="queue-row-main">
                      <div className="queue-row-top">
                        <span className="mono catalog-id-badge">#{loan.id}</span>
                        <span className="queue-row-title">{loan.bookTitle}</span>
                        <StatusBadge tone={loan.overdue ? 'danger' : 'info'}>
                          {loan.overdue ? 'Overdue' : 'Active'}
                        </StatusBadge>
                      </div>
                      <div className="queue-row-sub">
                        Borrowed by <strong>{loan.memberName}</strong> · Due{' '}
                        {formatCalendarDate(loan.dueOn)} (
                        {describeLoanSchedule(loan.dueOn, loan.returnedOn, loan.overdue)})
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      aria-label={`Return Book: ${loan.bookTitle}`}
                      onClick={() => onRequestReturnLoan(loan)}
                    >
                      Return Book
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="overview-side-stack">
            <AvailabilityGauge
              totalBooks={books.length}
              availableBooks={availableCount}
              borrowedBooks={checkedOutCount}
              overdueCount={overdueLoans.length}
              loading={loadingBooks}
              error={booksError}
              onRetry={onRetryBooks}
            />

            <section
              className="card card-padded form-stack"
              aria-labelledby="quick-actions-heading"
            >
              <div>
                <h3 id="quick-actions-heading" className="card-title">
                  Quick Staff Operations
                </h3>
                <p className="card-subtitle">Common circulation desk workflows</p>
              </div>

              <div className="form-stack" style={{ gap: '0.6rem' }}>
                <button
                  type="button"
                  className="btn btn-secondary quick-op-btn"
                  onClick={onOpenBorrowBook}
                >
                  <span className="quick-op-label">
                    <Repeat size={16} aria-hidden="true" />
                    <span>Borrow a Book (14-Day Loan)</span>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>

                {onOpenScanner ? (
                  <button
                    type="button"
                    className="btn btn-secondary quick-op-btn"
                    onClick={onOpenScanner}
                  >
                    <span className="quick-op-label">
                      <Camera size={16} aria-hidden="true" />
                      <span>Camera Barcode / QR Scanner</span>
                    </span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                ) : null}

                <button
                  type="button"
                  className="btn btn-secondary quick-op-btn"
                  onClick={onOpenRegisterMember}
                >
                  <span className="quick-op-label">
                    <UserPlus size={16} aria-hidden="true" />
                    <span>Register New Member</span>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>

                <button
                  type="button"
                  className="btn btn-secondary quick-op-btn"
                  onClick={onOpenAddBook}
                >
                  <span className="quick-op-label">
                    <Plus size={16} aria-hidden="true" />
                    <span>Add Volume to Catalog</span>
                  </span>
                  <ArrowRight size={15} aria-hidden="true" />
                </button>

                {isAdmin ? (
                  <button
                    type="button"
                    className="btn btn-secondary quick-op-btn"
                    onClick={() => onNavigate('admin')}
                  >
                    <span className="quick-op-label">
                      <ShieldCheck size={16} aria-hidden="true" />
                      <span>Provision Staff / Member Login</span>
                    </span>
                    <ArrowRight size={15} aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </section>
          </div>
        </div>
      ) : (
        <div className="two-col-grid">
          <section className="card" aria-labelledby="featured-books-heading">
            <div className="card-header">
              <div>
                <h3 id="featured-books-heading" className="card-title">
                  Recent Catalog Highlights
                </h3>
                <p className="card-subtitle">
                  Current availability across recent shelf additions
                </p>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => onNavigate('books')}
              >
                <span>View All</span>
                <ArrowRight size={15} aria-hidden="true" />
              </button>
            </div>

            {loadingBooks && books.length === 0 ? (
              <div className="queue-list">
                <TableSkeleton rows={3} label="Loading recent catalog titles" />
              </div>
            ) : booksError && featuredBooks.length === 0 ? (
              <div className="queue-list">
                <div className="alert alert-danger alert-row" role="alert">
                  <span>{booksError}</span>
                  {onRetryBooks ? (
                    <button type="button" className="btn btn-secondary btn-sm" onClick={onRetryBooks}>
                      Retry
                    </button>
                  ) : null}
                </div>
              </div>
            ) : featuredBooks.length === 0 ? (
              <EmptyState
                flat
                icon={<BookOpen size={22} />}
                title="Catalog is empty"
                description="Sign in as staff or admin to add the first books to your library."
              />
            ) : (
              <div className="queue-list">
                {featuredBooks.map((book) => (
                  <div key={book.id} className="highlight-row">
                    <div className="highlight-lead">
                      <div className="highlight-cover-thumb" aria-hidden="true">
                        <BookCoverImage
                          book={book}
                          width={80}
                          height={104}
                          loading="lazy"
                          className="highlight-cover-img"
                        />
                      </div>
                      <div className="queue-row-main">
                        <span className="mono catalog-id-badge">{formatCallNumber(book.id)}</span>
                        <div className="highlight-title">{book.title}</div>
                        <div className="queue-row-sub">
                          {book.author} · {book.publicationYear}
                        </div>
                      </div>
                    </div>
                    <div className="row-actions">
                      <StatusBadge tone={book.available ? 'success' : 'warning'}>
                        {book.available ? 'Available' : 'Borrowed'}
                      </StatusBadge>
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        aria-label={`Details: ${book.title}`}
                        onClick={() => onInspectBook(book.id)}
                      >
                        Details
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <div className="overview-side-stack">
            <AvailabilityGauge
              totalBooks={books.length}
              availableBooks={availableCount}
              borrowedBooks={checkedOutCount}
              overdueCount={null}
              loading={loadingBooks}
              error={booksError}
              onRetry={onRetryBooks}
            />

            <section
              className="card card-padded form-stack"
              aria-labelledby="access-overview-heading"
            >
              <div>
                <h3 id="access-overview-heading" className="card-title">
                  Role-Based Access
                </h3>
                <p className="card-subtitle">Permissions by account role</p>
              </div>

              <div className="access-info-panel">
                <KeyRound size={18} aria-hidden="true" className="access-key-icon" />
                <span>
                  {isAuthenticated && bookshelf ? (
                    <>
                      <strong>My Bookshelf Active:</strong> You have{' '}
                      <strong>{bookshelf.activeLoans.length}</strong> active loan
                      {bookshelf.activeLoans.length === 1 ? '' : 's'} and{' '}
                      <strong>{bookshelf.activeHolds.length}</strong> active hold
                      {bookshelf.activeHolds.length === 1 ? '' : 's'}. Open{' '}
                      <button
                        type="button"
                        className="error-summary-link"
                        onClick={() => onNavigate('bookshelf')}
                      >
                        My Bookshelf
                      </button>{' '}
                      to renew loans (+14 days) or track pickups.
                    </>
                  ) : (
                    <>
                      <strong>Public &amp; Member:</strong> Search and inspect the catalog freely,
                      manage personal loans &amp; holds in My Bookshelf, or sign in with{' '}
                      <code>LIBRARIAN</code> / <code>ADMIN</code> credentials for circulation desk
                      operations.
                    </>
                  )}
                </span>
              </div>

              {!isAuthenticated ? (
                <button type="button" className="btn btn-primary" onClick={openSignInModal}>
                  <LogIn size={16} aria-hidden="true" />
                  <span>Sign In</span>
                </button>
              ) : null}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
