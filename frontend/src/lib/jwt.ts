export interface AccessTokenClaims {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
  exp: number;
}

// Client-side decode only, never verified here — the access token is opaque
// as far as authorization goes (the BFF verifies every request), this just
// reads claims to drive the UI (who's logged in, which nav items to show).
export function decodeAccessToken(token: string): AccessTokenClaims | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
}

export function isExpired(claims: AccessTokenClaims, skewSeconds = 10): boolean {
  return claims.exp * 1000 <= Date.now() + skewSeconds * 1000;
}
