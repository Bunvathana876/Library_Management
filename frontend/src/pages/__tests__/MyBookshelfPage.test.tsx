import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { MyBookshelfPage } from '@/pages/MyBookshelfPage';
import type { MemberBookshelfResponse } from '@/types/api';

vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'alice@library.local', roles: ['MEMBER'] },
    isAuthenticated: true,
    isRestoring: false,
    isStaff: false,
    isAdmin: false,
    isMember: true,
    remainingSeconds: 1800,
    signInModalOpen: false,
    openSignInModal: vi.fn(),
    closeSignInModal: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
  }),
}));

describe('MyBookshelfPage', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    if (typeof Temporal === 'undefined') {
      return import('temporal-polyfill/global');
    }
  });

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.restoreAllMocks();
  });

  it('displays active loans, blocks renewal when hold is active, and triggers 1-click renewal when eligible', async () => {
    const bookshelf: MemberBookshelfResponse = {
      memberId: 7,
      fullName: 'Alice Reader',
      email: 'alice@library.local',
      activeLoans: [
        {
          id: 101,
          bookId: 1,
          bookTitle: 'Clean Code',
          bookAuthor: 'Robert C. Martin',
          bookIsbn: '9780132350884',
          bookCoverUrl: null,
          memberId: 7,
          memberName: 'Alice Reader',
          borrowedOn: '2026-11-18',
          dueOn: '2026-12-02',
          returnedOn: null,
          overdue: false,
          renewalCount: 0,
          maxRenewals: 2,
          lastRenewedOn: null,
          hasActiveHold: false,
          renewable: true,
          renewDisabledReason: null,
          heldForMemberName: null,
        },
        {
          id: 102,
          bookId: 2,
          bookTitle: 'Designing Data-Intensive Applications',
          bookAuthor: 'Martin Kleppmann',
          bookIsbn: '9781449373320',
          bookCoverUrl: null,
          memberId: 7,
          memberName: 'Alice Reader',
          borrowedOn: '2026-11-12',
          dueOn: '2026-11-28',
          returnedOn: null,
          overdue: false,
          renewalCount: 1,
          maxRenewals: 2,
          lastRenewedOn: '2026-11-15',
          hasActiveHold: true,
          renewable: false,
          renewDisabledReason: 'Blocked by an active hold',
          heldForMemberName: null,
        },
      ],
      returnHistory: [
        {
          id: 90,
          bookId: 3,
          bookTitle: 'Spring in Action',
          bookAuthor: 'Craig Walls',
          bookIsbn: null,
          bookCoverUrl: null,
          memberId: 7,
          memberName: 'Alice Reader',
          borrowedOn: '2026-10-01',
          dueOn: '2026-10-15',
          returnedOn: '2026-10-14',
          overdue: false,
          renewalCount: 0,
          maxRenewals: 2,
          lastRenewedOn: null,
          hasActiveHold: false,
          renewable: false,
          renewDisabledReason: 'Already returned',
          heldForMemberName: null,
        },
      ],
      activeHolds: [
        {
          id: 301,
          bookId: 4,
          bookTitle: 'Effective Java',
          bookAuthor: 'Joshua Bloch',
          bookIsbn: '9780134685991',
          bookCoverUrl: null,
          memberId: 7,
          memberName: 'Alice Reader',
          memberEmail: 'alice@library.local',
          status: 'READY_FOR_PICKUP',
          queuePosition: 0,
          placedAt: '2026-11-20T10:00:00Z',
          readyAt: '2026-11-24T10:00:00Z',
          expiresOn: '2026-11-28',
        },
      ],
      pastHolds: [],
    };

    const onRenewLoan = vi.fn().mockResolvedValue(undefined);
    const onCancelHold = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      root.render(
        <MyBookshelfPage
          bookshelf={bookshelf}
          loading={false}
          errorMsg={null}
          onRetry={vi.fn()}
          onRenewLoan={onRenewLoan}
          onCancelHold={onCancelHold}
          onInspectBook={vi.fn()}
          onBrowseCatalog={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Alice Reader');
    expect(container.textContent).toContain('MEM-0007');
    expect(container.textContent).toContain('1 reserved book is waiting for you at the circulation desk!');
    expect(container.textContent).toContain('Blocked by an active hold');

    const renewButtons = Array.from(container.querySelectorAll('button')).filter((b) =>
      b.textContent?.includes('Renew (+14d)'),
    );
    expect(renewButtons).toHaveLength(2);
    expect(renewButtons[0].disabled).toBe(false);
    expect(renewButtons[1].disabled).toBe(true);

    await act(async () => {
      renewButtons[0].click();
    });
    expect(onRenewLoan).toHaveBeenCalledWith(bookshelf.activeLoans[0]);

    // Switch to Return History tab
    const historyTab = Array.from(container.querySelectorAll('[role="tab"]')).find((t) =>
      t.textContent?.includes('Return History'),
    ) as HTMLButtonElement;
    await act(async () => {
      historyTab.click();
    });
    expect(container.textContent).toContain('Spring in Action');
  });

  it('displays unpaid fines, borrowing block banner, and fine ledger entries', async () => {
    const blockedShelf: MemberBookshelfResponse = {
      memberId: 9,
      fullName: 'Bob Overdue',
      email: 'bob@library.local',
      active: true,
      activeLoanLimit: 5,
      dailyFineRate: 0.5,
      unpaidFinesTotal: 12.5,
      fineBlockThreshold: 10,
      borrowingBlocked: true,
      borrowingBlockReason: 'Unpaid fines ($12.50) reached the $10.00 block threshold',
      activeLoans: [],
      returnHistory: [],
      fineLoans: [
        {
          id: 201,
          bookId: 5,
          copyBarcode: 'CPY-0005-01',
          bookTitle: 'Effective Java',
          bookAuthor: 'Joshua Bloch',
          memberId: 9,
          memberName: 'Bob Overdue',
          borrowedOn: '2026-10-01',
          dueOn: '2026-10-15',
          returnedOn: '2026-11-09',
          overdue: false,
          overdueDays: 25,
          fineAmount: 12.5,
          fineStatus: 'UNPAID',
          renewalCount: 0,
          maxRenewals: 2,
          lastRenewedOn: null,
          hasActiveHold: false,
          renewable: false,
          renewDisabledReason: 'Already returned',
          heldForMemberName: null,
        },
      ],
      activeHolds: [],
      pastHolds: [],
    };

    await act(async () => {
      root.render(
        <MyBookshelfPage
          bookshelf={blockedShelf}
          loading={false}
          errorMsg={null}
          onRetry={vi.fn()}
          onRenewLoan={vi.fn()}
          onCancelHold={vi.fn()}
          onInspectBook={vi.fn()}
          onBrowseCatalog={vi.fn()}
        />,
      );
    });

    expect(container.textContent).toContain('Borrowing & Renewals Restricted');
    expect(container.textContent).toContain('$12.50');

    const historyTab = Array.from(container.querySelectorAll('[role="tab"]')).find((t) =>
      t.textContent?.includes('Return History'),
    ) as HTMLButtonElement;
    await act(async () => {
      historyTab.click();
    });
    expect(container.textContent).toContain('Fine Ledger');
    expect(container.textContent).toContain('Effective Java');
  });
});
