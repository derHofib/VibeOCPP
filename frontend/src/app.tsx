import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/app-shell.js';
import { ProtectedRoute } from './components/auth/protected-route.js';
import { LoginPage } from './pages/login-page.js';
import { DashboardPage } from './pages/dashboard-page.js';
import { PlaceholderPage } from './pages/placeholder-page.js';

export function App() {
  const { t } = useTranslation('common');

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell>
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route
                    path="/stations"
                    element={<PlaceholderPage title={t('nav.stations')} description={t('nav.stations')} />}
                  />
                  <Route
                    path="/transactions"
                    element={<PlaceholderPage title={t('nav.transactions')} description={t('nav.transactions')} />}
                  />
                  <Route
                    path="/testsuite"
                    element={<PlaceholderPage title={t('nav.testsuite')} description={t('nav.testsuite')} />}
                  />
                  <Route
                    path="/monitor"
                    element={<PlaceholderPage title={t('nav.monitor')} description={t('nav.monitor')} />}
                  />
                  <Route
                    path="/users"
                    element={
                      <ProtectedRoute requiredRole="Admin">
                        <PlaceholderPage title={t('nav.users')} description={t('nav.users')} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute requiredRole="SuperAdmin">
                        <PlaceholderPage title={t('nav.settings')} description={t('nav.settings')} />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ops"
                    element={
                      <ProtectedRoute requiredRole="SuperAdmin">
                        <PlaceholderPage title={t('nav.ops')} description={t('nav.ops')} />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}
