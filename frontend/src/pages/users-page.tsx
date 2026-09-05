import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createUser, listUsers, setUserActive, type UserRow } from '../api/users.js';
import { useAuth } from '../auth/auth-context.js';
import { ApiError } from '../lib/api-client.js';
import type { Role } from '../lib/roles.js';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card.js';
import { Table, TableBody, TableCell, TableHead, TableHeaderCell, TableRow } from '../components/ui/table.js';
import { StatusBadge } from '../components/ui/status-badge.js';
import { Button } from '../components/ui/button.js';
import { Dialog } from '../components/ui/dialog.js';
import { Input } from '../components/ui/input.js';
import { Label } from '../components/ui/label.js';
import { Select } from '../components/ui/select.js';

// SuperAdmin creates Admin or Mitarbeiter; Admin only creates Mitarbeiter —
// mirrors ALLOWED_TARGET_ROLES in backend/src/users/users.service.ts. Purely
// a UI convenience: the backend re-checks this on every create regardless.
const CREATABLE_ROLES: Record<string, Role[]> = {
  SuperAdmin: ['Admin', 'Mitarbeiter'],
  Admin: ['Mitarbeiter'],
};

function CreateUserDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation('users');
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const creatableRoles = CREATABLE_ROLES[user?.role ?? ''] ?? [];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<Role>(creatableRoles[0] ?? 'Mitarbeiter');
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => createUser({ email, password, role }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setEmail('');
      setPassword('');
      setError(null);
      onClose();
    },
    onError: (err) => {
      setError(err instanceof ApiError && err.status === 409 ? t('errors.conflict') : t('errors.generic'));
    },
  });

  return (
    <Dialog open={open} onClose={onClose} title={t('form.title')}>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate();
        }}
      >
        <div>
          <Label htmlFor="new-user-email">{t('form.email')}</Label>
          <Input
            id="new-user-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="new-user-password">{t('form.password')}</Label>
          <Input
            id="new-user-password"
            type="password"
            required
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <p className="mt-1 text-xs text-text-muted">{t('form.passwordHint')}</p>
        </div>
        <div>
          <Label htmlFor="new-user-role">{t('form.role')}</Label>
          <Select id="new-user-role" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            {creatableRoles.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
        {error && (
          <p role="alert" className="text-sm text-danger">
            {error}
          </p>
        )}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? t('form.submitting') : t('form.submit')}
        </Button>
      </form>
    </Dialog>
  );
}

export function UsersPage() {
  const { t, i18n } = useTranslation('users');
  const { t: tc } = useTranslation('common');
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data, isLoading, isError } = useQuery({ queryKey: ['users'], queryFn: listUsers });

  const toggleActive = useMutation({
    mutationFn: (u: UserRow) => setUserActive(u.id, !u.isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{tc('appName')}</CardDescription>
        </div>
        <Button onClick={() => setDialogOpen(true)}>{t('actions.newUser')}</Button>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-text-muted">{tc('loading')}</p>}
        {isError && <p className="text-sm text-danger">{tc('error.generic')}</p>}
        {data && data.length === 0 && <p className="text-sm text-text-muted">{t('empty')}</p>}
        {data && data.length > 0 && (
          <Table>
            <TableHead>
              <TableRow>
                <TableHeaderCell>{t('table.email')}</TableHeaderCell>
                <TableHeaderCell>{t('table.role')}</TableHeaderCell>
                <TableHeaderCell>{t('table.status')}</TableHeaderCell>
                <TableHeaderCell>{t('table.createdAt')}</TableHeaderCell>
                <TableHeaderCell>{t('table.actions')}</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>{u.email}</TableCell>
                  <TableCell className="font-mono text-xs">{u.role}</TableCell>
                  <TableCell>
                    <StatusBadge tone={u.isActive ? 'success' : 'neutral'}>
                      {u.isActive ? t('status.active') : t('status.inactive')}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>{new Date(u.createdAt).toLocaleDateString(i18n.language)}</TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={toggleActive.isPending}
                      onClick={() => toggleActive.mutate(u)}
                    >
                      {u.isActive ? t('actions.deactivate') : t('actions.activate')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <CreateUserDialog open={dialogOpen} onClose={() => setDialogOpen(false)} />
    </Card>
  );
}
