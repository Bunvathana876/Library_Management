import { LogIn, Menu, Moon, Plus, Repeat, Search, Sun, UserPlus } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import type { NavTab } from '@/components/layout/Sidebar';

interface TopBarProps {
  activeTab: NavTab;
  mobileMenuOpen: boolean;
  onOpenMobileMenu: () => void;
  onQuickSearch: () => void;
  onOpenAddBook: () => void;
  onOpenBorrowBook: () => void;
  onOpenRegisterMember: () => void;
}

const PAGE_TITLES: Record<NavTab, { title: string; subtitle: string }> = {
  overview: {
    title: 'Library Overview',
    subtitle: 'Collection inventory, circulation status, and quick actions',
  },
  books: {
    title: 'Books Catalog',
    subtitle: 'Browse, filter, and manage titles in the collection',
  },
  loans: {
    title: 'Loans & Returns Desk',
    subtitle: 'Active checkouts, overdue alerts, and loan lookup',
  },
  members: {
    title: 'Member Directory',
    subtitle: 'Registered borrowers and active loan standing',
  },
  admin: {
    title: 'Staff & Account Provisioning',
    subtitle: 'Create staff or member accounts and review role permissions',
  },
};

export function TopBar({
  activeTab,
  mobileMenuOpen,
  onOpenMobileMenu,
  onQuickSearch,
  onOpenAddBook,
  onOpenBorrowBook,
  onOpenRegisterMember,
}: TopBarProps) {
  const { isAuthenticated, isStaff, openSignInModal } = useAuth();
  const { renderedScheme, toggleTheme } = useTheme();
  const meta = PAGE_TITLES[activeTab];

  const themeToggleLabel =
    renderedScheme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme';

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="btn btn-secondary btn-icon mobile-nav-trigger"
          onClick={onOpenMobileMenu}
          aria-expanded={mobileMenuOpen}
          aria-label="Open navigation menu"
          aria-controls="app-sidebar"
        >
          <Menu size={18} aria-hidden="true" />
        </button>
        <div>
          <h1 className="topbar-title">{meta.title}</h1>
          <p className="topbar-subtitle">{meta.subtitle}</p>
        </div>
      </div>

      <div className="topbar-actions">
        <button
          type="button"
          className="quick-search-trigger"
          onClick={onQuickSearch}
          aria-label="Jump to catalog search (press slash)"
          title="Jump to catalog search (/)"
        >
          <Search size={15} aria-hidden="true" />
          <span className="quick-search-label">Search catalog</span>
          <kbd className="kbd-hint">/</kbd>
        </button>

        {isStaff && activeTab === 'books' ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenAddBook}>
            <Plus size={16} aria-hidden="true" />
            <span>Add Book</span>
          </button>
        ) : null}

        {isStaff && activeTab === 'loans' ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenBorrowBook}>
            <Repeat size={16} aria-hidden="true" />
            <span>Borrow Book</span>
          </button>
        ) : null}

        {isStaff && activeTab === 'members' ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenRegisterMember}>
            <UserPlus size={16} aria-hidden="true" />
            <span>Register Member</span>
          </button>
        ) : null}

        {!isAuthenticated ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={openSignInModal}>
            <LogIn size={16} aria-hidden="true" />
            <span>Sign In</span>
          </button>
        ) : null}

        <button
          type="button"
          className="btn btn-secondary btn-icon"
          onClick={toggleTheme}
          aria-label={themeToggleLabel}
          title={themeToggleLabel}
        >
          {renderedScheme === 'dark' ? (
            <Sun size={17} aria-hidden="true" />
          ) : (
            <Moon size={17} aria-hidden="true" />
          )}
        </button>
      </div>
    </header>
  );
}
