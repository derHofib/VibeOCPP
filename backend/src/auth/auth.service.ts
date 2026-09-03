import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service.js';
import { PasswordService } from './password.service.js';
import type { AuthenticatedUser, JwtAccessPayload, TokenPair } from './auth.types.js';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_TOKEN_TTL = '30d';

// Refresh tokens are high-entropy signed JWTs already, so a fast hash
// (unlike argon2 for low-entropy passwords) is the right tool: it still
// means a DB leak alone cannot be replayed as a valid token, without the
// cost of a slow KDF on every refresh call.
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly passwordService: PasswordService,
  ) {}

  async validateCredentials(
    tenantId: string,
    email: string,
    plainPassword: string,
  ): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findUnique({
      where: { tenantId_email: { tenantId, email } },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const valid = await this.passwordService.verify(user.passwordHash, plainPassword);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return { id: user.id, tenantId: user.tenantId, email: user.email, role: user.role };
  }

  async issueTokenPair(user: AuthenticatedUser): Promise<TokenPair> {
    const payload: JwtAccessPayload = {
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      expiresIn: ACCESS_TOKEN_TTL,
    });

    const refreshJti = randomUUID();
    const refreshToken = await this.jwtService.signAsync(
      { sub: user.id, jti: refreshJti },
      {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: REFRESH_TOKEN_TTL,
      },
    );

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(refreshToken),
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      },
    });

    return { accessToken, refreshToken };
  }

  // Rotates on every use: the presented refresh token is revoked and a new
  // pair issued, so a stolen-but-unused token can only be replayed once
  // before the legitimate client's next refresh reveals the theft (its own
  // refresh call will then fail because the token was already rotated).
  async refresh(presentedRefreshToken: string): Promise<TokenPair> {
    let userId: string;
    try {
      const decoded = await this.jwtService.verifyAsync<{ sub: string }>(presentedRefreshToken, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
      });
      userId = decoded.sub;
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenHash = hashToken(presentedRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({ where: { tokenHash } });
    if (!stored || stored.revokedAt || stored.expiresAt < new Date() || stored.userId !== userId) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair({
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      role: user.role,
    });
  }

  async revokeRefreshToken(presentedRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(presentedRefreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
