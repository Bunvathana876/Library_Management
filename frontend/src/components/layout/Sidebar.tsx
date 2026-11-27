import { useEffect, useRef } from 'react';
import {
  BookmarkCheck,
  BookOpen,
  KeyRound,
  LayoutDashboard,
  LogIn,
  LogOut,
  Repeat,
  ShieldCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { formatRoleLabel, getPrimaryRole } from '@/utils/roles';
import { BrandMark } from '@/components/ui/BrandMark';

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
  onOpenChangePassword?: () => void;
}

interface NavEntry {
  id: NavTab;
  label: string;
  icon: typeof LayoutDashboard;
  count?: number | null;
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
  const { user, isAuthenticated, isStaff, isAdmin, openSignInModal, logout } =
    useAuth();

  const sidebarRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onCloseMobile);
  closeRef.current = onCloseMobile;
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.activeElement as HTMLElement | null;
    const main = document.querySelector<HTMLElement>('.main-column');
    const bottom = document.querySelector<HTMLElement>('.bottom-nav');
    const previousOverflow = document.body.style.overflow;
    if (main) main.inert = true;
    if (bottom) bottom.inert = true;
    document.body.style.overflow = 'hidden';
    sidebarRef.current?.querySelector<HTMLButtonElement>('.drawer-close-btn')?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); closeRef.current(); }
      if (e.key !== 'Tab') return;
      const buttons = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]') ?? [])
        .filter(el => el.getClientRects().length > 0);
      const first = buttons[0], last = buttons.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    const onResize = () => { if (window.innerWidth >= 1024) closeRef.current(); };
    document.addEventListener('keydown', onKeyDown);
    window.addEventListener('resize', onResize);
    return () => {
      if (main) main.inert = false;
      if (bottom) bottom.inert = false;
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('resize', onResize);
      previous?.focus();
    };
  }, [mobileOpen]);

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
          badgeTone: isStaff && counts.overdueLoans && counts.overdueLoans > 0 ? 'danger' : undefined,
        },
        {
          id: 'members',
          label: 'Members',
          icon: Users,
          count: isStaff ? counts.members : null,
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
        ref={sidebarRef}
        role={mobileOpen ? 'dialog' : undefined}
        aria-modal={mobileOpen ? true : undefined}
        id="app-sidebar"
        className="sidebar"
        data-open={mobileOpen ? 'true' : 'false'}
        aria-label="Workspace sidebar"
      >
        <div className="sidebar-top">
          <div className="brand-block">
            <div className="brand-identity">
              <BrandMark size={30} />
              <div>
                <div className="brand-name">Athenaeum</div>
                <div className="brand-tagline">Library & reading room</div>
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
            {navSections.filter(section => section.title === 'Discover' || (section.title === 'Circulation desk' && isStaff) || (section.title === 'Administration' && isAdmin)).map((section) => (
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
                          {item.count !== undefined && item.count !== null ? (
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

        <div className="sidebar-footer">
          {isAuthenticated && user ? (
            <div className="sidebar-user-compact">
              <div className="sidebar-user-row">
                <div className="user-panel-email" title={user.email}>
                  {user.email}
                </div>
              </div>
              <div className="sidebar-user-row">
                <span className="sidebar-user-meta">
                  {formatRoleLabel(primaryRole)}
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
