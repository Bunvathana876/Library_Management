import { ArrowRight, BookOpen, Camera, Plus, Repeat, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { BookCoverImage } from '@/components/ui/BookCoverImage';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { NavTab } from '@/components/layout/Sidebar';
import type { Book, HoldResponse, LoanResponse, Member, MemberBookshelfResponse } from '@/types/api';
import { describeLoanSchedule, formatCalendarDate } from '@/utils/dates';
import { formatCurrency } from '@/utils/formatting';
import { getInventorySummary } from '@/utils/inventory';

interface OverviewPageProps {
  books: Book[];
  activeLoans: LoanResponse[];
  overdueLoans: LoanResponse[];
  members: Member[];
  activeHolds?: HoldResponse[];
  bookshelf?: MemberBookshelfResponse | null;
  loadingBooks: boolean;
  loadingStaff?: boolean;
  staffError?: string | null;
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

export function OverviewPage({ books, activeLoans, overdueLoans, members, activeHolds = [], bookshelf = null,
  loadingBooks, loadingStaff = false, staffError, booksError, onRetryBooks, onNavigate, onInspectBook,
  onOpenAddBook, onOpenBorrowBook, onOpenScanner, onOpenRegisterMember, onRequestReturnLoan,
}: OverviewPageProps) {
  const { isAuthenticated, isStaff, openRegisterModal } = useAuth();
  const inventory = getInventorySummary(books);
  const inventoryPending = loadingBooks || Boolean(booksError);
  const staffPending = loadingStaff || Boolean(staffError);
  const readyHolds = activeHolds.filter(hold => hold.status === 'READY_FOR_PICKUP');
  const priorityLoans = [...activeLoans].sort((a, b) => a.dueOn.localeCompare(b.dueOn)).slice(0, 6);
  const recentLoans = [...activeLoans].sort((a, b) => b.borrowedOn.localeCompare(a.borrowedOn) || b.id - a.id).slice(0, 4);
  const fineTotal = members.reduce((total, member) => total + (member.unpaidFinesTotal ?? 0), 0);
  const displayStaff = (value: number | string) => staffPending ? '—' : value;

  const catalogError = booksError ? <div className="alert alert-danger alert-row" role="alert">
    <span>{booksError}</span>{onRetryBooks ? <button className="btn btn-secondary btn-sm" onClick={onRetryBooks}>Retry catalog</button> : null}
  </div> : null;

  if (!isStaff) return <>
    <section className="page-intro">
      <div><div className="eyebrow">Athenaeum library</div><h2>A place for your next chapter.</h2>
        <p>Explore the collection, borrow a book, and keep track of your reading.</p></div>
      <button className="btn btn-primary" onClick={() => onNavigate('books')}>Browse Catalog <ArrowRight size={16} aria-hidden="true" /></button>
    </section>
    {isAuthenticated && bookshelf ? <section className="reader-summary" aria-label="Your borrowing summary">
      <div><strong>{bookshelf.fullName}</strong><p>{bookshelf.activeLoans.length} books on loan · {bookshelf.activeHolds.length} reservations</p></div>
      <button className="btn btn-secondary" onClick={() => onNavigate('bookshelf')}>My Bookshelf <ArrowRight size={16} aria-hidden="true" /></button>
    </section> : !isAuthenticated ? <div className="reader-summary">
      <p>A library account lets you borrow books and reserve your next read.</p>
      <button className="btn btn-secondary" onClick={openRegisterModal}>Create Account</button>
    </div> : null}
    {catalogError}
    <section className="overview-section" aria-labelledby="collection-heading">
      <div className="overview-section-header"><h3 id="collection-heading">From the collection</h3><span className="text-secondary">{loadingBooks ? 'Loading…' : booksError ? 'Unavailable' : `${books.length} catalog titles`}</span></div>
      {loadingBooks && !books.length ? <TableSkeleton rows={3} label="Loading the collection" /> : !books.length && !booksError ? <EmptyState flat icon={<BookOpen size={22} />} title="The collection is being prepared" description="Books will appear here when they are added to the library." /> : <div className="recent-books">
        {books.slice(0, 6).map(book => <article className="recent-book" key={book.id}>
          <div className="highlight-cover-thumb" aria-hidden="true"><BookCoverImage book={book} width={64} height={96} loading="lazy" className="highlight-cover-img" /></div>
          <div><h4 className="highlight-title">{book.title}</h4><p className="queue-row-sub">{book.author}</p>
            <p className="queue-row-sub">{book.available ? 'Available to borrow' : book.reservedForPickup ? 'Reserved for pickup' : 'Currently unavailable'}</p>
            <button className="btn btn-ghost btn-sm" aria-label={`Details: ${book.title}`} onClick={() => onInspectBook(book.id)}>Details <ArrowRight size={14} aria-hidden="true" /></button>
          </div>
        </article>)}
      </div>}
    </section>
  </>;

  return <>
    <section className="page-intro">
      <div><div className="eyebrow">Circulation overview</div><h2>At the library desk</h2><p>Returns, reservations and the collection at a glance.</p></div>
      <div className="row-actions">
        {onOpenScanner ? <button className="btn btn-secondary" onClick={onOpenScanner}><Camera size={16} aria-hidden="true" /> Scan a code</button> : null}
        <button className="btn btn-primary" onClick={onOpenBorrowBook}><Repeat size={16} aria-hidden="true" /> Issue Loan</button>
      </div>
    </section>
    {catalogError}
    <dl className="operational-summary" aria-label="Library metrics" aria-busy={loadingBooks || loadingStaff}>
      <div><dt>Available copies</dt><dd>{inventoryPending ? '—' : inventory.available ?? '—'}</dd><small>{inventoryPending ? 'Inventory unavailable' : inventory.total === null ? 'Copy counts unavailable' : `of ${inventory.total} physical copies`}</small></div>
      <div><dt>Active loans</dt><dd>{displayStaff(activeLoans.length)}</dd><small>Currently checked out</small></div>
      <div><dt>Overdue loans</dt><dd className={overdueLoans.length ? 'attention-number' : undefined}>{displayStaff(overdueLoans.length)}</dd><small>Return follow-up needed</small></div>
      <div><dt>Ready for pickup</dt><dd>{displayStaff(readyHolds.length)}</dd><small>{staffPending ? 'Reservations unavailable' : `${activeHolds.length} total reservations`}</small></div>
    </dl>
    <div className="two-col-grid">
      <section className="overview-section" aria-labelledby="priority-loans-heading">
        <div className="overview-section-header"><div><h3 id="priority-loans-heading">Returns to follow up</h3><p className="card-subtitle">Earliest due dates first</p></div><button className="btn btn-ghost btn-sm" onClick={() => onNavigate('loans')}>Open Loans Desk <ArrowRight size={14} aria-hidden="true" /></button></div>
        {loadingStaff ? <TableSkeleton rows={4} label="Loading circulation" /> : staffError ? <p className="field-hint">Circulation data could not be loaded. Retry using the message above.</p> : !priorityLoans.length ? <EmptyState flat icon={<Repeat size={22} />} title="No active loans" description="New checkouts will appear here." action={<button className="btn btn-secondary" onClick={onOpenBorrowBook}>Issue a loan</button>} /> : <div className="queue-list operational-queue">
          {priorityLoans.map(loan => <div className="queue-row" key={loan.id}>
            <div className="queue-row-main"><div className="queue-row-top"><span className="queue-row-title">{loan.bookTitle}</span>{loan.overdue ? <StatusBadge tone="danger">Overdue</StatusBadge> : null}</div>
              <p className="queue-row-sub">{loan.memberName} · Due {formatCalendarDate(loan.dueOn)}</p><p className="queue-row-sub">{describeLoanSchedule(loan.dueOn, loan.returnedOn, loan.overdue)}</p>
            </div>
            <button className="btn btn-secondary btn-sm" aria-label={`Return Book: ${loan.bookTitle}`} onClick={() => onRequestReturnLoan(loan)}>Return Book</button>
          </div>)}
        </div>}
      </section>
      <div className="overview-side-stack">
        <section className="overview-section" aria-labelledby="attention-heading">
          <div className="overview-section-header"><h3 id="attention-heading">Desk priorities</h3></div>
          <button className="task-link" onClick={() => onNavigate('loans')}><span>Reservations waiting</span><strong>{displayStaff(activeHolds.filter(h => h.status === 'WAITING').length)}</strong></button>
          <button className="task-link" onClick={() => onNavigate('loans')}><span>Outstanding fines</span><strong>{displayStaff(formatCurrency(fineTotal))}</strong></button>
          <button className="task-link" onClick={() => onNavigate('members')}><span>Active members</span><strong>{displayStaff(members.filter(m => m.active !== false).length)}</strong></button>
        </section>
        <section className="overview-section" aria-labelledby="collection-summary-heading">
          <div className="overview-section-header"><h3 id="collection-summary-heading">Collection inventory</h3></div>
          <dl className="detail-stats"><div><dt>Catalog titles</dt><dd>{inventoryPending ? '—' : books.length}</dd></div><div><dt>Copies on loan</dt><dd>{inventoryPending ? '—' : inventory.loaned ?? '—'}</dd></div><div><dt>Copies reserved</dt><dd>{inventoryPending ? '—' : inventory.onHold ?? '—'}</dd></div></dl>
          <div className="row-actions section-actions"><button className="btn btn-secondary btn-sm" onClick={onOpenAddBook}><Plus size={14} aria-hidden="true" /> Add book</button><button className="btn btn-ghost btn-sm" onClick={onOpenRegisterMember}><UserPlus size={14} aria-hidden="true" /> Register member</button></div>
        </section>
      </div>
    </div>
    <section className="overview-section" aria-labelledby="recent-checkouts-heading">
      <div className="overview-section-header"><h3 id="recent-checkouts-heading">Latest active checkouts</h3><span className="field-hint">Current loans, newest first</span></div>
      {staffPending ? <p className="field-hint section-actions">Circulation data unavailable while loading or retrying.</p> : recentLoans.length ? <div className="activity-list">{recentLoans.map(loan => <div key={loan.id} className="activity-row"><div><strong>{loan.bookTitle}</strong><p className="queue-row-sub">{loan.memberName} · {loan.copyBarcode}</p></div><span className="text-secondary">{formatCalendarDate(loan.borrowedOn)}</span></div>)}</div> : <p className="field-hint section-actions">No active checkout activity.</p>}
    </section>
  </>;
}
