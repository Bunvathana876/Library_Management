import { useId, useMemo, useState } from 'react';
import { Lock, LogIn, Repeat, Search, UserPlus, Users, X } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import type { LoanResponse, Member } from '@/types/api';
import { getInitials } from '@/utils/formatting';

interface MembersPageProps {
  members: Member[];
  activeLoans: LoanResponse[];
  loading: boolean;
  onRegisterMember: () => void;
  onBorrowForMember: (member: Member) => void;
}

export function MembersPage({
  members,
  activeLoans,
  loading,
  onRegisterMember,
  onBorrowForMember,
}: MembersPageProps) {
  const { isAuthenticated, isStaff, openSignInModal } = useAuth();
  const tableCaptionId = useId();
  const [search, setSearch] = useState('');

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
        String(m.id).includes(q),
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
            aria-label="Search members by name, email, or ID"
            placeholder="Search members by name, email, or #ID…"
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

        <button type="button" className="btn btn-primary btn-sm" onClick={onRegisterMember}>
          <UserPlus size={15} aria-hidden="true" />
          <span>Register Member</span>
        </button>
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
                {filteredMembers.length} member{filteredMembers.length === 1 ? '' : 's'} synchronized
                with <code>/api/members</code>
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
                ['--label-2' as string]: '"Email"',
                ['--label-3' as string]: '"Active Loans"',
                ['--label-4' as string]: '"Standing"',
                ['--label-5' as string]: '"Action"',
              }}
            >
              <caption id={tableCaptionId}>
                Registered library members and current loan counts
              </caption>
              <thead>
                <tr>
                  <th scope="col">Member &amp; ID</th>
                  <th scope="col">Email</th>
                  <th scope="col">Active Loans</th>
                  <th scope="col">Standing</th>
                  <th scope="col">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((member) => {
                  const stats = loanStatsByMember.get(member.id) ?? { active: 0, overdue: 0 };
                  return (
                    <tr key={member.id}>
                      <th scope="row">
                        <div className="member-cell">
                          <span className="member-avatar" aria-hidden="true">
                            {getInitials(member.fullName)}
                          </span>
                          <div>
                            <div>{member.fullName}</div>
                            <div className="mono table-subline">Member #{member.id}</div>
                          </div>
                        </div>
                      </th>
                      <td>{member.email}</td>
                      <td className="tabular-nums">{stats.active} active</td>
                      <td>
                        {stats.overdue > 0 ? (
                          <StatusBadge tone="danger">{stats.overdue} Overdue</StatusBadge>
                        ) : stats.active > 0 ? (
                          <StatusBadge tone="info">Borrowing</StatusBadge>
                        ) : (
                          <StatusBadge tone="success">Good Standing</StatusBadge>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onBorrowForMember(member)}
                        >
                          <Repeat size={14} aria-hidden="true" />
                          <span>Borrow Book</span>
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
