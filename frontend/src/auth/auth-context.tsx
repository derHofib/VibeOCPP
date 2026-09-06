import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { publicApiFetch, configureApiClient, ApiError } from '../lib/api-client.js';
import { configureGraphqlClient } from '../lib/graphql-client.js';
import { decodeAccessToken, isExpired, type AccessTokenClaims } from '../lib/jwt.js';

interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'unauthenticated';
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REFRESH_TOKEN_KEY = 'vibeocpp.refreshToken';

function toUser(claims: AccessTokenClaims): AuthUser {
  return { id: claims.sub, tenantId: claims.tenantId, email: claims.email, role: claims.role };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  // Avoids a stampede of parallel refresh calls when several requests 401
  // at once — every caller awaits the same in-flight refresh instead of
  // each starting its own.
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  const clearSession = useCallback(() => {
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    setAccessToken(null);
    setUser(null);
    setStatus('unauthenticated');
  }, []);

  const applyTokenPair = useCallback((tokens: TokenPair) => {
    const claims = decodeAccessToken(tokens.accessToken);
    if (!claims) {
      throw new Error('Received an unreadable access token');
    }
    localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
    setAccessToken(tokens.accessToken);
    setUser(toUser(claims));
    setStatus('authenticated');
  }, []);

  const refreshSession = useCallback(async (): Promise<string | null> => {
    if (refreshInFlight.current) return refreshInFlight.current;

    const run = async () => {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
      if (!refreshToken) {
        clearSession();
        return null;
      }
      try {
        const tokens = await publicApiFetch<TokenPair>('/auth/refresh', {
          method: 'POST',
          body: { refreshToken },
        });
        applyTokenPair(tokens);
        return tokens.accessToken;
      } catch {
        clearSession();
        return null;
      } finally {
        refreshInFlight.current = null;
      }
    };

    refreshInFlight.current = run();
    return refreshInFlight.current;
  }, [applyTokenPair, clearSession]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (accessToken) {
      const claims = decodeAccessToken(accessToken);
      if (claims && !isExpired(claims)) return accessToken;
    }
    return refreshSession();
  }, [accessToken, refreshSession]);

  useEffect(() => {
    configureApiClient({ getAccessToken, onUnauthorized: clearSession });
    configureGraphqlClient({ getAccessToken });
  }, [getAccessToken, clearSession]);

  // On mount: silently try to resume a session from a stored refresh token
  // (e.g. after a page reload) before deciding the user is logged out.
  useEffect(() => {
    if (localStorage.getItem(REFRESH_TOKEN_KEY)) {
      void refreshSession().then((token) => {
        if (!token) setStatus('unauthenticated');
      });
    } else {
      setStatus('unauthenticated');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const tokens = await publicApiFetch<TokenPair>('/auth/login', {
          method: 'POST',
          body: { email, password },
        });
        applyTokenPair(tokens);
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw new ApiError('Login request failed', 0);
      }
    },
    [applyTokenPair],
  );

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    clearSession();
    if (refreshToken) {
      await publicApiFetch('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {
        // Best-effort: the session is already cleared client-side regardless.
      });
    }
  }, [clearSession]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout }),
    [user, status, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
