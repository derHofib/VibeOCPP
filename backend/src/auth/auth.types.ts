export interface AuthenticatedUser {
  id: string;
  tenantId: string;
  email: string;
  role: string;
}

export interface JwtAccessPayload {
  sub: string;
  tenantId: string;
  email: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}
