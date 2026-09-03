import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from '../../auth/auth-context.js';
import { ProtectedRoute } from './protected-route.js';

function makeToken(payload: Record<string, unknown>): string {
  const base64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64url({ alg: 'HS256' })}.${base64url(payload)}.sig`;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<div>login page</div>} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <div>protected content</div>
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin-only"
            element={
              <ProtectedRoute requiredRole="SuperAdmin">
                <div>super admin content</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('redirects to /login when unauthenticated', async () => {
    renderAt('/');
    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
  });

  it('renders protected content once authenticated', async () => {
    localStorage.setItem('vibeocpp.refreshToken', 'stored-refresh');
    const token = makeToken({ sub: 'u1', tenantId: 't1', email: 'a@b.c', role: 'Admin', exp: Date.now() / 1000 + 3600 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { accessToken: token, refreshToken: 'r2' }),
    );

    renderAt('/');
    await waitFor(() => expect(screen.getByText('protected content')).toBeInTheDocument());
  });

  it('redirects away from a role-gated route when the role is insufficient', async () => {
    localStorage.setItem('vibeocpp.refreshToken', 'stored-refresh');
    const token = makeToken({ sub: 'u1', tenantId: 't1', email: 'a@b.c', role: 'Mitarbeiter', exp: Date.now() / 1000 + 3600 });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { accessToken: token, refreshToken: 'r2' }),
    );

    renderAt('/admin-only');
    // Insufficient role redirects to "/", which itself renders fine for any
    // authenticated user — the assertion that matters is that the
    // SuperAdmin-only content never rendered.
    await waitFor(() => expect(screen.getByText('protected content')).toBeInTheDocument());
    expect(screen.queryByText('super admin content')).not.toBeInTheDocument();
  });
});
