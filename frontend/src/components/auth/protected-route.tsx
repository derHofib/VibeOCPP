import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../auth/auth-context.js';
import { hasAtLeastRole, type Role } from '../../lib/roles.js';
import { useTranslation } from 'react-i18next';

export function ProtectedRoute({
  children,
  requiredRole,
}: {
  children: ReactNode;
  requiredRole?: Role;
}) {
  const { user, status } = useAuth();
  const { t } = useTranslation('common');

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center text-text-muted">
        {t('loading')}
      </div>
    );
  }

  if (status === 'unauthenticated' || !user) {
    return <Navigate to="/login" replace />;
  }

  // Purely a UI convenience (hides nav the user can't act on) — every
  // privileged action is re-checked server-side by the BFF's own RolesGuard
  // regardless, per docs/architecture-proposal.md §6.
  if (requiredRole && !hasAtLeastRole(user.role, requiredRole)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
