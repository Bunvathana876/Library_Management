import { useId, useMemo, useState } from 'react';
import {
  History,
  Lock,
  LogIn,
  Pencil,
  QrCode,
  Repeat,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { ModalDialog } from '@/components/ui/ModalDialog';
import { QrCodeCanvas } from '@/components/ui/QrCodeCanvas';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { LoanResponse, Member } from '@/types/api';
import { formatCurrency, formatMemberCardCode, getInitials } from '@/utils/formatting';

interface MembersPageProps {
  members: Member[];
  activeLoans: LoanResponse[];
  loading: boolean;
  onRegisterMember: () => void;
  onEditMember: (member: Member) => void;
  onInspectMember: (member: Member) => void;
  onBorrowForMember: (member: Member) => void;
}

export function MembersPage({
  members,
  activeLoans,
  loading,
  onRegisterMember,
  onEditMember,
  onInspectMember,
  onBorrowForMember,
}: MembersPageProps) {
  const { isAuthenticated, isStaff, openSignInModal } = useAuth();
  const tableCaptionId = useId();
  const [search, setSearch] = useState('');
  const [qrMember, setQrMember] = useState<Member | null>(null);

  const loanStatsByMember = useMemo(() => {
    const map = new Map<number, { active: number; overdue: number }>();
    for (const loan of activeLoans) {
      const current = map.get(loan.memberId) ?? { active: 0, overdue: 0 };
      current.active += 1;
      if (loan.overdue) current.overdue += 1;
      map.set(loan.memberId, current);
    }
    return map;
  }, [activeLoans]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.email.toLowerCase().includes(q) ||
        (m.phone ? m.phone.toLowerCase().includes(q) : false) ||
        String(m.id).includes(q) ||
        formatMemberCardCode(m.id).toLowerCase().includes(q),
    );
  }, [members, search]);

  if (!isStaff) {
    return (
      <EmptyState
        icon={<Lock size={22} />}
        title={isAuthenticated ? 'Staff permissions required' : 'Sign in to view Members'}
        description={
          isAuthenticated
            ? 'Your current role cannot access the member directory. Sign in as LIBRARIAN or ADMIN.'
            : 'Sign in with a LIBRARIAN or ADMIN account to browse registered borrowers and issue library memberships.'
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

  return (
    <>
      <section className="card card-padded toolbar" aria-label="Member directory controls">
        <div className="search-input-wrap">
          <Search size={16} className="search-input-icon" aria-hidden="true" />
          <input
            type="search"
            className="input-control"
            enterKeyHint="search"
            aria-label="Search members by name, email, phone, or card ID"
            placeholder="Search by name, email, phone, or MEM-ID"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              className="search-clear-btn"
              onClick={() => setSearch('')}
              aria-label="Clear member search"
            >
              <X size={15} aria-hidden="true" />
            </button>
          ) : null}
        </div>
      </section>

      {loading && members.length === 0 ? (
        <TableSkeleton rows={4} label="Loading registered members" />
      ) : filteredMembers.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title={search ? 'No matching members' : 'No members registered yet'}
          description={
            search
              ? `No member records matched "${search}".`
              : 'Register your first borrower to start issuing book loans.'
          }
          action={
            search ? (
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSearch('')}>
                Clear Search
              </button>
            ) : (
              <button type="button" className="btn btn-primary btn-sm" onClick={onRegisterMember}>
                <UserPlus size={15} aria-hidden="true" />
                <span>Register Member</span>
              </button>
            )
          }
        />
      ) : (
        <section className="card" aria-label="Registered members table">
          <div className="card-header">
            <div>
              <h2 className="card-title">Registered Borrowers</h2>
              <p className="card-subtitle">
                {filteredMembers.length} registered borrower{filteredMembers.length === 1 ? '' : 's'}
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
                ['--label-2' as string]: '"Contact"',
                ['--label-3' as string]: '"Loans & Fines"',
                ['--label-4' as string]: '"Standing"',
                ['--label-5' as string]: '"Actions"',
              }}
            >
              <caption id={tableCaptionId}>
                Registered library members, borrowing standing, and unpaid fines
              </caption>
              <thead>
                <tr>
                  <th scope="col">Member &amp; ID</th>
                  <th scope="col">Contact</th>
                  <th scope="col">Loans &amp; Fines</th>
                  <th scope="col">Standing</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => {
                  const fallbackStats = loanStatsByMember.get(member.id) ?? { active: 0, overdue: 0 };
                  const activeCount = member.activeLoanCount ?? fallbackStats.active;
                  const overdueCount = member.overdueLoanCount ?? fallbackStats.overdue;
                  const unpaidFines = member.unpaidFinesTotal ?? 0;
                  const isActiveMember = member.active !== false;
                  return (
                    <tr key={member.id}>
                      <th scope="row">
                        <div className="member-cell">
                          <span className="member-avatar" aria-hidden="true">
                            {getInitials(member.fullName)}
                          </span>
                          <div>
                            <div>{member.fullName}</div>
                            <div className="mono table-subline">
                              {formatMemberCardCode(member.id)} · Member #{member.id}
                            </div>
                          </div>
                        </div>
                      </th>
                      <td>
                        <div>{member.email}</div>
                        {member.phone ? <div className="mono table-subline">{member.phone}</div> : null}
                      </td>
                      <td>
                        <div className="tabular-nums">{activeCount}/5 active</div>
                        {unpaidFines > 0 ? (
                          <div className="table-subline" style={{ color: 'var(--danger)' }}>
                            {formatCurrency(unpaidFines)} unpaid
                          </div>
                        ) : null}
                      </td>
                      <td>
                        <div className="form-stack" style={{ gap: '4px', alignItems: 'flex-start' }}>
                          {!isActiveMember ? (
                            <StatusBadge tone="neutral">Inactive</StatusBadge>
                          ) : member.borrowingBlocked ? (
                            <StatusBadge tone="danger">Blocked</StatusBadge>
                          ) : overdueCount > 0 ? (
                            <StatusBadge tone="danger">{overdueCount} Overdue</StatusBadge>
                          ) : activeCount > 0 ? (
                            <StatusBadge tone="info">Borrowing</StatusBadge>
                          ) : (
                            <StatusBadge tone="success">Good Standing</StatusBadge>
                          )}
                          {member.borrowingBlocked && member.borrowingBlockReason ? (
                            <span className="table-subline">{member.borrowingBlockReason}</span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            aria-label={`View history for ${member.fullName}`}
                            onClick={() => onInspectMember(member)}
                          >
                            <History size={14} aria-hidden="true" />
                            <span>History</span>
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon icon-square-btn"
                            aria-label={`Show QR pass for ${member.fullName}`}
                            title="Member QR Pass"
                            onClick={() => setQrMember(member)}
                          >
                            <QrCode size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon icon-square-btn"
                            aria-label={`Edit ${member.fullName}`}
                            title="Edit member"
                            onClick={() => onEditMember(member)}
                          >
                            <Pencil size={14} aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            disabled={!isActiveMember || Boolean(member.borrowingBlocked)}
                            title={member.borrowingBlockReason ?? 'Issue a loan'}
                            aria-label={`Borrow Book for ${member.fullName}`}
                            onClick={() => onBorrowForMember(member)}
                          >
                            <Repeat size={14} aria-hidden="true" />
                            <span>Borrow</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <ModalDialog
        open={qrMember !== null}
        onClose={() => setQrMember(null)}
        size="sm"
        title={qrMember ? qrMember.fullName : 'Member Pass'}
        subtitle={
          qrMember
            ? `${formatMemberCardCode(qrMember.id)} · ${qrMember.email}`
            : undefined
        }
      >
        <div className="modal-body form-stack" style={{ alignItems: 'center', textAlign: 'center' }}>
          {qrMember ? (
            <>
              <QrCodeCanvas
                value={formatMemberCardCode(qrMember.id)}
                size={164}
                label={`Member QR code ${formatMemberCardCode(qrMember.id)}`}
              />
              <p className="field-hint">
                Scan this code in the Circulation Camera Scanner to select{' '}
                <strong>{qrMember.fullName}</strong> during checkout.
              </p>
            </>
          ) : null}
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={() => setQrMember(null)}>
            Close
          </button>
        </div>
      </ModalDialog>
    </>
  );
}
