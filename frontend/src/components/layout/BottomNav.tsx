import { BookOpen, LayoutDashboard, Repeat, ShieldCheck, Users } from 'lucide-react';
import type { NavTab } from '@/components/layout/Sidebar';
import { useAuth } from '@/context/AuthContext';

interface BottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  counts: {
    books: number;
    activeLoans: number | null;
    overdueLoans: number | null;
  };
}

export function BottomNav({ activeTab, onSelectTab, counts }: BottomNavProps) {
  const { isStaff } = useAuth();

  const items: Array<{
    id: NavTab;
    label: string;
    icon: typeof LayoutDashboard;
    badge?: number | null;
    badgeTone?: 'danger';
  }> = [
    { id: 'overview', label: 'Home', icon: LayoutDashboard },
    { id: 'books', label: 'Books', icon: BookOpen, badge: counts.books > 0 ? counts.books : null },
    {
      id: 'loans',
      label: 'Loans',
      icon: Repeat,
      badge: isStaff ? (counts.overdueLoans && counts.overdueLoans > 0 ? counts.overdueLoans : counts.activeLoans) : null,
      badgeTone: counts.overdueLoans && counts.overdueLoans > 0 ? 'danger' : undefined,
    },
    { id: 'members', label: 'Members', icon: Users },
    { id: 'admin', label: 'Admin', icon: ShieldCheck },
  ];

  return (
    <nav className="bottom-nav" aria-label="Mobile quick navigation">
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
