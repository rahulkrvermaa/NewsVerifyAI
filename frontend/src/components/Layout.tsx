import React, { useState } from 'react';
import {
  BookOpen,
  FileSearch,
  History,
  Info,
  LayoutDashboard,
  Menu,
  Moon,
  PlusSquare,
  Settings,
  Sun,
  User,
  X,
} from 'lucide-react';
import type { PageRoute } from '../types';

interface LayoutProps {
  currentPage: PageRoute;
  onNavigate: (page: PageRoute) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS: Array<{ id: PageRoute; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'new-investigation', label: 'New Investigation', icon: PlusSquare },
  { id: 'history', label: 'Investigation History', icon: History },
  { id: 'evidence', label: 'Sources & Evidence', icon: BookOpen },
  { id: 'about', label: 'About the Project', icon: Info },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const PAGE_TITLES: Record<PageRoute, string> = {
  overview: 'Overview',
  'new-investigation': 'New Investigation',
  results: 'Investigation Report',
  history: 'Investigation History',
  evidence: 'Sources & Evidence',
  about: 'About the Project',
  settings: 'Settings',
};

export const Layout: React.FC<LayoutProps> = ({
  currentPage,
  onNavigate,
  theme,
  onToggleTheme,
  children,
}) => {
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleNav = (page: PageRoute) => {
    onNavigate(page);
    setMobileOpen(false);
  };

  const SidebarContent = (
    <div className="flex flex-col h-full bg-[var(--nv-surface)] border-r border-[var(--nv-border)]">
      {/* Masthead */}
      <div className="px-5 py-5 border-b border-[var(--nv-border)]">
        <button
          onClick={() => handleNav('overview')}
          className="text-left group focus:outline-none"
        >
          <div className="flex items-center gap-2">
            <FileSearch className="h-5 w-5 text-[var(--nv-accent)]" />
            <span className="font-serif-editorial text-lg font-bold tracking-tight text-[var(--nv-text)]">
              NewsVerify AI
            </span>
          </div>
          <p className="text-[11px] text-[var(--nv-text-muted)] mt-1 tracking-wide">
            Separate claims from facts.
          </p>
        </button>
      </div>

      {/* Navigation */}
      <nav aria-label="Primary Navigation" className="flex-1 px-3 py-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active =
            currentPage === item.id ||
            (currentPage === 'results' && item.id === 'history');
          return (
            <button
              key={item.id}
              onClick={() => handleNav(item.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm rounded-sm transition-colors text-left ${
                active
                  ? 'bg-[var(--nv-surface-alt)] text-[var(--nv-text)] font-medium border-l-2 border-[var(--nv-accent)]'
                  : 'text-[var(--nv-text-muted)] hover:text-[var(--nv-text)] hover:bg-[var(--nv-surface-alt)]/60'
              }`}
            >
              <Icon className={`h-4 w-4 ${active ? 'text-[var(--nv-accent)]' : ''}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Editorial Footer Note */}
      <div className="px-5 py-4 border-t border-[var(--nv-border)] text-[11px] text-[var(--nv-text-muted)] leading-relaxed">
        <p className="font-medium text-[var(--nv-text)]">Editorial Principle</p>
        <p className="mt-0.5">Every claim needs evidence. Every verdict needs a source.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[var(--nv-bg)] text-[var(--nv-text)]">
      {/* Desktop Fixed Sidebar */}
      <aside className="hidden lg:block w-60 fixed inset-y-0 left-0 z-30 print:hidden">
        {SidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="relative w-64 max-w-[80vw] h-full z-10">
            <button
              onClick={() => setMobileOpen(false)}
              aria-label="Close navigation menu"
              className="absolute top-4 right-3 p-1 text-[var(--nv-text-muted)] hover:text-[var(--nv-text)]"
            >
              <X className="h-4 w-4" />
            </button>
            {SidebarContent}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-60 print:pl-0 flex flex-col min-w-0">
        {/* Compact Top Bar */}
        <header className="sticky top-0 z-20 h-12 bg-[var(--nv-surface)]/95 backdrop-blur-sm border-b border-[var(--nv-border)] px-4 sm:px-6 flex items-center justify-between print:hidden">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-1.5 text-[var(--nv-text-muted)] hover:text-[var(--nv-text)] border border-[var(--nv-border)] rounded-sm"
            >
              <Menu className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2 lg:hidden">
              <FileSearch className="h-4 w-4 text-[var(--nv-accent)]" />
              <span className="font-serif-editorial font-bold text-sm">NewsVerify AI</span>
              <span className="text-[var(--nv-border)]">/</span>
            </div>
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--nv-text-muted)]">
              {PAGE_TITLES[currentPage]}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onToggleTheme}
              aria-label="Toggle color theme"
              title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              className="p-1.5 text-[var(--nv-text-muted)] hover:text-[var(--nv-text)] border border-[var(--nv-border)] rounded-sm transition-colors"
            >
              {theme === 'light' ? <Moon className="h-3.5 w-3.5" /> : <Sun className="h-3.5 w-3.5" />}
            </button>
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 border border-[var(--nv-border)] rounded-sm text-xs text-[var(--nv-text-muted)]"
              title="Researcher Workspace (Local)"
            >
              <User className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Newsroom Desk</span>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-8 py-6 max-w-6xl w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
};
