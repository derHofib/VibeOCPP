import { useTranslation } from 'react-i18next';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AppShell } from './components/layout/app-shell.js';
import { ProtectedRoute } from './components/auth/protected-route.js';
import { LoginPage } from './pages/login-page.js';
import { DashboardPage } from './pages/dashboard-page.js';
import { PlaceholderPage } from './pages/placeholder-page.js';
import { UsersPage } from './pages/users-page.js';
import { SettingsPage } from './pages/settings-page.js';
import { OpsPage } from './pages/ops-page.js';
import { TestSuitePage } from './pages/testsuite-page.js';
import { MonitorPage } from './pages/monitor-page.js';
import { StationsPage } from './pages/stations-page.js';

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
                  {/* Stations reads live CitrineOS data via our read-only
                      Hasura mirror (docs/architecture-proposal.md §9/§11
                      decision A, plan in docs/stations-feature-plan.md) —
                      list view only so far (no map/filters yet).
                      Transactions still needs the same treatment. */}
                  <Route path="/stations" element={<StationsPage />} />
                  <Route
                    path="/transactions"
                    element={<PlaceholderPage title={t('nav.transactions')} description={t('nav.transactions')} />}
                  />
                  <Route path="/testsuite" element={<TestSuitePage />} />
                  <Route path="/monitor" element={<MonitorPage />} />
                  <Route
                    path="/users"
                    element={
                      <ProtectedRoute requiredRole="Admin">
                        <UsersPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/settings"
                    element={
                      <ProtectedRoute requiredRole="SuperAdmin">
                        <SettingsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ops"
                    element={
                      <ProtectedRoute requiredRole="SuperAdmin">
                        <OpsPage />
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
