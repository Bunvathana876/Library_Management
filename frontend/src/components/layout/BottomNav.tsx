import { BookmarkCheck, BookOpen, LayoutDashboard, Repeat, ShieldCheck, Users } from 'lucide-react';
import type { NavTab } from '@/components/layout/Sidebar';
import { useAuth } from '@/context/AuthContext';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  counts: {
    books: number;
    myLoans?: number | null;
    activeLoans: number | null;
    overdueLoans: number | null;
  };
}

export function BottomNav({ activeTab, onSelectTab, counts }: BottomNavProps) {
  const { isAuthenticated, isStaff, isAdmin } = useAuth();

  const items: Array<{
    id: NavTab;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number | null;
    badgeTone?: 'danger';
  }> = [
    { id: 'overview', label: 'Home', icon: LayoutDashboard },
    { id: 'books', label: 'Books', icon: BookOpen, badge: null },
    ...(isStaff
      ? [
          {
            id: 'loans' as NavTab,
            label: 'Loans',
            icon: Repeat,
            badge:
              counts.overdueLoans && counts.overdueLoans > 0
                ? counts.overdueLoans
                : null,
            badgeTone: counts.overdueLoans && counts.overdueLoans > 0 ? ('danger' as const) : undefined,
          },
          { id: 'members' as NavTab, label: 'Members', icon: Users },
          isAdmin
            ? { id: 'admin' as NavTab, label: 'Admin', icon: ShieldCheck }
            : {
                id: 'bookshelf' as NavTab,
                label: 'Shelf',
                icon: BookmarkCheck,
                badge: counts.myLoans ?? null,
              },
        ]
      : [
          {
            id: 'bookshelf' as NavTab,
            label: 'Shelf',
            icon: BookmarkCheck,
            badge: isAuthenticated ? (counts.myLoans ?? null) : null,
          },
        ]),
  ];

  return (
    <nav className="bottom-nav" aria-label="Primary mobile navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const current = activeTab === item.id;
        return (
          <button
            key={item.id}
            type="button"
            className="bottom-nav-btn"
            aria-current={current ? 'page' : undefined}
            onClick={() => onSelectTab(item.id)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{item.label}</span>
            {item.badge !== undefined && item.badge !== null && item.badge > 0 ? (
              <span className="bottom-nav-badge" data-tone={item.badgeTone}>
                {item.badge > 99 ? '99+' : item.badge}
              </span>
            ) : null}
          </button>
        );
      })}
    </nav>
  );
}
