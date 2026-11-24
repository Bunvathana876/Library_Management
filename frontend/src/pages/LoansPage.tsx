import { useId, useMemo, useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  LogIn,
  Receipt,
  Repeat,
  Search,
  X,
} from 'lucide-react';
import { loansApi } from '@/api/loansApi';
import { useAuth } from '@/context/AuthContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { LoanResponse } from '@/types/api';
import {
  describeLoanSchedule,
  formatCalendarDate,
  loanProgressPercent,
} from '@/utils/dates';
import { formatApiErrorMessage } from '@/utils/errors';

interface LoansPageProps {
  activeLoans: LoanResponse[];
  overdueLoans: LoanResponse[];
  loading: boolean;
  onBorrowBook: () => void;
  onRequestReturnLoan: (loan: LoanResponse) => void;
}

type LoanTab = 'active' | 'overdue';

export function LoansPage({
  activeLoans,
  overdueLoans,
  loading,
  onBorrowBook,
  onRequestReturnLoan,
}: LoansPageProps) {
  const { isAuthenticated, isStaff, openSignInModal } = useAuth();
  const tableCaptionId = useId();

  const [loanTab, setLoanTab] = useState<LoanTab>('active');
  const [filterText, setFilterText] = useState('');

  const [lookupId, setLookupId] = useState('');
  const [lookupBusy, setLookupBusy] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [lookupLoan, setLookupLoan] = useState<LoanResponse | null>(null);

  const visibleLoans = useMemo(() => {
    const source = loanTab === 'overdue' ? overdueLoans : activeLoans;
    const q = filterText.trim().toLowerCase();
    if (!q) return source;
    return source.filter(
      (loan) =>
        loan.bookTitle.toLowerCase().includes(q) ||
        loan.memberName.toLowerCase().includes(q) ||
        String(loan.id).includes(q),
    );
  }, [loanTab, activeLoans, overdueLoans, filterText]);

  if (!isStaff) {
    return (
      <EmptyState
        icon={<Lock size={22} />}
        title={isAuthenticated ? 'Staff permissions required' : 'Sign in for Loans & Returns'}
        description={
          isAuthenticated
            ? 'Your current role cannot view circulation records. Sign in with a LIBRARIAN or ADMIN account.'
            : 'Authenticate with an ADMIN or LIBRARIAN account to inspect active loans, overdue alerts, and process returns.'
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

  return (
    <>
      <section className="card card-padded toolbar" aria-label="Loans filter and lookup controls">
        <div className="pill-group" role="tablist" aria-label="Loan views">
          <button
            type="button"
            role="tab"
            className="pill-btn"
            aria-selected={loanTab === 'active'}
            onClick={() => setLoanTab('active')}
          >
            <Repeat size={15} aria-hidden="true" />
            <span>Active Loans ({activeLoans.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            className="pill-btn"
            aria-selected={loanTab === 'overdue'}
            onClick={() => setLoanTab('overdue')}
          >
            <AlertTriangle size={15} aria-hidden="true" />
            <span>Overdue ({overdueLoans.length})</span>
          </button>
        </div>

        <div className="search-input-wrap" style={{ maxWidth: '340px' }}>
          <Search size={16} className="search-input-icon" aria-hidden="true" />
          <input
            type="search"
            className="input-control"
            enterKeyHint="search"
            aria-label="Filter loans by book, member, or loan ID"
            placeholder="Filter by book, member, or #ID…"
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
      </section>

      <section className="card card-padded form-stack" aria-labelledby="loan-lookup-heading">
        <div className="toolbar">
          <div>
            <h2 id="loan-lookup-heading" className="card-title">
              Loan Receipt Lookup
            </h2>
            <p className="card-subtitle">
              Inspect any active or already-returned loan record by ID via{' '}
              <code>GET /api/loans/&#123;id&#125;</code>
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
                <span className="mono queue-row-title">Loan #{lookupLoan.id}</span>
                <span className="queue-row-title">{lookupLoan.bookTitle}</span>
                <StatusBadge
                  tone={lookupLoan.returnedOn ? 'success' : lookupLoan.overdue ? 'danger' : 'info'}
                >
                  {lookupLoan.returnedOn ? 'Returned' : lookupLoan.overdue ? 'Overdue' : 'Active'}
                </StatusBadge>
              </div>
              <div className="queue-row-sub">
                Member: <strong>{lookupLoan.memberName}</strong> (#{lookupLoan.memberId}) · Borrowed{' '}
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
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onRequestReturnLoan(lookupLoan)}
                >
                  Return Book
                </button>
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

      {loading && activeLoans.length === 0 ? (
        <TableSkeleton rows={4} label="Loading active circulation records" />
      ) : visibleLoans.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={22} />}
          title={loanTab === 'overdue' ? 'No overdue loans' : 'No active loans found'}
          description={
            filterText
              ? `No loans matched "${filterText}".`
              : loanTab === 'overdue'
                ? 'Great news — every borrowed title is within its 14-day return window.'
                : 'Issue a book loan to track active checkouts here.'
          }
          action={
            filterText ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setFilterText('')}>
                Clear Filter
              </button>
            ) : loanTab === 'active' ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={onBorrowBook}>
                <Repeat size={15} aria-hidden="true" />
                <span>Borrow Book</span>
              </button>
            ) : undefined
          }
        />
      ) : (
        <section className="card" aria-label="Loans table">
          <div className="card-header">
            <div>
              <h2 className="card-title">
                {loanTab === 'overdue' ? 'Overdue Loans' : 'Active Loans'}
              </h2>
              <p className="card-subtitle">
                Ordered by earliest due date first · {visibleLoans.length} record
                {visibleLoans.length === 1 ? '' : 's'}
              </p>
            </div>
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
                {visibleLoans.map((loan) => {
                  const pct = loanProgressPercent(loan.borrowedOn, loan.dueOn, loan.returnedOn);
                  return (
                    <tr key={loan.id}>
                      <th scope="row">
                        <div>{loan.bookTitle}</div>
                        <div className="mono table-subline">
                          Loan #{loan.id} · Book #{loan.bookId}
                        </div>
                      </th>
                      <td>
                        <div>{loan.memberName}</div>
                        <div className="mono table-subline">Member #{loan.memberId}</div>
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
                        <div className="loan-progress-track" aria-hidden="true">
                          <div
                            className="loan-progress-fill"
                            data-tone={loan.overdue ? 'danger' : pct >= 80 ? 'warning' : 'accent'}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </td>
                      <td>
                        <StatusBadge tone={loan.overdue ? 'danger' : 'info'}>
                          {loan.overdue ? 'Overdue' : 'Active'}
                        </StatusBadge>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => onRequestReturnLoan(loan)}
                        >
                          Return Book
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  );
}
