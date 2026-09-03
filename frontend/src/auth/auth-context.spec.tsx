import { act, render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { AuthProvider, useAuth } from './auth-context.js';

function makeToken(payload: Record<string, unknown>): string {
  const base64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${base64url({ alg: 'HS256' })}.${base64url(payload)}.sig`;
}

const validClaims = { sub: 'u1', tenantId: 't1', email: 'a@b.c', role: 'Admin', exp: Date.now() / 1000 + 3600 };
const validAccessToken = makeToken(validClaims);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function Probe() {
  const { user, status, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="email">{user?.email ?? ''}</span>
      <button onClick={() => void login('a@b.c', 'pw').catch(() => {})}>login</button>
      <button onClick={() => void logout()}>logout</button>
    </div>
  );
}

describe('AuthProvider', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts unauthenticated when there is no stored refresh token', async () => {
    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
  });

  it('logs in, decodes the access token, and stores the refresh token', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse(200, { accessToken: validAccessToken, refreshToken: 'refresh-1' }));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));

    await act(async () => {
      screen.getByText('login').click();
    });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(screen.getByTestId('email')).toHaveTextContent('a@b.c');
    expect(localStorage.getItem('vibeocpp.refreshToken')).toBe('refresh-1');
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining('/auth/login'),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('resumes a session on mount from a stored refresh token', async () => {
    localStorage.setItem('vibeocpp.refreshToken', 'stored-refresh');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse(200, { accessToken: validAccessToken, refreshToken: 'rotated-refresh' }),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));
    expect(localStorage.getItem('vibeocpp.refreshToken')).toBe('rotated-refresh');
  });

  it('clears the session when the stored refresh token is rejected', async () => {
    localStorage.setItem('vibeocpp.refreshToken', 'stale-refresh');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(401, { message: 'invalid' }));

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(localStorage.getItem('vibeocpp.refreshToken')).toBeNull();
  });

  it('clears local state on logout even if the server call fails', async () => {
    localStorage.setItem('vibeocpp.refreshToken', 'stored-refresh');
    vi.spyOn(globalThis, 'fetch').mockImplementation((input) => {
      const url = String(input);
      if (url.includes('/auth/refresh')) {
        return Promise.resolve(jsonResponse(200, { accessToken: validAccessToken, refreshToken: 'r2' }));
      }
      return Promise.reject(new Error('network down'));
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    await act(async () => {
      screen.getByText('logout').click();
    });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    expect(localStorage.getItem('vibeocpp.refreshToken')).toBeNull();
  });
});
