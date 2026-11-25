import { useEffect, useId, useRef, useState } from 'react';
import {
  AlertTriangle,
  Clock,
  History,
  Pencil,
  Phone,
  Power,
  Receipt,
  Repeat,
  Trash2,
  X,
} from 'lucide-react';
import { membersApi } from '@/api/membersApi';
import { AccessibleTabs, type TabItem } from '@/components/ui/AccessibleTabs';
import { DetailSkeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useToast } from '@/context/ToastContext';
import type { HoldResponse, LoanResponse, Member, MemberDetailResponse } from '@/types/api';
import { describeLoanSchedule, formatCalendarDate } from '@/utils/dates';
import { formatApiErrorMessage } from '@/utils/errors';
import {
  formatCallNumber,
  formatCurrency,
  formatLoanCode,
  formatMemberCardCode,
} from '@/utils/formatting';

interface MemberHistoryDrawerProps {
  memberId: number | null;
  onClose: () => void;
  onEditMember: (member: Member) => void;
  onBorrowForMember: (member: Member) => void;
  onRequestReturnLoan: (loan: LoanResponse) => void;
  onRenewLoan: (loan: LoanResponse) => Promise<void>;
  onPayFine: (loan: LoanResponse) => Promise<void>;
  onWaiveFine: (loan: LoanResponse) => Promise<void>;
  onCancelHold: (hold: HoldResponse) => Promise<void>;
  onMembersChanged: () => void;
}

type DrawerTab = 'loans' | 'fines' | 'holds' | 'history';

export function MemberHistoryDrawer({
  memberId,
  onClose,
  onEditMember,
  onBorrowForMember,
  onRequestReturnLoan,
  onRenewLoan,
  onPayFine,
  onWaiveFine,
  onCancelHold,
  onMembersChanged,
}: MemberHistoryDrawerProps) {
  const { notify } = useToast();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const tabsPrefix = useId();

  const [detail, setDetail] = useState<MemberDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>('loans');
  const [actionBusy, setActionBusy] = useState(false);

  const loadDetail = async (id: number, signal?: AbortSignal) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await membersApi.getMemberDetail(id, signal);
      if (!signal?.aborted) {
        setDetail(data);
      }
    } catch (err) {
      if (!signal?.aborted) {
        setErrorMsg(formatApiErrorMessage(err));
      }
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (memberId !== null && !dialog.open) {
      dialog.showModal();
    } else if (memberId === null && dialog.open) {
      dialog.close();
    }
  }, [memberId]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onNativeClose = () => onClose();
    dialog.addEventListener('close', onNativeClose);
    return () => dialog.removeEventListener('close', onNativeClose);
  }, [onClose]);

  useEffect(() => {
    if (memberId === null) {
      setDetail(null);
      setDrawerTab('loans');
      return;
    }
    const controller = new AbortController();
    void loadDetail(memberId, controller.signal);
    return () => controller.abort();
  }, [memberId]);

  const toMemberStub = (d: MemberDetailResponse): Member => ({
    id: d.id,
    fullName: d.fullName,
    email: d.email,
    active: d.active,
    phone: d.phone,
    notes: d.notes,
    createdAt: d.createdAt,
    activeLoanCount: d.activeLoanCount,
    overdueLoanCount: d.overdueLoanCount,
    unpaidFinesTotal: d.unpaidFinesTotal,
    borrowingBlocked: d.borrowingBlocked,
    borrowingBlockReason: d.borrowingBlockReason,
  });

  const handleToggleActive = async () => {
    if (!detail) return;
    setActionBusy(true);
    try {
      const updated = await membersApi.updateMemberStatus(detail.id, !detail.active);
      await loadDetail(detail.id);
      onMembersChanged();
      notify({
        variant: 'info',
        title: updated.active ? 'Member reactivated' : 'Member deactivated',
        message: `${updated.fullName} is now ${updated.active ? 'active' : 'inactive'}.`,
      });
    } catch (err) {
      notify({
        variant: 'error',
        title: 'Status update failed',
        message: formatApiErrorMessage(err),
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!detail) return;
    setActionBusy(true);
    try {
      await membersApi.deleteMember(detail.id);
      const removedName = detail.fullName;
      onMembersChanged();
      onClose();
      notify({
        variant: 'success',
        title: 'Member deleted',
        message: `Removed ${removedName} from the directory.`,
      });
    } catch (err) {
      notify({
        variant: 'error',
        title: 'Cannot delete member',
        message: formatApiErrorMessage(err),
      });
    } finally {
      setActionBusy(false);
    }
  };

  const refreshAfterMutation = async (fn: () => Promise<void>) => {
    if (!detail) return;
    setActionBusy(true);
    try {
      await fn();
      await loadDetail(detail.id);
    } finally {
      setActionBusy(false);
    }
  };

  const tabs: ReadonlyArray<TabItem<DrawerTab>> = detail
    ? [
        { id: 'loans', label: 'Loans', count: detail.activeLoans.length, icon: <Repeat size={14} /> },
        { id: 'fines', label: 'Fines', count: detail.fineLoans.length, icon: <Receipt size={14} /> },
        { id: 'holds', label: 'Holds', count: detail.activeHolds.length, icon: <Clock size={14} /> },
        { id: 'history', label: 'History', count: detail.returnHistory.length, icon: <History size={14} /> },
      ]
    : [];

  return (
    <dialog
      ref={dialogRef}
      className="drawer-dialog"
      aria-labelledby={titleId}
      {...({ closedby: 'any' } as Record<string, string>)}
    >
      <div className="drawer-header">
        <div>
          <h2 id={titleId} className="modal-title">
            {detail ? detail.fullName : 'Patron Standing & History'}
          </h2>
          {detail ? (
            <p className="modal-subtitle mono">
              {formatMemberCardCode(detail.id)} · {detail.email}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-icon"
          aria-label="Close patron drawer"
          onClick={onClose}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div className="drawer-body form-stack">
        {loading && !detail ? (
          <DetailSkeleton />
        ) : errorMsg ? (
          <div className="alert alert-danger" role="alert">
            <span>{errorMsg}</span>
          </div>
        ) : detail ? (
          <>
            <div className="drawer-standing-card">
              <div className="queue-row-top">
                <StatusBadge tone={detail.active ? (detail.borrowingBlocked ? 'danger' : 'success') : 'neutral'}>
                  {!detail.active
                    ? 'Inactive'
                    : detail.borrowingBlocked
                      ? 'Borrowing Blocked'
                      : 'Good Standing'}
                </StatusBadge>
                <span className="badge badge-info tabular-nums">
                  {detail.activeLoanCount}/{detail.activeLoanLimit} Active Loans
                </span>
                <span
                  className={`badge ${detail.unpaidFinesTotal > 0 ? 'badge-warning' : 'badge-neutral'} tabular-nums`}
                >
                  Unpaid Fines: {formatCurrency(detail.unpaidFinesTotal)}
                </span>
              </div>

              {detail.borrowingBlocked && detail.borrowingBlockReason ? (
                <div className="alert alert-warning" style={{ marginTop: '0.5rem' }}>
                  <AlertTriangle size={16} aria-hidden="true" className="alert-icon" />
                  <span>{detail.borrowingBlockReason}</span>
                </div>
              ) : null}

              {detail.phone || detail.notes ? (
                <div className="drawer-meta-notes">
                  {detail.phone ? (
                    <div className="table-subline" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={13} aria-hidden="true" />
                      <span className="mono">{detail.phone}</span>
                    </div>
                  ) : null}
                  {detail.notes ? <div className="table-subline">Note: {detail.notes}</div> : null}
                </div>
              ) : null}

              <div className="row-actions" style={{ marginTop: '0.5rem' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!detail.active || detail.borrowingBlocked || actionBusy}
                  onClick={() => {
                    onClose();
                    onBorrowForMember(toMemberStub(detail));
                  }}
                >
                  <Repeat size={14} aria-hidden="true" />
                  <span>Issue Loan</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={actionBusy}
                  onClick={() => {
                    onClose();
                    onEditMember(toMemberStub(detail));
                  }}
                >
                  <Pencil size={14} aria-hidden="true" />
                  <span>Edit Profile</span>
                </button>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  disabled={actionBusy}
                  onClick={() => void handleToggleActive()}
                >
                  <Power size={14} aria-hidden="true" />
                  <span>{detail.active ? 'Deactivate' : 'Reactivate'}</span>
                </button>
                <button
                  type="button"
                  className="btn btn-soft-danger btn-sm"
                  disabled={actionBusy}
                  onClick={() => void handleDelete()}
                >
                  <Trash2 size={14} aria-hidden="true" />
                  <span>Delete</span>
                </button>
              </div>
            </div>

            <AccessibleTabs
              ariaLabel="Patron activity sections"
              tabs={tabs}
              activeTab={drawerTab}
              idPrefix={tabsPrefix}
              onChange={setDrawerTab}
            />

            {drawerTab === 'loans' ? (
              detail.activeLoans.length === 0 ? (
                <p className="text-muted">No active loans for this member.</p>
              ) : (
                <div className="queue-list" style={{ padding: 0 }}>
                  {detail.activeLoans.map((loan) => (
                    <div key={loan.id} className="queue-row">
                      <div className="queue-row-main">
                        <div className="queue-row-top">
                          <span className="catalog-id-badge mono">{formatLoanCode(loan.id)}</span>
                          {loan.copyBarcode ? (
                            <span className="catalog-id-badge mono">{loan.copyBarcode}</span>
                          ) : null}
                          <StatusBadge tone={loan.overdue ? 'danger' : 'info'}>
                            {loan.overdue ? `${loan.overdueDays ?? 0}d Overdue` : 'Active'}
                          </StatusBadge>
                        </div>
                        <div className="queue-row-title">{loan.bookTitle}</div>
                        <div className="queue-row-sub">
                          Due {formatCalendarDate(loan.dueOn)} ·{' '}
                          {describeLoanSchedule(loan.dueOn, loan.returnedOn, loan.overdue)}
                          {(loan.fineAmount ?? 0) > 0
                            ? ` · Accrued fine: ${formatCurrency(loan.fineAmount)}`
                            : ''}
                        </div>
                      </div>
                      <div className="row-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={!loan.renewable || actionBusy}
                          title={loan.renewDisabledReason ?? 'Renew +14d'}
                          onClick={() => void refreshAfterMutation(() => onRenewLoan(loan))}
                        >
                          Renew
                        </button>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={actionBusy}
                          onClick={() => {
                            onClose();
                            onRequestReturnLoan(loan);
                          }}
                        >
                          Return
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : null}

            {drawerTab === 'fines' ? (
              detail.fineLoans.length === 0 ? (
                <p className="text-muted">No overdue fines on record.</p>
              ) : (
                <div className="queue-list" style={{ padding: 0 }}>
                  {detail.fineLoans.map((loan) => (
                    <div key={loan.id} className="queue-row">
                      <div className="queue-row-main">
                        <div className="queue-row-top">
                          <span className="catalog-id-badge mono">{formatLoanCode(loan.id)}</span>
                          <StatusBadge
                            tone={
                              loan.fineStatus === 'UNPAID'
                                ? 'danger'
                                : loan.fineStatus === 'PAID'
                                  ? 'success'
                                  : 'neutral'
                            }
                          >
                            {loan.fineStatus} · {formatCurrency(loan.fineAmount)}
                          </StatusBadge>
                        </div>
                        <div className="queue-row-title">{loan.bookTitle}</div>
                        <div className="queue-row-sub">
                          {loan.returnedOn
                            ? `Returned ${formatCalendarDate(loan.returnedOn)}`
                            : `Still checked out · ${loan.overdueDays ?? 0}d overdue`}
                          {loan.fineNote ? ` · ${loan.fineNote}` : ''}
                        </div>
                      </div>
                      {loan.fineStatus === 'UNPAID' && loan.returnedOn ? (
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={actionBusy}
                            onClick={() => void refreshAfterMutation(() => onPayFine(loan))}
                          >
                            Mark Paid
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            disabled={actionBusy}
                            onClick={() => void refreshAfterMutation(() => onWaiveFine(loan))}
                          >
                            Waive
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              )
            ) : null}

            {drawerTab === 'holds' ? (
              detail.activeHolds.length === 0 && detail.pastHolds.length === 0 ? (
                <p className="text-muted">No active or past holds for this member.</p>
              ) : (
                <div className="queue-list" style={{ padding: 0 }}>
                  {[...detail.activeHolds, ...detail.pastHolds].map((hold) => (
                    <div key={hold.id} className="queue-row">
                      <div className="queue-row-main">
                        <div className="queue-row-top">
                          <span className="catalog-id-badge mono">{formatCallNumber(hold.bookId)}</span>
                          <StatusBadge
                            tone={
                              hold.status === 'READY_FOR_PICKUP' || hold.status === 'FULFILLED'
                                ? 'success'
                                : hold.status === 'WAITING'
                                  ? 'warning'
                                  : 'neutral'
                            }
                          >
                            {hold.status === 'WAITING' ? `Waiting #${hold.queuePosition}` : hold.status}
                          </StatusBadge>
                        </div>
                        <div className="queue-row-title">{hold.bookTitle}</div>
                      </div>
                      {hold.status === 'WAITING' || hold.status === 'READY_FOR_PICKUP' ? (
                        <button
                          type="button"
                          className="btn btn-soft-danger btn-sm"
                          disabled={actionBusy}
                          onClick={() => void refreshAfterMutation(() => onCancelHold(hold))}
                        >
                          Cancel
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
              )
            ) : null}

            {drawerTab === 'history' ? (
              detail.returnHistory.length === 0 ? (
                <p className="text-muted">No returned loans on record yet.</p>
              ) : (
                <div className="queue-list" style={{ padding: 0 }}>
                  {detail.returnHistory.map((loan) => (
                    <div key={loan.id} className="queue-row">
                      <div className="queue-row-main">
                        <div className="queue-row-title">{loan.bookTitle}</div>
                        <div className="queue-row-sub tabular-nums">
                          {formatLoanCode(loan.id)} · Borrowed {formatCalendarDate(loan.borrowedOn)} ·
                          Returned {formatCalendarDate(loan.returnedOn)}
                          {loan.fineStatus && loan.fineStatus !== 'NONE'
                            ? ` · Fine ${formatCurrency(loan.fineAmount)} (${loan.fineStatus})`
                            : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : null}
          </>
        ) : null}
      </div>
    </dialog>
  );
}
