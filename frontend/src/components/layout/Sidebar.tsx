import { useEffect } from 'react';
import {
  BookmarkCheck,
  BookOpen,
  KeyRound,
  LayoutDashboard,
  Lock,
  LogIn,
  LogOut,
  Repeat,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import type { HealthResponse } from '@/types/api';
import { formatDurationSeconds } from '@/utils/dates';
import { formatRoleLabel, getPrimaryRole } from '@/utils/roles';
import { BrandMark } from '@/components/ui/BrandMark';
import { StatusBadge } from '@/components/ui/StatusBadge';

export type NavTab = 'overview' | 'books' | 'bookshelf' | 'loans' | 'members' | 'admin';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  counts: {
    books: number;
    myLoans?: number | null;
    activeLoans: number | null;
    overdueLoans: number | null;
    members: number | null;
  };
  health?: HealthResponse | null;
  healthError?: boolean;
  onRefreshHealth?: () => void;
  onOpenChangePassword?: () => void;
}

interface NavEntry {
  id: NavTab;
  label: string;
  icon: typeof LayoutDashboard;
  count?: number | null;
  locked?: boolean;
  badgeTone?: 'danger';
}

export function Sidebar({
  activeTab,
  onSelectTab,
  mobileOpen,
  onCloseMobile,
  counts,
  onOpenChangePassword,
}: SidebarProps) {
  const { user, isAuthenticated, isStaff, isAdmin, remainingSeconds, openSignInModal, logout } =
    useAuth();

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseMobile();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [mobileOpen, onCloseMobile]);

  const primaryRole = getPrimaryRole(user?.roles);

  const navSections: Array<{ title: string; items: NavEntry[] }> = [
    {
      title: 'Discover',
      items: [
        { id: 'overview', label: 'Overview', icon: LayoutDashboard },
        { id: 'books', label: 'Books Catalog', icon: BookOpen, count: counts.books },
        {
          id: 'bookshelf',
          label: 'My Bookshelf',
          icon: BookmarkCheck,
          count: isAuthenticated ? counts.myLoans : null,
          locked: !isAuthenticated,
        },
      ],
    },
    {
      title: 'Circulation desk',
      items: [
        {
          id: 'loans',
          label: 'Loans & Returns',
          icon: Repeat,
          count: isStaff ? counts.activeLoans : null,
          locked: !isStaff,
          badgeTone: counts.overdueLoans && counts.overdueLoans > 0 ? 'danger' : undefined,
        },
        {
          id: 'members',
          label: 'Members',
          icon: Users,
          count: isStaff ? counts.members : null,
          locked: !isStaff,
        },
      ],
    },
    {
      title: 'Administration',
      items: [
        {
          id: 'admin',
          label: 'Staff & Accounts',
          icon: ShieldCheck,
          locked: !isAdmin,
        },
      ],
    },
  ];

  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    onCloseMobile();
  };

  return (
    <>
      <div
        className="sidebar-backdrop"
        data-open={mobileOpen ? 'true' : 'false'}
        onClick={onCloseMobile}
        aria-hidden="true"
      />
      <aside
        id="app-sidebar"
        className="sidebar"
        data-open={mobileOpen ? 'true' : 'false'}
        aria-label="Workspace sidebar"
      >
        <div className="sidebar-top">
          <div className="brand-block">
            <div className="brand-identity">
              <BrandMark size={40} />
              <div>
                <div className="brand-name">Athenaeum</div>
                <div className="brand-tagline">Library Management</div>
              </div>
            </div>
            <button
              type="button"
              className="btn btn-ghost btn-icon drawer-close-btn"
              onClick={onCloseMobile}
              aria-label="Close navigation menu"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <nav aria-label="Workspace sections">
            {navSections.map((section) => (
              <div key={section.title}>
                <div className="nav-section-label">{section.title}</div>
                <ul className="nav-list">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isCurrent = activeTab === item.id;
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          className="nav-item-btn"
                          aria-current={isCurrent ? 'page' : undefined}
                          onClick={() => handleSelect(item.id)}
                        >
                          <span className="nav-item-left">
                            <Icon size={18} aria-hidden="true" />
                            <span>{item.label}</span>
                          </span>
                          {item.locked ? (
                            <Lock
                              size={14}
                              aria-label="Sign in required"
                              className="nav-lock-icon"
                            />
                          ) : item.count !== undefined && item.count !== null ? (
                            <span
                              className="nav-count"
                              data-tone={item.badgeTone}
                            >
                              {item.count}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </div>

        <div className="sidebar-spacer" aria-hidden="true" />

        <div className="sidebar-illustration" aria-hidden="true">
          <img
            src="/images/sidebar-library.webp"
            alt=""
            width={600}
            height={750}
            loading="lazy"
            decoding="async"
            className="sidebar-illustration-img"
          />
        </div>

        <div className="sidebar-footer">
          {isAuthenticated && user ? (
            <div className="sidebar-user-compact">
              <div className="sidebar-user-row">
                <div className="user-panel-email" title={user.email}>
                  {user.email}
                </div>
                <span className="sidebar-user-timer mono" title="JWT access token time remaining">
                  {formatDurationSeconds(remainingSeconds)}
                </span>
              </div>
              <div className="sidebar-user-row">
                <span className="sidebar-user-meta">
                  <StatusBadge tone={isAdmin ? 'info' : isStaff ? 'success' : 'neutral'} dot={false}>
                    {formatRoleLabel(primaryRole)}
                  </StatusBadge>
                </span>
                <div className="sidebar-footer-actions">
                  {onOpenChangePassword ? (
                    <button
                      type="button"
                      className="sidebar-auth-link"
                      onClick={() => {
                        onOpenChangePassword();
                        onCloseMobile();
                      }}
                      title="Change password"
                    >
                      <KeyRound size={13} aria-hidden="true" />
                      <span>Password</span>
                    </button>
                  ) : null}
                  <button type="button" className="sidebar-auth-link" onClick={logout}>
                    <LogOut size={14} aria-hidden="true" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="sidebar-auth-bar">
              <span className="sidebar-guest-label">Guest catalog</span>
              <button
                type="button"
                className="sidebar-auth-link"
                onClick={openSignInModal}
              >
                <LogIn size={14} aria-hidden="true" />
                <span>Sign In</span>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
