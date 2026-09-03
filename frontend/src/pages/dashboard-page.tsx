import { useTranslation } from 'react-i18next';
import { useAuth } from '../auth/auth-context.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card.js';

export function DashboardPage() {
  const { t } = useTranslation('common');
  const { user } = useAuth();

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('nav.dashboard')}</CardTitle>
        <CardDescription>{user?.email}</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-text-muted">Coming soon.</CardContent>
    </Card>
  );
}
