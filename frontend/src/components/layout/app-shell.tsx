import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context.js';
import { hasAtLeastRole } from '../../lib/roles.js';
import { cn } from '../../lib/cn.js';
import { Button } from '../ui/button.js';
import { ThemeToggle } from './theme-toggle.js';
import { LanguageToggle } from './language-toggle.js';
import { NAV_ITEMS } from './nav-items.js';

export function AppShell({ children }: { children: ReactNode }) {
  const { t } = useTranslation('common');
  const { user, logout } = useAuth();

  const visibleItems = NAV_ITEMS.filter(
    (item) => !item.requiredRole || (user && hasAtLeastRole(user.role, item.requiredRole)),
  );

  return (
    <div className="flex min-h-screen bg-bg">
      <aside className="flex w-60 shrink-0 flex-col border-r border-border bg-surface">
        <div className="flex h-14 items-center px-4 text-base font-semibold text-text">
          {t('appName')}
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 px-2" aria-label="Main">
          {visibleItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cn(
                  'rounded-md px-3 py-2 text-sm font-medium text-text-muted transition-colors',
                  'hover:bg-surface-raised hover:text-text',
                  isActive && 'bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground',
                )
              }
            >
              {t(item.labelKey)}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-3 border-b border-border bg-surface px-4">
          <LanguageToggle />
          <ThemeToggle />
          {user && (
            <div className="flex items-center gap-3 border-l border-border pl-3">
              <span className="text-sm text-text-muted">{user.email}</span>
              <Button variant="outline" size="sm" onClick={() => void logout()}>
                {t('actions.logout')}
              </Button>
            </div>
          )}
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
