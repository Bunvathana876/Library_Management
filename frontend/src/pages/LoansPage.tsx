import { useId, useMemo, useState, type FormEvent } from 'react';
import {
  Camera,
  CheckCircle2,
  Clock,
  Lock,
  LogIn,
  Receipt,
  Search,
  X,
} from 'lucide-react';
import { loansApi } from '@/api/loansApi';
import type { ScannerMode } from '@/components/forms/CirculationScannerModal';
import { AccessibleTabs, type TabItem } from '@/components/ui/AccessibleTabs';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useAuth } from '@/context/AuthContext';
import type { HoldResponse, LoanResponse } from '@/types/api';
import {
  describeLoanSchedule,
  formatCalendarDate,
} from '@/utils/dates';
import { formatApiErrorMessage } from '@/utils/errors';
import {
  formatCallNumber,
  formatCurrency,
  formatFineStatus,
  formatLoanCode,
  formatMemberCardCode,
} from '@/utils/formatting';

interface LoansPageProps {
  activeLoans: LoanResponse[];
  overdueLoans: LoanResponse[];
  fineLoans: LoanResponse[];
  activeHolds: HoldResponse[];
  loading: boolean;
  onBorrowBook: () => void;
  onOpenScanner: (mode: ScannerMode) => void;
  onRequestReturnLoan: (loan: LoanResponse) => void;
  onRenewLoan: (loan: LoanResponse) => Promise<void>;
  onPayFine: (loan: LoanResponse, note?: string) => Promise<void>;
  onWaiveFine: (loan: LoanResponse, note?: string) => Promise<void>;
  onFulfillHold: (hold: HoldResponse) => Promise<void>;
  onCancelHold: (hold: HoldResponse) => Promise<void>;
}

type LoanTab = 'active' | 'overdue' | 'holds' | 'fines';

export function LoansPage({
  activeLoans,
  overdueLoans,
  fineLoans,
  activeHolds,
  loading,
  onBorrowBook,
  onOpenScanner,
  onRequestReturnLoan,
  onRenewLoan,
  onPayFine,
  onWaiveFine,
  onFulfillHold,
  onCancelHold,
}: LoansPageProps) {
  const { isAuthenticated, isStaff, openSignInModal } = useAuth();
  const tableCaptionId = useId();
  const holdsCaptionId = useId();
  const finesCaptionId = useId();
  const tabsPrefix = useId();

  const [loanTab, setLoanTab] = useState<LoanTab>('active');
  const [filterText, setFilterText] = useState('');

  const [lookupId, setLookupId] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoan, setLookupLoan] = useState<LoanResponse | null>(null);

  const [busyLoanId, setBusyLoanId] = useState<number | null>(null);
  const [busyHoldId, setBusyHoldId] = useState<number | null>(null);

  const visibleLoans = useMemo(() => {
    const source = loanTab === 'overdue' ? overdueLoans : activeLoans;
    const q = filterText.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (loan) =>
        loan.bookTitle.toLowerCase().includes(q) ||
        loan.memberName.toLowerCase().includes(q) ||
        String(loan.id).includes(q) ||
        formatLoanCode(loan.id).toLowerCase().includes(q) ||
        (loan.copyBarcode ? loan.copyBarcode.toLowerCase().includes(q) : false),
    );
  }, [loanTab, activeLoans, overdueLoans, filterText]);

  const visibleHolds = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return activeHolds;
    return activeHolds.filter(
      (hold) =>
        hold.bookTitle.toLowerCase().includes(q) ||
        hold.memberName.toLowerCase().includes(q) ||
        hold.memberEmail.toLowerCase().includes(q) ||
        String(hold.bookId).includes(q),
    );
  }, [activeHolds, filterText]);

  const visibleFines = useMemo(() => {
    const q = filterText.trim().toLowerCase();
    if (!q) return fineLoans;
    return fineLoans.filter(
      (loan) =>
        loan.bookTitle.toLowerCase().includes(q) ||
        loan.memberName.toLowerCase().includes(q) ||
        String(loan.id).includes(q) ||
        formatLoanCode(loan.id).toLowerCase().includes(q),
    );
  }, [fineLoans, filterText]);

  if (!isStaff) {
    return (
      <EmptyState
        icon={<Lock size={22} />}
        title={isAuthenticated ? 'Staff permissions required' : 'Sign in for Loans & Returns'}
        description={
          isAuthenticated
            ? 'Your current role cannot view the circulation desk. Sign in with a librarian or administrator account, or manage your personal loans in My Bookshelf.'
            : 'Sign in with a librarian or administrator account to manage active loans, overdue returns, reservations, and fines.'
        }
        action={
          !isAuthenticated ? (
            <button type="button" className="btn btn-primary" onClick={openSignInModal}>
              <LogIn size={16} aria-hidden="true" />
              <span>Sign In</span>
            </button>
          ) : undefined
        }
      />
    );
  }

  const handleLookup = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const idNum = Number.parseInt(lookupId.trim(), 10);
    if (!Number.isFinite(idNum) || idNum <= 0) {
      setLookupError('Enter a positive loan ID number.');
      setLookupLoan(null);
      return;
    }

    setLookupBusy(true);
    setLookupError(null);
    try {
      const found = await loansApi.getLoanById(idNum);
      setLookupLoan(found);
    } catch (err) {
      setLookupLoan(null);
      setLookupError(formatApiErrorMessage(err));
    } finally {
      setLookupBusy(false);
    }
  };

  const handleRenew = async (loan: LoanResponse) => {
    setBusyLoanId(loan.id);
    try {
      await onRenewLoan(loan);
      if (lookupLoan && lookupLoan.id === loan.id) {
        const refreshed = await loansApi.getLoanById(loan.id);
        setLookupLoan(refreshed);
      }
    } finally {
      setBusyLoanId(null);
    }
  };

  const handlePayFine = async (loan: LoanResponse) => {
    setBusyLoanId(loan.id);
    try {
      await onPayFine(loan);
    } finally {
      setBusyLoanId(null);
    }
  };

  const handleWaiveFine = async (loan: LoanResponse) => {
    setBusyLoanId(loan.id);
    try {
      await onWaiveFine(loan);
    } finally {
      setBusyLoanId(null);
    }
  };

  const handleFulfill = async (hold: HoldResponse) => {
    setBusyHoldId(hold.id);
    try {
      await onFulfillHold(hold);
    } finally {
      setBusyHoldId(null);
    }
  };

  const handleCancelHold = async (hold: HoldResponse) => {
    setBusyHoldId(hold.id);
    try {
      await onCancelHold(hold);
    } finally {
      setBusyHoldId(null);
    }
  };

  const unpaidFinesCount = fineLoans.filter((l) => l.fineStatus === 'UNPAID').length;
  const readyHoldCount = activeHolds.filter((h) => h.status === 'READY_FOR_PICKUP').length;

  const tabs: ReadonlyArray<TabItem<LoanTab>> = [
    { id: 'active', label: 'Active Loans', count: activeLoans.length },
    { id: 'overdue', label: 'Overdue', count: overdueLoans.length },
    { id: 'holds', label: 'Holds Queue', count: activeHolds.length },
    { id: 'fines', label: 'Fines Desk', count: unpaidFinesCount },
  ];

  return (
    <>
      <section className="page-intro" aria-label="Circulation desk summary">
        <div>
          <div className="eyebrow">Circulation desk</div>
          <h2>Loans, reservations &amp; fines</h2>
          <p>
            {loading && activeLoans.length === 0
              ? 'Loading circulation ledger…'
              : `${activeLoans.length} active checkouts · ${overdueLoans.length} overdue · ${readyHoldCount} ready at desk`}
          </p>
        </div>
      </section>

      <section className="toolbar" aria-label="Loans filter and lookup controls">
        <AccessibleTabs
          ariaLabel="Circulation views"
          tabs={tabs}
          activeTab={loanTab}
          idPrefix={tabsPrefix}
          onChange={setLoanTab}
        />

        <div className="toolbar-group loans-toolbar-actions">
          <div className="search-input-wrap loans-filter-input">
            <Search size={16} className="search-input-icon" aria-hidden="true" />
            <input
              type="search"
              className="input-control"
              enterKeyHint="search"
              aria-label="Filter loans, fines, or holds by book, member, or ID"
              placeholder="Filter book, member, or ID"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
            />
            {filterText ? (
              <button
                type="button"
                className="search-clear-btn"
                onClick={() => setFilterText('')}
                aria-label="Clear loan filter"
              >
                <X size={15} aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ whiteSpace: 'nowrap', flexShrink: 0 }}
            onClick={() => onOpenScanner('return')}
          >
            <Camera size={15} aria-hidden="true" />
            <span>Scan Return</span>
          </button>
        </div>
      </section>

      <details className="lookup-disclosure">
        <summary>Find a loan receipt by ID</summary>
        <section className="card form-stack" aria-labelledby="loan-lookup-heading">
          <div className="toolbar">
            <div>
              <h3 id="loan-lookup-heading" className="card-title">
                Loan Receipt Lookup
              </h3>
              <p className="card-subtitle">
                Look up any active or returned loan record by its loan ID
              </p>
            </div>
            <form onSubmit={handleLookup} className="lookup-form">
              <input
                type="number"
                min={1}
                step={1}
                className="input-control lookup-input"
                aria-label="Loan ID number"
                placeholder="Loan ID (e.g. 1)"
                value={lookupId}
                onChange={(e) => setLookupId(e.target.value)}
              />
              <button type="submit" className="btn btn-secondary btn-sm" disabled={lookupBusy}>
                <Receipt size={15} aria-hidden="true" />
                <span>{lookupBusy ? 'Looking up…' : 'Lookup Loan'}</span>
              </button>
            </form>
          </div>

          {lookupError ? (
            <div className="alert alert-danger" role="alert">
              <span>{lookupError}</span>
            </div>
          ) : null}

          {lookupLoan ? (
            <div className="receipt-card">
              <div className="queue-row-main">
                <div className="queue-row-top">
                  <span className="mono queue-row-title">{formatLoanCode(lookupLoan.id)}</span>
                  {lookupLoan.copyBarcode ? (
                    <span className="catalog-id-badge mono">{lookupLoan.copyBarcode}</span>
                  ) : null}
                  <span className="queue-row-title">{lookupLoan.bookTitle}</span>
                  <StatusBadge
                    tone={lookupLoan.returnedOn ? 'success' : lookupLoan.overdue ? 'danger' : 'info'}
                  >
                    {lookupLoan.returnedOn ? 'Returned' : lookupLoan.overdue ? 'Overdue' : 'Active'}
                  </StatusBadge>
                  <span className="renewal-pill tabular-nums">
                    Renewals {lookupLoan.renewalCount}/{lookupLoan.maxRenewals}
                  </span>
                  {(lookupLoan.fineAmount ?? 0) > 0 ? (
                    <span className="badge badge-warning tabular-nums">
                      Fine {formatCurrency(lookupLoan.fineAmount)} ({formatFineStatus(lookupLoan.fineStatus)})
                    </span>
                  ) : null}
                </div>
                <div className="queue-row-sub">
                  Member: <strong>{lookupLoan.memberName}</strong> ({formatMemberCardCode(lookupLoan.memberId)}) · Borrowed{' '}
                  {formatCalendarDate(lookupLoan.borrowedOn)} · Due{' '}
                  {formatCalendarDate(lookupLoan.dueOn)} ·{' '}
                  {describeLoanSchedule(
                    lookupLoan.dueOn,
                    lookupLoan.returnedOn,
                    lookupLoan.overdue,
                  )}
                </div>
              </div>
              <div className="row-actions">
                {!lookupLoan.returnedOn ? (
                  <>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      disabled={!lookupLoan.renewable || busyLoanId === lookupLoan.id}
                      title={lookupLoan.renewDisabledReason ?? 'Extend due date by 14 days'}
                      onClick={() => void handleRenew(lookupLoan)}
                    >
                      <span>{busyLoanId === lookupLoan.id ? 'Renewing…' : 'Renew (+14d)'}</span>
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => onRequestReturnLoan(lookupLoan)}
                    >
                      Return Book
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setLookupLoan(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          ) : null}
        </section>
      </details>

      <div
        role="tabpanel"
        aria-labelledby={`${tabsPrefix}-tab-${loanTab}`}
        tabIndex={
          (loanTab === 'holds' && visibleHolds.length === 0) ||
          (loanTab === 'fines' && visibleFines.length === 0) ||
          ((loanTab === 'active' || loanTab === 'overdue') && visibleLoans.length === 0)
            ? 0
            : undefined
        }
      >
        {loanTab === 'fines' ? (
          loading && fineLoans.length === 0 ? (
            <TableSkeleton rows={4} label="Loading overdue fines ledger" />
          ) : visibleFines.length === 0 ? (
            <EmptyState
              flat
              icon={<CheckCircle2 size={22} />}
              title={filterText ? 'No matching fine records' : 'No overdue fines recorded'}
              description={
                filterText
                  ? `No fine records matched "${filterText}".`
                  : 'All active and returned loans have zero outstanding overdue fines.'
              }
              action={
                filterText ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFilterText('')}>
                    Clear Filter
                  </button>
                ) : undefined
              }
            />
          ) : (
            <section className="ledger-section" aria-label="Overdue fines management">
              <div className="ledger-caption-bar">
                <span>Return an overdue book before recording payment or waiving its fine</span>
                <span className="tabular-nums">
                  {visibleFines.length} {visibleFines.length === 1 ? 'record' : 'records'}
                </span>
              </div>

              <div
                tabIndex={0}
                role="region"
                aria-labelledby={finesCaptionId}
                className="table-wrapper"
              >
                <table
                  className="data-table"
                  style={{
                    ['--label-2' as string]: '"Member"',
                    ['--label-3' as string]: '"Return State"',
                    ['--label-4' as string]: '"Fine"',
                    ['--label-5' as string]: '"Action"',
                  }}
                >
                  <caption id={finesCaptionId}>Overdue fine accruals and settlement status</caption>
                  <thead>
                    <tr>
                      <th scope="col">Book &amp; Loan ID</th>
                      <th scope="col">Member</th>
                      <th scope="col">Return State</th>
                      <th scope="col">Fine &amp; Status</th>
                      <th scope="col">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleFines.map((loan) => (
                      <tr key={loan.id}>
                        <th scope="row">
                          <div>{loan.bookTitle}</div>
                          <div className="mono table-subline">
                            {formatLoanCode(loan.id)} · {loan.copyBarcode || formatCallNumber(loan.bookId)}
                          </div>
                        </th>
                        <td>
                          <div>{loan.memberName}</div>
                          <div className="mono table-subline">{formatMemberCardCode(loan.memberId)}</div>
                        </td>
                        <td>
                          {loan.returnedOn ? (
                            <div>
                              Returned <span className="tabular-nums">{formatCalendarDate(loan.returnedOn)}</span>
                              <div className="table-subline">{loan.overdueDays ?? 0} days overdue</div>
                            </div>
                          ) : (
                            <div>
                              <span style={{ color: 'var(--danger)', fontWeight: 600 }}>Still checked out</span>
                              <div className="table-subline">{loan.overdueDays ?? 0} days overdue (accruing)</div>
                            </div>
                          )}
                        </td>
                        <td>
                          <div className="form-stack" style={{ gap: '4px', alignItems: 'flex-start' }}>
                            <StatusBadge
                              tone={
                                loan.fineStatus === 'UNPAID'
                                  ? 'danger'
                                  : loan.fineStatus === 'PAID'
                                    ? 'success'
                                    : 'neutral'
                              }
                            >
                              {formatFineStatus(loan.fineStatus)} · {formatCurrency(loan.fineAmount)}
                            </StatusBadge>
                            {loan.fineNote ? <span className="table-subline">{loan.fineNote}</span> : null}
                          </div>
                        </td>
                        <td>
                          {!loan.returnedOn ? (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => onRequestReturnLoan(loan)}
                            >
                              Return First
                            </button>
                          ) : loan.fineStatus === 'UNPAID' ? (
                            <div className="row-actions">
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={busyLoanId === loan.id}
                                onClick={() => void handlePayFine(loan)}
                              >
                                {busyLoanId === loan.id ? 'Saving…' : 'Mark Paid'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                disabled={busyLoanId === loan.id}
                                onClick={() => void handleWaiveFine(loan)}
                              >
                                Waive
                              </button>
                            </div>
                          ) : (
                            <span className="text-muted" style={{ fontSize: 'var(--text-sm)' }}>
                              Settled {loan.fineSettledAt ? formatCalendarDate(loan.fineSettledAt.slice(0, 10)) : ''}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        ) : loanTab === 'holds' ? (
          loading && activeHolds.length === 0 ? (
            <TableSkeleton rows={4} label="Loading holds queue" />
          ) : visibleHolds.length === 0 ? (
            <EmptyState
              flat
              icon={<Clock size={22} />}
              title={filterText ? 'No matching holds' : 'Holds queue is empty'}
              description={
                filterText
                  ? `No holds matched "${filterText}".`
                  : 'When members reserve checked-out titles, ready pickups and waiting queues appear here.'
              }
              action={
                filterText ? (
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFilterText('')}>
                    Clear Filter
                  </button>
                ) : undefined
              }
            />
          ) : (
            <section className="ledger-section" aria-label="Reservations and holds queue">
              <div className="ledger-caption-bar">
                <span>Ready-for-pickup copies held at desk appear first, followed by waiting queues</span>
                <span className="tabular-nums">
                  {visibleHolds.length} {visibleHolds.length === 1 ? 'reservation' : 'reservations'}
                </span>
              </div>

              <div
                tabIndex={0}
                role="region"
                aria-labelledby={holdsCaptionId}
                className="table-wrapper"
              >
                <table
                  className="data-table"
                  style={{
                    ['--label-2' as string]: '"Patron"',
                    ['--label-3' as string]: '"Queue / Status"',
                    ['--label-4' as string]: '"Window"',
                    ['--label-5' as string]: '"Actions"',
                  }}
                >
                  <caption id={holdsCaptionId}>Active reservations and pickup holds</caption>
                  <thead>
                    <tr>
                      <th scope="col">Book</th>
                      <th scope="col">Member</th>
                      <th scope="col">Status</th>
                      <th scope="col">Placed / Expires</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleHolds.map((hold) => (
                      <tr key={hold.id}>
                        <th scope="row">
                          <div>{hold.bookTitle}</div>
                          <div className="mono table-subline">
                            {hold.copyBarcode || formatCallNumber(hold.bookId)} · Hold #{hold.id}
                          </div>
                        </th>
                        <td>
                          <div>{hold.memberName}</div>
                          <div className="table-subline">
                            <span className="mono">{formatMemberCardCode(hold.memberId)}</span> ·{' '}
                            {hold.memberEmail}
                          </div>
                        </td>
                        <td>
                          {hold.status === 'READY_FOR_PICKUP' ? (
                            <StatusBadge tone="success">Ready for pickup</StatusBadge>
                          ) : (
                            <StatusBadge tone="warning">
                              Waiting · #{hold.queuePosition} in queue
                            </StatusBadge>
                          )}
                        </td>
                        <td className="tabular-nums">
                          {hold.status === 'READY_FOR_PICKUP' && hold.expiresOn ? (
                            <div>
                              <strong>Pick up by {formatCalendarDate(hold.expiresOn)}</strong>
                            </div>
                          ) : (
                            <div>Placed {formatCalendarDate(hold.placedAt.slice(0, 10))}</div>
                          )}
                        </td>
                        <td>
                          <div className="row-actions">
                            {hold.status === 'READY_FOR_PICKUP' ? (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={busyHoldId === hold.id}
                                onClick={() => void handleFulfill(hold)}
                              >
                                {busyHoldId === hold.id ? 'Issuing…' : 'Checkout to Holder'}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="btn btn-soft-danger btn-sm"
                              disabled={busyHoldId === hold.id}
                              onClick={() => void handleCancelHold(hold)}
                            >
                              <span>Cancel</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )
        ) : loading && activeLoans.length === 0 ? (
          <TableSkeleton rows={4} label="Loading active circulation records" />
        ) : visibleLoans.length === 0 ? (
          <EmptyState
            flat
            icon={<CheckCircle2 size={22} />}
            title={loanTab === 'overdue' ? 'No overdue loans' : 'No active loans found'}
            description={
              filterText
                ? `No loans matched "${filterText}".`
                : loanTab === 'overdue'
                  ? 'All active loans are within their return dates.'
                  : 'Issue a book loan to track active checkouts here.'
            }
            action={
              filterText ? (
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFilterText('')}>
                  Clear Filter
                </button>
              ) : loanTab === 'active' ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={onBorrowBook}>
                  <span>Borrow Book</span>
                </button>
              ) : undefined
            }
          />
        ) : (
          <section className="ledger-section" aria-label="Loans table">
            <div className="ledger-caption-bar">
              <span>Ordered by earliest due date first</span>
              <span className="tabular-nums">
                {visibleLoans.length} {visibleLoans.length === 1 ? 'record' : 'records'}
              </span>
            </div>

            <div
              tabIndex={0}
              role="region"
              aria-labelledby={tableCaptionId}
              className="table-wrapper"
            >
              <table
                className="data-table"
                style={{
                  ['--label-2' as string]: '"Member"',
                  ['--label-3' as string]: '"Borrowed"',
                  ['--label-4' as string]: '"Due Date"',
                  ['--label-5' as string]: '"Status"',
                  ['--label-6' as string]: '"Action"',
                }}
              >
                <caption id={tableCaptionId}>Active library book loans and due dates</caption>
                <thead>
                  <tr>
                    <th scope="col">Book &amp; Loan ID</th>
                    <th scope="col">Member</th>
                    <th scope="col">Borrowed On</th>
                    <th scope="col">Due Date</th>
                    <th scope="col">Status</th>
                    <th scope="col">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleLoans.map((loan) => (
                    <tr key={loan.id}>
                      <th scope="row">
                        <div>{loan.bookTitle}</div>
                        <div className="mono table-subline">
                          {formatLoanCode(loan.id)} · {loan.copyBarcode || formatCallNumber(loan.bookId)}
                        </div>
                      </th>
                      <td>
                        <div>{loan.memberName}</div>
                        <div className="mono table-subline">
                          {formatMemberCardCode(loan.memberId)}
                        </div>
                      </td>
                      <td className="tabular-nums">{formatCalendarDate(loan.borrowedOn)}</td>
                      <td>
                        <div className="tabular-nums" style={{ fontWeight: 600 }}>
                          {formatCalendarDate(loan.dueOn)}
                        </div>
                        <div
                          className="table-subline"
                          style={loan.overdue ? { color: 'var(--danger)' } : undefined}
                        >
                          {describeLoanSchedule(loan.dueOn, loan.returnedOn, loan.overdue)}
                        </div>
                      </td>
                      <td>
                        <div className="form-stack" style={{ gap: '4px', alignItems: 'flex-start' }}>
                          <StatusBadge tone={loan.overdue ? 'danger' : 'info'}>
                            {loan.overdue ? `${loan.overdueDays ?? 0}d Overdue` : 'Active'}
                          </StatusBadge>
                          {(loan.fineAmount ?? 0) > 0 ? (
                            <span className="badge badge-danger tabular-nums">
                              Fine {formatCurrency(loan.fineAmount)}
                            </span>
                          ) : null}
                          <span className="renewal-pill tabular-nums">
                            Renewals {loan.renewalCount}/{loan.maxRenewals}
                          </span>
                          {loan.hasActiveHold ? (
                            <span className="table-subline" style={{ color: 'var(--warning)' }}>
                              Hold queued
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={!loan.renewable || busyLoanId === loan.id}
                            title={loan.renewDisabledReason ?? 'Extend due date by 14 days'}
                            aria-label={`Renew Loan #${loan.id}: ${loan.bookTitle}`}
                            onClick={() => void handleRenew(loan)}
                          >
                            <span>{busyLoanId === loan.id ? 'Renewing…' : 'Renew (+14d)'}</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            aria-label={`Return Book: ${loan.bookTitle} (Loan #${loan.id})`}
                            onClick={() => onRequestReturnLoan(loan)}
                          >
                            Return Book
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </>
  );
}
