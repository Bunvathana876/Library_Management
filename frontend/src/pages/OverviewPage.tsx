import {
  AlertTriangle,
  ArrowRight,
  BookCheck,
  BookOpen,
  KeyRound,
  LibraryBig,
  LogIn,
  Plus,
  Repeat,
  ShieldCheck,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AvailabilityGauge } from '@/components/ui/AvailabilityGauge';
import { EmptyState } from '@/components/ui/EmptyState';
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { NavTab } from '@/components/layout/Sidebar';
import type { Book, LoanResponse, Member } from '@/types/api';
import { describeLoanSchedule, formatCalendarDate } from '@/utils/dates';
import { formatCallNumber } from '@/utils/formatting';
import { formatRoleLabel, getPrimaryRole } from '@/utils/roles';

interface OverviewPageProps {
  books: Book[];
  activeLoans: LoanResponse[];
  overdueLoans: LoanResponse[];
  members: Member[];
  loadingBooks: boolean;
  booksError?: string | null;
  onRetryBooks?: () => void;
  onNavigate: (tab: NavTab) => void;
  onInspectBook: (bookId: number) => void;
  onOpenAddBook: () => void;
  onOpenBorrowBook: () => void;
  onOpenRegisterMember: () => void;
  onRequestReturnLoan: (loan: LoanResponse) => void;
}

const COVER_ACCENTS = [
  'var(--spine-1)',
  'var(--spine-2)',
  'var(--spine-3)',
  'var(--spine-4)',
  'var(--spine-5)',
  'var(--spine-6)',
];

export function OverviewPage({
  books,
  activeLoans,
  overdueLoans,
  members,
  loadingBooks,
  booksError = null,
  onRetryBooks,
  onNavigate,
  onInspectBook,
  onOpenAddBook,
  onOpenBorrowBook,
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
        <svg
          className="hero-bg-curves"
          viewBox="0 0 1200 260"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,185 C260,120 480,255 820,175 C985,135 1100,155 1200,115 L1200,260 L0,260 Z"
            fill="currentColor"
            opacity="0.065"
          />
          <circle cx="960" cy="48" r="150" fill="currentColor" opacity="0.05" />
        </svg>

        <div className="hero-content">
          <div className="hero-eyebrow">
            <Sparkles size={13} aria-hidden="true" />
            <span>
              {isAuthenticated
                ? `${formatRoleLabel(primaryRole)} Workspace`
                : 'Public Catalog Explorer'}
            </span>
          </div>

          <h2 className="hero-heading">
            {isAuthenticated && user ? (
              <>
                Welcome back, <span className="hero-heading-accent">{user.email}</span>
              </>
            ) : (
              <>
                Curated Library Catalog &amp;{' '}
                <span className="hero-heading-accent">Circulation Desk</span>
              </>
            )}
          </h2>

          <p className="hero-copy">
            {isStaff
              ? 'Manage volumes, register borrowers, issue 14-day loans, and resolve overdue returns directly against your Spring Boot API.'
              : 'Browse real-time book availability across the collection. Sign in with a Librarian or Admin account to manage circulation and members.'}
          </p>

          <div className="hero-actions">
            <button type="button" className="btn btn-primary" onClick={() => onNavigate('books')}>
              <BookOpen size={16} aria-hidden="true" />
              <span>Browse Catalog</span>
            </button>
            {isStaff ? (
              <>
                <button type="button" className="btn btn-hero-outline" onClick={onOpenAddBook}>
                  <Plus size={16} aria-hidden="true" />
                  <span>Add Book</span>
                </button>
                <button type="button" className="btn btn-hero-outline" onClick={onOpenBorrowBook}>
                  <Repeat size={16} aria-hidden="true" />
                  <span>Issue Loan</span>
                </button>
              </>
            ) : !isAuthenticated ? (
              <button type="button" className="btn btn-hero-outline" onClick={openSignInModal}>
                <LogIn size={16} aria-hidden="true" />
                <span>Sign In to Staff Desk</span>
              </button>
            ) : null}
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
            foot="Indexed via GET /api/books"
            icon={<BookOpen size={20} />}
            watermark={<BookOpen size={90} strokeWidth={1.35} />}
            tone="accent"
          />
          <StatCard
            staggerIndex={1}
            label="Available on Shelf"
            value={availableCount}
            foot={books.length > 0 ? `${availPercent}% ready to borrow` : 'No titles in catalog'}
            progress={books.length > 0 ? availPercent : 0}
            icon={<LibraryBig size={20} />}
            watermark={<LibraryBig size={90} strokeWidth={1.35} />}
            tone="success"
          />
          <StatCard
            staggerIndex={2}
            label={isStaff ? 'Active Loans' : 'Checked Out Copies'}
            value={isStaff ? activeLoans.length : checkedOutCount}
            foot={isStaff ? 'Currently out on 14-day term' : 'Currently borrowed by members'}
            icon={<Repeat size={20} />}
            watermark={<Repeat size={90} strokeWidth={1.35} />}
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
                <AlertTriangle size={20} />
              ) : (
                <Users size={20} />
              )
            }
            watermark={
              isStaff && overdueLoans.length > 0 ? (
                <AlertTriangle size={90} strokeWidth={1.35} />
              ) : (
                <Users size={90} strokeWidth={1.35} />
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
              <div className="card-header-with-icon">
                <span className="section-icon-badge" aria-hidden="true">
                  <Repeat size={18} />
                </span>
                <div>
                  <h3 id="priority-loans-heading" className="card-title">
                    Circulation Queue
                  </h3>
                  <p className="card-subtitle">
                    Overdue returns appear first, followed by active upcoming due dates
                  </p>
                </div>
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
              <div className="card-header-with-icon">
                <span className="section-icon-badge" aria-hidden="true">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <h3 id="quick-actions-heading" className="card-title">
                    Quick Staff Operations
                  </h3>
                  <p className="card-subtitle">
                    Common workflows mapped directly to Spring Boot endpoints
                  </p>
                </div>
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
              <div className="card-header-with-icon">
                <span className="section-icon-badge" aria-hidden="true">
                  <BookOpen size={18} />
                </span>
                <div>
                  <h3 id="featured-books-heading" className="card-title">
                    Recent Catalog Highlights
                  </h3>
                  <p className="card-subtitle">
                    Inspect live availability across the library shelf
                  </p>
                </div>
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
                {featuredBooks.map((book) => {
                  const coverColor = COVER_ACCENTS[book.id % COVER_ACCENTS.length];
                  return (
                    <div key={book.id} className="highlight-row">
                      <div className="highlight-lead">
                        <span
                          className="book-mini-cover"
                          style={{ ['--cover-accent' as string]: coverColor }}
                          aria-hidden="true"
                        >
                          <BookOpen size={16} />
                        </span>
                        <div className="queue-row-main">
                          <span className="mono catalog-id-badge">
                            {formatCallNumber(book.id)}
                          </span>
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
                          onClick={() => onInspectBook(book.id)}
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  );
                })}
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
              <div className="card-header-with-icon">
                <span className="section-icon-badge" aria-hidden="true">
                  <ShieldCheck size={18} />
                </span>
                <div>
                  <h3 id="access-overview-heading" className="card-title">
                    Role-Based Access
                  </h3>
                  <p className="card-subtitle">Enforced by Spring Security JWT permissions</p>
                </div>
              </div>

              <div className="access-info-panel">
                <KeyRound size={18} aria-hidden="true" className="access-key-icon" />
                <span>
                  <strong>Public &amp; Member:</strong> Search and inspect the entire book catalog
                  freely. Staff circulation, member registration, and account provisioning require{' '}
                  <code>LIBRARIAN</code> or <code>ADMIN</code> authentication.
                </span>
              </div>

              {!isAuthenticated ? (
                <button type="button" className="btn btn-primary" onClick={openSignInModal}>
                  <LogIn size={16} aria-hidden="true" />
                  <span>Sign In with JWT Account</span>
                </button>
              ) : null}
            </section>
          </div>
        </div>
      )}
    </>
  );
}
