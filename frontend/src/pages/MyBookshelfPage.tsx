import { useId, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  BookCheck,
  BookOpen,
  CalendarClock,
  Clock,
  Eye,
  History,
  LogIn,
  QrCode,
  Receipt,
  RefreshCw,
  Sparkles,
  UserCheck,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { AccessibleTabs, type TabItem } from '@/components/ui/AccessibleTabs';
import { BookCoverImage } from '@/components/ui/BookCoverImage';
import { EmptyState } from '@/components/ui/EmptyState';
import { QrCodeCanvas } from '@/components/ui/QrCodeCanvas';
import { StatCardSkeleton, TableSkeleton } from '@/components/ui/Skeleton';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { Book, HoldResponse, LoanResponse, MemberBookshelfResponse } from '@/types/api';
import {
  describeLoanSchedule,
  formatCalendarDate,
  loanProgressPercent,
} from '@/utils/dates';
import {
  formatCallNumber,
  formatCurrency,
  formatLoanCode,
  formatMemberCardCode,
} from '@/utils/formatting';

interface MyBookshelfPageProps {
  bookshelf: MemberBookshelfResponse | null;
  loading: boolean;
  errorMsg: string | null;
  onRetry: () => void;
  onRenewLoan: (loan: LoanResponse) => Promise<void>;
  onCancelHold: (hold: HoldResponse) => Promise<void>;
  onInspectBook: (bookId: number) => void;
  onBrowseCatalog: () => void;
}

type ShelfTab = 'loans' | 'holds' | 'history';

function buildLoanBookStub(loan: LoanResponse): Book {
  return {
    id: loan.bookId,
    title: loan.bookTitle,
    author: loan.bookAuthor ?? '',
    publicationYear: 2024,
    isbn: loan.bookIsbn ?? null,
    coverUrl: loan.bookCoverUrl ?? null,
    available: loan.returnedOn !== null,
  };
}

function buildHoldBookStub(hold: HoldResponse): Book {
  return {
    id: hold.bookId,
    title: hold.bookTitle,
    author: hold.bookAuthor,
    publicationYear: 2024,
    isbn: hold.bookIsbn,
    coverUrl: hold.bookCoverUrl,
    available: false,
  };
}

export function MyBookshelfPage({
  bookshelf,
  loading,
  errorMsg,
  onRetry,
  onRenewLoan,
  onCancelHold,
  onInspectBook,
  onBrowseCatalog,
}: MyBookshelfPageProps) {
  const { isAuthenticated, openSignInModal } = useAuth();
  const tabsPrefix = useId();
  const historyCaptionId = useId();

  const [activeTab, setActiveTab] = useState<ShelfTab>('loans');
  const [showQrPass, setShowQrPass] = useState(false);
  const [busyLoanId, setBusyLoanId] = useState<number | null>(null);
  const [busyHoldId, setBusyHoldId] = useState<number | null>(null);

  if (!isAuthenticated) {
    return (
      <EmptyState
        icon={<BookOpen size={22} />}
        title="Sign in to view My Bookshelf"
        description="View your active checkouts with due-date countdowns, renew eligible loans for +14 days, track holds, and review return history."
        action={
          <button type="button" className="btn btn-primary" onClick={openSignInModal}>
            <LogIn size={16} aria-hidden="true" />
            <span>Sign In</span>
          </button>
        }
      />
    );
  }

  if (loading && !bookshelf) {
    return (
      <div className="form-stack">
        <StatCardSkeleton count={4} />
        <TableSkeleton rows={4} label="Loading your personal bookshelf" />
      </div>
    );
  }

  if (errorMsg && !bookshelf) {
    return (
      <div className="alert alert-danger alert-row" role="alert">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={onRetry}>
          Retry
        </button>
      </div>
    );
  }

  if (!bookshelf) {
    return null;
  }

  const memberCode = formatMemberCardCode(bookshelf.memberId);
  const readyHolds = bookshelf.activeHolds.filter((h) => h.status === 'READY_FOR_PICKUP');
  const waitingHolds = bookshelf.activeHolds.filter((h) => h.status === 'WAITING');
  const overdueCount = bookshelf.activeLoans.filter((l) => l.overdue).length;
  const activeLimit = bookshelf.activeLoanLimit ?? 5;
  const unpaidFinesTotal = bookshelf.unpaidFinesTotal ?? 0;
  const fineThreshold = bookshelf.fineBlockThreshold ?? 10;
  const fineLoans = bookshelf.fineLoans ?? [];

  const tabs: ReadonlyArray<TabItem<ShelfTab>> = [
    {
      id: 'loans',
      label: 'Active Loans',
      count: bookshelf.activeLoans.length,
      icon: <BookOpen size={15} />,
    },
    {
      id: 'holds',
      label: 'Holds & Queue',
      count: bookshelf.activeHolds.length,
      icon: <Clock size={15} />,
    },
    {
      id: 'history',
      label: 'Return History',
      count: bookshelf.returnHistory.length,
      icon: <History size={15} />,
    },
  ];

  const handleRenew = async (loan: LoanResponse) => {
    setBusyLoanId(loan.id);
    try {
      await onRenewLoan(loan);
    } finally {
      setBusyLoanId(null);
    }
  };

  const handleCancel = async (hold: HoldResponse) => {
    setBusyHoldId(hold.id);
    try {
      await onCancelHold(hold);
    } finally {
      setBusyHoldId(null);
    }
  };

  return (
    <div className="form-stack">
      <section className="card card-padded bookshelf-header-card" aria-label="Patron membership card">
        <div className="bookshelf-identity">
          <div className="bookshelf-eyebrow">
            <UserCheck size={15} aria-hidden="true" />
            <span>Patron Self-Service · {memberCode}</span>
          </div>
          <h2 className="bookshelf-patron-name">{bookshelf.fullName}</h2>
          <p className="card-subtitle">{bookshelf.email}</p>
        </div>

        <div className="bookshelf-header-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            aria-expanded={showQrPass}
            onClick={() => setShowQrPass((prev) => !prev)}
          >
            <QrCode size={15} aria-hidden="true" />
            <span>{showQrPass ? 'Hide Member QR' : 'Member QR Pass'}</span>
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={onBrowseCatalog}>
            <BookOpen size={15} aria-hidden="true" />
            <span>Browse Catalog</span>
          </button>
        </div>
      </section>

      {showQrPass ? (
        <section className="card card-padded bookshelf-qr-panel" aria-label="Scannable member pass">
          <QrCodeCanvas
            value={memberCode}
            size={116}
            label={`Member QR pass for ${bookshelf.fullName} (${memberCode})`}
          />
          <div className="form-stack" style={{ gap: '0.35rem' }}>
            <div className="queue-row-top">
              <span className="catalog-id-badge mono">{memberCode}</span>
              <StatusBadge tone="info">Circulation Desk Pass</StatusBadge>
            </div>
            <p className="card-subtitle">
              Show this QR code to a librarian at the desk for instant barcode checkout.
            </p>
          </div>
        </section>
      ) : null}

      {readyHolds.length > 0 ? (
        <section className="hold-pickup-banner" aria-label="Books ready for pickup">
          <div className="hold-pickup-banner-head">
            <Sparkles size={18} aria-hidden="true" />
            <strong>
              {readyHolds.length === 1
                ? '1 reserved book is waiting for you at the circulation desk!'
                : `${readyHolds.length} reserved books are waiting for you at the circulation desk!`}
            </strong>
          </div>
          <div className="hold-pickup-list">
            {readyHolds.map((hold) => (
              <div key={hold.id} className="hold-pickup-item">
                <div>
                  <span className="queue-row-title">{hold.bookTitle}</span>{' '}
                  <span className="text-secondary">
                    · Pick up by{' '}
                    <strong className="tabular-nums">
                      {formatCalendarDate(hold.expiresOn)}
                    </strong>
                  </span>
                </div>
                <div className="row-actions">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => onInspectBook(hold.bookId)}
                  >
                    Details
                  </button>
                  <button
                    type="button"
                    className="btn btn-soft-danger btn-sm"
                    disabled={busyHoldId === hold.id}
                    onClick={() => void handleCancel(hold)}
                  >
                    {busyHoldId === hold.id ? 'Cancelling…' : 'Cancel Hold'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {bookshelf.borrowingBlocked || unpaidFinesTotal > 0 ? (
        <section
          className={`alert ${bookshelf.borrowingBlocked ? 'alert-danger' : 'alert-warning'}`}
          role="status"
          aria-label="Patron standing and fine summary"
        >
          <AlertTriangle size={18} aria-hidden="true" className="alert-icon" />
          <div>
            <strong>
              {bookshelf.borrowingBlocked
                ? 'Borrowing & Renewals Restricted'
                : 'Outstanding Overdue Fines'}
            </strong>
            <div style={{ marginTop: '2px', fontSize: 'var(--text-sm)' }}>
              {bookshelf.borrowingBlockReason
                ? `${bookshelf.borrowingBlockReason}. `
                : null}
              Active loans: <strong>{bookshelf.activeLoans.length}/{activeLimit}</strong> · Unpaid fines:{' '}
              <strong className="tabular-nums">{formatCurrency(unpaidFinesTotal)}</strong> (block limit{' '}
              {formatCurrency(fineThreshold)}). Settle fines at the circulation desk.
            </div>
          </div>
        </section>
      ) : null}

      <section className="kpi-grid" aria-label="My bookshelf summary">
        <StatCard
          label="Active Loans"
          value={`${bookshelf.activeLoans.length}/${activeLimit}`}
          foot={overdueCount > 0 ? `${overdueCount} overdue` : 'All loans on schedule'}
          icon={<BookOpen size={16} />}
          tone={overdueCount > 0 ? 'danger' : 'accent'}
        />
        <StatCard
          label="Ready for Pickup"
          value={readyHolds.length}
          foot={readyHolds.length > 0 ? 'Held at circulation desk' : 'No pending pickups'}
          icon={<Sparkles size={16} />}
          tone={readyHolds.length > 0 ? 'success' : 'info'}
        />
        <StatCard
          label="Unpaid Fines"
          value={formatCurrency(unpaidFinesTotal)}
          foot={
            unpaidFinesTotal > 0
              ? `Blocked at ${formatCurrency(fineThreshold)}`
              : 'Account in good standing'
          }
          icon={<Receipt size={16} />}
          tone={unpaidFinesTotal >= fineThreshold ? 'danger' : unpaidFinesTotal > 0 ? 'warning' : 'success'}
        />
        <StatCard
          label="Returned & Holds"
          value={bookshelf.returnHistory.length}
          foot={`${waitingHolds.length} waiting in queue`}
          icon={<BookCheck size={16} />}
          tone="success"
        />
      </section>

      <section className="card" aria-label="My bookshelf tabs">
        <div className="card-header bookshelf-tabs-header">
          <AccessibleTabs
            ariaLabel="My bookshelf sections"
            tabs={tabs}
            activeTab={activeTab}
            idPrefix={tabsPrefix}
            onChange={setActiveTab}
          />
        </div>

        <div
          role="tabpanel"
          aria-labelledby={`${tabsPrefix}-tab-loans`}
          hidden={activeTab !== 'loans'}
          tabIndex={activeTab === 'loans' && bookshelf.activeLoans.length === 0 ? 0 : undefined}
        >
          <div className="bookshelf-panel-body">
            {bookshelf.activeLoans.length === 0 ? (
              <EmptyState
                flat
                icon={<BookCheck size={22} />}
                title="No active loans"
                description="You have no books checked out right now. Explore the catalog to borrow or place holds."
                action={
                  <button type="button" className="btn btn-primary btn-sm" onClick={onBrowseCatalog}>
                    Browse Catalog
                  </button>
                }
              />
            ) : (
              <div className="bookshelf-loan-list">
                {bookshelf.activeLoans.map((loan) => {
                  const pct = loanProgressPercent(loan.borrowedOn, loan.dueOn, loan.returnedOn);
                  return (
                    <article key={loan.id} className="bookshelf-loan-card">
                      <div className="bookshelf-loan-lead">
                        <div className="highlight-cover-thumb" aria-hidden="true">
                          <BookCoverImage
                            book={buildLoanBookStub(loan)}
                            width={48}
                            height={64}
                            className="highlight-cover-img"
                          />
                        </div>
                        <div className="queue-row-main">
                          <div className="queue-row-top">
                            <span className="catalog-id-badge mono">{formatLoanCode(loan.id)}</span>
                            <span className="catalog-id-badge mono">
                              {loan.copyBarcode || formatCallNumber(loan.bookId)}
                            </span>
                            <StatusBadge tone={loan.overdue ? 'danger' : 'info'}>
                              {loan.overdue ? `${loan.overdueDays ?? 0}d Overdue` : 'Checked Out'}
                            </StatusBadge>
                            {(loan.fineAmount ?? 0) > 0 ? (
                              <span className="badge badge-danger tabular-nums">
                                Fine {formatCurrency(loan.fineAmount)}
                              </span>
                            ) : null}
                            <span className="renewal-pill tabular-nums">
                              Renewals {loan.renewalCount}/{loan.maxRenewals}
                            </span>
                          </div>
                          <h3 className="highlight-title">{loan.bookTitle}</h3>
                          <p className="queue-row-sub">
                            {loan.bookAuthor ? `${loan.bookAuthor} · ` : ''}
                            Borrowed {formatCalendarDate(loan.borrowedOn)} · Due{' '}
                            <strong className="tabular-nums">{formatCalendarDate(loan.dueOn)}</strong>{' '}
                            ·{' '}
                            <span style={loan.overdue ? { color: 'var(--danger)', fontWeight: 600 } : undefined}>
                              {describeLoanSchedule(loan.dueOn, loan.returnedOn, loan.overdue)}
                            </span>
                          </p>
                          <div className="loan-progress-track" aria-hidden="true">
                            <div
                              className="loan-progress-fill"
                              data-tone={loan.overdue ? 'danger' : pct >= 80 ? 'warning' : 'accent'}
                              style={{ transform: `scaleX(${pct / 100})` }}
                            />
                          </div>
                          {!loan.renewable && loan.renewDisabledReason ? (
                            <p className="bookshelf-renew-reason">{loan.renewDisabledReason}</p>
                          ) : null}
                        </div>
                      </div>

                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => onInspectBook(loan.bookId)}
                        >
                          <Eye size={14} aria-hidden="true" />
                          <span>Details</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={!loan.renewable || busyLoanId === loan.id}
                          title={loan.renewDisabledReason ?? 'Extend due date by 14 days'}
                          onClick={() => void handleRenew(loan)}
                        >
                          <RefreshCw size={14} aria-hidden="true" />
                          <span>
                            {busyLoanId === loan.id ? 'Renewing…' : 'Renew (+14d)'}
                          </span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div
          role="tabpanel"
          aria-labelledby={`${tabsPrefix}-tab-holds`}
          hidden={activeTab !== 'holds'}
          tabIndex={
            activeTab === 'holds' &&
            bookshelf.activeHolds.length === 0 &&
            bookshelf.pastHolds.length === 0
              ? 0
              : undefined
          }
        >
          <div className="bookshelf-panel-body form-stack">
            {bookshelf.activeHolds.length === 0 ? (
              <EmptyState
                flat
                icon={<CalendarClock size={22} />}
                title="No active holds"
                description="When a book you want is checked out, place a hold from the catalog to reserve the next returned copy."
                action={
                  <button type="button" className="btn btn-secondary btn-sm" onClick={onBrowseCatalog}>
                    Browse Catalog
                  </button>
                }
              />
            ) : (
              <div className="bookshelf-loan-list">
                {bookshelf.activeHolds.map((hold) => (
                  <article key={hold.id} className="bookshelf-loan-card">
                    <div className="bookshelf-loan-lead">
                      <div className="highlight-cover-thumb" aria-hidden="true">
                        <BookCoverImage
                          book={buildHoldBookStub(hold)}
                          width={48}
                          height={64}
                          className="highlight-cover-img"
                        />
                      </div>
                      <div className="queue-row-main">
                        <div className="queue-row-top">
                          <span className="catalog-id-badge mono">
                            {formatCallNumber(hold.bookId)}
                          </span>
                          {hold.status === 'READY_FOR_PICKUP' ? (
                            <StatusBadge tone="success">Ready for Pickup</StatusBadge>
                          ) : (
                            <StatusBadge tone="warning">
                              Waiting · #{hold.queuePosition} in Queue
                            </StatusBadge>
                          )}
                        </div>
                        <h3 className="highlight-title">{hold.bookTitle}</h3>
                        <p className="queue-row-sub">
                          {hold.bookAuthor} ·{' '}
                          {hold.status === 'READY_FOR_PICKUP' && hold.expiresOn
                            ? `Held at desk until ${formatCalendarDate(hold.expiresOn)}`
                            : 'You will be reserved automatically when returned'}
                        </p>
                      </div>
                    </div>
                    <div className="row-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => onInspectBook(hold.bookId)}
                      >
                        <Eye size={14} aria-hidden="true" />
                        <span>Details</span>
                      </button>
                      <button
                        type="button"
                        className="btn btn-soft-danger btn-sm"
                        disabled={busyHoldId === hold.id}
                        onClick={() => void handleCancel(hold)}
                      >
                        <XCircle size={14} aria-hidden="true" />
                        <span>{busyHoldId === hold.id ? 'Cancelling…' : 'Cancel Hold'}</span>
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}

            {bookshelf.pastHolds.length > 0 ? (
              <div className="form-stack" style={{ gap: '0.6rem' }}>
                <h3 className="card-title" style={{ fontSize: '0.95rem' }}>
                  Past Hold Activity
                </h3>
                <div className="queue-list" style={{ padding: 0 }}>
                  {bookshelf.pastHolds.map((hold) => (
                    <div key={hold.id} className="queue-row">
                      <div className="queue-row-main">
                        <div className="queue-row-top">
                          <span className="queue-row-title">{hold.bookTitle}</span>
                          <StatusBadge
                            tone={
                              hold.status === 'FULFILLED'
                                ? 'success'
                                : hold.status === 'EXPIRED'
                                  ? 'danger'
                                  : 'neutral'
                            }
                          >
                            {hold.status === 'FULFILLED'
                              ? 'Checked Out'
                              : hold.status === 'EXPIRED'
                                ? 'Expired'
                                : 'Cancelled'}
                          </StatusBadge>
                        </div>
                        <div className="queue-row-sub">
                          {hold.bookAuthor} · Placed {formatCalendarDate(hold.placedAt.slice(0, 10))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div
          role="tabpanel"
          aria-labelledby={`${tabsPrefix}-tab-history`}
          hidden={activeTab !== 'history'}
          tabIndex={activeTab === 'history' && bookshelf.returnHistory.length === 0 ? 0 : undefined}
        >
          <div className="bookshelf-panel-body">
            {bookshelf.returnHistory.length === 0 ? (
              <EmptyState
                flat
                icon={<History size={22} />}
                title="No returned books yet"
                description="Completed loans will appear here once you return borrowed volumes."
              />
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-labelledby={historyCaptionId}
                className="table-wrapper"
              >
                <table
                  className="data-table"
                  style={{
                    ['--label-2' as string]: '"Borrowed"',
                    ['--label-3' as string]: '"Returned"',
                    ['--label-4' as string]: '"Renewals"',
                    ['--label-5' as string]: '"Action"',
                  }}
                >
                  <caption id={historyCaptionId}>Your completed borrowing and return history</caption>
                  <thead>
                    <tr>
                      <th scope="col">Book</th>
                      <th scope="col">Borrowed On</th>
                      <th scope="col">Returned On</th>
                      <th scope="col">Renewals</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bookshelf.returnHistory.map((loan) => (
                      <tr key={loan.id}>
                        <th scope="row">
                          <div>{loan.bookTitle}</div>
                          <div className="mono table-subline">
                            {formatLoanCode(loan.id)} · {formatCallNumber(loan.bookId)}
                          </div>
                        </th>
                        <td className="tabular-nums">{formatCalendarDate(loan.borrowedOn)}</td>
                        <td className="tabular-nums">{formatCalendarDate(loan.returnedOn)}</td>
                        <td className="tabular-nums">
                          {loan.renewalCount}/{loan.maxRenewals}
                          {loan.fineStatus && loan.fineStatus !== 'NONE' ? (
                            <div className="table-subline">
                              Fine {formatCurrency(loan.fineAmount)} ({loan.fineStatus})
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => onInspectBook(loan.bookId)}
                          >
                            <Eye size={14} aria-hidden="true" />
                            <span>Inspect</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {fineLoans.length > 0 ? (
              <div className="form-stack" style={{ gap: '0.5rem', marginTop: '1rem' }}>
                <h3 className="card-title" style={{ fontSize: '0.95rem' }}>
                  Fine Ledger
                </h3>
                <div className="queue-list" style={{ padding: 0 }}>
                  {fineLoans.map((f) => (
                    <div key={f.id} className="queue-row">
                      <div className="queue-row-main">
                        <div className="queue-row-top">
                          <span className="catalog-id-badge mono">{formatLoanCode(f.id)}</span>
                          <StatusBadge
                            tone={
                              f.fineStatus === 'UNPAID'
                                ? 'danger'
                                : f.fineStatus === 'PAID'
                                  ? 'success'
                                  : 'neutral'
                            }
                          >
                            {f.fineStatus} · {formatCurrency(f.fineAmount)}
                          </StatusBadge>
                        </div>
                        <div className="queue-row-title">{f.bookTitle}</div>
                        {f.fineNote ? <div className="queue-row-sub">Note: {f.fineNote}</div> : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
